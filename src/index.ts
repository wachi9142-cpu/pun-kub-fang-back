import path from "node:path";
import { mkdir } from "node:fs/promises";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sign, verify } from "hono/jwt";
import { ZodError } from "zod";
import { env } from "./config";
import { sql } from "./db/client";
import { safeEqual } from "./lib/auth";
import { toProduct } from "./products/mapper";
import { productInputSchema } from "./products/schema";
import {
  contentUpdateSchema,
  orderInputSchema,
  orderStatusSchema,
} from "./content/schema";

type Variables = { admin: { role: "admin" } };
const app = new Hono<{ Variables: Variables }>();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: env.FRONTEND_URL,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  }),
);

app.get("/health", async (c) => {
  await sql`SELECT 1`;
  return c.json({ ok: true, service: "pun-kub-fang-api" });
});

app.get("/uploads/:filename", async (c) => {
  const filename = decodeURIComponent(c.req.param("filename"));
  if (!filename || path.basename(filename) !== filename) return c.notFound();

  const file = Bun.file(path.resolve(env.UPLOAD_DIR, filename));
  if (!(await file.exists())) return c.notFound();
  return new Response(file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

app.get("/api/products", async (c) => {
  const category = c.req.query("category")?.trim();
  const rows = category
    ? await sql`
        SELECT * FROM products
        WHERE active = TRUE AND category = ${category}
        ORDER BY sort_order ASC, created_at ASC
      `
    : await sql`
        SELECT * FROM products
        WHERE active = TRUE
        ORDER BY sort_order ASC, created_at ASC
      `;
  return c.json({ items: rows.map(toProduct) });
});

app.get("/api/site", async (c) => {
  const [datasets, products] = await Promise.all([
    sql`SELECT key, value FROM content_datasets ORDER BY key`,
    sql`
      SELECT * FROM products
      WHERE active = TRUE
      ORDER BY sort_order ASC, created_at ASC
    `,
  ]);
  const data = Object.fromEntries(
    datasets.map((dataset) => [String(dataset.key), dataset.value]),
  );
  data.MENU_ITEMS = products.map(toProduct);
  c.header("Cache-Control", "no-store");
  return c.json({ data });
});

app.post("/api/orders", async (c) => {
  const input = orderInputSchema.parse(await c.req.json());
  const id = crypto.randomUUID();
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const orderNumber = `PKF-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const itemCount = input.items.reduce((sum, item) => sum + item.qty, 0);
  const total = input.items.reduce((sum, item) => sum + item.price * item.qty, 0);

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO orders (
        id, order_number, customer_name, customer_phone, note,
        source, item_count, total
      ) VALUES (
        ${id}, ${orderNumber}, ${input.customerName ?? null},
        ${input.customerPhone ?? null}, ${input.note ?? null},
        ${input.source}, ${itemCount}, ${total}
      )
    `;
    for (const item of input.items) {
      await tx`
        INSERT INTO order_items (
          id, order_id, item_key, name, unit_price,
          quantity, options, line_total
        ) VALUES (
          ${crypto.randomUUID()}, ${id}, ${item.id}, ${item.name},
          ${item.price}, ${item.qty}, ${tx.json(item.options)},
          ${item.price * item.qty}
        )
      `;
    }
  });

  return c.json(
    { order: { id, orderNumber, status: "new", itemCount, total } },
    201,
  );
});

app.post("/api/admin/login", async (c) => {
  const body: { password?: string } = await c.req
    .json<{ password?: string }>()
    .catch(() => ({}));
  if (!body.password || !safeEqual(body.password, env.ADMIN_PASSWORD)) {
    return c.json({ message: "รหัสผ่านไม่ถูกต้อง" }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: "admin", role: "admin", iat: now, exp: now + 60 * 60 * 8 },
    env.JWT_SECRET,
    "HS256",
  );
  return c.json({ token, expiresIn: 60 * 60 * 8 });
});

app.use("/api/admin/*", async (c, next) => {
  const authorization = c.req.header("Authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!token) return c.json({ message: "กรุณาเข้าสู่ระบบ" }, 401);

  try {
    const payload = await verify(token, env.JWT_SECRET, "HS256");
    if (payload.role !== "admin") throw new Error("Invalid role");
    c.set("admin", { role: "admin" });
    await next();
  } catch {
    return c.json({ message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" }, 401);
  }
});

app.get("/api/admin/products", async (c) => {
  const rows = await sql`
    SELECT * FROM products
    ORDER BY active DESC, sort_order ASC, created_at ASC
  `;
  return c.json({ items: rows.map(toProduct) });
});

app.get("/api/admin/content", async (c) => {
  const rows = await sql`
    SELECT key, label, group_name, value, updated_at
    FROM content_datasets
    ORDER BY group_name, label
  `;
  return c.json({ items: rows });
});

app.put("/api/admin/content/:key", async (c) => {
  const input = contentUpdateSchema.parse(await c.req.json());
  const [row] = await sql`
    UPDATE content_datasets
    SET value = ${sql.json(input.value)}, updated_at = NOW()
    WHERE key = ${c.req.param("key")}
    RETURNING key, label, group_name, value, updated_at
  `;
  if (!row) return c.json({ message: "ไม่พบชุดข้อมูล" }, 404);
  return c.json({ item: row });
});

app.get("/api/admin/orders", async (c) => {
  const status = c.req.query("status")?.trim();
  const rows = status
    ? await sql`
        SELECT o.*,
          COALESCE(json_agg(json_build_object(
            'id', oi.id,
            'itemKey', oi.item_key,
            'name', oi.name,
            'unitPrice', oi.unit_price,
            'quantity', oi.quantity,
            'options', oi.options,
            'lineTotal', oi.line_total
          ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status = ${status}
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `
    : await sql`
        SELECT o.*,
          COALESCE(json_agg(json_build_object(
            'id', oi.id,
            'itemKey', oi.item_key,
            'name', oi.name,
            'unitPrice', oi.unit_price,
            'quantity', oi.quantity,
            'options', oi.options,
            'lineTotal', oi.line_total
          ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `;
  return c.json({ items: rows });
});

app.put("/api/admin/orders/:id/status", async (c) => {
  const input = orderStatusSchema.parse(await c.req.json());
  const [row] = await sql`
    UPDATE orders
    SET status = ${input.status}, updated_at = NOW()
    WHERE id = ${c.req.param("id")}
    RETURNING *
  `;
  if (!row) return c.json({ message: "ไม่พบออเดอร์" }, 404);
  return c.json({ order: row });
});

app.delete("/api/admin/orders/:id", async (c) => {
  const [row] = await sql`
    DELETE FROM orders WHERE id = ${c.req.param("id")} RETURNING id
  `;
  if (!row) return c.json({ message: "ไม่พบออเดอร์" }, 404);
  return c.json({ ok: true });
});

app.post("/api/admin/products", async (c) => {
  const input = productInputSchema.parse(await c.req.json());
  const id = crypto.randomUUID();
  const [row] = await sql`
    INSERT INTO products (
      id, slug, name, name_en, tagline, price, likes, emoji, category,
      palette, badge, popular, image_url, sold_out, active, sort_order
    ) VALUES (
      ${id}, ${input.slug}, ${input.name}, ${input.nameEn ?? null},
      ${input.tagline}, ${input.price}, ${input.likes}, ${input.emoji},
      ${input.category}, ${sql.json(input.palette)}, ${input.badge ?? null},
      ${input.popular}, ${input.imageUrl ?? null}, ${input.soldOut},
      ${input.active}, ${input.sortOrder}
    )
    RETURNING *
  `;
  return c.json({ item: toProduct(row) }, 201);
});

app.put("/api/admin/products/:id", async (c) => {
  const input = productInputSchema.parse(await c.req.json());
  const [row] = await sql`
    UPDATE products SET
      slug = ${input.slug},
      name = ${input.name},
      name_en = ${input.nameEn ?? null},
      tagline = ${input.tagline},
      price = ${input.price},
      likes = ${input.likes},
      emoji = ${input.emoji},
      category = ${input.category},
      palette = ${sql.json(input.palette)},
      badge = ${input.badge ?? null},
      popular = ${input.popular},
      image_url = ${input.imageUrl ?? null},
      sold_out = ${input.soldOut},
      active = ${input.active},
      sort_order = ${input.sortOrder},
      updated_at = NOW()
    WHERE id = ${c.req.param("id")}
    RETURNING *
  `;
  if (!row) return c.json({ message: "ไม่พบสินค้า" }, 404);
  return c.json({ item: toProduct(row) });
});

app.delete("/api/admin/products/:id", async (c) => {
  const [row] = await sql`
    DELETE FROM products WHERE id = ${c.req.param("id")} RETURNING id
  `;
  if (!row) return c.json({ message: "ไม่พบสินค้า" }, 404);
  return c.json({ ok: true });
});

app.post("/api/admin/uploads", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return c.json({ message: "กรุณาเลือกไฟล์รูป" }, 400);
  }

  const extensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  const extension = extensions[file.type];
  if (!extension) {
    return c.json({ message: "รองรับเฉพาะ JPG, PNG, WebP และ GIF" }, 400);
  }
  if (file.size > env.MAX_UPLOAD_MB * 1024 * 1024) {
    return c.json({ message: `รูปต้องไม่เกิน ${env.MAX_UPLOAD_MB} MB` }, 400);
  }

  await mkdir(env.UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}${extension}`;
  await Bun.write(path.resolve(env.UPLOAD_DIR, filename), file);
  return c.json({ url: `${env.PUBLIC_URL.replace(/\/$/, "")}/uploads/${filename}` }, 201);
});

app.notFound((c) => c.json({ message: "Not found" }, 404));
app.onError((error, c) => {
  console.error(error);
  if (error instanceof ZodError) {
    return c.json(
      { message: "ข้อมูลไม่ถูกต้อง", issues: error.issues },
      400,
    );
  }
  if ((error as { code?: string }).code === "23505") {
    return c.json({ message: "slug นี้ถูกใช้แล้ว กรุณาเปลี่ยน slug" }, 409);
  }
  return c.json({ message: "เกิดข้อผิดพลาดภายในระบบ" }, 500);
});

Bun.serve({ port: env.PORT, fetch: app.fetch });
console.info(`Pun Kub Fang API running on ${env.PUBLIC_URL}`);
