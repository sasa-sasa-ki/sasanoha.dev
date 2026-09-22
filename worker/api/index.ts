import {
  isItemAction,
  type ItemStore,
} from "./contracts.ts";
import {
  D1ItemStore,
  type D1DatabaseLike,
} from "./d1-item-store.ts";

type AccessIdentity = {
  email?: string;
  name?: string;
  groups?: string[];
};

type AccessContext = {
  aud: string;
  getIdentity(): Promise<AccessIdentity | null>;
};

type WorkerContext = {
  access?: AccessContext;
};

type Env = {
  CMS_DB: D1DatabaseLike;
  EDITOR_EMAILS?: string;
};

type AuthorizedEditor =
  | { ok: true; email: string }
  | { ok: false; response: Response };

function json(
  value: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return Response.json(value, {
    ...init,
    headers,
  });
}

function editorAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Cloudflare Accessで認証されたidentityを、instance固有allowlistで再認可します。
 *
 * Access policyとapplication codeのauthorizationを分離し、
 * allowlist未設定時はfail-closedにします。
 */
export async function authorizeEditor(
  env: Pick<Env, "EDITOR_EMAILS">,
  ctx: WorkerContext,
): Promise<AuthorizedEditor> {
  if (!ctx.access) {
    return {
      ok: false,
      response: json(
        { error: "access_required" },
        { status: 401 },
      ),
    };
  }

  const identity = await ctx.access.getIdentity();
  const email = identity?.email?.trim().toLowerCase();

  if (!email) {
    return {
      ok: false,
      response: json(
        { error: "identity_email_required" },
        { status: 403 },
      ),
    };
  }

  const allowlist = editorAllowlist(env.EDITOR_EMAILS);
  if (allowlist.size === 0) {
    return {
      ok: false,
      response: json(
        { error: "editor_allowlist_not_configured" },
        { status: 503 },
      ),
    };
  }

  if (!allowlist.has(email)) {
    return {
      ok: false,
      response: json(
        { error: "editor_not_allowed" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, email };
}

function sameOriginWrite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  return origin === new URL(request.url).origin;
}

async function readAction(request: Request): Promise<unknown> {
  const body = await request.text();

  if (body.length > 1_024) {
    throw new Error("request_body_too_large");
  }

  if (!body) return undefined;

  try {
    return (JSON.parse(body) as { action?: unknown }).action;
  } catch {
    throw new Error("invalid_json");
  }
}

/**
 * 認証・Cloudflare bindingを除いたHTTP contractです。
 * unit testではmemory storeを渡して検証できます。
 */
export async function handleCmsApiRequest(
  request: Request,
  store: ItemStore,
  actorEmail: string,
  now = new Date(),
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/admin/api/health") {
    return json({ ok: true });
  }

  const match = /^\/admin\/api\/items\/([^/]+)\/action$/.exec(
    url.pathname,
  );
  if (!match) {
    return json({ error: "not_found" }, { status: 404 });
  }

  const id = decodeURIComponent(match[1]!);

  if (request.method === "GET") {
    const item = await store.get(id);
    return item
      ? json(item)
      : json({ error: "item_not_found" }, { status: 404 });
  }

  if (request.method !== "POST") {
    return json(
      { error: "method_not_allowed" },
      {
        status: 405,
        headers: { allow: "GET, POST" },
      },
    );
  }

  if (!sameOriginWrite(request)) {
    return json({ error: "cross_origin_write" }, { status: 403 });
  }

  let action: unknown;
  try {
    action = await readAction(request);
  } catch (error) {
    const code = error instanceof Error
      ? error.message
      : "invalid_request";

    return json(
      { error: code },
      { status: code === "request_body_too_large" ? 413 : 400 },
    );
  }

  if (!isItemAction(action)) {
    return json({ error: "invalid_action" }, { status: 400 });
  }

  const item = await store.applyAction(
    id,
    action,
    actorEmail,
    now,
  );

  return item
    ? json(item)
    : json({ error: "item_not_found" }, { status: 404 });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: WorkerContext,
  ): Promise<Response> {
    const editor = await authorizeEditor(env, ctx);
    if (!editor.ok) return editor.response;

    const store = new D1ItemStore(env.CMS_DB);
    return handleCmsApiRequest(
      request,
      store,
      editor.email,
    );
  },
};
