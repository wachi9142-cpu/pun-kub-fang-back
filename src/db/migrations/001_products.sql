CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  name_en VARCHAR(180),
  tagline TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  emoji VARCHAR(32) NOT NULL DEFAULT '🥤',
  category VARCHAR(80) NOT NULL,
  palette JSONB NOT NULL DEFAULT '{"foam":"#fff2f6","top":"#ff9ec0","bottom":"#f0507f"}'::jsonb,
  badge VARCHAR(80),
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  sold_out BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_category_active_idx
  ON products (category, active, sort_order, created_at);

CREATE INDEX IF NOT EXISTS products_popular_active_idx
  ON products (popular, active)
  WHERE popular = TRUE;
