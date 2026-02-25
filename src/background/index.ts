import type { ActionType, AIConfig, AIRecord, RuntimeMessage } from "../shared/types";

const MENU_IDS: Record<ActionType, ActionType> = {
  summarize: "summarize",
  comment: "comment",
  rebut: "rebut",
  expand: "expand",
};

const RECORDS_KEY = "records";
const CONFIG_KEY = "ai-config";
const LAST_ERROR_KEY = "last-error";

// 初始化右键菜单
function registerContextMenus() {
  chrome.contextMenus.removeAll(() => {
    Object.values(MENU_IDS).forEach((id) => {
      const titleMap: Record<ActionType, string> = {
        summarize: "AI 压缩总结",
        comment: "AI 发表评论",
        rebut: "AI 反驳",
        expand: "AI 延伸",
      };
      chrome.contextMenus.create({
        id,
        title: titleMap[id],
        contexts: ["selection"],
      });
    });
  });
}

// 获取当前页面选中文本
async function requestSelectedText(tabId: number): Promise<string> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "get-selection" } as RuntimeMessage,
      (response?: RuntimeMessage) => {
        const text = typeof response?.payload === "string" ? response.payload : "";
        resolve(text);
      }
    );
  });
}

// 写入一条记录并通知 Popup 刷新
async function saveRecord(record: AIRecord) {
  const current = await chrome.storage.local.get(RECORDS_KEY);
  const records = Array.isArray(current[RECORDS_KEY]) ? current[RECORDS_KEY] : [];
  records.unshift(record);
  await chrome.storage.local.set({ [RECORDS_KEY]: records });
  chrome.runtime.sendMessage({ type: "records-updated" } as RuntimeMessage);
}

// 写入错误信息，供 Popup 展示
async function saveLastError(message: string) {
  await chrome.storage.local.set({
    [LAST_ERROR_KEY]: { message, timestamp: Date.now() },
  });
  chrome.runtime.sendMessage({ type: "error", payload: message } as RuntimeMessage);
}

// 清除错误信息
async function clearLastError() {
  await chrome.storage.local.remove(LAST_ERROR_KEY);
}

// 尝试打开 Popup
async function openPopupSafe() {
  try {
    await chrome.action.openPopup();
  } catch (error) {
    const message =
      error instanceof Error ? `无法打开弹窗：${error.message}` : "无法打开弹窗，请点击扩展图标";
    await saveLastError(message);
  }
}

// 读取 AI 配置
async function loadConfig(): Promise<AIConfig | null> {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  if (!stored[CONFIG_KEY]) return null;
  return stored[CONFIG_KEY] as AIConfig;
}

// 规范化配置并补齐默认值
function normalizeConfig(config: AIConfig): AIConfig {
  return {
    baseUrl: config.baseUrl ?? "",
    apiKey: config.apiKey ?? "",
    model: config.model ?? "",
    temperature: Number.isFinite(config.temperature) ? config.temperature : 0.7,
  };
}

// 根据动作生成 prompt
function buildPrompt(action: ActionType): string {
  switch (action) {
    case "summarize":
      return "压缩文本内容，去除不必要的部分，保证文本压缩至精华";
    case "comment":
      return "以一个网民的身份为文本做出评论内容，不需要长篇大论，而是以真实网民的身份，发表一个评论的内容";
    case "rebut":
      return "请对给出的文本做出最强反驳，语气：嘲讽、讽刺、有力、不给予对方反驳的机会，拒绝AI感，像真人一样回复";
    case "expand":
      return "请为文本进行合理的拓展延伸，输出的文字请衔接文本下文。";
    default:
      return "请输出结果。";
  }
}

// 构建 API 请求地址
function buildApiUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();
  if (trimmed.endsWith("/v1/chat/completions")) {
    return trimmed;
  }
  return `${trimmed.replace(/\/+$/, "")}/v1/chat/completions`;
}

// 生成请求参数并调用 AI 接口
async function callAI(action: ActionType, inputText: string) {
  const configRaw = await loadConfig();
  if (!configRaw) {
    throw new Error("AI 配置不完整，请在设置页填写。");
  }
  const config = normalizeConfig(configRaw);
  if (!config?.baseUrl || !config?.apiKey || !config?.model) {
    throw new Error("AI 配置不完整，请在设置页填写。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const messages = [
    { role: "system", content: "[总体要求：输出严格禁止markdown格式；严禁过多划分段落、标题、序号；严禁输出与要求不相关内容]" + buildPrompt(action) },
    { role: "user", content: inputText },
  ];
  const temperature = Math.min(2, Math.max(0, Number(config.temperature)));

  const response = await fetch(buildApiUrl(config.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
    }),
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout);
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("请求失败：401（Key 错误或无权限）");
    }
    if (response.status === 429) {
      throw new Error("请求失败：429（请求过于频繁）");
    }
    throw new Error(`请求失败：${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("AI 返回内容为空");
  }
  return {
    content,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

// 处理菜单点击事件
async function handleMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
  const action = info.menuItemId as ActionType;
  if (!tab?.id) return;

  // 优先使用 contextMenus 提供的选中文本，避免选区丢失
  const inputText =
    typeof info.selectionText === "string" && info.selectionText.trim()
      ? info.selectionText.trim()
      : await requestSelectedText(tab.id);
  if (!inputText) {
    await saveLastError("未检测到选中文本");
    await openPopupSafe();
    return;
  }

  try {
    const output = await callAI(action, inputText);
    const record: AIRecord = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      action,
      inputText,
      outputText: output.content,
      url: tab.url ?? "",
      pageTitle: tab.title ?? "",
      timestamp: Date.now(),
      usage: output.usage,
    };
    await clearLastError();
    await saveRecord(record);
    await openPopupSafe();
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "请求超时，请稍后再试"
        : error instanceof Error
        ? error.message
        : "未知错误";
    await saveLastError(message);
    await openPopupSafe();
  }
}

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenus();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleMenuClick(info, tab);
});

// 处理内容脚本请求打开 Popup
chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type === "open-popup") {
    void openPopupSafe();
  }
});
