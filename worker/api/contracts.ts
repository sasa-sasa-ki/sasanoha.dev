export type ItemStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "archived";

export type ItemAction = "publish" | "draft" | "archive";

export type StoredItemState = {
  id: string;
  status: ItemStatus;
  updatedAt: string;
  publishAt?: string;
  publishedAt?: string;
};

export type ItemStore = {
  get(id: string): Promise<StoredItemState | null>;
  applyAction(
    id: string,
    action: ItemAction,
    actorEmail: string,
    now: Date,
  ): Promise<StoredItemState | null>;
};

/**
 * sasanohaCMS CoreのPreview/Admin action vocabularyと同じ3操作です。
 *
 * @remarks
 * @sasanoha/cmsがexternal consumerから利用可能になるまでは、
 * reference instance側でtransport contractだけを小さくmirroringします。
 */
export function isItemAction(value: unknown): value is ItemAction {
  return value === "publish" || value === "draft" || value === "archive";
}
