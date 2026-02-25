<template>
  <div class="popup">
    <header class="header">
      <div class="title">
        <h1>SnapText</h1>
        <p>从网页选中文本，右键触发 AI 操作</p>
      </div>
      <div class="actions">
        <button type="button" class="ghost" @click="openOptions">设置</button>
        <button type="button" class="ghost" @click="reload">刷新</button>
        <button type="button" class="danger" @click="clearRecords">清空</button>
      </div>
    </header>

    <section v-if="loading" class="loading">
      <span class="spinner"></span>
      正在请求 AI，请稍候...
    </section>

    <section v-if="errorMessage" class="error">
      {{ errorMessage }}
    </section>

    <section v-if="records.length === 0" class="empty">
      <div class="empty-card">
        <h2>暂无记录</h2>
        <p>在网页中选中文本，右键选择 AI 总结/评论/反驳/延伸。</p>
      </div>
    </section>

    <section v-else class="single">
      <div class="pager">
        <button type="button" class="ghost" @click="prevCard" :disabled="records.length <= 1">
          上一条
        </button>
        <span>{{ currentIndex + 1 }} / {{ records.length }}</span>
        <button type="button" class="ghost" @click="nextCard" :disabled="records.length <= 1">
          下一条
        </button>
        <div class="jump">
          <input
            v-model.number="jumpIndex"
            type="number"
            min="1"
            :max="records.length"
            placeholder="跳转"
            @keyup.enter="jumpToIndex"
          />
          <button type="button" class="ghost" @click="jumpToIndex" :disabled="records.length === 0">
            跳转
          </button>
        </div>
        <button type="button" class="ghost" @click="showAll = true">全部</button>
        <label class="toggle">
          <input v-model="extraEnabled" type="checkbox" @change="saveExtraEnabled" />
          <span>附加信息模式</span>
        </label>
      </div>
      <article v-if="currentRecord" :key="currentRecord.id" class="card">
        <div class="meta">
          <span class="tag">{{ getActionLabel(currentRecord.action) }}</span>
          <span class="time">{{ formatTime(currentRecord.timestamp) }}</span>
        </div>
        <div v-if="currentRecord.usage" class="usage">
          Tokens：{{ formatTokens(currentRecord.usage) }}
        </div>
        <div class="page">
          <span class="page-title">{{ currentRecord.pageTitle || "未命名页面" }}</span>
          <span class="page-url">{{ currentRecord.url }}</span>
        </div>
        <div class="block">
          <h3>选中文本</h3>
          <p class="input">{{ currentRecord.inputText }}</p>
        </div>
        <div class="block">
          <h3>AI 输出</h3>
          <pre class="output">{{ currentRecord.outputText }}</pre>
        </div>
        <div class="card-actions">
          <button type="button" class="ghost" @click="copyOutput(currentRecord.outputText)">
            复制结果
          </button>
          <button type="button" class="ghost" @click="deleteRecord(currentRecord.id)">删除</button>
        </div>
      </article>
    </section>

    <div v-if="showExtra" class="modal">
      <div class="modal-card">
        <div class="modal-header">
          <h2>补充信息</h2>
          <button type="button" class="ghost" @click="cancelExtra">关闭</button>
        </div>
        <div class="modal-body">
          <p class="hint">请补充额外信息，帮助生成更准确的回复。</p>
          <textarea
            v-model.trim="extraText"
            class="textarea"
            rows="5"
            placeholder="请输入补充信息..."
          ></textarea>
          <div class="modal-actions">
            <button type="button" class="ghost" @click="cancelExtra">取消</button>
            <button type="button" class="primary" @click="submitExtra" :disabled="!extraText">
              发送
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showAll" class="modal">
      <div class="modal-card">
        <div class="modal-header">
          <h2>全部记录</h2>
          <button type="button" class="ghost" @click="showAll = false">关闭</button>
        </div>
        <div class="modal-body">
          <article v-for="record in records" :key="record.id" class="card">
            <div class="meta">
              <span class="tag">{{ getActionLabel(record.action) }}</span>
              <span class="time">{{ formatTime(record.timestamp) }}</span>
            </div>
            <div v-if="record.usage" class="usage">
              Tokens：{{ formatTokens(record.usage) }}
            </div>
            <div class="page">
              <span class="page-title">{{ record.pageTitle || "未命名页面" }}</span>
              <span class="page-url">{{ record.url }}</span>
            </div>
            <div class="block">
              <h3>选中文本</h3>
              <p class="input">{{ record.inputText }}</p>
            </div>
            <div class="block">
              <h3>AI 输出</h3>
              <pre class="output">{{ record.outputText }}</pre>
            </div>
            <div class="card-actions">
              <button type="button" class="ghost" @click="copyOutput(record.outputText)">
                复制结果
              </button>
              <button type="button" class="ghost" @click="deleteRecord(record.id)">删除</button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { AIRecord, PendingRequest, RuntimeMessage } from "../shared/types";

const RECORDS_KEY = "records";
const LAST_ERROR_KEY = "last-error";
const LOADING_KEY = "loading";
const PENDING_KEY = "pending-request";
const EXTRA_ENABLED_KEY = "extra-enabled";
const records = ref<AIRecord[]>([]);
const errorMessage = ref("");
const loading = ref(false);
const currentIndex = ref(0);
const showAll = ref(false);
const jumpIndex = ref<number | null>(null);
const showExtra = ref(false);
const extraText = ref("");
const pendingRequest = ref<PendingRequest | null>(null);
const extraEnabled = ref(false);

// 从 storage 读取记录
async function loadRecords() {
  const stored = await chrome.storage.local.get(RECORDS_KEY);
  const list = Array.isArray(stored[RECORDS_KEY]) ? stored[RECORDS_KEY] : [];
  records.value = list;
  if (currentIndex.value >= list.length) {
    currentIndex.value = Math.max(0, list.length - 1);
  }
}

// 从 storage 读取错误信息
async function loadLastError() {
  const stored = await chrome.storage.local.get(LAST_ERROR_KEY);
  const payload = stored[LAST_ERROR_KEY] as { message?: string } | undefined;
  errorMessage.value = payload?.message ?? "";
}

// 从 storage 读取加载状态
async function loadLoading() {
  const stored = await chrome.storage.local.get(LOADING_KEY);
  const payload = stored[LOADING_KEY] as { active?: boolean } | undefined;
  loading.value = Boolean(payload?.active);
}

// 从 storage 读取补充请求
async function loadPendingRequest() {
  const stored = await chrome.storage.local.get(PENDING_KEY);
  const pending = stored[PENDING_KEY] as PendingRequest | undefined;
  pendingRequest.value = pending ?? null;
  showExtra.value = Boolean(pending);
  if (!pending) {
    extraText.value = "";
  }
}

// 读取补充信息开关
async function loadExtraEnabled() {
  const stored = await chrome.storage.local.get(EXTRA_ENABLED_KEY);
  extraEnabled.value = Boolean(stored[EXTRA_ENABLED_KEY]?.enabled);
}

// 保存补充信息开关
async function saveExtraEnabled() {
  await chrome.storage.local.set({ [EXTRA_ENABLED_KEY]: { enabled: extraEnabled.value } });
}

// 刷新记录
async function reload() {
  errorMessage.value = "";
  await loadRecords();
  await loadLastError();
  await loadLoading();
  await loadPendingRequest();
  await loadExtraEnabled();
}

// 打开设置页
function openOptions() {
  chrome.runtime.openOptionsPage();
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

// 获取动作标签
function getActionLabel(action: AIRecord["action"]) {
  const map: Record<AIRecord["action"], string> = {
    summarize: "AI 总结",
    comment: "AI 评论",
    rebut: "AI 反驳",
    expand: "AI 延伸",
  };
  return map[action] ?? action;
}

// 格式化 token 统计
function formatTokens(usage: AIRecord["usage"]) {
  if (!usage) return "";
  const parts = [];
  if (Number.isFinite(usage.promptTokens)) {
    parts.push(`prompt ${usage.promptTokens}`);
  }
  if (Number.isFinite(usage.completionTokens)) {
    parts.push(`completion ${usage.completionTokens}`);
  }
  if (Number.isFinite(usage.totalTokens)) {
    parts.push(`total ${usage.totalTokens}`);
  }
  return parts.join(" / ");
}

// 当前卡片
const currentRecord = computed(() => records.value[currentIndex.value]);

// 切换卡片
function prevCard() {
  if (records.value.length <= 1) return;
  currentIndex.value =
    currentIndex.value === 0 ? records.value.length - 1 : currentIndex.value - 1;
}

function nextCard() {
  if (records.value.length <= 1) return;
  currentIndex.value =
    currentIndex.value === records.value.length - 1 ? 0 : currentIndex.value + 1;
}

// 提交补充信息
function submitExtra() {
  if (!pendingRequest.value) return;
  if (!extraText.value.trim()) return;
  chrome.runtime.sendMessage({
    type: "submit-extra",
    payload: { id: pendingRequest.value.id, extraText: extraText.value.trim() },
  } as RuntimeMessage);
  showExtra.value = false;
  extraText.value = "";
  pendingRequest.value = null;
}

// 取消补充信息
function cancelExtra() {
  chrome.runtime.sendMessage({ type: "cancel-extra" } as RuntimeMessage);
  showExtra.value = false;
  extraText.value = "";
  pendingRequest.value = null;
}

// 跳转到指定卡片
function jumpToIndex() {
  if (!records.value.length) return;
  const target = Number(jumpIndex.value);
  if (!Number.isFinite(target)) return;
  const clamped = Math.min(records.value.length, Math.max(1, Math.floor(target)));
  currentIndex.value = clamped - 1;
  jumpIndex.value = clamped;
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type === "records-updated") {
    void loadRecords();
  }
  if (message.type === "error") {
    errorMessage.value = String(message.payload ?? "未知错误");
  }
  if (message.type === "loading") {
    loading.value = Boolean((message.payload as { active?: boolean } | undefined)?.active);
  }
  if (message.type === "request-extra") {
    pendingRequest.value = message.payload as PendingRequest;
    showExtra.value = true;
  }
});

onMounted(() => {
  void loadRecords();
  void loadLastError();
  void loadLoading();
  void loadPendingRequest();
  void loadExtraEnabled();
});
</script>

<style scoped>
.popup {
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  padding: 16px;
  width: 420px;
  color: #111;
  background: radial-gradient(circle at top, #f4f1ea, #f7f7f7 45%, #f0f0f0 100%);
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}
.loading {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #111;
  color: #fff;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  margin-bottom: 10px;
}
.loading .spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}
.title h1 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.5px;
}
.title p {
  margin: 6px 0 0;
  color: #555;
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #333;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid #e3e3e3;
  background: #fff;
}
.toggle input {
  accent-color: #111;
}
.ghost,
.danger {
  border: 1px solid #dcdcdc;
  background: #fff;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
  transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.08s ease, opacity 0.08s ease;
}
.danger {
  border-color: #f1c4c4;
  color: #9a1a1a;
}
.ghost:hover,
.danger:hover {
  background: #f7f7f7;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}
.ghost:active,
.danger:active {
  transform: translateY(1px);
  opacity: 0.85;
}
.ghost:disabled,
.danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
.empty {
  color: #555;
}
.empty-card {
  background: #fff;
  border-radius: 12px;
  border: 1px dashed #d7d7d7;
  padding: 16px;
  text-align: center;
}
.empty-card h2 {
  margin: 0 0 6px;
  font-size: 16px;
}
.hint {
  margin: 0;
  color: #666;
  font-size: 12px;
}
.error {
  background: #ffe8e8;
  color: #9a1a1a;
  border: 1px solid #f5b4b4;
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 12px;
}
.single {
  display: grid;
  gap: 10px;
}
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.pager span {
  color: #555;
}
.jump {
  display: flex;
  align-items: center;
  gap: 6px;
}
.jump input {
  width: 56px;
  padding: 5px 6px;
  border-radius: 8px;
  border: 1px solid #dcdcdc;
  font-size: 12px;
}
.card {
  border: 1px solid #e5e0d8;
  border-radius: 12px;
  padding: 12px;
  background: #fffdfa;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
}
.meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #888;
  font-size: 12px;
}
.tag {
  background: #111;
  color: #fff;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
}
.usage {
  margin-bottom: 8px;
  font-size: 11px;
  color: #666;
}
.page {
  display: grid;
  gap: 2px;
  margin-bottom: 10px;
}
.page-title {
  font-size: 13px;
  color: #222;
}
.page-url {
  font-size: 11px;
  color: #777;
  word-break: break-all;
}
.block {
  margin-top: 10px;
}
.block h3 {
  margin: 0 0 6px;
  font-size: 12px;
  color: #555;
}
.input {
  font-weight: 600;
  margin: 0;
}
.output {
  white-space: pre-wrap;
  background: #f4f1ea;
  padding: 10px;
  border-radius: 8px;
  margin: 0;
}
.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  z-index: 2147483647;
}
.modal-card {
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  background: #fff;
  border-radius: 12px;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #eee;
}
.modal-body {
  padding: 12px 14px;
  overflow: auto;
  display: grid;
  gap: 12px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.textarea {
  width: 90%;
  border-radius: 10px;
  border: 1px solid #dcdcdc;
  padding: 10px;
  font-size: 12px;
  resize: vertical;
}
.primary {
  background: #111;
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
  transition: transform 0.08s ease, box-shadow 0.08s ease, opacity 0.08s ease;
}
.primary:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.12);
}
.primary:active {
  transform: translateY(1px);
  opacity: 0.9;
}
.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
