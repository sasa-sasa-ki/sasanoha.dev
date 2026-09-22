CREATE TABLE IF NOT EXISTS cms_items (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  properties_json TEXT NOT NULL CHECK (json_valid(properties_json)),
  status TEXT NOT NULL CHECK (
    status IN ('draft', 'scheduled', 'published', 'archived')
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  publish_at TEXT,
  published_at TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS cms_items_type_status_idx
  ON cms_items (item_type, status);

INSERT OR IGNORE INTO cms_items (
  id,
  item_type,
  properties_json,
  status,
  created_at,
  updated_at,
  publish_at,
  published_at,
  updated_by
) VALUES (
  'reference-work',
  'work',
  '{"description":"公開前の制作物","producedAt":"2026-09-18"}',
  'scheduled',
  '2026-09-22T03:00:00.000Z',
  '2026-09-22T03:00:00.000Z',
  '2026-10-01T09:00:00.000Z',
  NULL,
  NULL
);
