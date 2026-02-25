import type { RuntimeMessage } from "../shared/types";

const FLOATING_BUTTON_ID = "textops-floating-button";
let lastSelectionRect: DOMRect | null = null;

// 读取选中文本
function getSelectedText(): string {
  const selection = window.getSelection();
  return selection?.toString().trim() ?? "";
}

// 记录最近一次选区位置
function captureSelectionRect() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    lastSelectionRect = null;
    return;
  }
  const range = selection.getRangeAt(0);
  if (!range || range.collapsed) {
    lastSelectionRect = null;
    return;
  }
  const rect = range.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    lastSelectionRect = rect;
  }
}

// 注入悬浮按钮（使用 Shadow DOM 防止样式冲突）
function injectFloatingButton() {
  if (document.getElementById(FLOATING_BUTTON_ID)) return;
  const host = document.createElement("div");
  host.id = FLOATING_BUTTON_ID;
  host.style.cssText = [
    "position:fixed",
    "right:16px",
    "top:50%",
    "transform:translateY(-50%)",
    "z-index:2147483647",
    "pointer-events:none",
  ].join(";");

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .btn {
      all: initial;
      pointer-events: auto;
      font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #111;
      color: #fff;
      border-radius: 999px;
      border: 1px solid #111;
      padding: 6px 14px;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
      transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
      opacity: 0.9;
    }
    .btn.loading {
      cursor: progress;
      opacity: 0.6;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
      opacity: 1;
    }
    .btn:active {
      transform: translateY(0);
      opacity: 0.85;
    }
  `;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.textContent = "SnapText";
  button.setAttribute("aria-label", "打开 SnapText");

  // 点击时请求后台打开 Popup
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: "open-popup" } as RuntimeMessage);
  });

  shadow.appendChild(style);
  shadow.appendChild(button);
  document.documentElement.appendChild(host);
}

function setButtonLoading(active: boolean) {
  const host = document.getElementById(FLOATING_BUTTON_ID);
  const button = host?.shadowRoot?.querySelector("button");
  if (!button) return;
  if (active) {
    button.classList.add("loading");
    button.textContent = "处理中...";
  } else {
    button.classList.remove("loading");
    button.textContent = "SnapText";
  }
}

// 显示加载指示
// 保留选区记录以备后续需求

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "get-selection") {
    sendResponse({ type: "selection-result", payload: getSelectedText() } as RuntimeMessage);
  }
  if (message.type === "loading") {
    const active = Boolean((message.payload as { active?: boolean } | undefined)?.active);
    if (active) {
      setButtonLoading(true);
    } else {
      setButtonLoading(false);
    }
  }
});

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", injectFloatingButton, { once: true });
} else {
  injectFloatingButton();
}

document.addEventListener("selectionchange", captureSelectionRect);
window.addEventListener("mouseup", captureSelectionRect);
window.addEventListener("keyup", captureSelectionRect);
