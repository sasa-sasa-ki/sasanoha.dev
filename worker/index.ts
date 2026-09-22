type AssetBinding = {
  fetch(input: Request | URL | string): Promise<Response>;
};

type Env = {
  ASSETS: AssetBinding;
};

export const PREVIEW_HOST = "preview.sasanoha.dev";

function looksLikeStaticAsset(pathname: string): boolean {
  return pathname.startsWith("/_astro/")
    || /\.[a-z0-9]+$/i.test(pathname);
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (isPublicPreviewPath(url)) {
      return new Response("Not Found", {
        status: 404,
        headers: {
          "cache-control": "no-store",
        },
      });
    }

    const assetPath = assetPathForRequest(url);

    if (assetPath === url.pathname) {
      return env.ASSETS.fetch(request);
    }

    const assetUrl = new URL(request.url);
    assetUrl.hostname = "assets.local";
    assetUrl.pathname = assetPath;

    return env.ASSETS.fetch(assetUrl);
  },
};
