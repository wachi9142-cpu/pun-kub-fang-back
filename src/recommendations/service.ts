import { z } from "zod";
import { env } from "../config";

type Provider = "deepseek" | "gemini" | "openai" | "xai";
type Trace = {
  step: string;
  provider: string;
  model: string;
  latencyMs: number;
};

type Product = {
  id: string;
  slug: string;
  name: string;
  nameEn?: string | null;
  tagline: string;
  price: number;
  emoji: string;
  category: string;
  palette: { foam: string; top: string; bottom: string };
  image?: string | null;
};

type MixOption = {
  id: string;
  label: string;
  labelEn?: string;
  emoji?: string;
  palette?: { foam: string; top: string; bottom: string };
};

type Topping = { nameTh: string; nameEn: string; price: number };

export type RecommendationCatalog = {
  products: Product[];
  bases: MixOption[];
  teas: MixOption[];
  herbals: MixOption[];
  syrups: MixOption[];
  toppings: Topping[];
};

const intentSchema = z.object({
  summary: z.string().min(1),
  budget: z.number().positive().nullable(),
  desired: z.array(z.string()).max(12).default([]),
  flavors: z.array(z.string()).max(12).default([]),
  likelyIngredients: z.array(z.string()).max(12).default([]),
  avoid: z.array(z.string()).max(12).default([]),
});

const mixDraftSchema = z.object({
  mixes: z.array(z.object({
    baseKey: z.string(),
    syrupIds: z.array(z.string()).max(2).default([]),
    toppingNameEn: z.string().nullable().default(null),
    reason: z.string().min(1).max(300),
  })).length(3),
});

const fixedDraftSchema = z.object({
  products: z.array(z.object({
    id: z.string(),
    reason: z.string().min(1).max(300),
  })).length(3),
});

const reviewSchema = z.object({
  summary: z.string().min(1).max(500),
  mixOrder: z.array(z.string()).length(3),
  productOrder: z.array(z.string()).length(3),
});

function extractJson(content: string): unknown {
  const unfenced = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI did not return a JSON object");
  return JSON.parse(unfenced.slice(start, end + 1));
}

async function callStructured<T>(args: {
  step: string;
  provider: Provider;
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
}): Promise<{ value: T; trace: Trace }> {
  let correction = "";
  let lastError = "invalid JSON";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(new URL("/chat", env.AI_GATEWAY_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
      body: JSON.stringify({
        provider: args.provider,
        model: args.model,
        temperature: attempt === 0 ? 0.25 : 0,
        max_tokens: 1600,
        messages: [
          {
            role: "system",
            content: `${args.system}\nตอบเป็น JSON object เท่านั้น ห้ามใช้ markdown ห้ามอธิบายนอก JSON.${correction}`,
          },
          { role: "user", content: args.user },
        ],
      }),
    });
    if (!response.ok) throw new Error(`AI gateway returned ${response.status}`);
    const payload = await response.json() as {
      success?: boolean;
      error?: string;
      data?: { provider?: string; model?: string; content?: string; latency_ms?: number };
    };
    if (!payload.success || !payload.data?.content) {
      throw new Error(payload.error || "AI gateway returned an empty response");
    }
    try {
      const value = args.schema.parse(extractJson(payload.data.content));
      return {
        value,
        trace: {
          step: args.step,
          provider: payload.data.provider || args.provider,
          model: payload.data.model || args.model,
          latencyMs: payload.data.latency_ms || 0,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "invalid JSON";
      correction = `\nคำตอบก่อนหน้าใช้ไม่ได้ (${lastError.slice(0, 250)}) โปรดแก้รูปแบบและส่ง JSON ใหม่ให้ครบ`;
    }
  }
  throw new Error(`AI response validation failed: ${lastError}`);
}

function unique<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export async function recommendDrinks(prompt: string, catalog: RecommendationCatalog) {
  const traces: Trace[] = [];
  const intentCall = await callStructured({
    step: "วิเคราะห์ความต้องการ",
    provider: "deepseek",
    model: "deepseek-chat",
    schema: intentSchema,
    system: "คุณเป็นนักวิเคราะห์ภาษาพูดภาษาไทยของร้านเครื่องดื่ม วิเคราะห์ความหมายเชิงบริบท เช่น ดีด สดชื่น วิ่งๆ เปรี้ยว หวาน อิ่ม โดยไม่อ้างสรรพคุณรักษาโรคและไม่แต่งข้อมูลสินค้า รูปแบบ JSON: {summary:string,budget:number|null,desired:string[],flavors:string[],likelyIngredients:string[],avoid:string[]}",
    user: JSON.stringify({ customerText: prompt }),
  });
  traces.push(intentCall.trace);
  const intent = intentCall.value;
  const budget = Math.min(intent.budget ?? 9999, 10000);

  const baseChoices = [
    ...catalog.bases.map((item) => ({ ...item, key: `base:${item.id}`, kind: "base" })),
    ...catalog.teas.map((item) => ({ ...item, key: `tea:${item.id}`, kind: "tea" })),
    ...catalog.herbals.map((item) => ({ ...item, key: `herbal:${item.id}`, kind: "herbal" })),
  ];
  if (budget < 45) throw new Error("งบต่ำกว่าราคาเริ่มต้นของเมนูมิกซ์ 45 บาท");

  const mixCall = await callStructured({
    step: "ออกแบบสูตรมิกซ์",
    provider: "xai",
    model: "grok-3-mini",
    schema: mixDraftSchema,
    system: "คุณเป็นนักออกแบบเครื่องดื่ม เลือกสูตรจาก ID ที่ให้เท่านั้น ต้องให้ 3 สูตรไม่ซ้ำกันและเข้ากับ intent ราคาเริ่ม 45 บาทต่อฐานแรก ไซรัปฟรี ท็อปปิ้งคิดตามราคา เลือกฐานเดียวต่อสูตรเพื่อคุมราคา ห้ามแต่ง ID รูปแบบ JSON: {mixes:[{baseKey:string,syrupIds:string[],toppingNameEn:string|null,reason:string}]} จำนวน mixes ต้องเท่ากับ 3",
    user: JSON.stringify({ intent, maxPrice: budget, bases: baseChoices.map(({ key, kind, id, label, labelEn }) => ({ key, kind, id, label, labelEn })), syrups: catalog.syrups.map(({ id, label, labelEn }) => ({ id, label, labelEn })), toppings: catalog.toppings }),
  });
  traces.push(mixCall.trace);

  const mixes = unique(mixCall.value.mixes.map((draft, index) => {
    const base = baseChoices.find((item) => item.key === draft.baseKey);
    if (!base) return null;
    const syrups = unique(draft.syrupIds.map((id) => catalog.syrups.find((item) => item.id === id)).filter(Boolean) as MixOption[], (item) => item.id).slice(0, 2);
    const topping = draft.toppingNameEn ? catalog.toppings.find((item) => item.nameEn === draft.toppingNameEn) : undefined;
    const toppingPrice = topping?.nameEn === "Classic Black Tapioca Pearls" ? 0 : topping?.price ?? 0;
    const price = 45 + toppingPrice;
    if (price > budget) return null;
    const id = `mix-${index + 1}-${base.kind}-${base.id}`;
    const flavor = syrups.map((item) => item.label).join(" + ");
    return {
      id,
      name: `${flavor ? `${flavor} ` : ""}${base.label}ปั่น`,
      price,
      reason: draft.reason,
      base: { kind: base.kind, id: base.id, label: base.label, emoji: base.emoji || "🥤" },
      syrups: syrups.map(({ id, label, emoji }) => ({ id, label, emoji: emoji || "✨" })),
      topping: topping ? { nameTh: topping.nameTh, nameEn: topping.nameEn, price: toppingPrice } : null,
      palette: base.palette || { foam: "#fff7ef", top: "#d8b4fe", bottom: "#7e22ce" },
    };
  }).filter(Boolean) as Array<any>, (item) => `${item.base.kind}:${item.base.id}:${item.syrups.map((s: any) => s.id).join(",")}:${item.topping?.nameEn || ""}`);
  if (mixes.length !== 3) throw new Error("AI ไม่สามารถสร้างสูตรมิกซ์ที่ผ่านเงื่อนไขราคาได้ครบ 3 สูตร");

  const affordableProducts = catalog.products.filter((item) => item.price <= budget);
  if (affordableProducts.length < 3) throw new Error("มีเมนูสำเร็จในงบไม่ครบ 3 รายการ");
  const fixedCall = await callStructured({
    step: "คัดเมนูสำเร็จ",
    provider: "openai",
    model: "gpt-4.1-mini",
    schema: fixedDraftSchema,
    system: "คุณเป็นผู้คัดเมนูร้านเครื่องดื่ม เลือกสินค้า 3 รายการที่ต่างกันจาก catalog ตาม intent และคำอธิบายสินค้า ห้ามแต่ง ID ห้ามเปลี่ยนราคา รูปแบบ JSON: {products:[{id:string,reason:string}]} จำนวน products ต้องเท่ากับ 3",
    user: JSON.stringify({ intent, maxPrice: budget, products: affordableProducts.map(({ id, name, nameEn, tagline, price, category }) => ({ id, name, nameEn, tagline, price, category })) }),
  });
  traces.push(fixedCall.trace);
  const fixed = unique(fixedCall.value.products.map((draft) => {
    const product = affordableProducts.find((item) => item.id === draft.id);
    return product ? { ...product, reason: draft.reason } : null;
  }).filter(Boolean) as Array<Product & { reason: string }>, (item) => item.id);
  if (fixed.length !== 3) throw new Error("AI เลือกเมนูสำเร็จที่มีอยู่จริงไม่ครบ 3 รายการ");

  const reviewArgs = {
    step: "ตรวจทานคำแนะนำ",
    schema: reviewSchema,
    system: "คุณเป็นผู้ตรวจทานคำแนะนำเครื่องดื่ม ตรวจว่าตรงคำลูกค้า มี 3 สูตรมิกซ์และ 3 เมนูสำเร็จ อยู่ในงบ ห้ามเพิ่มหรือลบ ID ให้เรียงจากเหมาะที่สุด รูปแบบ JSON: {summary:string,mixOrder:string[],productOrder:string[]}",
    user: JSON.stringify({ customerText: prompt, intent, mixes, products: fixed }),
  };
  let reviewCall;
  try {
    reviewCall = await callStructured({
      ...reviewArgs,
      provider: "deepseek",
      model: "deepseek-v4-flash",
    });
  } catch {
    reviewCall = await callStructured({
      ...reviewArgs,
      provider: "openai",
      model: "gpt-4.1-nano",
    });
  }
  traces.push(reviewCall.trace);
  const orderedMixes = reviewCall.value.mixOrder.map((id) => mixes.find((item) => item.id === id)).filter(Boolean);
  const orderedFixed = reviewCall.value.productOrder.map((id) => fixed.find((item) => item.id === id)).filter(Boolean);
  if (orderedMixes.length !== 3 || orderedFixed.length !== 3) throw new Error("AI ตรวจทานแล้วคืนลำดับไม่ครบ");

  return {
    interpretation: intent,
    summary: reviewCall.value.summary,
    mixes: orderedMixes,
    products: orderedFixed,
    meta: { steps: traces },
  };
}
