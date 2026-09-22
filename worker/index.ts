type AssetBinding = {
  fetch(input: Request | URL | string): Promise<Response>;
};

type Env = {
  ASSETS: AssetBinding;
};

export const PREVIEW_HOST = "preview.sasanoha.dev";

/**
 * preview hostnameでは通常の公開indexではなくpreview pageを返します。
 *
 * @remarks
 * Astroの/_astro assetsは同じpathをそのまま利用します。
 */
export function assetPathForRequest(url: URL): string {
  if (url.hostname !== PREVIEW_HOST) {
    return url.pathname;
  }

  if (url.pathname.startsWith("/_astro/")) {
    return url.pathname;
  }

  return "/preview/";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const assetPath = assetPathForRequest(url);

    if (assetPath === url.pathname) {
      return env.ASSETS.fetch(request);
    }

    const assetUrl = new URL(request.url);
    assetUrl.hostname = "assets.local";
    assetUrl.pathname = assetPath;

    return env.ASSETS.fetch(
      new Request(assetUrl, request),
    );
  },
};
