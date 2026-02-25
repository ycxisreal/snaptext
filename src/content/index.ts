import type { RuntimeMessage } from "../shared/types";

const FLOATING_BUTTON_ID = "textops-floating-button";
const FLOATING_LOADER_ID = "textops-floating-loader";

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
    .btn.loading {
      cursor: progress;
      opacity: 0.7;
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

function setButtonLoading(active: boolean) {
  const host = document.getElementById(FLOATING_BUTTON_ID);
  const button = host?.shadowRoot?.querySelector("button");
  if (!button) return;
  if (active) {
    button.classList.add("loading");
    button.textContent = "处理中...";
  } else {
    button.classList.remove("loading");
    button.textContent = "TextOps";
  }
}

// 显示加载指示
function showLoadingIndicator() {
  if (document.getElementById(FLOATING_LOADER_ID)) return;
  const selection = window.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const rect = range ? range.getBoundingClientRect() : null;
  const host = document.createElement("div");
  host.id = FLOATING_LOADER_ID;
  host.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "pointer-events:none",
    "top:0",
    "left:0",
  ].join(";");

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .spinner {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid rgba(0,0,0,0.2);
      border-top-color: #111;
      animation: spin 0.8s linear infinite;
      background: #fff;
      box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  const spinner = document.createElement("div");
  spinner.className = "spinner";
  shadow.appendChild(style);
  shadow.appendChild(spinner);
  document.documentElement.appendChild(host);

  const left = rect ? rect.right + 6 : window.innerWidth - 60;
  const top = rect ? rect.top - 6 : window.innerHeight / 2;
  host.style.left = `${Math.max(8, Math.min(left, window.innerWidth - 24))}px`;
  host.style.top = `${Math.max(8, Math.min(top, window.innerHeight - 24))}px`;
}

// 隐藏加载指示
function hideLoadingIndicator() {
  const node = document.getElementById(FLOATING_LOADER_ID);
  if (node) node.remove();
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "get-selection") {
    sendResponse({ type: "selection-result", payload: getSelectedText() } as RuntimeMessage);
  }
  if (message.type === "loading") {
    const active = Boolean((message.payload as { active?: boolean } | undefined)?.active);
    if (active) {
      showLoadingIndicator();
      setButtonLoading(true);
    } else {
      hideLoadingIndicator();
      setButtonLoading(false);
    }
  }
});

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", injectFloatingButton, { once: true });
} else {
  injectFloatingButton();
}
