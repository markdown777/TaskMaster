# Vision 配置 + Doubao 接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不影响现有“文本 AI 解析（NLP）”能力的前提下，新增独立的“图片识别（Vision/OCR）”模型配置，并接入 Doubao（火山方舟 Ark）以支持粘贴聊天截图 → 自动解析为任务。

**Architecture:** 将 AI 配置拆分为两套：`AI_CONFIG` 负责文本解析；新增 `VISION_CONFIG` 负责图片解析。前台粘贴图片时仅使用 `VISION_CONFIG`（Provider/BaseURL/Model/Key），文本解析仍使用 `AI_CONFIG`。Doubao 的 curl 粘贴解析在设置页完成：解析 Base URL / API Key / Model 并填入表单，点击“保存设置”后按现有加密策略落盘（复用同一 PIN）。

**Tech Stack:** Vanilla JS、Chrome Extension MV3、Fetch API、Web Crypto API（PBKDF2 + AES-GCM）、Volcengine Ark REST API。

---

## 文件结构变更

**Modify**
- `options.html`：新增 “🖼️ 图片识别（Vision/OCR）配置” 区块；新增 curl 粘贴解析 UI
- `options.js`：新增 `VISION_CONFIG` 的读取/保存；实现 Doubao curl 解析与“应用到 Vision 配置”交互；PIN 复用逻辑
- `popup.js`：图片粘贴流程改为读取 `VISION_CONFIG`（而非 `AI_CONFIG`）；新增 Vision 解锁/解密 session key（复用相同 PIN 输入框）
- `services/ai.js`：新增/完善 Doubao provider 的文本与图片请求组装；对 `response_format` 做兼容降级；错误信息人话化

**Create**
- `tests/visionCurlParser.test.js`：Node 运行的轻量测试（不引入测试框架）

---

### Task 1: 定义 Vision 配置与存储键

**Files:**
- Modify: `options.js`
- Modify: `popup.js`

- [ ] **Step 1: 在 options.js 定义 VISION 默认结构并支持 loadSettings**

实现目标：
- `VISION_CONFIG` 结构（示例）：
  - `provider`: `'doubao' | 'openai' | 'off'`
  - `baseUrl`: string
  - `model`: string
  - `enableEncryption`: boolean（复用现有 PIN）
  - `hasKey`: boolean
- 读取与写入使用 `window.storageAdapter.get/set`

- [ ] **Step 2: 在 popup.js 增加 getSessionVisionApiKey()**

实现目标：
- 明文模式：读取 `VISION_PLAINTEXT_KEY`
- 加密模式：从 `chrome.storage.session`（或 `sessionStorage`）读取 `VISION_DECRYPTED_KEY`
- 解锁 PIN 弹窗复用现有 UI；解密成功后将 key 写入 `VISION_DECRYPTED_KEY`

- [ ] **Step 3: 手工验证**

验证点：
- 不配置 Vision 时粘贴图片：提示用户先配置 Vision
- 配置了 Vision 明文 key：粘贴图片不弹 PIN
- 配置了 Vision 加密 key：粘贴图片会弹 PIN，解锁后继续解析

---

### Task 2: 设置页新增 Vision 区块与 Provider=Doubao

**Files:**
- Modify: `options.html`
- Modify: `options.js`

- [ ] **Step 1: options.html 增加 Vision 配置 UI**

UI 需求（建议字段）：
- Provider 下拉框（Off / Doubao / OpenAI）
- Base URL 输入框（Doubao 默认值：`https://ark.cn-beijing.volces.com/api/v3/chat/completions`）
- Model 输入框（可粘贴：`doubao-seed-2-0-code-preview-260215`）
- API Key 输入框（password）
- 启用加密 checkbox（提示：复用“AI 助理配置”的 PIN）
- curl 粘贴框（textarea）+ “解析填充”按钮

- [ ] **Step 2: options.js 实现 Vision 保存逻辑**

保存逻辑要求：
- provider/off 时：`VISION_CONFIG.provider = 'off'` 并清理 `VISION_*_KEY`
- provider 非 off：
  - 允许明文或加密落盘（复用 PIN：使用现有 `aiPinCode` 输入的值）
  - 维持 `VISION_CONFIG.hasKey`

- [ ] **Step 3: 手工验证**

验证点：
- Provider 切换显示/隐藏对应字段
- 保存后刷新设置页能正确回显（provider/baseUrl/model/是否已配置 key）

---

### Task 3: Doubao curl 自动识别（B 方案）

**Files:**
- Modify: `options.js`
- Create: `tests/visionCurlParser.test.js`

- [ ] **Step 1: 在 options.js 实现 parseDoubaoCurl(curlText)**

解析规则：
- URL：匹配 `curl` 后的第一个 URL（支持反引号/引号包裹）
- API Key：匹配 `Authorization: Bearer <token>`
- Model：匹配 JSON 里的 `"model": "<value>"`

返回：
```js
{ baseUrl, apiKey, model }
```

- [ ] **Step 2: 设置页交互（B）**

实现目标：
- 无论当前是否选择 Doubao，只要在 Vision 区块的 curl textarea 粘贴（或在页面任意位置捕获到符合特征的 curl 文本），就弹出确认：
  - `confirm("检测到 Doubao curl 配置，是否应用到图片识别配置？")`
- 用户确认后自动：
  - Provider 切换为 Doubao
  - 填充 Base URL / API Key / Model
  - 仍需点击“保存设置”才会写入 storage

- [ ] **Step 3: 添加 Node 测试**

Create: `tests/visionCurlParser.test.js`

```js
const assert = require('assert');

const sample = String.raw`curl \`https://ark.cn-beijing.volces.com/api/v3/chat/completions\` \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ark-xxx" \
  -d $'{
    "model": "doubao-seed-2-0-code-preview-260215",
    "messages": [{"role":"user","content":"hi"}]
}'`;

function parseDoubaoCurl(curlText) {
  const urlMatch = curlText.match(/curl\\s+[`'"]?(https?:\\/\\/[^\\s`'"]+)[`'"]?/i);
  const authMatch = curlText.match(/Authorization:\\s*Bearer\\s+([^"\\s\\\\]+)/i);
  const modelMatch = curlText.match(/"model"\\s*:\\s*"([^"]+)"/i);
  return {
    baseUrl: urlMatch ? urlMatch[1] : null,
    apiKey: authMatch ? authMatch[1] : null,
    model: modelMatch ? modelMatch[1] : null,
  };
}

const parsed = parseDoubaoCurl(sample);
assert.strictEqual(parsed.baseUrl, 'https://ark.cn-beijing.volces.com/api/v3/chat/completions');
assert.strictEqual(parsed.apiKey, 'ark-xxx');
assert.strictEqual(parsed.model, 'doubao-seed-2-0-code-preview-260215');
console.log('OK');
```

- [ ] **Step 4: 运行测试**

Run:
```bash
node tests/visionCurlParser.test.js
```
Expected: 输出 `OK`

---

### Task 4: AIService 增加 Doubao Vision provider（图片解析）

**Files:**
- Modify: `services/ai.js`

- [ ] **Step 1: 扩展 parseTaskFromImage 支持 provider=doubao**

请求组装（按用户 curl 示例）：
```js
{
  model: visionModelFromConfig,
  messages: [{
    role: "user",
    content: [
      { type: "image_url", image_url: { url: base64DataUrlOrRemoteUrl } },
      { type: "text", text: "请从图片中提取任务信息，并仅输出 JSON。" }
    ]
  }],
  temperature: 0.1
}
```

- [ ] **Step 2: response_format 兼容降级**

策略：
- 第一次请求带 `response_format: { type: "json_object" }`（如果 provider 支持）
- 若返回 400 且提示不支持（或解析失败），移除 `response_format` 重试一次

- [ ] **Step 3: 错误提示人话化**

策略：
- 如果后端返回 `unknown variant image_url` 或类似：提示用户“当前 Vision provider 不支持图片输入”
- 如果 401/403：提示“API Key 无效或无权限”
- 其他：透传简化后的 message

---

### Task 5: popup 粘贴图片走 VISION_CONFIG（不影响文本 AI）

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: 将 paste handler 改为 processVisionImage(base64)**

实现目标：
- 粘贴图片后：
  - 读取 `VISION_CONFIG`
  - 若 provider 为 off 或没配置 key：提示用户去设置页配置
  - 获取 Vision session key（必要时弹 PIN 解锁）
  - 调用 `aiService.parseTaskFromImage(base64, apiKey, provider, baseUrl, model)`

- [ ] **Step 2: 文本 AI 完全不改动**

验证点：
- 输入自然语言仍调用 `AI_CONFIG`（DeepSeek/OpenAI）
- 粘贴图片完全不读取 `AI_CONFIG`

- [ ] **Step 3: 手工回归验证**

建议验证步骤：
- 文本：在 AI 模式输入“明天下午三点开会”，可正常解析
- 图片：粘贴一张聊天截图，能自动生成任务标题、时间、备注

---

### Task 6: 文档与版本说明（可选）

**Files:**
- Modify: `UPDATE_NOTES_v3.0.0_TO_v3.5.0.md`

- [ ] **Step 1: 增加第三阶段（Vision/OCR）说明**

要点：
- 新增 Vision 配置独立区块
- 支持 Doubao（Ark）视觉模型
- 支持粘贴 curl 自动填充配置

