import { describe, expect, test } from "bun:test";
import { contentUpdateSchema, orderInputSchema, orderStatusSchema, recommendationRequestSchema } from "../src/content/schema";

describe("CMS and order schemas", () => {
  test("accepts JSON content values", () => {
    expect(contentUpdateSchema.parse({ value: [{ id: "tea", price: 35 }] }).value).toHaveLength(1);
  });

  test("calculates with validated order lines", () => {
    const input = orderInputSchema.parse({
      items: [{ id: "tea-หวานน้อย", name: "ชาไทย", price: 35, qty: 2, options: ["หวานน้อย"] }],
    });
    expect(input.items[0].price * input.items[0].qty).toBe(70);
  });

  test("rejects unsupported order status", () => {
    expect(() => orderStatusSchema.parse({ status: "refunded" })).toThrow();
  });

  test("accepts a customer recommendation prompt", () => {
    expect(recommendationRequestSchema.parse({ prompt: "  อยากได้เปรี้ยวสดชื่น งบ 50  " }).prompt).toBe("อยากได้เปรี้ยวสดชื่น งบ 50");
  });

  test("rejects oversized recommendation prompts", () => {
    expect(() => recommendationRequestSchema.parse({ prompt: "x".repeat(501) })).toThrow();
  });
});
