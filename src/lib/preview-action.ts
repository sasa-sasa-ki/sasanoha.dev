export type PreviewStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "archived";

export type PreviewAction = "publish" | "draft" | "archive";

export type PreviewActionResult = {
  status: PreviewStatus;
};

function isPreviewStatus(value: unknown): value is PreviewStatus {
  return value === "draft"
    || value === "scheduled"
    || value === "published"
    || value === "archived";
}

async function readStatus(response: Response): Promise<PreviewActionResult> {
  if (!response.ok) {
    throw new Error(`preview API failed: ${response.status}`);
  }

  const body = await response.json() as { status?: unknown };
  if (!isPreviewStatus(body.status)) {
    throw new Error("preview API returned an invalid status");
  }

  return { status: body.status };
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

/**
 * D1-backed CMS APIから現在のitem状態を読みます。
 */
export async function loadPreviewStatus(
  endpoint: string,
  fetcher: typeof fetch = fetch,
): Promise<PreviewActionResult> {
  return readStatus(
    await fetcher(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    }),
  );
}

/**
 * preview panelからCMS APIへ最小action contractを送ります。
 */
export async function sendPreviewAction(
  endpoint: string,
  action: PreviewAction,
  fetcher: typeof fetch = fetch,
): Promise<PreviewActionResult> {
  return readStatus(
    await fetcher(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ action }),
    }),
  );
}
