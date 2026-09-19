import seedProducts from "./seed-products.json";
import { sql } from "./client";

for (const product of seedProducts) {
  await sql`
    INSERT INTO products (
      id, slug, name, name_en, tagline, price, likes, emoji, category,
      palette, badge, popular, image_url, sold_out, active, sort_order
    ) VALUES (
      ${crypto.randomUUID()}, ${product.slug}, ${product.name},
      ${product.nameEn}, ${product.tagline}, ${product.price}, ${product.likes},
      ${product.emoji}, ${product.category}, ${sql.json(product.palette)},
      ${product.badge}, ${product.popular}, ${product.imageUrl},
      ${product.soldOut}, ${product.active}, ${product.sortOrder}
    )
    ON CONFLICT (slug) DO NOTHING
  `;
}

await sql.end();
console.info(`Seeded ${seedProducts.length} products (existing slugs were kept)`);
