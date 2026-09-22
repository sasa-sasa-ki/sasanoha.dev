import type {
  CmsItem,
  CmsItemAction,
  CmsItemStatus,
} from "./contract.ts";

type D1RunResultLike = {
  meta?: {
    changes?: number;
  };
};

type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T>(): Promise<T | null>;
  run(): Promise<D1RunResultLike>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatementLike;
};

export type ItemStore = {
  get(id: string, now?: Date): Promise<CmsItem | null>;
  applyAction(id: string, action: CmsItemAction, now?: Date): Promise<CmsItem | null>;
};

type StoredItem = {
  id: string;
  kind: string;
  properties_json: string;
  status: CmsItemStatus;
  created_at: string;
  updated_at: string;
  publish_at: string | null;
  published_at: string | null;
  revision: number;
};

function parseProperties(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("cms item properties_json must contain an object");
  }
  return parsed as Record<string, unknown>;
}

function toItem(row: StoredItem): CmsItem {
  return {
    id: row.id,
    kind: row.kind,
    properties: parseProperties(row.properties_json),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.publish_at ? { publishAt: row.publish_at } : {}),
    ...(row.published_at ? { publishedAt: row.published_at } : {}),
    revision: row.revision,
  };
}

function actionState(
  row: StoredItem,
  action: CmsItemAction,
  now: string,
): {
  status: CmsItemStatus;
  publishAt: string | null;
  publishedAt: string | null;
} {
  switch (action) {
    case "publish":
      return {
        status: "published",
        publishAt: null,
        publishedAt: now,
      };
    case "draft":
      return {
        status: "draft",
        publishAt: null,
        publishedAt: row.published_at,
      };
    case "archive":
      return {
        status: "archived",
        publishAt: null,
        publishedAt: row.published_at,
      };
  }
}

async function readRow(
  db: D1DatabaseLike,
  id: string,
): Promise<StoredItem | null> {
  return db
    .prepare(`
      SELECT
        id,
        kind,
        properties_json,
        status,
        created_at,
        updated_at,
        publish_at,
        published_at,
        revision
      FROM cms_items
      WHERE id = ?
    `)
    .bind(id)
    .first<StoredItem>();
}

export function createD1ItemStore(db: D1DatabaseLike): ItemStore {
  return {
    async get(id, now = new Date()) {
      const row = await readRow(db, id);
      if (!row) return null;

      if (
        row.status === "scheduled"
        && row.publish_at
        && Date.parse(row.publish_at) <= now.getTime()
      ) {
        return this.applyAction(id, "publish", now);
      }

      return toItem(row);
    },

    async applyAction(id, action, now = new Date()) {
      const row = await readRow(db, id);
      if (!row) return null;

      const timestamp = now.toISOString();
      const next = actionState(row, action, timestamp);

      const result = await db
        .prepare(`
          UPDATE cms_items
          SET
            status = ?,
            updated_at = ?,
            publish_at = ?,
            published_at = ?,
            revision = revision + 1
          WHERE id = ? AND revision = ?
        `)
        .bind(
          next.status,
          timestamp,
          next.publishAt,
          next.publishedAt,
          id,
          row.revision,
        )
        .run();

      if (result.meta?.changes !== 1) {
        throw new Error("cms item update conflict");
      }

      const updated = await readRow(db, id);
      return updated ? toItem(updated) : null;
    },
  };
}
