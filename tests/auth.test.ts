import { describe, expect, test } from "bun:test";
import { safeEqual } from "../src/lib/auth";

describe("safeEqual", () => {
  test("accepts equal values", () => expect(safeEqual("secret123", "secret123")).toBe(true));
  test("rejects different values", () => expect(safeEqual("secret123", "secret456")).toBe(false));
  test("rejects different lengths", () => expect(safeEqual("short", "much-longer")).toBe(false));
});
