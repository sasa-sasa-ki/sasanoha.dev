import assert from "node:assert/strict";
import test from "node:test";

import type { CmsItem } from "../worker/api/contract.ts";
import { handleApiRequest } from "../worker/api/handler.ts";
import type { ItemStore } from "../worker/api/store.ts";

function accessContext() {
  return {
    access: {
      aud: "test",
      async getIdentity() {
        return { email: "admin@example.invalid" };
      },
    },
  };
}

function memoryStore(): ItemStore {
  let item: CmsItem = {
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
  };

  return {
    async get(id) {
      return id === item.id ? item : null;
    },
    async applyAction(id, action, now = new Date()) {
      if (id !== item.id) return null;

      const timestamp = now.toISOString();
      item = {
        ...item,
        status:
          action === "publish"
            ? "published"
            : action === "draft"
              ? "draft"
              : "archived",
        updatedAt: timestamp,
        ...(action === "publish"
          ? { publishedAt: timestamp }
          : {}),
        revision: item.revision + 1,
      };
      delete item.publishAt;
      return item;
    },
  };
}

test("CMS API fails closed without Access context", async () => {
  const response = await handleApiRequest(
    new Request("https://sasanoha.dev/admin/api/items/reference-work"),
    {},
    memoryStore(),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "access_required" });
});

test("CMS API reads an Access-authorized item", async () => {
  const response = await handleApiRequest(
    new Request("https://sasanoha.dev/admin/api/items/reference-work"),
    accessContext(),
    memoryStore(),
  );

  assert.equal(response.status, 200);
  const body = await response.json() as CmsItem;
  assert.equal(body.id, "reference-work");
  assert.equal(body.status, "scheduled");
});

test("CMS API applies the preview action contract", async () => {
  const response = await handleApiRequest(
    new Request(
      "https://sasanoha.dev/admin/api/items/reference-work/action",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      },
    ),
    accessContext(),
    memoryStore(),
    new Date("2026-09-22T05:00:00.000Z"),
  );

  assert.equal(response.status, 200);
  const body = await response.json() as CmsItem;
  assert.equal(body.status, "published");
  assert.equal(body.revision, 2);
  assert.equal(body.publishAt, undefined);
  assert.equal(body.publishedAt, "2026-09-22T05:00:00.000Z");
});

test("CMS API rejects unknown actions", async () => {
  const response = await handleApiRequest(
    new Request(
      "https://sasanoha.dev/admin/api/items/reference-work/action",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      },
    ),
    accessContext(),
    memoryStore(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_action" });
});
