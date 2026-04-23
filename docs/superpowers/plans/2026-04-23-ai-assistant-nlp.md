# AI Assistant NLP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the AI Service and Popup UI to parse natural language into structured task data using DeepSeek/OpenAI, with secure PIN-based decryption.

**Architecture:** We will create `adapters/network.js` for fetch abstraction, and `services/ai.js` to handle the LLM API calls with a strict JSON-output system prompt. The popup will feature an AI entry button. If the API key is encrypted and not yet unlocked in the current session, the popup will prompt the user for their PIN, decrypt the key, save it to `chrome.storage.session`, and execute the natural language parsing.

**Tech Stack:** Vanilla JS, Chrome Manifest V3 (`chrome.storage.session`), Fetch API.

---

### Task 1: Create Network Adapter

**Files:**
- Create: `adapters/network.js`

- [ ] **Step 1: Write the NetworkAdapter implementation**

```javascript
// adapters/network.js
class NetworkAdapter {
  async post(url, headers, body) {
    // In Chrome extensions, we can just use fetch. 
    // This abstraction allows future replacement with wx.request for miniprograms.
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    return await response.json();
  }
}

window.networkAdapter = new NetworkAdapter();
```

- [ ] **Step 2: Commit the changes**

```bash
git add adapters/network.js
git commit -m "feat: create NetworkAdapter for cross-platform request abstraction"
```

### Task 2: Create AI Service

**Files:**
- Create: `services/ai.js`

- [ ] **Step 1: Write the AIService implementation**

```javascript
// services/ai.js
class AIService {
  constructor(networkAdapter) {
    this.network = networkAdapter;
    this.defaultDeepSeekUrl = 'https://api.deepseek.com/v1/chat/completions';
    this.defaultOpenAIUrl = 'https://api.openai.com/v1/chat/completions';
  }

  /**
   * Parses natural language into a task object using LLM
   */
  async parseTaskFromText(text, apiKey, provider, customBaseUrl) {
    const baseUrl = customBaseUrl || (provider === 'openai' ? this.defaultOpenAIUrl : this.defaultDeepSeekUrl);
    // DeepSeek API is fully compatible with OpenAI's Chat Completion format
    const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const model = provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat';

    const systemPrompt = `你是一个专业的任务解析助手。请从用户的输入中提取待办任务的核心要素，并严格以JSON格式返回。
必须包含以下字段：
- "title": 任务的简短标题 (字符串)
- "due_date": 任务的截止时间 (如果提到)，格式必须是 "YYYY-MM-DD HH:mm:ss"。当前时间是 ${new Date().toLocaleString('zh-CN')}。如果没有明确时间，返回 null。
- "priority": 优先级，必须是 "high", "medium" 或 "low"。默认为 "medium"。
- "tags": 标签数组 (字符串数组)，如 ["会议", "工作"]。
- "notes": 详细的备注信息，提炼用户的核心要点。

请不要输出任何 Markdown 标记（如 \`\`\`json），只输出纯 JSON 字符串。`;

    const body = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const response = await this.network.post(endpoint, headers, body);
    
    try {
      const content = response.choices[0].message.content.trim();
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse LLM response as JSON:", response);
      throw new Error("模型返回的数据无法解析为JSON");
    }
  }
}

window.aiService = new AIService(window.networkAdapter);
```

- [ ] **Step 2: Commit the changes**

```bash
git add services/ai.js
git commit -m "feat: create AIService for LLM natural language parsing"
```

### Task 3: Update Popup UI for AI Input and PIN Unlocking

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`

- [ ] **Step 1: Add new script tags and UI elements to `popup.html`**

In `popup.html`, before `<script src="popup.js"></script>`, add:
```html
  <script src="adapters/storage.js"></script>
  <script src="adapters/crypto.js"></script>
  <script src="adapters/network.js"></script>
  <script src="services/ai.js"></script>
```

In `popup.html`, next to the search input or task input, add an AI toggle button. Inside `<div class="header">`, let's add an AI button:
```html
    <div class="header">
      <h1>TaskMaster</h1>
      <div class="header-actions">
        <button id="ai-toggle-btn" class="icon-btn" title="✨ AI 智能录入">✨</button>
        <button id="options-btn" class="icon-btn" title="设置">⚙️</button>
      </div>
    </div>
```

Add the PIN Prompt Modal at the bottom of `popup.html` (before `</body>`):
```html
  <!-- PIN Prompt Modal -->
  <div id="pin-modal" class="modal" hidden>
    <div class="modal-content">
      <h3>解锁 AI 助理</h3>
      <p>请输入您在设置中配置的 4 位安全 PIN 码以解密 API Key。</p>
      <input type="password" id="pin-input" class="form-control" maxlength="4" placeholder="****">
      <div class="modal-actions">
        <button id="pin-cancel-btn" class="secondary-btn">取消</button>
        <button id="pin-submit-btn" class="primary-btn">解锁</button>
      </div>
      <p id="pin-error" class="error-text" hidden>PIN码错误或解密失败</p>
    </div>
  </div>
```

- [ ] **Step 2: Add styles to `popup.css`**

Append to `popup.css`:
```css
/* AI Button & Modal Styles */
.header-actions {
  display: flex;
  gap: 8px;
}

#ai-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  transition: transform 0.2s;
}
#ai-toggle-btn:hover {
  transform: scale(1.1);
}

#ai-toggle-btn.active {
  background: var(--brand-color);
  border-radius: 4px;
}

.modal {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal[hidden] {
  display: none;
}
.modal-content {
  background: var(--bg-primary);
  padding: 20px;
  border-radius: 8px;
  width: 280px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.modal-content h3 { margin-top: 0; margin-bottom: 8px; }
.modal-content p { font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.error-text {
  color: #e74c3c;
  font-size: 12px;
  margin-top: 8px;
}
.primary-btn { background: var(--brand-color); color: var(--bg-primary); border: none; padding: 6px 12px; cursor: pointer; }
.secondary-btn { background: transparent; border: 1px solid var(--border-light); padding: 6px 12px; cursor: pointer; }
```

- [ ] **Step 3: Commit the changes**

```bash
git add popup.html popup.css
git commit -m "feat: add AI UI elements and PIN modal to popup"
```

### Task 4: Implement AI Logic in Popup

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: Write the integration logic in `popup.js`**

Add variables and event listeners inside the `DOMContentLoaded` block:
```javascript
  const aiToggleBtn = document.getElementById('ai-toggle-btn');
  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinSubmitBtn = document.getElementById('pin-submit-btn');
  const pinCancelBtn = document.getElementById('pin-cancel-btn');
  const pinError = document.getElementById('pin-error');
  
  let isAiMode = false;
  let pendingAiText = "";

  aiToggleBtn.addEventListener('click', () => {
    isAiMode = !isAiMode;
    aiToggleBtn.classList.toggle('active', isAiMode);
    taskInput.placeholder = isAiMode ? "✨ AI 模式: 输入自然语言 (如: 明天下午3点开会)" : "添加新任务...";
  });

  pinCancelBtn.addEventListener('click', () => {
    pinModal.hidden = true;
    pinInput.value = '';
    pinError.hidden = true;
  });

  pinSubmitBtn.addEventListener('click', async () => {
    const pin = pinInput.value;
    if (pin.length < 4) return;
    
    pinSubmitBtn.disabled = true;
    pinSubmitBtn.textContent = '解密中...';
    
    try {
      const encryptedKey = await window.storageAdapter.get('AI_ENCRYPTED_KEY');
      const decryptedKey = await window.cryptoAdapter.decrypt(encryptedKey, pin);
      
      if (!decryptedKey) throw new Error("解密失败");
      
      // Store in session storage for the lifetime of the browser
      if (chrome.storage && chrome.storage.session) {
        await chrome.storage.session.set({ 'AI_DECRYPTED_KEY': decryptedKey });
      } else {
        // Fallback for environments without session storage
        window.sessionStorage.setItem('AI_DECRYPTED_KEY', decryptedKey);
      }
      
      pinModal.hidden = true;
      pinInput.value = '';
      pinError.hidden = true;
      
      // Resume the AI parsing
      if (pendingAiText) {
        processAiInput(pendingAiText);
        pendingAiText = "";
      }
    } catch (e) {
      pinError.hidden = false;
    } finally {
      pinSubmitBtn.disabled = false;
      pinSubmitBtn.textContent = '解锁';
    }
  });

  async function getSessionApiKey() {
    if (chrome.storage && chrome.storage.session) {
      const data = await chrome.storage.session.get('AI_DECRYPTED_KEY');
      return data['AI_DECRYPTED_KEY'];
    }
    return window.sessionStorage.getItem('AI_DECRYPTED_KEY');
  }

  async function processAiInput(text) {
    const aiConfig = await window.storageAdapter.get('AI_CONFIG');
    if (!aiConfig || !aiConfig.hasKey) {
      alert("请先在设置页配置 AI 助理的 API Key");
      return;
    }

    const apiKey = await getSessionApiKey();
    if (!apiKey) {
      // Need PIN to unlock
      pendingAiText = text;
      pinModal.hidden = false;
      pinInput.focus();
      return;
    }

    // Change UI state to loading
    const originalPlaceholder = taskInput.placeholder;
    taskInput.placeholder = "✨ AI 正在思考中...";
    taskInput.disabled = true;

    try {
      const parsedTask = await window.aiService.parseTaskFromText(text, apiKey, aiConfig.provider, aiConfig.baseUrl);
      
      // Populate the form
      taskInput.value = parsedTask.title || text;
      
      if (parsedTask.priority) {
        document.getElementById('task-priority').value = parsedTask.priority;
      }
      
      if (parsedTask.tags && parsedTask.tags.length > 0) {
        document.getElementById('task-tags').value = parsedTask.tags.join(', ');
      }
      
      if (parsedTask.due_date) {
        // Format to local datetime-local string format: YYYY-MM-DDTHH:mm
        const dateObj = new Date(parsedTask.due_date);
        if (!isNaN(dateObj.getTime())) {
          const tzOffset = (new Date()).getTimezoneOffset() * 60000;
          const localISOTime = (new Date(dateObj - tzOffset)).toISOString().slice(0,16);
          document.getElementById('task-due').value = localISOTime;
          // Update due button visual
          const dueButton = document.getElementById('due-button');
          dueButton.textContent = '已设时间';
          dueButton.style.background = 'var(--brand-color)';
          dueButton.style.color = 'var(--bg-primary)';
        }
      }
      
      // Auto submit
      taskForm.dispatchEvent(new Event('submit'));
      
      // Reset AI mode
      isAiMode = false;
      aiToggleBtn.classList.remove('active');
      
    } catch (e) {
      console.error(e);
      alert("AI 解析失败: " + e.message);
    } finally {
      taskInput.disabled = false;
      taskInput.placeholder = "添加新任务...";
      taskInput.focus();
    }
  }
```

Intercept the form submission in `popup.js` to route to AI processing if AI mode is active:
```javascript
  // Inside the submit event listener for taskForm, at the very beginning:
  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = taskInput.value.trim();
    if (!title) return;

    if (isAiMode) {
      taskInput.value = ''; // clear input immediately for UX
      await processAiInput(title);
      return;
    }
    // ... existing submit logic ...
```

- [ ] **Step 2: Commit the changes**

```bash
git add popup.js
git commit -m "feat: implement AI natural language parsing and PIN decryption flow in popup"
```
