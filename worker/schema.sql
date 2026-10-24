-- PhoneCam ratings and testimonials (Cloudflare D1)
-- Apply with: npx wrangler d1 execute phonecam --remote --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  -- The person ticked "Show my comment on the website"
  public_ok INTEGER NOT NULL DEFAULT 0,
  -- You set this to 1 after reading the comment. Only approved, public comments are shown.
  approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Hash of the visitor's network address and the day, so one person can rate once a day.
  -- The address itself is never stored.
  visitor_day TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS feedback_shown ON feedback (approved, public_ok, created_at);
