CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  order_number TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions (user_id);

CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY,
  routing_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS outbox_unpublished_idx ON outbox (created_at) WHERE published_at IS NULL;
