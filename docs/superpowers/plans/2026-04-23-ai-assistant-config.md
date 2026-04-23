# AI Assistant Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "AI Assistant Configuration" UI in the Options page, supporting BYOK (Bring Your Own Key) with DeepSeek as the default provider, secured via AES-256-GCM encryption using a user-provided PIN.

**Architecture:** We will introduce an `adapters/` directory to decouple Chrome APIs and implement `CryptoAdapter` for AES encryption and `StorageAdapter` for safe storage access. The Options page will collect the API Provider, API Key, and an Encryption PIN, encrypt the key, and save it securely to `chrome.storage.local`.

**Tech Stack:** HTML/CSS/JS (Vanilla), Chrome Manifest V3 (`chrome.storage.local`, `chrome.storage.session`), Web Crypto API (`crypto.subtle`).

---

### Task 1: Create the Storage Adapter

**Files:**
- Create: `adapters/storage.js`

- [ ] **Step 1: Write the StorageAdapter implementation**

```javascript
// adapters/storage.js
class StorageAdapter {
  constructor() {
    this.isChrome = typeof chrome !== 'undefined' && chrome.storage;
  }

  async get(key) {
    if (this.isChrome) {
      return new Promise(resolve => {
        chrome.storage.local.get([key], result => resolve(result[key]));
      });
    }
    // Fallback for future platforms (e.g. wx.getStorage)
    return localStorage.getItem(key);
  }

  async set(key, value) {
    if (this.isChrome) {
      return new Promise(resolve => {
        const obj = {};
        obj[key] = value;
        chrome.storage.local.set(obj, resolve);
      });
    }
    localStorage.setItem(key, value);
  }
}

// Attach to window for global access
window.storageAdapter = new StorageAdapter();
```

- [ ] **Step 2: Commit the changes**

```bash
git add adapters/storage.js
git commit -m "feat: create StorageAdapter for cross-platform storage abstraction"
```

### Task 2: Create the Crypto Adapter for AES-256-GCM

**Files:**
- Create: `adapters/crypto.js`

- [ ] **Step 1: Write the CryptoAdapter implementation**

```javascript
// adapters/crypto.js
class CryptoAdapter {
  /**
   * Generates an AES-GCM key from a user PIN using PBKDF2
   */
  async _getKeyMaterial(pin) {
    const enc = new TextEncoder();
    return crypto.subtle.importKey(
      "raw", 
      enc.encode(pin), 
      { name: "PBKDF2" }, 
      false, 
      ["deriveBits", "deriveKey"]
    );
  }

  async _getKey(keyMaterial, salt) {
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypts plaintext using AES-256-GCM with a user-provided PIN
   */
  async encrypt(plaintext, pin) {
    if (!plaintext || !pin) return null;
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const keyMaterial = await this._getKeyMaterial(pin);
    const key = await this._getKey(keyMaterial, salt);
    
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(plaintext)
    );
    
    // Combine salt, iv, and ciphertext into a single base64 string
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode.apply(null, combined));
  }

  /**
   * Decrypts ciphertext using AES-256-GCM with a user-provided PIN
   */
  async decrypt(ciphertextB64, pin) {
    if (!ciphertextB64 || !pin) return null;
    
    try {
      const combinedStr = atob(ciphertextB64);
      const combined = new Uint8Array(combinedStr.length);
      for (let i = 0; i < combinedStr.length; i++) {
        combined[i] = combinedStr.charCodeAt(i);
      }
      
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const data = combined.slice(28);
      
      const keyMaterial = await this._getKeyMaterial(pin);
      const key = await this._getKey(keyMaterial, salt);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
      );
      
      const dec = new TextDecoder();
      return dec.decode(decrypted);
    } catch (e) {
      console.error("Decryption failed:", e);
      return null;
    }
  }
}

// Attach to window for global access
window.cryptoAdapter = new CryptoAdapter();
```

- [ ] **Step 2: Commit the changes**

```bash
git add adapters/crypto.js
git commit -m "feat: create CryptoAdapter for AES-256-GCM encryption of API keys"
```

### Task 3: Update Options UI (HTML & CSS)

**Files:**
- Modify: `options.html`
- Modify: `options.js`

- [ ] **Step 1: Add adapter scripts and UI to `options.html`**

Find the `<script src="utils.js"></script>` tag and add the new scripts before `options.js`:
```html
<script src="adapters/storage.js"></script>
<script src="adapters/crypto.js"></script>
<script src="utils.js"></script>
```

Add the AI Settings section right after the Security Settings section (`<div class="settings-section">...</div>`):
```html
      <!-- AI 助理配置 -->
      <div class="settings-section">
        <h2>✨ AI 助理配置</h2>
        <p class="section-desc">配置大语言模型接口，启用智能自然语言解析与截图任务提取功能。</p>
        
        <div class="form-group">
          <label for="aiProvider">模型提供商</label>
          <select id="aiProvider" class="form-control">
            <option value="deepseek">DeepSeek (默认，推荐)</option>
            <option value="openai">OpenAI (兼容格式)</option>
          </select>
        </div>

        <div class="form-group" id="customUrlGroup" style="display: none;">
          <label for="aiBaseUrl">自定义接口地址 (Base URL)</label>
          <input type="url" id="aiBaseUrl" class="form-control" placeholder="例如: https://api.deepseek.com/v1">
        </div>

        <div class="form-group">
          <label for="aiApiKey">API Key</label>
          <input type="password" id="aiApiKey" class="form-control" placeholder="输入您的 API Key">
          <p class="help-text" id="deepseekHelp">
            没有 Key？<a href="https://platform.deepseek.com/" target="_blank">点击前往 DeepSeek 开放平台免费申请</a>。
          </p>
        </div>

        <div class="form-group">
          <label for="aiPinCode">安全加密 PIN 码</label>
          <input type="password" id="aiPinCode" class="form-control" placeholder="设置一个4位数PIN码用于加密您的 API Key" maxlength="4">
          <p class="help-text">您的 API Key 将通过此 PIN 码加密并仅存储在本地。每次重启浏览器需要输入此 PIN 解锁。</p>
        </div>
      </div>
```

- [ ] **Step 2: Add logic to `options.js`**

Add event listeners for the new fields in `document.addEventListener('DOMContentLoaded', ...)`:
```javascript
  document.getElementById('aiProvider').addEventListener('change', toggleAiProvider);
```

Add the function `toggleAiProvider`:
```javascript
function toggleAiProvider() {
  const provider = document.getElementById('aiProvider').value;
  const customUrlGroup = document.getElementById('customUrlGroup');
  const deepseekHelp = document.getElementById('deepseekHelp');
  
  if (provider === 'openai') {
    customUrlGroup.style.display = 'block';
    deepseekHelp.style.display = 'none';
  } else {
    customUrlGroup.style.display = 'none';
    deepseekHelp.style.display = 'block';
  }
}
```

Update `saveSettings` to include the AI configuration:
```javascript
async function saveSettings() {
  // ... existing code ...
  
  const provider = document.getElementById('aiProvider').value;
  const baseUrl = document.getElementById('aiBaseUrl').value;
  const apiKey = document.getElementById('aiApiKey').value;
  const pinCode = document.getElementById('aiPinCode').value;

  const aiConfig = {
    provider: provider,
    baseUrl: baseUrl
  };

  // Encrypt and save API key if provided
  if (apiKey && pinCode) {
    if (pinCode.length < 4) {
      alert("PIN 码必须至少4位");
      return;
    }
    try {
      const encryptedKey = await window.cryptoAdapter.encrypt(apiKey, pinCode);
      await window.storageAdapter.set('AI_ENCRYPTED_KEY', encryptedKey);
      
      // We also store a flag indicating a key is configured
      aiConfig.hasKey = true;
    } catch (e) {
      console.error("Encryption failed", e);
      alert("加密 API Key 失败，请重试。");
      return;
    }
  }

  await window.storageAdapter.set('AI_CONFIG', aiConfig);

  // ... existing save logic ...
  const saveBtn = document.getElementById('saveSettings');
  saveBtn.textContent = '保存成功！';
  setTimeout(() => {
    saveBtn.textContent = '保存设置';
  }, 2000);
}
```

Update `loadSettings` to fetch the AI configuration:
```javascript
async function loadSettings() {
  // ... existing load logic ...
  const aiConfig = await window.storageAdapter.get('AI_CONFIG') || { provider: 'deepseek', baseUrl: '' };
  document.getElementById('aiProvider').value = aiConfig.provider || 'deepseek';
  document.getElementById('aiBaseUrl').value = aiConfig.baseUrl || '';
  
  if (aiConfig.hasKey) {
    document.getElementById('aiApiKey').placeholder = '已配置 (已加密，请重新输入更新)';
  }

  toggleAiProvider();
}
```

- [ ] **Step 3: Commit the changes**

```bash
git add options.html options.js
git commit -m "feat: add AI Assistant configuration UI with BYOK and AES encryption"
```
