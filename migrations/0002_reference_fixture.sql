INSERT OR IGNORE INTO cms_items (
  id,
  kind,
  properties_json,
  status,
  created_at,
  updated_at,
  publish_at,
  published_at,
  revision
) VALUES (
  'reference-work',
  'work',
  '{"description":"公開前の制作物","producedAt":"2026-09-18"}',
  'scheduled',
  '2026-09-22T03:00:00.000Z',
  '2026-09-22T03:00:00.000Z',
  '2026-10-01T09:00:00.000Z',
  NULL,
  1
);
