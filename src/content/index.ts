import type { RuntimeMessage } from "../shared/types";

const FLOATING_BUTTON_ID = "textops-floating-button";

// 读取选中文本
function getSelectedText(): string {
  const selection = window.getSelection();
  return selection?.toString().trim() ?? "";
}

// 注入悬浮按钮
function injectFloatingButton() {
  if (document.getElementById(FLOATING_BUTTON_ID)) return;
  const button = document.createElement("button");
  button.id = FLOATING_BUTTON_ID;
  button.type = "button";
  button.textContent = "TextOps";
  button.style.cssText = [
    "position:fixed",
    "right:16px",
    "top:50%",
    "transform:translateY(-50%)",
    "z-index:2147483647",
    "padding:10px 12px",
    "border-radius:999px",
    "border:1px solid #111",
    "background:#fff",
    "color:#111",
    "font-size:12px",
    "cursor:pointer",
  ].join(";");

  // 点击时请求后台打开 Popup
  button.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open-popup" } as RuntimeMessage);
  });

  document.documentElement.appendChild(button);
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "get-selection") {
    sendResponse({ type: "selection-result", payload: getSelectedText() } as RuntimeMessage);
  }
});

injectFloatingButton();
