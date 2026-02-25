<template>
  <div class="options">
    <header class="header">
      <h1>TextOps 设置</h1>
      <button type="button" @click="saveConfig">保存</button>
    </header>

    <form class="form" @submit.prevent="saveConfig">
      <label>
        Base URL
        <input v-model.trim="config.baseUrl" type="text" />
      </label>
      <label>
        API Key
        <input v-model.trim="config.apiKey" type="password" />
      </label>
      <label>
        Model
        <input v-model.trim="config.model" type="text" />
      </label>
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
});

// 读取配置
async function loadConfig() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  if (stored[CONFIG_KEY]) {
    Object.assign(config, stored[CONFIG_KEY]);
  }
}

// 保存配置
async function saveConfig() {
  await chrome.storage.local.set({ [CONFIG_KEY]: { ...config } });
}

onMounted(() => {
  void loadConfig();
});
</script>

<style scoped>
.options {
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  padding: 16px;
  max-width: 520px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.form {
  display: grid;
  gap: 12px;
}
label {
  display: grid;
  gap: 6px;
  font-size: 14px;
}
input {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #dcdcdc;
}
</style>
