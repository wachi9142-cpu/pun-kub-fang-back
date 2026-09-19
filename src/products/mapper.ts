type ProductRow = Record<string, unknown>;

export function toProduct(row: ProductRow) {
  return {
    id: row.slug,
    databaseId: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.nameEn ?? undefined,
    tagline: row.tagline,
    price: Number(row.price),
    likes: Number(row.likes),
    emoji: row.emoji,
    category: row.category,
    palette: row.palette,
    badge: row.badge ?? undefined,
    popular: Boolean(row.popular),
    image: row.imageUrl ?? undefined,
    soldOut: Boolean(row.soldOut),
    active: Boolean(row.active),
    sortOrder: Number(row.sortOrder),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
