type FetchBinding = {
  fetch(input: Request | URL | string): Promise<Response>;
};

type Env = {
  ASSETS: FetchBinding;
  CMS?: FetchBinding;
};

export const PREVIEW_HOST = "preview.sasanoha.dev";

function noStoreResponse(
  body: string,
  status: number,
): Response {
  return new Response(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function looksLikeStaticAsset(pathname: string): boolean {
  return pathname.startsWith("/_astro/")
    || /\.[a-z0-9]+$/i.test(pathname);
}

export function isAdminPath(url: URL): boolean {
  return url.pathname === "/admin"
    || url.pathname.startsWith("/admin/");
}

export function isPublicPreviewPath(url: URL): boolean {
  return url.hostname !== PREVIEW_HOST
    && (
      url.pathname === "/preview"
      || url.pathname.startsWith("/preview/")
    );
}

/**
 * preview hostnameでは通常の公開indexではなくpreview pageを返します。
 */
export function assetPathForRequest(url: URL): string {
  if (url.hostname !== PREVIEW_HOST) {
    return url.pathname;
  }

  if (looksLikeStaticAsset(url.pathname)) {
    return url.pathname;
  }

  return "/preview/";
}

export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);

  if (isAdminPath(url)) {
    if (!env.CMS) {
      return noStoreResponse("CMS unavailable", 503);
    }

    return env.CMS.fetch(request);
  }

  if (isPublicPreviewPath(url)) {
    return noStoreResponse("Not Found", 404);
  }

  const assetPath = assetPathForRequest(url);

  if (assetPath === url.pathname) {
    return env.ASSETS.fetch(request);
  }

  const assetUrl = new URL(request.url);
  assetUrl.hostname = "assets.local";
  assetUrl.pathname = assetPath;

  return env.ASSETS.fetch(assetUrl);
}

export default {
  fetch: handleRequest,
};
