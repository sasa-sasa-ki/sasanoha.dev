import assert from "node:assert/strict";
import test from "node:test";

import {
  assetPathForRequest,
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
