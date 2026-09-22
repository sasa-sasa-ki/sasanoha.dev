import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeEditor,
  handleCmsApiRequest,
} from "../worker/api/index.ts";
import type {
  ItemAction,
  ItemStore,
  StoredItemState,
} from "../worker/api/contracts.ts";

class MemoryStore implements ItemStore {
  state: StoredItemState | null = {
    id: "reference-work",
    status: "scheduled",
    updatedAt: "2026-09-22T03:00:00.000Z",
    publishAt: "2026-10-01T09:00:00.000Z",
  };

  lastActor = "";

  async get(id: string): Promise<StoredItemState | null> {
    return this.state?.id === id ? this.state : null;
  }

  async applyAction(
    id: string,
    action: ItemAction,
    actorEmail: string,
    now: Date,
  ): Promise<StoredItemState | null> {
    if (!this.state || this.state.id !== id) return null;

    this.lastActor = actorEmail;
    const updatedAt = now.toISOString();

    this.state =
      action === "publish"
        ? {
            ...this.state,
            status: "published",
            updatedAt,
            publishedAt: updatedAt,
            publishAt: undefined,
          }
        : {
            ...this.state,
            status: action === "draft" ? "draft" : "archived",
            updatedAt,
            publishAt: undefined,
          };

    return this.state;
  }
}

function accessContext(email = "editor@example.com") {
  return {
    access: {
      aud: "test-aud",
      async getIdentity() {
        return { email };
      },
    },
  };
}

test("authorization fails closed without Access", async () => {
  const result = await authorizeEditor(
    { EDITOR_EMAILS: "editor@example.com" },
    {},
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 401);
});

test("authorization fails closed without an editor allowlist", async () => {
  const result = await authorizeEditor(
    {},
    accessContext(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 503);
});

test("authorization requires the Access identity to be allowlisted", async () => {
  const result = await authorizeEditor(
    { EDITOR_EMAILS: "other@example.com" },
    accessContext(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 403);
});

test("authorization accepts a normalized allowlisted email", async () => {
  const result = await authorizeEditor(
    { EDITOR_EMAILS: " Editor@Example.com " },
    accessContext("editor@example.com"),
  );

  assert.deepEqual(result, {
    ok: true,
    email: "editor@example.com",
  });
});

test("GET returns the persisted item state", async () => {
  const store = new MemoryStore();
  const response = await handleCmsApiRequest(
    new Request(
      "https://preview.sasanoha.dev/admin/api/items/reference-work/action",
    ),
    store,
    "editor@example.com",
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "scheduled");
});

test("POST rejects cross-origin writes", async () => {
  const store = new MemoryStore();
  const response = await handleCmsApiRequest(
    new Request(
      "https://preview.sasanoha.dev/admin/api/items/reference-work/action",
      {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "publish" }),
      },
    ),
    store,
    "editor@example.com",
  );

  assert.equal(response.status, 403);
  assert.equal(store.state?.status, "scheduled");
});

test("POST applies a valid action and records the actor", async () => {
  const store = new MemoryStore();
  const response = await handleCmsApiRequest(
    new Request(
      "https://preview.sasanoha.dev/admin/api/items/reference-work/action",
      {
        method: "POST",
        headers: {
          origin: "https://preview.sasanoha.dev",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "publish" }),
      },
    ),
    store,
    "editor@example.com",
    new Date("2026-09-22T05:00:00.000Z"),
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "published");
  assert.equal(store.lastActor, "editor@example.com");
});

test("POST rejects unknown actions", async () => {
  const store = new MemoryStore();
  const response = await handleCmsApiRequest(
    new Request(
      "https://preview.sasanoha.dev/admin/api/items/reference-work/action",
      {
        method: "POST",
        headers: {
          origin: "https://preview.sasanoha.dev",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "delete" }),
      },
    ),
    store,
    "editor@example.com",
  );

  assert.equal(response.status, 400);
  assert.equal(store.state?.status, "scheduled");
});
