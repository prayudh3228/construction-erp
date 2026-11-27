-- Safety nets the application also enforces: identifiers are stored lower-case so lookups are
-- case-insensitive, counters never go negative, and a session cannot end before it started.
ALTER TABLE "users"
  ADD CONSTRAINT "users_username_lowercase" CHECK ("username" = lower("username")),
  ADD CONSTRAINT "users_username_not_blank" CHECK (length(trim("username")) > 0),
  ADD CONSTRAINT "users_email_lowercase" CHECK ("email" IS NULL OR "email" = lower("email")),
  ADD CONSTRAINT "users_failed_login_count_non_negative" CHECK ("failed_login_count" >= 0);

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_expires_after_created" CHECK ("expires_at" > "created_at");
