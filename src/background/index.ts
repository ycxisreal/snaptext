import type { ActionType, AIRecord, RuntimeMessage } from "../shared/types";

const MENU_IDS: Record<ActionType, ActionType> = {
  summarize: "summarize",
  comment: "comment",
  rebut: "rebut",
  expand: "expand",
};

const RECORDS_KEY = "records";

// 初始化右键菜单
function registerContextMenus() {
  chrome.contextMenus.removeAll(() => {
    Object.values(MENU_IDS).forEach((id) => {
      chrome.contextMenus.create({
        id,
        title: `AI ${id}`,
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

// 生成请求参数并调用 AI 接口（占位）
async function callAI(action: ActionType, inputText: string): Promise<string> {
  void action;
  void inputText;
  return "TODO: 调用 AI API 并返回 Markdown 文本";
}

// 处理菜单点击事件
async function handleMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
  const action = info.menuItemId as ActionType;
  if (!tab?.id) return;

  const inputText = await requestSelectedText(tab.id);
  if (!inputText) return;

  const outputText = await callAI(action, inputText);
  const record: AIRecord = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    action,
    inputText,
    outputText,
    url: tab.url ?? "",
    pageTitle: tab.title ?? "",
    timestamp: Date.now(),
  };
  await saveRecord(record);
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
    chrome.action.openPopup();
  }
});
