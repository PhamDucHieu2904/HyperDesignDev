PRAGMA foreign_keys = ON;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  discipline TEXT NOT NULL CHECK(discipline IN ('design', 'development')),
  sort_order INTEGER NOT NULL UNIQUE
);

INSERT INTO categories (id, label, discipline, sort_order) VALUES
  ('illustrator', 'Brand', 'design', 10),
  ('photoshop', 'Visual', 'design', 20),
  ('blender', '3D', 'design', 30),
  ('game', 'Game', 'development', 40),
  ('web', 'Web', 'development', 50),
  ('app', 'App', 'development', 60)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK(bytes >= 0),
  width INTEGER,
  height INTEGER,
  alt_default TEXT NOT NULL DEFAULT '',
  checksum TEXT,
  state TEXT NOT NULL CHECK(state IN ('pending', 'ready', 'failed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK((width IS NULL AND height IS NULL) OR (width > 0 AND height > 0))
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  draft_meta_json TEXT NOT NULL CHECK(json_valid(draft_meta_json) AND length(draft_meta_json) <= 65536),
  draft_body_json TEXT NOT NULL CHECK(json_valid(draft_body_json) AND length(draft_body_json) <= 524288),
  draft_version INTEGER NOT NULL DEFAULT 1 CHECK(draft_version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE project_revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  source_version INTEGER NOT NULL CHECK(source_version > 0),
  meta_json TEXT NOT NULL CHECK(json_valid(meta_json) AND length(meta_json) <= 65536),
  body_json TEXT NOT NULL CHECK(json_valid(body_json) AND length(body_json) <= 524288),
  schema_version INTEGER NOT NULL CHECK(schema_version >= 1),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, id),
  UNIQUE(project_id, source_version)
);

CREATE TABLE public_projects (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL,
  short_title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  thumbnail_asset_id TEXT NOT NULL REFERENCES media_assets(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0, 1)),
  search_text TEXT NOT NULL,
  content_state TEXT NOT NULL CHECK(content_state IN ('empty', 'ready')),
  published_at TEXT NOT NULL,
  FOREIGN KEY(project_id, revision_id) REFERENCES project_revisions(project_id, id)
);

CREATE TABLE revision_assets (
  revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  PRIMARY KEY(revision_id, asset_id)
);

CREATE TABLE draft_assets (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  PRIMARY KEY(project_id, asset_id)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_sub TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detail_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX public_category_order ON public_projects(category_id, sort_order, project_id);
CREATE INDEX public_featured ON public_projects(is_featured, sort_order, project_id);
CREATE INDEX revision_history ON project_revisions(project_id, created_at DESC);
CREATE INDEX project_updated ON projects(updated_at DESC, id);
CREATE INDEX revision_asset_lookup ON revision_assets(asset_id);
CREATE INDEX draft_asset_lookup ON draft_assets(asset_id);
CREATE INDEX audit_by_entity ON audit_events(entity_type, entity_id, created_at DESC);
