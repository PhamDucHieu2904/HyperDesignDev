-- Additive: no changes to projects, media or published revisions.
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL, local_day TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('edge','client')), event TEXT NOT NULL,
  path TEXT NOT NULL, classification TEXT NOT NULL CHECK(classification IN ('human','bot','suspected','unknown')),
  reason TEXT NOT NULL, score INTEGER, status INTEGER NOT NULL DEFAULT 200
);
CREATE INDEX analytics_events_date ON analytics_events(local_day, created_at DESC, id DESC);
CREATE TABLE analytics_daily (
  day TEXT NOT NULL, source TEXT NOT NULL, event TEXT NOT NULL, classification TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, source, event, classification)
);
CREATE TRIGGER analytics_rollup AFTER INSERT ON analytics_events BEGIN
  INSERT INTO analytics_daily(day,source,event,classification,count)
  VALUES(NEW.local_day,NEW.source,NEW.event,NEW.classification,1)
  ON CONFLICT(day,source,event,classification) DO UPDATE SET count=count+1;
END;
CREATE TABLE request_limits (
  key TEXT NOT NULL, window TEXT NOT NULL, count INTEGER NOT NULL, expires_at TEXT NOT NULL,
  PRIMARY KEY(key,window)
);
CREATE TABLE create_requests (
  id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, created_at TEXT NOT NULL, local_day TEXT NOT NULL,
  email TEXT NOT NULL, email_hash TEXT NOT NULL, ip_hash TEXT NOT NULL,
  description TEXT NOT NULL, category TEXT NOT NULL, budget_mode TEXT NOT NULL, budget_text TEXT NOT NULL,
  notification TEXT NOT NULL DEFAULT 'pending' CHECK(notification IN ('pending','sending','sent','failed')),
  notification_attempts INTEGER NOT NULL DEFAULT 0, notified_at TEXT, last_attempt_at TEXT, provider_id TEXT
);
CREATE INDEX create_requests_email_day ON create_requests(local_day,email_hash);
CREATE INDEX create_requests_ip_day ON create_requests(local_day,ip_hash);
CREATE TABLE create_attempts (
  id TEXT PRIMARY KEY, request_id TEXT, created_at TEXT NOT NULL, local_day TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('accepted','blocked')), reason TEXT NOT NULL,
  email_hint TEXT NOT NULL DEFAULT '', email_hash TEXT NOT NULL DEFAULT ''
);
CREATE INDEX create_attempts_date ON create_attempts(local_day,created_at DESC,id DESC);
CREATE TABLE create_daily (
  day TEXT NOT NULL, outcome TEXT NOT NULL, reason TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day,outcome,reason)
);
CREATE TRIGGER create_attempt_rollup AFTER INSERT ON create_attempts BEGIN
  INSERT INTO create_daily(day,outcome,reason,count) VALUES(NEW.local_day,NEW.outcome,NEW.reason,1)
  ON CONFLICT(day,outcome,reason) DO UPDATE SET count=count+1;
END;
