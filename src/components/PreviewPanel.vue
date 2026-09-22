<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import {
  fetchPreviewItem,
  nextPreviewStatus,
  sendPreviewAction,
  type PreviewAction,
  type PreviewItem,
  type PreviewStatus,
} from "../lib/preview-action.ts";

const props = defineProps<{
  status: PreviewStatus;
  producedAt: string;
  createdAt: string;
  publishAt?: string;
  itemId?: string;
  apiBaseUrl?: string;
  connectOnPreviewHost?: boolean;
  referenceMode?: boolean;
}>();

const open = ref(false);
const mounted = ref(false);
const currentStatus = ref<PreviewStatus>(props.status);
const currentCreatedAt = ref(props.createdAt);
const currentPublishAt = ref<string | undefined>(props.publishAt);
const pending = ref(false);
const message = ref("");
const apiBase = ref<string | null>(null);
const apiAttempted = ref(false);
const apiConnected = ref(false);

const labels = {
  draft: "下書き",
  scheduled: "公開予約",
  published: "公開中",
  archived: "保管",
} as const;

const actionsEnabled = computed(() => {
  if (!mounted.value) return false;
  if (apiBase.value) return true;
  if (apiAttempted.value) return false;
  return props.referenceMode === true;
});

const displayedPublishAt = computed(
  () =>
    currentStatus.value === "scheduled"
      ? (currentPublishAt.value ?? "未設定")
      : "未設定",
);

function applyApiItem(item: PreviewItem): void {
  currentStatus.value = item.status;
  currentCreatedAt.value = item.createdAt;
  currentPublishAt.value = item.publishAt;
}

function runtimeApiBase(): string | null {
  if (props.apiBaseUrl) return props.apiBaseUrl;
  if (
    props.connectOnPreviewHost
    && props.itemId
    && window.location.hostname === "preview.sasanoha.dev"
  ) {
    return `/admin/api/items/${encodeURIComponent(props.itemId)}`;
  }
  return null;
}

onMounted(async () => {
  mounted.value = true;

  const base = runtimeApiBase();
  if (!base) return;

  apiAttempted.value = true;
  pending.value = true;

  try {
    const item = await fetchPreviewItem(base);
    apiBase.value = base;
    apiConnected.value = true;
    applyApiItem(item);
    message.value = "CMS APIとD1へ接続しました。";
  } catch (error) {
    apiConnected.value = false;
    message.value =
      error instanceof Error
        ? `CMS API接続に失敗しました: ${error.message}`
        : "CMS API接続に失敗しました。";
  } finally {
    pending.value = false;
  }
});

async function runAction(action: PreviewAction): Promise<void> {
  if (!actionsEnabled.value || pending.value) return;

  pending.value = true;
  message.value = "";

  try {
    if (apiBase.value) {
      const item = await sendPreviewAction(
        `${apiBase.value}/action`,
        action,
      );
      applyApiItem(item);
      message.value = "D1へ反映しました。";
      return;
    }

    currentStatus.value = nextPreviewStatus(currentStatus.value, action);
    if (action !== "scheduled") {
      currentPublishAt.value = undefined;
    }
    message.value =
      "reference modeのため、この画面上だけで状態を切り替えています。再読み込みすると戻ります。";
  } catch (error) {
    message.value =
      error instanceof Error
        ? `操作に失敗しました: ${error.message}`
        : "操作に失敗しました。";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <button
    class="preview-toggle"
    type="button"
    :aria-expanded="open"
    aria-controls="sasanoha-preview-panel"
    @click="open = !open"
  >
    {{ open ? "閉じる" : "CMS" }}
  </button>

  <aside
    id="sasanoha-preview-panel"
    class="preview-panel"
    :class="{ open }"
  >
    <p class="eyebrow">sasanohaCMS Preview</p>
    <h2>下書き確認</h2>

    <dl>
      <div>
        <dt>状態</dt>
        <dd>{{ labels[currentStatus] }}</dd>
      </div>
      <div>
        <dt>制作日時</dt>
        <dd>{{ props.producedAt }}</dd>
      </div>
      <div>
        <dt>CMS作成日時</dt>
        <dd>{{ currentCreatedAt }}</dd>
      </div>
      <div>
        <dt>公開予約</dt>
        <dd>{{ displayedPublishAt }}</dd>
      </div>
    </dl>

    <div class="actions">
      <button
        type="button"
        :disabled="!actionsEnabled || pending"
        @click="runAction('publish')"
      >
        今すぐ公開
      </button>
      <button
        type="button"
        :disabled="!actionsEnabled || pending"
        @click="runAction('draft')"
      >
        下書きへ戻す
      </button>
      <button
        class="danger"
        type="button"
        :disabled="!actionsEnabled || pending"
        @click="runAction('archive')"
      >
        保管する
      </button>
    </div>

    <p v-if="message" class="message" aria-live="polite">
      {{ message }}
    </p>

    <p class="note">
      <template v-if="apiConnected">
        Cloudflare Access認証済みのCMS API Workerを経由して、D1へ接続しています。
      </template>
      <template v-else-if="apiAttempted">
        本番PreviewではAPI接続失敗時にreference modeへ自動fallbackせず、操作を停止します。
      </template>
      <template v-else-if="props.referenceMode">
        現在はreference modeです。操作は永続化せず、Preview本番では同じUIが実APIへ切り替わります。
      </template>
      <template v-else>
        CMS API未接続のため操作は無効です。
      </template>
    </p>
  </aside>
</template>

<style scoped lang="scss">
.preview-toggle {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 2147483001;
  border: 0;
  border-radius: 999px;
  padding: 12px 16px;
  background: #171719;
  color: #fff;
  box-shadow: 0 10px 30px rgb(0 0 0 / 22%);
  cursor: pointer;
}

.preview-panel {
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 2147483000;
  width: min(360px, calc(100vw - 48px));
  padding: 76px 22px 28px;
  color: #fff;
  background: rgb(18 18 20 / 98%);
  box-shadow: -18px 0 50px rgb(0 0 0 / 30%);
  transform: translateX(100%);
  transition: transform 180ms ease;
  overflow-y: auto;

  &.open {
    transform: translateX(0);
  }

  .eyebrow {
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.72;
  }

  dl {
    display: grid;
    gap: 12px;
    margin: 24px 0;

    div {
      display: grid;
      gap: 4px;
    }

    dt {
      font-size: 0.8rem;
      opacity: 0.62;
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }

  .actions {
    display: grid;
    gap: 10px;

    button {
      padding: 10px 12px;
      font: inherit;
    }
  }

  .danger {
    border-color: #ff7474;
  }

  .message {
    margin-top: 18px;
    line-height: 1.6;
  }

  .note {
    margin-top: 24px;
    font-size: 0.84rem;
    line-height: 1.7;
    opacity: 0.7;
  }
}
</style>
