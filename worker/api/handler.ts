import {
  isCmsItemAction,
  type CmsItemAction,
} from "./contract.ts";
import type { ItemStore } from "./store.ts";

type AccessIdentityLike = {
  email?: string;
  name?: string;
  groups?: string[];
};

type AccessContextLike = {
  aud: string;
  getIdentity(): Promise<AccessIdentityLike | null>;
};

export type ApiExecutionContextLike = {
  access?: AccessContextLike;
};

function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function itemPath(pathname: string): {
  id: string;
  action: boolean;
} | null {
  const match = /^\/admin\/api\/items\/([^/]+)(\/action)?$/.exec(pathname);
  if (!match) return null;

  return {
    id: decodeURIComponent(match[1]!),
    action: Boolean(match[2]),
  };
}

async function readAction(request: Request): Promise<CmsItemAction | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return null;
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return null;
  }

  const body = await request.json() as { action?: unknown };
  return isCmsItemAction(body.action) ? body.action : null;
}

/**
 * Accessで認証・許可されたrequestだけをCMS write/read APIへ通します。
 *
 * @remarks
 * Access policyがauthorizationを担当し、このhandlerはctx.accessが無い経路を
 * fail-closedで拒否します。独自password/sessionは持ちません。
 */
export async function handleApiRequest(
  request: Request,
  ctx: ApiExecutionContextLike,
  store: ItemStore,
  now = new Date(),
): Promise<Response> {
  if (!ctx.access) {
    return json({ error: "access_required" }, 403);
  }

  const identity = await ctx.access.getIdentity();
  if (!identity?.email) {
    return json({ error: "identity_required" }, 403);
  }

  const url = new URL(request.url);
  const route = itemPath(url.pathname);
  if (!route) {
    return json({ error: "not_found" }, 404);
  }

  if (!route.action && request.method === "GET") {
    const item = await store.get(route.id, now);
    return item
      ? json(item)
      : json({ error: "item_not_found" }, 404);
  }

  if (route.action && request.method === "POST") {
    let action: CmsItemAction | null = null;
    try {
      action = await readAction(request);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    if (!action) {
      return json({ error: "invalid_action" }, 400);
    }

    try {
      const item = await store.applyAction(route.id, action, now);
      return item
        ? json(item)
        : json({ error: "item_not_found" }, 404);
    } catch (error) {
      if (
        error instanceof Error
        && error.message === "cms item update conflict"
      ) {
        return json({ error: "conflict" }, 409);
      }
      throw error;
    }
  }

  return json(
    { error: "method_not_allowed" },
    405,
    { allow: route.action ? "POST" : "GET" },
  );
}
