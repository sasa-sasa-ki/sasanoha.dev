export type CmsItemStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "archived";

export type CmsItemAction = "publish" | "draft" | "archive";

export type CmsItem = {
  id: string;
  kind: string;
  properties: Record<string, unknown>;
  status: CmsItemStatus;
  createdAt: string;
  updatedAt: string;
  publishAt?: string;
  publishedAt?: string;
  revision: number;
};

export function isCmsItemAction(value: unknown): value is CmsItemAction {
  return value === "publish" || value === "draft" || value === "archive";
}
