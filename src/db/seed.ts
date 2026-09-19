import seedProducts from "./seed-products.json";
import contentDatasets from "./content-seed.json";
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

for (const dataset of contentDatasets) {
  await sql`
    INSERT INTO content_datasets (key, label, group_name, value)
    VALUES (${dataset.key}, ${dataset.label}, ${dataset.group}, ${sql.json(dataset.value)})
    ON CONFLICT (key) DO NOTHING
  `;
}

await sql.end();
console.info(
  `Seeded ${seedProducts.length} products and ${contentDatasets.length} CMS datasets (existing data was kept)`,
);
