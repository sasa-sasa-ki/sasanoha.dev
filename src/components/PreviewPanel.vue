<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import {
  loadPreviewStatus,
  nextPreviewStatus,
  sendPreviewAction,
  type PreviewAction,
  type PreviewStatus,
} from "../lib/preview-action.ts";

const props = defineProps<{
  status: PreviewStatus;
  producedAt: string;
  createdAt: string;
  publishAt?: string;
  actionEndpoint?: string;
  referenceMode?: boolean;
}>();

const open = ref(false);
const currentStatus = ref<PreviewStatus>(props.status);
const pending = ref(false);
const message = ref("");
const loading = ref(Boolean(props.actionEndpoint));

const labels = {
  draft: "下書き",
  scheduled: "公開予約",
  published: "公開中",
  archived: "保管",
} as const;

const actionsEnabled = computed(
  () => Boolean(props.actionEndpoint || props.referenceMode),
);

const displayedPublishAt = computed(
  () =>
    currentStatus.value === "scheduled"
      ? (props.publishAt ?? "未設定")
      : "未設定",
);

onMounted(async () => {
  if (!props.actionEndpoint) {
    loading.value = false;
    return;
  }

  try {
    const result = await loadPreviewStatus(props.actionEndpoint);
    currentStatus.value = result.status;
  } catch (error) {
    message.value =
      error instanceof Error
        ? `CMS状態の取得に失敗しました: ${error.message}`
        : "CMS状態の取得に失敗しました。";
  } finally {
    loading.value = false;
  }
});

async function runAction(action: PreviewAction): Promise<void> {
  if (!actionsEnabled.value || pending.value || loading.value) return;

  pending.value = true;
  message.value = "";

  try {
    if (props.actionEndpoint) {
      const result = await sendPreviewAction(props.actionEndpoint, action);
      currentStatus.value = result.status;
      message.value = "CMSへ反映しました。";
      return;
    }

    currentStatus.value = nextPreviewStatus(currentStatus.value, action);
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
        <dd>{{ props.createdAt }}</dd>
      </div>
      <div>
        <dt>公開予約</dt>
        <dd>{{ displayedPublishAt }}</dd>
      </div>
    </dl>

    <div class="actions">
      <button
        type="button"
        :disabled="!actionsEnabled || pending || loading"
        @click="runAction('publish')"
      >
        今すぐ公開
      </button>
      <button
        type="button"
        :disabled="!actionsEnabled || pending || loading"
        @click="runAction('draft')"
      >
        下書きへ戻す
      </button>
      <button
        class="danger"
        type="button"
        :disabled="!actionsEnabled || pending || loading"
        @click="runAction('archive')"
      >
        保管する
      </button>
    </div>

    <p v-if="message" class="message" aria-live="polite">
      {{ message }}
    </p>

    <p class="note">
      <template v-if="props.actionEndpoint">
        {{ loading ? "CMS APIから状態を読み込んでいます。" : "CMS APIへ接続しています。" }}
      </template>
      <template v-else-if="props.referenceMode">
        現在はreference modeです。操作は永続化せず、API接続時も同じaction語彙を利用します。
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
