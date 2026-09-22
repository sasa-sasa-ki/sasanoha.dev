export type PreviewStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "archived";

export type PreviewAction = "publish" | "draft" | "archive";

export type PreviewActionResult = {
  status: PreviewStatus;
};

/**
 * reference-only UIで使う、永続化を伴わない状態遷移です。
 *
 * 実CMS接続時はsendPreviewActionを利用し、最終状態はAPI応答を正とします。
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

function isPreviewStatus(value: unknown): value is PreviewStatus {
  return value === "draft"
    || value === "scheduled"
    || value === "published"
    || value === "archived";
}

/**
 * preview panelからCMS APIへ最小action contractを送ります。
 *
 * endpointはitem単位のaction URLを想定し、
 * JSON body { action }、response { status } を契約とします。
 */
export async function sendPreviewAction(
  endpoint: string,
  action: PreviewAction,
  fetcher: typeof fetch = fetch,
): Promise<PreviewActionResult> {
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

  const body = await response.json() as { status?: unknown };
  if (!isPreviewStatus(body.status)) {
    throw new Error("preview action returned an invalid status");
  }

  return { status: body.status };
}
