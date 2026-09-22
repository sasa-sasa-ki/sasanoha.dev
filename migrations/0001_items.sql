CREATE TABLE cms_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  properties_json TEXT NOT NULL CHECK (json_valid(properties_json)),
  status TEXT NOT NULL
    CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  publish_at TEXT,
  published_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1)
);

CREATE INDEX cms_items_kind_status_idx
  ON cms_items (kind, status);

CREATE INDEX cms_items_publish_at_idx
  ON cms_items (publish_at)
  WHERE publish_at IS NOT NULL;
