项目名称
TextOps AI Browser Extension

目标
实现一个基于 Chrome Manifest V3 的浏览器扩展。
功能为：用户在网页中选中一段文本后，通过右键菜单触发 AI 操作，并在扩展弹窗中展示结果。

所有输出均在扩展 Popup 页面中展示。
Popup 关闭后，数据必须持久化，下次打开仍可查看。
页面上需提供一个可点击的侧边悬浮按钮，用于快速打开 Popup。

————————————

一、整体功能定义

1. 文本选中后右键菜单包含以下选项：

* AI 总结（summarize）
* AI 评论（comment）
* AI 反驳（rebut）
* AI 延伸（expand）

2. 用户点击某个菜单项后：

* 获取当前选中的纯文本
* 发送至 AI API
* 返回结果
* 在 Popup 页面展示结果

3. Popup 页面要求：

* 展示历史记录（按时间倒序）
* 每条记录包含：

    * 原始选中文本
    * 操作类型（summarize/comment/rebut/expand）
    * AI 输出结果
    * 时间戳
* 支持删除单条记录
* 支持清空全部记录
* 支持复制结果

4. Popup 关闭后：

* 所有记录必须保存在 chrome.storage.local
* 再次打开 Popup 时自动读取并渲染

5. 页面悬浮按钮：

* 在每个页面注入一个固定定位按钮
* 位于右侧中部
* 点击后打开扩展 Popup（或触发 chrome.action.openPopup）
* 不影响页面正常交互
* 可通过设置关闭

————————————

二、技术规范

浏览器
Chrome (Manifest V3)

架构模块

1. background (service worker)

职责：

* 注册 contextMenus
* 监听菜单点击事件
* 接收选中文本
* 调用 AI API
* 将结果写入 chrome.storage.local
* 向 Popup 发送消息更新 UI

2. content script

职责：

* 读取当前页面选中文本
* 注入悬浮按钮
* 悬浮按钮点击时向 background 发送“打开 popup”消息

3. popup 页面（Vue3 + TypeScript）

职责：

* 从 chrome.storage.local 读取历史记录
* 渲染记录列表
* 支持删除 / 清空
* 监听 runtime 消息实时刷新
* 管理 API 配置（BaseURL、Key、Model）

————————————

三、数据结构定义

统一存储结构

key: "records"
type:
interface AIRecord {
id: string
action: "summarize" | "comment" | "rebut" | "expand"
inputText: string
outputText: string
url: string
pageTitle: string
timestamp: number
}

records: AIRecord[]

————————————

四、AI API 交互规范

由 background 统一发起请求。

配置项（存储于 storage.local）：

interface AIConfig {
baseUrl: string
apiKey: string
model: string
}

请求格式（示例）：

POST {baseUrl}

headers:
Authorization: Bearer {apiKey}
Content-Type: application/json

body:
{
model: "...",
messages: [
{ role: "system", content: "<根据 action 选择 prompt 模板>" },
{ role: "user", content: "<选中文本>" }
]
}

prompt 模板规范：

summarize:

* 输出结构化 Markdown
* 3~7 条要点
* 一句话总结

comment:

* 核心观点
* 支持点
* 反对点

rebut:

* 最强反驳逻辑
* 证据缺口
* 可验证问题

expand:

* 背景补充
* 延伸方向
* 进一步研究关键词

所有输出必须为 Markdown 文本。

————————————

五、权限最小化原则

manifest.json 需包含：

* "contextMenus"
* "storage"
* "activeTab"
* "scripting"
* "host_permissions": 仅允许配置的 API 域名

禁止：

* 全站静默抓取页面内容
* 自动发送整页文本
* 后台定时请求

仅在用户主动点击右键菜单时发送选中文本。

————————————

六、消息通信流程

1. 用户右键点击菜单
2. background 通过 tabs.sendMessage 请求 content script 获取选中文本
3. content script 返回文本
4. background 调用 AI API
5. background 将结果存入 storage
6. background 通过 runtime.sendMessage 通知 popup 刷新

Popup 需要在 mounted 时读取 storage，并监听 onMessage。

————————————

七、异常处理规范

必须处理：

* 无选中文本
* API 超时
* 401（Key 错误）
* 429（限流）
* 网络失败

错误记录不得写入 records。
Popup 需展示错误提示。

————————————

八、目录结构

src/
background/
content/
popup/
options/
shared/

public/
manifest.json
icons/

dist/（构建产物）
* background.js
* content.js
* popup.html / popup.js
* options.html / options.js
* assets/
* chunks/

目录职责说明

src/background/
* service worker 入口，负责注册右键菜单、处理菜单点击、调用 AI API、写入 storage、通知 popup 刷新

src/content/
* 内容脚本入口，负责读取选中文本、注入悬浮按钮（Shadow DOM、悬浮样式）、向后台发送“打开 popup”请求

src/popup/
* 扩展弹窗页面（Vue3），负责读取记录、展示列表、复制/删除/清空、接收刷新与错误消息

src/options/
* 设置页（Vue3），负责维护 AI 配置（BaseURL、Key、Model）

src/shared/
* 公共类型与消息结构定义

public/
* 静态资源与 manifest.json，构建时复制到 dist

public/icons/
* 扩展图标资源（需手动补齐）

dist/
* 打包输出目录，用于加载已解压扩展

————————————

九、需要补全的资源文件清单（手动添加）

图标资源（manifest.json 引用）
* public/icons/icon-16.png（16x16）
* public/icons/icon-32.png（32x32）
* public/icons/icon-128.png（128x128）

————————————

十、扩展约束

* 不实现用户登录系统
* 不实现服务端
* 不实现 Key 加密服务器
* 所有数据仅本地存储

————————————

十一、完成标准

满足以下条件视为完成：

* 右键四个功能可正常调用 API
* Popup 可展示历史
* 关闭再打开数据仍在
* 悬浮按钮可打开 Popup
* 无明显权限冗余
* 无控制台报错

————————————

十二、TODO

已完成
* 创建基础目录结构：src/background、src/content、src/popup、src/options、src/shared、public/icons
* 添加基础类型定义与消息结构
* 添加 background、content、popup、options 的基础代码骨架
* 创建 manifest.json 与 popup/options 基础页面
* 新增 Vite 构建配置与 TypeScript 基础配置
* 增加基础 AI 请求与错误通知骨架
* dist 产物已输出：background.js、content.js、popup/options 相关文件

待办
* 完善 AI API 调用逻辑与错误处理细节
* 补齐图标资源与悬浮按钮开关配置
* 校验 manifest.json 的 host_permissions 为真实 API 域名
* 完成 popup 与 options 的完整交互与样式
