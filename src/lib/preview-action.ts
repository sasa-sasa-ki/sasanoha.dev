export type PreviewStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "archived";

export type PreviewAction = "publish" | "draft" | "archive";

export type PreviewItem = {
  id: string;
  kind: string;
  properties: Record<string, unknown>;
  status: PreviewStatus;
  createdAt: string;
  updatedAt: string;
  publishAt?: string;
  publishedAt?: string;
  revision: number;
};

function isPreviewStatus(value: unknown): value is PreviewStatus {
  return value === "draft"
    || value === "scheduled"
    || value === "published"
    || value === "archived";
}

function parsePreviewItem(value: unknown): PreviewItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("preview API returned an invalid item");
  }

  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string"
    || typeof item.kind !== "string"
    || !item.properties
    || typeof item.properties !== "object"
    || Array.isArray(item.properties)
    || !isPreviewStatus(item.status)
    || typeof item.createdAt !== "string"
    || typeof item.updatedAt !== "string"
    || typeof item.revision !== "number"
  ) {
    throw new Error("preview API returned an invalid item");
  }

  return item as PreviewItem;
}

/**
 * reference-only UIで使う、永続化を伴わない状態遷移です。
 */
export function nextPreviewStatus(
  _status: PreviewStatus,
  action: PreviewAction,
): PreviewStatus {
  switch (action) {
    case "publish":
      return "published";
    case "draft":
      return "draft";
    case "archive":
      return "archived";
  }
}

export async function fetchPreviewItem(
  endpoint: string,
  fetcher: typeof fetch = fetch,
): Promise<PreviewItem> {
  const response = await fetcher(endpoint, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`preview item fetch failed: ${response.status}`);
  }

  return parsePreviewItem(await response.json());
}

/**
 * preview panelからCMS APIへ最小action contractを送ります。
 *
 * endpointはitem単位のaction URLを想定し、
 * JSON body { action }、responseは更新後itemを契約とします。
 */
export async function sendPreviewAction(
  endpoint: string,
  action: PreviewAction,
  fetcher: typeof fetch = fetch,
): Promise<PreviewItem> {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    throw new Error(`preview action failed: ${response.status}`);
  }

  return parsePreviewItem(await response.json());
}
