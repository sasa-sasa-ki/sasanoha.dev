import assert from "node:assert/strict";
import test from "node:test";

import {
  nextPreviewStatus,
  sendPreviewAction,
} from "../src/lib/preview-action.ts";

test("reference preview actions follow the CMS action vocabulary", () => {
  assert.equal(nextPreviewStatus("scheduled", "publish"), "published");
  assert.equal(nextPreviewStatus("published", "draft"), "draft");
  assert.equal(nextPreviewStatus("draft", "archive"), "archived");
});

test("API preview action uses JSON contract and trusts returned status", async () => {
  let capturedBody = "";

  const result = await sendPreviewAction(
    "/admin/api/items/reference-work/action",
    "publish",
    async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ status: "published" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    },
  );

  assert.equal(capturedBody, JSON.stringify({ action: "publish" }));
  assert.equal(result.status, "published");
});

test("API preview action rejects invalid status responses", async () => {
  await assert.rejects(
    () =>
      sendPreviewAction(
        "/admin/api/items/reference-work/action",
        "publish",
        async () =>
          new Response(
            JSON.stringify({ status: "unknown" }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          ),
      ),
    /invalid status/,
  );
});
