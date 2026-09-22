<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  status: "draft" | "scheduled" | "published" | "archived";
  producedAt: string;
  createdAt: string;
  publishAt?: string;
}>();

const open = ref(false);

const labels = {
  draft: "下書き",
  scheduled: "公開予約",
  published: "公開中",
  archived: "保管",
} as const;
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
        <dd>{{ labels[status] }}</dd>
      </div>
      <div>
        <dt>制作日時</dt>
        <dd>{{ producedAt }}</dd>
      </div>
      <div>
        <dt>CMS作成日時</dt>
        <dd>{{ createdAt }}</dd>
      </div>
      <div>
        <dt>公開予約</dt>
        <dd>{{ publishAt ?? "未設定" }}</dd>
      </div>
    </dl>

    <div class="actions">
      <button type="button" disabled>今すぐ公開</button>
      <button type="button" disabled>下書きへ戻す</button>
      <button type="button" disabled>保管する</button>
    </div>

    <p class="note">
      このreference siteではUIのみ先行実装しています。
      CMS API接続後に同じpanelから操作できるようにします。
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

  .note {
    margin-top: 24px;
    font-size: 0.84rem;
    line-height: 1.7;
    opacity: 0.7;
  }
}
</style>
