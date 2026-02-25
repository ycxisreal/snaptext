<template>
  <div class="options">
    <header class="header">
      <div>
        <h1>TextOps 设置</h1>
        <p class="subtitle">配置 API 与对话策略</p>
      </div>
      <button type="button" class="primary" @click="saveConfig">保存</button>
    </header>

    <form class="form" @submit.prevent="saveConfig">
      <section class="card">
        <h2>接口配置</h2>
        <label>
          接口地址
          <input v-model.trim="config.baseUrl" type="text" placeholder="https://api.deepseek.com" />
        </label>
        <label>
          接口密钥
          <input v-model.trim="config.apiKey" type="password" placeholder="sk-xxxx" />
        </label>
        <label>
          模型名称
          <input v-model.trim="config.model" type="text" placeholder="gpt-4o-mini" />
        </label>
      </section>

      <section class="card">
        <h2>生成参数</h2>
        <label>
          温度（temperature）
          <input v-model.number="config.temperature" type="range" min="0" max="2" step="0.1" />
        </label>
        <div class="row">
          <input v-model.number="config.temperature" type="number" min="0" max="2" step="0.1" />
          <span class="hint">范围 0~2，越低越稳定</span>
        </div>
      </section>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from "vue";
import type { AIConfig } from "../shared/types";

const CONFIG_KEY = "ai-config";
const config = reactive<AIConfig>({
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: 0.7,
});

// 读取配置
async function loadConfig() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  if (stored[CONFIG_KEY]) {
    Object.assign(config, {
      baseUrl: "",
      apiKey: "",
      model: "",
      temperature: 0.7,
      ...stored[CONFIG_KEY],
    });
  }
}

// 保存配置
async function saveConfig() {
  if (!Number.isFinite(config.temperature)) {
    config.temperature = 0.7;
  }
  if (config.temperature < 0) {
    config.temperature = 0;
  }
  if (config.temperature > 2) {
    config.temperature = 2;
  }
  await chrome.storage.local.set({ [CONFIG_KEY]: { ...config } });
}

onMounted(() => {
  void loadConfig();
});
</script>

<style scoped>
.options {
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  padding: 20px;
  max-width: 760px;
  color: #151515;
  background: linear-gradient(180deg, #fbfbfb 0%, #f2f2f2 100%);
  min-height: 100vh;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.subtitle {
  margin: 6px 0 0;
  color: #666;
  font-size: 13px;
}
.primary {
  background: #151515;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.08s ease, box-shadow 0.08s ease, opacity 0.08s ease;
}
.primary:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.18);
}
.primary:active {
  transform: translateY(1px);
  opacity: 0.9;
}
.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}
.form {
  display: grid;
  gap: 16px;
}
.card {
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.04);
}
.card h2 {
  margin: 0 0 12px;
  font-size: 16px;
}
label {
  display: grid;
  gap: 6px;
  font-size: 14px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
input {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #dcdcdc;
}
.hint {
  margin: 8px 0 0;
  color: #666;
  font-size: 12px;
}
</style>
