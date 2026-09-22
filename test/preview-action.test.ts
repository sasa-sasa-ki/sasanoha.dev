import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchPreviewItem,
  nextPreviewStatus,
  sendPreviewAction,
} from "../src/lib/preview-action.ts";

const scheduledItem = {
  id: "reference-work",
  kind: "work",
  properties: {
    description: "公開前の制作物",
    producedAt: "2026-09-18",
  },
  status: "scheduled",
  createdAt: "2026-09-22T03:00:00.000Z",
  updatedAt: "2026-09-22T03:00:00.000Z",
  publishAt: "2026-10-01T09:00:00.000Z",
  revision: 1,
} as const;

test("reference preview actions follow the CMS action vocabulary", () => {
  assert.equal(nextPreviewStatus("scheduled", "publish"), "published");
  assert.equal(nextPreviewStatus("published", "draft"), "draft");
  assert.equal(nextPreviewStatus("draft", "archive"), "archived");
});

test("preview item GET reads the API item contract", async () => {
  const item = await fetchPreviewItem(
    "/admin/api/items/reference-work",
    async () =>
      Response.json(scheduledItem),
  );

  assert.equal(item.id, "reference-work");
  assert.equal(item.status, "scheduled");
});

test("API preview action sends JSON and reads the updated item", async () => {
  let capturedBody = "";

  const item = await sendPreviewAction(
    "/admin/api/items/reference-work/action",
    "publish",
    async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      return Response.json({
        ...scheduledItem,
        status: "published",
        updatedAt: "2026-09-22T05:00:00.000Z",
        publishedAt: "2026-09-22T05:00:00.000Z",
        publishAt: undefined,
        revision: 2,
      });
    },
  );

  assert.equal(capturedBody, JSON.stringify({ action: "publish" }));
  assert.equal(item.status, "published");
  assert.equal(item.revision, 2);
});

test("preview API rejects invalid item responses", async () => {
  await assert.rejects(
    () =>
      fetchPreviewItem(
        "/admin/api/items/reference-work",
        async () => Response.json({ status: "unknown" }),
      ),
    /invalid item/,
  );
});
