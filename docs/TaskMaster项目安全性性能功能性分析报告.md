# TaskMaster Chrome/Edge 浏览器插件项目分析报告

## 📊 项目概览

**TaskMaster** 是一个智能待办事项管理浏览器插件，目前有两个版本：
- **Chrome 版本** (v3.5.0) - 主版本，位于根目录
- **Edge 版本** (v3.5.0) - 基于 Chrome 版本适配，位于 `edge-version/` 目录

### 核心功能
- ✅ AI 智能自然语言解析（DeepSeek/OpenAI/豆包）
- ✅ BYOK 银行级硬件加密（AES-256-GCM）
- ✅ 任务管理（增删改查、置顶、归档）
- ✅ 跨设备同步（Sync + Local 混合存储）
- ✅ 自动备份（保留7天）
- ✅ 图片识别（Vision API）
- ✅ 搜索与过滤
- ✅ 数据导入导出

---

## 🔒 安全性分析

### 安全优点

| 方面 | 说明 | 评分 |
|------|------|------|
| **API Key 加密** | 使用 AES-256-GCM + PBKDF2 派生密钥，支持 PIN 码保护 | ⭐⭐⭐⭐ |
| **Session 存储** | 解密后的密钥仅存于 `chrome.storage.session`，浏览器关闭即销毁 | ⭐⭐⭐⭐⭐ |
| **XSS 防护** | 使用 `escapeHtml()` 函数防止 XSS 注入 | ⭐⭐⭐⭐ |
| **权限最小化** | 仅申请必要权限（storage, alarms, notifications, downloads） | ⭐⭐⭐⭐⭐ |
| **适配器模式** | 已有 `adapters/crypto.js` 和 `adapters/storage.js`，为多端扩展奠定基础 | ⭐⭐⭐⭐ |

### 🔍 深入分析：两套加密系统

在 v3.5.0 版本中，项目实际存在**两套独立的加密系统**：

#### 第一套：任务内容加密系统（旧系统）
| 项目 | 说明 |
|------|------|
| **用途** | 加密用户的**任务数据**（`task.text` 和 `task.notes`） |
| **密钥** | 用户设置的 `encryptionKey`（8位以上密码） |
| **存储位置** | 密钥在 `settings.encryptionKey`，加密数据在 `tasks` |
| **算法** | AES-256-GCM + PBKDF2（`iterations: 100000`） |
| **Salt** | ❌ 静态 Salt `'taskmaster-salt'` |
| **实现位置** | `options.js` 和 `utils.js` 内联函数 |
| **UI 位置** | 设置页面 → "安全" 部分 |
| **诞生时间** | v2.9.0 或更早 |

#### 第二套：API Key 加密系统（新系统，v3.5.0）
| 项目 | 说明 |
|------|------|
| **用途** | 加密用户的 **AI/Vision API Key**（敏感凭证） |
| **密钥** | 用户设置的 4 位 **PIN 码** |
| **存储位置** | 加密后的 Key 在 `AI_ENCRYPTED_KEY` / `VISION_ENCRYPTED_KEY`；<br>解密后的 Key 在 **Session Storage**（浏览器关闭后销毁） |
| **算法** | AES-256-GCM + PBKDF2（`iterations: 100000`） |
| **Salt** | ✅ 随机 Salt（16字节） |
| **实现位置** | `adapters/crypto.js`（已存在！） |
| **UI 位置** | 设置页面 → "✨ AI 助理配置" 和 "🖼️ 图片识别配置" |
| **诞生时间** | v3.5.0 |

#### 为什么有两套系统？（历史原因）

| 对比项 | 任务加密 | API Key 加密 |
|---------|---------|-------------|
| **加密对象** | 用户自己的任务数据 | 第三方服务凭证（金钱相关） |
| **解密频率** | 每次打开插件 | 每次浏览器重启（Session 机制） |
| **安全性要求** | 中等 | 高（防止被盗刷） |
| **记忆负担** | 用户可能忘记密钥 | 用户必须记住 PIN |

**核心原因**：v3.5.0 新增 AI 功能时，为了给小程序铺路，新建了 `adapters/` 目录，设计了更好的加密方案（随机 Salt、Session 存储），但**旧代码没有迁移**，导致两套系统并存。

### 安全问题与建议

#### 1. **两套加密系统并存，代码重复严重** 🔴

**问题**：
- `options.js` 有自己的 `encryptText()` / `decryptText()`
- `utils.js` 也有自己的 `encryptText()` / `decryptText()`
- `adapters/crypto.js` 有更好的 `encrypt()` / `decrypt()`
- 三个实现基本相同，但细节有差异
- `popup.html` 没有引用 `adapters/crypto.js`，导致 `popup.js` 又重复实现解密逻辑

**建议**：统一使用 `adapters/crypto.js`

#### 2. **旧系统使用静态 Salt** ⚠️
```javascript
// utils.js line 42 / options.js line 36
salt: encoder.encode('taskmaster-salt')  // 硬编码的静态 Salt
```

**问题**：Salt 是静态的，攻击者可以预计算 Rainbow Table
**好消息**：`adapters/crypto.js` 已经实现了随机 Salt！

#### 3. **PBKDF2 迭代次数较低** ⚠️
```javascript
iterations: 100000  // 建议至少 600,000+
```

**建议**：升级到 600,000+ 次迭代，或使用 Argon2（需要额外库）

#### 4. **没有完整性校验** ⚠️
**问题**：加密数据没有 HMAC 校验，无法检测数据是否被篡改
**建议**：
```javascript
async function encryptWithHMAC(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, cryptoKey, data);
  const hmac = await crypto.subtle.sign({name: 'HMAC', hash: 'SHA-256'}, hmacKey, encrypted);
  return { iv, encrypted, hmac };
}
```

#### 5. **错误处理可能泄露信息** ⚠️
```javascript
// options.js line 278-279
if (!decryptedKey || decryptedKey === existingEncrypted) {
  showMessage('PIN 码不匹配。如需更换 PIN，请重新输入 API Key。', 'error');
}
```

**问题**：区分了"PIN 错误"和"没有 Key"两种情况，可能帮助攻击者枚举
**建议**：统一错误消息

---

## ⚡ 性能分析

### 性能优点

| 方面 | 说明 | 评分 |
|------|------|------|
| **存储分离** | 使用 Local 存全量任务，Sync 存核心数据（避免配额限制） | ⭐⭐⭐⭐ |
| **防抖处理** | 搜索输入有 300ms 防抖 | ⭐⭐⭐ |
| **事件委托** | 任务列表使用事件委托减少监听器数量 | ⭐⭐⭐⭐ |

### 性能问题与建议

#### 1. **频繁的全量存储写入** 🔴
```javascript
// taskManager.js line 68
chrome.storage.local.set({ tasks }, ...)  // 每次任务变更都全量写入
```

**问题**：任务数量多时，每次修改都要序列化和写入整个数组
**建议**：
```javascript
// 使用增量更新 + 写缓存
let writeQueue = [];
let writeTimer = null;

function queueWrite(taskId, update) {
  writeQueue.push({ taskId, update });
  if (!writeTimer) {
    writeTimer = setTimeout(flushWrites, 500);  // 500ms 合并窗口
  }
}

async function flushWrites() {
  // 合并更新后一次性写入
  writeTimer = null;
}
```

#### 2. **同步存储数据截断策略可优化** ⚠️
```javascript
// taskManager.js line 93
text: task.text.length > 50 ? task.text.substring(0, 50) + '...' : task.text
```

**问题**：简单截断可能破坏语义，且没有利用 Sync 配额（8KB/项，100KB 总）
**建议**：
- 使用智能摘要（提取前 N 个句子）
- 压缩数据（LZ-string 等轻量库）

#### 3. **任务列表渲染性能** ⚠️
```javascript
// popup.js line 950
taskList.innerHTML = html;  // 每次重渲染都全量替换
```

**问题**：任务量大时会闪烁，且丢失 DOM 状态
**建议**：
- 使用虚拟列表（如 `react-window` 思想的轻量实现）
- 增量 DOM 更新

#### 4. **背景定时器可能被限制** ⚠️
```javascript
// background.js line 20
periodInMinutes: CONFIG.BACKUP_PERIOD_MINUTES  // 24小时
```

**问题**：Manifest V3 中 Service Worker 可能被终止，导致定时器失效
**建议**：
- 增加启动时的时间检查，补偿错过的备份
- 使用 `chrome.alarms` 是正确的，但要增加重试逻辑

---

## 🎯 功能性分析

### 功能优点

| 功能 | 说明 | 评分 |
|------|------|------|
| **AI 解析** | 支持文本和图片解析，用户体验好 | ⭐⭐⭐⭐⭐ |
| **数据备份** | 7天自动备份 + 手动备份/恢复 | ⭐⭐⭐⭐ |
| **跨设备同步** | 混合存储策略设计巧妙 | ⭐⭐⭐⭐ |
| **分享功能** | 支持 Markdown 格式分享 | ⭐⭐⭐⭐ |

### 功能问题与建议

#### 1. **Chrome 和 Edge 版本代码重复** 🔴
**问题**：两个版本有大量重复代码，维护成本高
**分析**：
- Edge 版本有 `_locales/` 国际化支持
- Edge 版本有更好的 manifest.json（author, homepage_url, minimum_edge_version）
- Edge 版本有自己的截图和说明文档

**建议**：
```
项目结构重组：
├── src/
│   ├── manifest.json.template    # 模板
│   ├── background.js
│   ├── popup.js
│   ├── ...
│   └── _locales/                 # 国际化文件
├── dist/
│   ├── chrome/                   # Chrome 构建输出
│   └── edge/                     # Edge 构建输出
└── build.js                      # 构建脚本
```

**构建脚本示例**：
```javascript
// build.js
const fs = require('fs');
const path = require('path');

const configs = {
  chrome: {
    name: 'TaskMaster',
    description: '智能待办事项管理扩展',
    // ...
  },
  edge: {
    name: '__MSG_extName__',
    description: '__MSG_extDesc__',
    author: 'TaskMaster Team',
    homepage_url: 'https://github.com/taskmaster/edge-extension',
    minimum_edge_version: '88',
    // ...
  }
};

function build(browser) {
  const config = configs[browser];
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json.template'));
  Object.assign(manifest, config);
  
  const distDir = `dist/${browser}`;
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  
  // 复制其他文件...
}

build('chrome');
build('edge');
```

#### 2. **同步冲突解决策略简陋** ⚠️
```javascript
// background.js line 120-145
// 只比较了 updatedAt，没有更复杂的冲突解决
```

**问题**：当前策略是"远程覆盖本地"，可能导致数据丢失
**建议**：
```javascript
function mergeTasks(localTasks, remoteTasks) {
  const taskMap = new Map();
  
  // 先合并本地任务
  localTasks.forEach(task => taskMap.set(task.id, { ...task }));
  
  // 合并远程任务
  remoteTasks.forEach(remoteTask => {
    const localTask = taskMap.get(remoteTask.id);
    if (!localTask) {
      // 新任务，直接添加
      taskMap.set(remoteTask.id, { ...remoteTask, notes: '', tags: [] });
    } else if (remoteTask.updatedAt > localTask.updatedAt) {
      // 远程更新，合并非同步字段
      taskMap.set(remoteTask.id, {
        ...localTask,  // 保留本地的 notes, tags
        ...remoteTask, // 远程覆盖其他字段
      });
    }
  });
  
  return Array.from(taskMap.values());
}
```

#### 3. **缺乏批量操作** ⚠️
**问题**：没有批量完成、批量删除、批量归档功能
**建议**：在 UI 中增加选择模式，支持批量操作

#### 4. **AI 解析失败没有重试机制** ⚠️
```javascript
// popup.js line 303-304
} catch (e) {
  console.error(e);
  alert("AI 解析失败: " + e.message);  // 直接失败，没有重试
}
```

**建议**：增加指数退避重试，或提供"手动调整"模式

---

## 🏗️ 架构分析

### 当前架构问题

#### 1. **代码重复严重**
- `popup.js` 中有重复的 `decryptText()` 实现（应该复用 utils.js 或 adapters/crypto.js）
- `options.js` 也有自己的 `encryptText()` / `decryptText()`
- `utils.js` 还有一套
- Chrome 和 Edge 版本有大量重复文件

#### 2. **模块依赖混乱**
```
popup.js → taskManager.js → background.js
  ↓           ↓
utils.js  constants.js
  ↓
options.js (重复实现加密函数)

adapters/crypto.js  ← 已存在但未被充分利用
  ↓
options.html (已引用)
popup.html (未引用！)
```

**关键发现**：`adapters/crypto.js` 已经存在，且实现了**更好的加密方案**（随机 Salt、适配器模式），但 `popup.html` 没有引用它！

#### 3. **缺少 TypeScript 类型定义**
**问题**：纯 JavaScript 项目，容易产生类型错误
**建议**：
- 增加 JSDoc 类型注释（成本最低）
- 或迁移到 TypeScript（长期收益）

---

## 📋 优化升级方案（按优先级）

### 🟥 高优先级（安全性问题）

#### 1. **统一加密模块**
**现状**：已有 `adapters/crypto.js`（实现更好），但未被充分利用
**实施步骤**：
- 在 `popup.html` 中引用 `adapters/crypto.js`
- 移除 `options.js` 中的重复加密函数，改用 `window.cryptoAdapter`
- 移除 `utils.js` 中的重复加密函数，改用 `window.cryptoAdapter`
- （可选但推荐）升级旧的任务加密系统也使用随机 Salt
  - 需要存储 Salt：可以在 `settings` 中存储 `encryptionSalt`
  - 提供数据迁移方案

**预期收益**：
- 消除代码重复
- 旧系统也获得随机 Salt 安全升级
- 统一加密逻辑，便于未来维护

#### 2. **修复错误信息泄露**
- 统一认证失败时的错误消息
- 避免提供过多信息给潜在攻击者

#### 3. **增加 PBKDF2 迭代次数**
- 从 100,000 升级到 600,000+
- 在 `adapters/crypto.js` 中统一修改

### 🟧 中优先级（性能问题）

#### 4. **实现写合并机制**
- 减少 Chrome Storage 写入频率
- 500ms 合并窗口，批量写入

#### 5. **优化任务列表渲染**
- 实现虚拟列表或增量更新
- 避免全量 innerHTML 替换

### 🟨 低优先级（功能/架构）

#### 6. **统一 Chrome/Edge 构建流程**
- 建立代码共享机制
- 自动化构建脚本

#### 7. **改进同步冲突解决**
- 更智能的三路合并
- 增加同步历史和回滚功能

#### 8. **增加批量操作功能**
- 批量完成/删除/归档
- 批量编辑标签/优先级

---

## 🎯 总结

| 维度 | 评分 | 说明 |
|------|------|------|
| **安全性** | ⭐⭐⭐ | 有加密但有改进空间，主要是 Salt 和迭代次数 |
| **性能** | ⭐⭐⭐ | 基本可用，但任务量大时可能有卡顿 |
| **功能性** | ⭐⭐⭐⭐ | AI 功能很有特色，但缺少批量操作 |
| **可维护性** | ⭐⭐ | 代码重复严重，但已有适配器基础 |

**总体评价**：这是一个功能丰富、设计用心的插件项目，AI 功能是亮点。**好消息是重构基础已经存在**（`adapters/crypto.js`），只需要统一使用即可。建议优先解决安全问题（统一加密模块），然后是性能优化，最后是架构重构。

---

**报告生成时间**：2026-06-10
**更新时间**：2026-06-10
**分析版本**：v3.5.0
