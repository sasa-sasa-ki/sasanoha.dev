<script setup lang="ts">
defineProps<{
  phase: string;
  cmsConnected: boolean;
}>();
</script>

<template>
  <div class="status">
    <strong>{{ phase }}</strong>
    <span>{{ cmsConnected ? "sasanohaCMS 接続済み" : "package 公開前のため未接続" }}</span>
  </div>
</template>

<style scoped lang="scss">
.status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid #d8d8d4;
  border-radius: 12px;
  background: #fff;

  span {
    color: #666;
  }
}
</style>
