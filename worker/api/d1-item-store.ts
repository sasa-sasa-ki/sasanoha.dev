import type {
  ItemAction,
  ItemStatus,
  ItemStore,
  StoredItemState,
} from "./contracts.ts";

type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type D1DatabaseLike = {
  prepare(sql: string): D1PreparedStatementLike;
};

type ItemRow = {
  id: string;
  status: ItemStatus;
  updated_at: string;
  publish_at: string | null;
  published_at: string | null;
};

function rowToState(row: ItemRow): StoredItemState {
  return {
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at,
    ...(row.publish_at ? { publishAt: row.publish_at } : {}),
    ...(row.published_at ? { publishedAt: row.published_at } : {}),
  };
}

/**
 * sasanoha.dev reference instance用の最小D1 adapterです。
 *
 * schemaやUIの意味は外へ漏らさず、itemの状態だけを永続化します。
 */
export class D1ItemStore implements ItemStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async get(id: string): Promise<StoredItemState | null> {
    const row = await this.db
      .prepare(
        `SELECT
          id,
          status,
          updated_at,
          publish_at,
          published_at
        FROM cms_items
        WHERE id = ?1
        LIMIT 1`,
      )
      .bind(id)
      .first<ItemRow>();

    return row ? rowToState(row) : null;
  }

  async applyAction(
    id: string,
    action: ItemAction,
    actorEmail: string,
    now: Date,
  ): Promise<StoredItemState | null> {
    const current = await this.get(id);
    if (!current) return null;

    const updatedAt = now.toISOString();

    const next: StoredItemState =
      action === "publish"
        ? {
            ...current,
            status: "published",
            updatedAt,
            publishedAt: updatedAt,
          }
        : {
            ...current,
            status: action === "draft" ? "draft" : "archived",
            updatedAt,
          };

    delete next.publishAt;

    await this.db
      .prepare(
        `UPDATE cms_items
        SET
          status = ?1,
          updated_at = ?2,
          publish_at = NULL,
          published_at = ?3,
          updated_by = ?4
        WHERE id = ?5`,
      )
      .bind(
        next.status,
        next.updatedAt,
        next.publishedAt ?? null,
        actorEmail,
        id,
      )
      .run();

    return next;
  }
}
