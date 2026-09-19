CREATE TABLE IF NOT EXISTS content_datasets (
  key VARCHAR(120) PRIMARY KEY,
  label VARCHAR(180) NOT NULL,
  group_name VARCHAR(120) NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_datasets_group_idx
  ON content_datasets (group_name, label);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  order_number VARCHAR(32) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  customer_name VARCHAR(180),
  customer_phone VARCHAR(50),
  note TEXT,
  source VARCHAR(40) NOT NULL DEFAULT 'web',
  item_count INTEGER NOT NULL CHECK (item_count > 0),
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_status_created_idx
  ON orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_key VARCHAR(240) NOT NULL,
  name VARCHAR(240) NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 100),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
