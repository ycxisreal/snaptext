<template>
  <div class="popup">
    <header class="header">
      <h1>TextOps</h1>
      <div class="actions">
        <button type="button" @click="clearRecords">清空</button>
        <button type="button" @click="reload">刷新</button>
      </div>
    </header>

    <section v-if="records.length === 0" class="empty">
      暂无记录
    </section>

    <section v-else class="list">
      <article v-for="record in records" :key="record.id" class="card">
        <div class="meta">
          <span class="tag">{{ record.action }}</span>
          <span class="time">{{ formatTime(record.timestamp) }}</span>
        </div>
        <p class="input">{{ record.inputText }}</p>
        <pre class="output">{{ record.outputText }}</pre>
        <div class="card-actions">
          <button type="button" @click="copyOutput(record.outputText)">复制</button>
          <button type="button" @click="deleteRecord(record.id)">删除</button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { AIRecord, RuntimeMessage } from "../shared/types";

const RECORDS_KEY = "records";
const records = ref<AIRecord[]>([]);

// 从 storage 读取记录
async function loadRecords() {
  const stored = await chrome.storage.local.get(RECORDS_KEY);
  const list = Array.isArray(stored[RECORDS_KEY]) ? stored[RECORDS_KEY] : [];
  records.value = list;
}

// 刷新记录
async function reload() {
  await loadRecords();
}

// 删除单条记录
async function deleteRecord(id: string) {
  const next = records.value.filter((item) => item.id !== id);
  records.value = next;
  await chrome.storage.local.set({ [RECORDS_KEY]: next });
}

// 清空记录
async function clearRecords() {
  records.value = [];
  await chrome.storage.local.set({ [RECORDS_KEY]: [] });
}

// 复制输出内容
async function copyOutput(text: string) {
  await navigator.clipboard.writeText(text);
}

// 格式化时间戳
function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type === "records-updated") {
    void loadRecords();
  }
});

onMounted(() => {
  void loadRecords();
});
</script>

<style scoped>
.popup {
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  padding: 12px;
  width: 360px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.actions button {
  margin-left: 8px;
}
.empty {
  color: #666;
}
.list {
  display: grid;
  gap: 12px;
}
.card {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 10px;
}
.meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #888;
  font-size: 12px;
}
.tag {
  text-transform: uppercase;
}
.input {
  font-weight: 600;
  margin-bottom: 8px;
}
.output {
  white-space: pre-wrap;
  background: #f7f7f7;
  padding: 8px;
  border-radius: 6px;
}
.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
