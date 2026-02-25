import type { RuntimeMessage } from "../shared/types";

const FLOATING_BUTTON_ID = "textops-floating-button";

// 读取选中文本
function getSelectedText(): string {
  const selection = window.getSelection();
  return selection?.toString().trim() ?? "";
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
      padding: 10px 14px;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
      transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
      opacity: 0.9;
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
  button.textContent = "TextOps";
  button.setAttribute("aria-label", "打开 TextOps");

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

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "get-selection") {
    sendResponse({ type: "selection-result", payload: getSelectedText() } as RuntimeMessage);
  }
});

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", injectFloatingButton, { once: true });
} else {
  injectFloatingButton();
}
