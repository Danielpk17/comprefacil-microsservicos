CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  transaction_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_transaction_idx ON notifications (transaction_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id);
