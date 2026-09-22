import assert from "node:assert/strict";
import test from "node:test";

import {
  assetPathForRequest,
  handleRequest,
  isAdminPath,
  isPublicPreviewPath,
  PREVIEW_HOST,
} from "../worker/index.ts";

test("public hostname keeps its normal asset path", () => {
  assert.equal(
    assetPathForRequest(new URL("https://sasanoha.dev/experiment/")),
    "/experiment/",
  );
});

test("preview hostname maps pages to the preview surface", () => {
  assert.equal(
    assetPathForRequest(new URL(`https://${PREVIEW_HOST}/`)),
    "/preview/",
  );

  assert.equal(
    assetPathForRequest(new URL(`https://${PREVIEW_HOST}/works/abc`)),
    "/preview/",
  );
});

test("preview hostname keeps Astro assets unchanged", () => {
  assert.equal(
    assetPathForRequest(
      new URL(`https://${PREVIEW_HOST}/_astro/PreviewPanel.js`),
    ),
    "/_astro/PreviewPanel.js",
  );
});

test("public hostname blocks the internal preview asset path", () => {
  assert.equal(
    isPublicPreviewPath(new URL("https://sasanoha.dev/preview/")),
    true,
  );

  assert.equal(
    isPublicPreviewPath(new URL("https://preview.sasanoha.dev/preview/")),
    false,
  );
});

test("admin API paths are recognized before preview asset routing", () => {
  assert.equal(
    isAdminPath(
      new URL(
        "https://preview.sasanoha.dev/admin/api/items/reference-work/action",
      ),
    ),
    true,
  );
});

test("public admin path reaches the protected CMS service binding", async () => {
  let calls = 0;

  const response = await handleRequest(
    new Request("https://sasanoha.dev/admin/panel"),
    {
      ASSETS: {
        async fetch() {
          return new Response("asset");
        },
      },
      CMS: {
        async fetch() {
          calls += 1;
          return new Response("access required", { status: 403 });
        },
      },
    },
  );

  assert.equal(response.status, 403);
  assert.equal(calls, 1);
});

test("preview hostname forwards admin API to the CMS service binding", async () => {
  let pathname = "";

  const response = await handleRequest(
    new Request(
      "https://preview.sasanoha.dev/admin/api/items/reference-work/action",
      { method: "POST" },
    ),
    {
      ASSETS: {
        async fetch() {
          return new Response("asset");
        },
      },
      CMS: {
        async fetch(input) {
          const url =
            input instanceof Request
              ? new URL(input.url)
              : new URL(String(input));
          pathname = url.pathname;
          return Response.json({ status: "published" });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(
    pathname,
    "/admin/api/items/reference-work/action",
  );
});

test("preview admin path fails closed until service binding exists", async () => {
  const response = await handleRequest(
    new Request(
      "https://preview.sasanoha.dev/admin/api/items/reference-work/action",
      { method: "POST" },
    ),
    {
      ASSETS: {
        async fetch() {
          return new Response("asset");
        },
      },
    },
  );

  assert.equal(response.status, 503);
});
