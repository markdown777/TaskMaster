/**
 * 弹出页面逻辑
 */

// 全局搜索状态
let searchState = {
  query: '',
  showActive: true,
  showCompleted: true,
  showNotesOnly: false,
  isSearching: false
};

// 初始化任务管理器和分享管理器
const taskManager = new TaskManager();
const shareManager = new ShareManager();

// 渲染缓存
let _lastRenderedTasksHash = '';
let _lastRenderedHtml = '';

// 全局状态变量
let isAiMode = false;
let pendingAiText = "";
let pendingAiIsImage = false;

/**
 * 统一初始化逻辑 - 页面加载完成后执行
 * 包含所有事件监听器的绑定和初始化操作
 */
document.addEventListener('DOMContentLoaded', () => {
  // 添加存储操作日志
  console.log('[DEBUG] 开始初始化存储监听');

  // 表单元素获取
  const taskForm = document.getElementById('taskForm');
  const taskInput = document.getElementById('new-task');
  const taskPriority = document.getElementById('task-priority');
  const taskTags = document.getElementById('task-tags');
  const taskDue = document.getElementById('task-due');
  const dueButton = document.getElementById('due-button');
  const duePopover = document.getElementById('due-popover');
  const duePopoverClose = document.getElementById('due-popover-close');
  const duePopoverConfirm = document.getElementById('due-popover-confirm');
  const taskList = document.getElementById('task-list');
  
  // 搜索元素获取
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchActive = document.getElementById('search-active');
  const searchCompleted = document.getElementById('search-completed');
  const searchNotes = document.getElementById('search-notes');

  // AI 助理相关元素
  const searchToggleBtn = document.getElementById('search-toggle-btn');
  const searchPopover = document.getElementById('search-popover');
  const aiToggleBtn = document.getElementById('ai-toggle-btn');
  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinSubmitBtn = document.getElementById('pin-submit-btn');
  const pinCancelBtn = document.getElementById('pin-cancel-btn');
  const pinError = document.getElementById('pin-error');

  // 1. 初始化 AI 按钮首次引导状态
  window.storageAdapter.get('AI_GUIDE_SEEN').then(isAIGuideSeen => {
    if (!isAIGuideSeen && aiToggleBtn) {
      aiToggleBtn.classList.add('guide-glow');
    }
  });

  // 初始化搜索按钮切换
  searchToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = searchPopover.hidden;
    searchPopover.hidden = !isHidden;
    searchToggleBtn.classList.toggle('active', isHidden);
    
    // 如果展开了搜索框，自动聚焦输入框
    if (isHidden) {
      searchInput?.focus();
    } else {
      // 隐藏时清空搜索输入并重置列表显示
      if (searchInput) searchInput.value = '';
      searchState.query = '';
      searchState.showActive = true;
      searchState.showCompleted = true;
      searchState.showNotesOnly = false;
      
      if (searchActive) searchActive.checked = true;
      if (searchCompleted) searchCompleted.checked = true;
      if (searchNotes) searchNotes.checked = false;
      
      updateSearchState();
    }
  });

  // 点击外部关闭搜索弹层
  document.addEventListener('click', (e) => {
    if (!searchPopover || searchPopover.hidden) return;
    if (!searchPopover.contains(e.target) && !searchToggleBtn.contains(e.target)) {
      searchPopover.hidden = true;
      searchToggleBtn.classList.remove('active');
    }
  });

  aiToggleBtn.addEventListener('click', () => {
    isAiMode = !isAiMode;
    aiToggleBtn.classList.toggle('active', isAiMode);
    
    // 点击后永久移除引导效果并记录到本地
    if (aiToggleBtn.classList.contains('guide-glow')) {
      aiToggleBtn.classList.remove('guide-glow');
      window.storageAdapter.set('AI_GUIDE_SEEN', true);
    }

    taskInput.classList.toggle('ai-mode', isAiMode);
    taskInput.placeholder = isAiMode ? "✨ AI 模式: 输入自然语言 或 粘贴聊天截图" : "添加新任务...";
  });

  pinCancelBtn?.addEventListener('click', () => {
    pinModal.hidden = true;
    pinInput.value = '';
    pinError.hidden = true;
  });

  pinSubmitBtn?.addEventListener('click', async () => {
    const pin = pinInput.value;
    if (pin.length < 4) return;
    
    pinSubmitBtn.disabled = true;
    pinSubmitBtn.textContent = '解密中...';
    
    try {
      const aiConfig = await window.storageAdapter.get('AI_CONFIG') || {};
      const visionConfig = await window.storageAdapter.get('VISION_CONFIG') || {};

      let anyDecrypted = false;

      // 尝试解密 AI Key
      if (aiConfig.enableEncryption) {
        const encryptedKey = await window.storageAdapter.get('AI_ENCRYPTED_KEY');
        if (encryptedKey) {
          const decryptedKey = await window.cryptoAdapter.decrypt(encryptedKey, pin);
          if (decryptedKey) {
            if (chrome.storage && chrome.storage.session) {
              await chrome.storage.session.set({ 'AI_DECRYPTED_KEY': decryptedKey });
            } else {
              window.sessionStorage.setItem('AI_DECRYPTED_KEY', decryptedKey);
            }
            anyDecrypted = true;
          }
        }
      }

      // 尝试解密 Vision Key
      if (visionConfig.enableEncryption) {
        const encryptedKey = await window.storageAdapter.get('VISION_ENCRYPTED_KEY');
        if (encryptedKey) {
          const decryptedKey = await window.cryptoAdapter.decrypt(encryptedKey, pin);
          if (decryptedKey) {
            if (chrome.storage && chrome.storage.session) {
              await chrome.storage.session.set({ 'VISION_DECRYPTED_KEY': decryptedKey });
            } else {
              window.sessionStorage.setItem('VISION_DECRYPTED_KEY', decryptedKey);
            }
            anyDecrypted = true;
          }
        }
      }

      if (!anyDecrypted) {
        throw new Error("认证失败，请检查 PIN 码");
      }
      
      pinModal.hidden = true;
      pinInput.value = '';
      pinError.hidden = true;
      
      // Resume the AI parsing
      if (pendingAiText) {
        processAiInput(pendingAiText, pendingAiIsImage);
        pendingAiText = "";
        pendingAiIsImage = false;
      }
    } catch (e) {
      pinError.hidden = false;
    } finally {
      pinSubmitBtn.disabled = false;
      pinSubmitBtn.textContent = '解锁';
    }
  });

  async function getSessionApiKey() {
    // 检查是否启用了加密
    const aiConfig = await window.storageAdapter.get('AI_CONFIG') || {};
    if (aiConfig.hasKey && !aiConfig.enableEncryption) {
      // 如果没有启用加密，直接从 storage 中读取明文 key
      const plainKey = await window.storageAdapter.get('AI_PLAINTEXT_KEY');
      if (plainKey) return plainKey;
    }

    if (chrome.storage && chrome.storage.session) {
      const data = await chrome.storage.session.get('AI_DECRYPTED_KEY');
      return data['AI_DECRYPTED_KEY'];
    }
    return window.sessionStorage.getItem('AI_DECRYPTED_KEY');
  }

  // 获取 Vision API Key (根据加密状态)
  async function getSessionVisionApiKey() {
    const visionConfig = await window.storageAdapter.get('VISION_CONFIG');
    if (!visionConfig) return null;

    if (visionConfig.hasKey && !visionConfig.enableEncryption) {
      // 如果没有启用加密，直接从 storage 中读取明文 key
      const plainKey = await window.storageAdapter.get('VISION_PLAINTEXT_KEY');
      if (plainKey) return plainKey;
    }

    if (chrome.storage && chrome.storage.session) {
      const data = await chrome.storage.session.get('VISION_DECRYPTED_KEY');
      return data['VISION_DECRYPTED_KEY'];
    }
    return window.sessionStorage.getItem('VISION_DECRYPTED_KEY');
  }

  async function processAiInput(inputData, isImage = false) {
    let config, apiKey;

    if (isImage) {
      config = await window.storageAdapter.get('VISION_CONFIG');
      if (!config || !config.hasKey || config.provider === 'off') {
        alert("请先在设置页配置 🖼️ 图片识别 (Vision/OCR) 的模型与 API Key");
        return;
      }
      apiKey = await getSessionVisionApiKey();
    } else {
      config = await window.storageAdapter.get('AI_CONFIG');
      if (!config || !config.hasKey || config.provider === 'off') {
        alert("请先在设置页配置 ✨ AI 助理的 API Key");
        return;
      }
      apiKey = await getSessionApiKey();
    }

    if (!apiKey) {
      if (config.enableEncryption) {
        // Need PIN to unlock
        pendingAiText = inputData;
        pendingAiIsImage = isImage;
        pinModal.hidden = false;
        pinInput.focus();
      } else {
        alert(`未找到 ${isImage ? '图片识别' : 'AI 助理'} 的 API Key，请前往设置重新配置`);
      }
      return;
    }

    // Change UI state to loading
    const originalPlaceholder = taskInput.placeholder;
    taskInput.placeholder = isImage ? "✨ AI 正在解析截图内容..." : "✨ AI 正在思考中...";
    taskInput.disabled = true;

    try {
      const parsedTask = isImage 
        ? await window.aiService.parseTaskFromImage(inputData, apiKey, config.provider, config.baseUrl, config.model)
        : await window.aiService.parseTaskFromText(inputData, apiKey, config.provider, config.baseUrl, config.model);
      
      // Populate the form
      taskInput.value = parsedTask.title || (isImage ? "图片任务解析结果" : inputData);
      
      if (parsedTask.priority) {
        document.getElementById('task-priority').value = parsedTask.priority;
      }
      
      if (parsedTask.tags && parsedTask.tags.length > 0) {
        document.getElementById('task-tags').value = parsedTask.tags.join(', ');
      }
      
      if (parsedTask.due_date) {
        // Format cleaning: replace slashes with dashes, spaces with 'T'
        let dateStr = parsedTask.due_date.replace(/\//g, '-').replace(' ', 'T');
        if (dateStr.length > 16) {
          dateStr = dateStr.slice(0, 16); // Extract up to minutes (YYYY-MM-DDTHH:mm)
        }

        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) {
          document.getElementById('task-due').value = dateStr;
          updateDueButtonState(document.getElementById('due-button'), dateStr);
        } else {
          // Fallback: If LLM returns an unstandardized format, parse using Date and compensate for local timezone
          const dateObj = new Date(dateStr);
          if (!isNaN(dateObj.getTime())) {
            const tzOffset = dateObj.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
            document.getElementById('task-due').value = localISOTime;
            updateDueButtonState(document.getElementById('due-button'), localISOTime);
          }
        }
      }
      
      // 暂存原始输入作为备注，结合AI可能提取的要点
      let finalNotes = `[AI自动生成]\n原始信息：${isImage ? "[图片截图]" : inputData}`;
      if (parsedTask.notes && typeof parsedTask.notes === 'string' && parsedTask.notes.trim()) {
        // 移除每行可能的前导空格
        const cleanedNotes = parsedTask.notes.split('\n').map(line => line.trim()).join('\n');
        finalNotes = `[AI提取要点]\n${cleanedNotes}\n\n${finalNotes}`;
      }
      window.currentTaskNotes = finalNotes;
      
      // 先重置 AI 模式，避免死循环
      isAiMode = false;
      aiToggleBtn.classList.remove('active');
      
      // 触发提交创建任务
      const tags = document.getElementById('task-tags').value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== '');
      
      let dueValue = document.getElementById('task-due').value;
      // 如果解析成功并且页面元素没来得及更新 value，我们直接从 parsedTask 中取并格式化
      if (!dueValue && parsedTask.due_date) {
        let dateStr = parsedTask.due_date.replace(/\//g, '-').replace(' ', 'T');
        if (dateStr.length > 16) dateStr = dateStr.slice(0, 16);
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) {
          dueValue = dateStr;
        } else {
          const dateObj = new Date(dateStr);
          if (!isNaN(dateObj.getTime())) {
            const tzOffset = dateObj.getTimezoneOffset() * 60000;
            dueValue = (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
          }
        }
      }

      const dueIso = dueValue ? new Date(dueValue).toISOString() : new Date(Date.now() + 3600000).toISOString();
      
      const taskData = {
        text: taskInput.value.trim(),
        priority: document.getElementById('task-priority').value,
        tags: tags,
        due: dueIso,
        notes: window.currentTaskNotes || ''
      };
      
      window.currentTaskNotes = '';

      await taskManager.addTask(taskData);
      
      // 清空表单
      taskInput.value = '';
      document.getElementById('task-priority').value = 'medium';
      document.getElementById('task-tags').value = '';
      document.getElementById('task-due').value = '';
      updateDueButtonState(document.getElementById('due-button'), '');
      
      renderTasks();
      
      // 添加任务后，显示成功提示
      showMessage('✨ AI 解析成功并已添加任务', 'success');
      
    } catch (e) {
      console.error(e);
      alert("AI 解析失败: " + e.message);
    } finally {
      taskInput.disabled = false;
      taskInput.classList.remove('ai-mode');
      taskInput.placeholder = "添加新任务...";
      taskInput.focus();
    }
  }

  // 增强存储回调验证
  if (chrome.storage) {
    chrome.storage.onChanged.addListener((changes) => {
      if (!changes.tasks) return;

      // 本地写入尚未完成时，忽略自己触发的旧快照，避免缓存回退
      if (!taskManager.isSaving() && changes.tasks.newValue) {
        taskManager.syncFromStorage(changes.tasks.newValue);
      }
      renderTasks();
    });
  } else {
    console.error('Chrome storage API不可用');
  }

  // 监听粘贴事件，捕获截图并调用 AI 视觉大模型
  document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || window.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image/') !== -1) {
        e.preventDefault(); // 阻止默认粘贴行为
        
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Image = event.target.result;
          
          // 自动进入 AI 模式以提供视觉反馈
          isAiMode = true;
          aiToggleBtn.classList.add('active');
          taskInput.classList.add('ai-mode');
          
          await processAiInput(base64Image, true);
        };
        reader.readAsDataURL(blob);
        return; // 只处理找到的第一张图片
      }
    }
  });

  /**
   * 表单提交处理 - 创建新任务
   */
  taskForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = taskInput.value.trim();
    if (!title) return;

    if (isAiMode) {
      taskInput.value = ''; // clear input immediately for UX
      await processAiInput(title, false);
      return;
    }
    
    if (title) {
      // 解析标签
      const tags = taskTags.value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== '');
      
      // 处理截止时间
      const dueValue = taskDue.value;
      const dueIso = dueValue ? new Date(dueValue).toISOString() : new Date(Date.now() + 3600000).toISOString();
      
      const taskData = {
        text: taskInput.value.trim(),
        priority: taskPriority.value,
        tags: tags,
        due: dueIso,
        notes: window.currentTaskNotes || ''
      };
      
      // 取出后立即清除，避免污染后续手动创建的任务
      window.currentTaskNotes = '';

      try {
        await taskManager.addTask(taskData);
        
        // 清空表单
        taskInput.value = '';
        taskPriority.value = 'medium';
        taskTags.value = '';
        taskDue.value = '';
        updateDueButtonState(dueButton, taskDue.value);
        duePopover.hidden = true;
        dueButton.dataset.active = 'false';
        
        renderTasks();
        showMessage('任务已添加');
      } catch (error) {
        console.error('添加任务失败:', error);
        showMessage('添加任务失败，请重试', 'error');
      }
    }
  });

  // 搜索功能事件监听
  initializeSearchEvents();
  initializeDuePicker(dueButton, duePopover, duePopoverClose, duePopoverConfirm, taskDue);
  
  /**
   * 分享按钮事件处理
   */
  document.getElementById('share-btn')?.addEventListener('click', async () => {
    try {
      const tasks = await taskManager.getAllTasks();
      const shareContent = shareManager.generateShareContent(tasks);
      shareManager.showShareMenu(shareContent);
    } catch (error) {
      console.error('分享失败:', error);
      showMessage('分享失败，请重试', 'error');
    }
  });
  
  /**
   * 设置按钮事件 - 打开选项页面
   */
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    if (chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      console.warn('chrome.runtime.openOptionsPage API不可用');
    }
  });
  
  /**
   * 日期标题点击事件 - 展开/折叠任务组
   */
  document.addEventListener('click', (e) => {
    const header = e.target.closest('.date-header');
    if (!header) return;
    const content = header.nextElementSibling;
    if (!content) return;
    const isExpanded = content.style.display !== 'none';
    content.style.display = isExpanded ? 'none' : 'block';
    const icon = header.querySelector('.toggle-icon');
    if (icon) icon.textContent = isExpanded ? '▶' : '▼';
  });
  
  // 初始化任务列表事件委托（仅执行一次）
  addTaskEventListeners();
  
  // 添加渲染完成标记
  renderTasks();
  console.log('[DEBUG] 初始渲染完成');
});

// 初始化搜索事件
function initializeSearchEvents() {
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchActive = document.getElementById('search-active');
  const searchCompleted = document.getElementById('search-completed');
  const searchNotes = document.getElementById('search-notes');
  
  // 搜索输入事件（添加防抖）
  searchInput?.addEventListener('input', debounce((e) => {
    searchState.query = e.target.value.trim();
    updateSearchState();
  }, 300));
  
  // 清空搜索
  searchClear?.addEventListener('click', () => {
    searchInput.value = '';
    searchState.query = '';
    updateSearchState();
  });
  
  // 搜索过滤器事件
  searchActive?.addEventListener('change', (e) => {
    searchState.showActive = e.target.checked;
    updateSearchState();
  });
  
  searchCompleted?.addEventListener('change', (e) => {
    searchState.showCompleted = e.target.checked;
    updateSearchState();
  });
  
  searchNotes?.addEventListener('change', (e) => {
    searchState.showNotesOnly = e.target.checked;
    updateSearchState();
  });
}

/**
 * 初始化截止时间弹层选择器
 * 通过一个紧凑按钮触发时间选择，减少表单区域的视觉复杂度
 * 弹层内的选择是“草稿”：确定后才写回按钮，取消/点外部/Esc 恢复原值
 * @param {HTMLButtonElement|null} dueButton - 触发按钮
 * @param {HTMLElement|null} duePopover - 弹层容器
 * @param {HTMLButtonElement|null} duePopoverClose - 取消按钮
 * @param {HTMLButtonElement|null} duePopoverConfirm - 确定按钮
 * @param {HTMLInputElement|null} taskDueInput - datetime-local 输入框
 */
function initializeDuePicker(dueButton, duePopover, duePopoverClose, duePopoverConfirm, taskDueInput) {
  if (!dueButton || !duePopover || !taskDueInput) return;

  // 打开弹层前的已应用值，用于取消时回滚
  let appliedValue = taskDueInput.value;

  /**
   * 根据当前 input 值更新按钮状态（不占用额外空间）
   * @param {string} dueValue - datetime-local 值
   */
  function syncButtonState(dueValue) {
    updateDueButtonState(dueButton, dueValue);
  }

  /**
   * 打开弹层
   */
  function openPopover() {
    appliedValue = taskDueInput.value;
    // 未选过时间时预填当前时间，方便直接微调后创建
    if (!taskDueInput.value) {
      taskDueInput.value = toDatetimeLocalValue(new Date());
    }
    duePopover.hidden = false;
    dueButton.dataset.active = 'true';
    // 移除自动调用 showPicker，因为会让系统自带的和自定义弹窗同时出现
  }

  /**
   * 关闭弹层
   */
  function closePopover() {
    duePopover.hidden = true;
    dueButton.dataset.active = 'false';
  }

  /**
   * 放弃草稿，恢复打开前的值
   */
  function cancelPopover() {
    taskDueInput.value = appliedValue;
    syncButtonState(appliedValue);
    closePopover();
  }

  /**
   * 应用草稿值并关闭
   */
  function confirmPopover() {
    appliedValue = taskDueInput.value;
    syncButtonState(appliedValue);
    closePopover();
  }

  /**
   * 应用快捷时间（快捷项立即生效）
   * @param {string} preset - 预设类型
   */
  function applyPreset(preset) {
    if (preset === 'clear') {
      taskDueInput.value = '';
      confirmPopover();
      return;
    }

    const target = computeDuePreset(preset);
    if (!target) return;

    taskDueInput.value = toDatetimeLocalValue(target);
    confirmPopover();
  }

  dueButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (duePopover.hidden) openPopover();
    else confirmPopover();
  });

  duePopoverClose?.addEventListener('click', (e) => {
    e.preventDefault();
    cancelPopover();
  });

  duePopoverConfirm?.addEventListener('click', (e) => {
    e.preventDefault();
    confirmPopover();
  });

  duePopover.querySelectorAll('.due-quick').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const preset = btn.getAttribute('data-preset');
      if (preset) applyPreset(preset);
    });
  });

  document.addEventListener('click', (e) => {
    if (duePopover.hidden) return;
    if (duePopover.contains(e.target) || dueButton.contains(e.target)) return;
    cancelPopover();
  });

  document.addEventListener('keydown', (e) => {
    if (duePopover.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelPopover();
    }
  });

  syncButtonState(taskDueInput.value);
}

/**
 * 更新截止时间按钮的视觉状态
 * 按钮直接显示已选时间，未选择时显示“时间”
 * @param {HTMLButtonElement|null} dueButton - 触发按钮
 * @param {string} dueValue - datetime-local 的本地时间值
 */
function updateDueButtonState(dueButton, dueValue) {
  if (!dueButton) return;

  const label = dueValue ? formatDueShort(dueValue) : '';

  if (!label) {
    dueButton.textContent = '时间';
    dueButton.removeAttribute('data-has-value');
    dueButton.title = '设置截止时间';
    return;
  }

  dueButton.textContent = formatDueButtonLabel(dueValue);
  dueButton.setAttribute('data-has-value', 'true');
  dueButton.title = `截止：${label}`;
}

// —— 已有任务的截止时间快捷修改 ——
let taskDueEditor = null;

function ensureTaskDueEditor() {
  if (taskDueEditor) return taskDueEditor;

  const editor = document.createElement('div');
  editor.className = 'task-due-popover';
  editor.hidden = true;
  editor.innerHTML = `
    <div class="due-quick-row">
      <button type="button" class="due-quick" data-preset="plus60">1 小时后</button>
      <button type="button" class="due-quick" data-preset="today18">今天 18:00</button>
      <button type="button" class="due-quick" data-preset="tomorrow12">明天 12:00</button>
    </div>
    <div class="task-due-custom-row">
      <input type="datetime-local" class="task-due-input" aria-label="自定义截止时间">
      <button type="button" class="task-due-save">保存</button>
    </div>
    <button type="button" class="due-quick task-due-clear" data-preset="clear">清除截止时间</button>`;

  editor.addEventListener('click', async (e) => {
    const taskId = Number(editor.dataset.taskId);
    if (!taskId) return;

    const presetButton = e.target.closest('[data-preset]');
    if (presetButton) {
      const preset = presetButton.dataset.preset;
      if (preset === 'clear') {
        await applyTaskDue(taskId, null);
        return;
      }
      const target = computeDuePreset(preset);
      if (target) await applyTaskDue(taskId, target);
      return;
    }

    if (e.target.closest('.task-due-save')) {
      const input = editor.querySelector('.task-due-input');
      if (!input.value) {
        input.focus();
        return;
      }
      await applyTaskDue(taskId, new Date(input.value));
    }
  });

  document.addEventListener('click', (e) => {
    if (editor.hidden) return;
    if (editor.contains(e.target) || e.target.closest('.due-chip, .due-btn')) return;
    closeTaskDueEditor();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editor.hidden) closeTaskDueEditor();
  });

  window.addEventListener('resize', () => {
    if (!editor.hidden) closeTaskDueEditor();
  });

  document.body.appendChild(editor);

  const taskList = document.getElementById('task-list');
  if (taskList) {
    // 打开瞬间可能伴随滚动事件，延迟后再响应，避免刚打开就被关闭
    taskList.addEventListener('scroll', () => {
      if (editor.hidden) return;
      if (Date.now() - Number(editor.dataset.openedAt || 0) < 150) return;
      closeTaskDueEditor();
    }, { passive: true });
  }

  taskDueEditor = editor;
  return editor;
}

function openTaskDueEditor(anchor, taskId, currentDue) {
  const editor = ensureTaskDueEditor();
  editor.dataset.taskId = String(taskId);
  editor.dataset.openedAt = String(Date.now());
  editor.querySelector('.task-due-input').value = currentDue
    ? toDatetimeLocalValue(new Date(currentDue))
    : '';
  editor.hidden = false;

  const rect = anchor.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, window.innerWidth - editor.offsetWidth - 8)
  );
  let top = rect.bottom + 6;
  if (top + editor.offsetHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - editor.offsetHeight - 6);
  }
  editor.style.left = `${Math.round(left)}px`;
  editor.style.top = `${Math.round(top)}px`;

  editor.querySelector('.due-quick').focus({ preventScroll: true });
}

function closeTaskDueEditor() {
  if (taskDueEditor) taskDueEditor.hidden = true;
}

async function applyTaskDue(taskId, dueDate) {
  try {
    await taskManager.updateTask(taskId, {
      due: dueDate ? dueDate.toISOString() : null
    });
    closeTaskDueEditor();
    await renderTasks();
    revealTaskItem(taskId);
    showMessage(dueDate ? `截止时间已改为 ${formatDueShort(dueDate)}` : '已清除截止时间');
  } catch (error) {
    console.error('修改截止时间失败:', error);
    showMessage('修改失败，请重试', 'error');
  }
}

// 展开任务所在分组并滚动到可视区域，避免取消置顶后“看起来消失了”
function revealTaskItem(taskId) {
  const taskList = document.getElementById('task-list');
  if (!taskList) return;

  const item = taskList.querySelector(`.task-item[data-id="${CSS.escape(String(taskId))}"]`);
  if (!item) return;

  const content = item.closest('.date-content');
  if (content && content.style.display === 'none') {
    content.style.display = '';
    const header = content.previousElementSibling;
    const icon = header && header.querySelector('.toggle-icon');
    if (icon) icon.textContent = '▼';
  }

  item.scrollIntoView({ block: 'nearest' });
  item.classList.add('task-flash');
  setTimeout(() => item.classList.remove('task-flash'), 1200);
}

// 将当前所有逾期任务顺延到最近的可执行时间
async function postponeOverdueTasks() {
  const tasks = await taskManager.getAllTasks();
  const now = new Date();
  const overdueIds = tasks
    .filter(task => !task.completed && !task.pinned && isOverdue(task.due, now))
    .map(task => task.id);

  if (overdueIds.length === 0) return;

  const target = new Date(now);
  target.setHours(18, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
    target.setHours(12, 0, 0, 0);
  }

  try {
    await taskManager.setTasksDue(overdueIds, target.toISOString());
    await renderTasks();
    showMessage(`${overdueIds.length} 条任务已顺延至 ${formatDueShort(target)}`);
  } catch (error) {
    console.error('批量顺延失败:', error);
    showMessage('顺延失败，请重试', 'error');
  }
}

// 更新搜索状态
function updateSearchState() {
  searchState.isSearching = searchState.query.length > 0 || 
                           searchState.showNotesOnly || 
                           (!searchState.showActive && searchState.showCompleted) ||
                           (searchState.showActive && !searchState.showCompleted);
  
  if (searchState.isSearching) {
    performSearch();
  } else {
    renderTasks();
  }
}

// 执行搜索
async function performSearch() {
  try {
    const filters = {
      showActive: searchState.showActive,
      showCompleted: searchState.showCompleted,
      showNotesOnly: searchState.showNotesOnly
    };

    const [filteredTasks, settings] = await Promise.all([
      taskManager.searchTasks(searchState.query, filters),
      taskManager.getSettings()
    ]);
    renderSearchResults(filteredTasks, searchState.query, settings);
  } catch (error) {
    console.error('搜索失败:', error);
    showMessage('搜索失败，请重试', 'error');
  }
}

// 渲染搜索结果
function renderSearchResults(tasks, query = '', settings = {}) {
  const taskList = document.getElementById('task-list');
  if (!taskList) return;
  
  if (tasks.length === 0) {
    taskList.innerHTML = `
      <div class="search-no-results">
        <p>没有找到匹配的任务</p>
        <p style="font-size: 12px; color: #999;">尝试调整搜索条件或清空搜索</p>
      </div>
    `;
    return;
  }
  
  // 添加搜索统计
  const activeCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;
  const withNotesCount = tasks.filter(t => t.notes && t.notes.trim() !== '').length;
  
  let html = '';
  if (settings.showTaskStats !== false) {
    html += `
      <div class="search-stats">
        搜索结果：共 ${tasks.length} 项任务
        ${activeCount > 0 ? ` | 活动 ${activeCount} 项` : ''}
        ${completedCount > 0 ? ` | 已完成 ${completedCount} 项` : ''}
        ${withNotesCount > 0 ? ` | 有备注 ${withNotesCount} 项` : ''}
      </div>
    `;
  }
  
  // 按完成状态分组
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  
  // 渲染活动任务
  if (activeTasks.length > 0) {
    html += `<div class="search-section">
              <div class="search-section-title">活动任务 (${activeTasks.length})</div>
              <ul>`;
    activeTasks.forEach(task => {
      html += generateTaskItemHtml(task, false, query);
    });
    html += '</ul></div>';
  }
  
  // 渲染已完成任务
  if (completedTasks.length > 0) {
    html += `<div class="search-section">
              <div class="search-section-title">已完成任务 (${completedTasks.length})</div>
              <ul>`;
    completedTasks.forEach(task => {
      html += generateTaskItemHtml(task, true, query);
    });
    html += '</ul></div>';
  }
  
  const currentScrollTop = taskList.scrollTop;
  taskList.innerHTML = html;
  taskList.scrollTop = currentScrollTop;
}

// 任务渲染功能
async function renderTasks() {
  try {
    const [tasks, settings] = await Promise.all([
      taskManager.getAllTasks(),
      taskManager.getSettings()
    ]);
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    // 记录当前的折叠状态，避免重绘后丢失
    const expandedStates = {};
    document.querySelectorAll('.date-header').forEach(header => {
      const date = header.dataset.date;
      const content = header.nextElementSibling;
      if (date && content) {
        expandedStates[date] = content.style.display !== 'none';
      }
    });

    // 仅首次进入时播放入场动画
    taskList.classList.toggle('no-anim', taskList.dataset.rendered === 'true');
    taskList.dataset.rendered = 'true';

    if (tasks.length === 0) {
      taskList.innerHTML = `
        <li class="empty-state">
          <div class="empty-title">还没有任务</div>
          <div class="empty-hint">在上方输入框写下第一件事，回车即可创建</div>
        </li>`;
      return;
    }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // 已完成任务保留时长（0 = 永久，仅影响展示，不删除数据）
    const retentionDays = Number(settings.taskRetentionDays) || 0;
    const retentionCutoff = retentionDays > 0
      ? now.getTime() - retentionDays * 24 * 60 * 60 * 1000
      : 0;

    // 分离任务：置顶、逾期、活动、归档
    const pinnedTasks = [];
    const overdueTasks = [];
    const activeTasks = [];
    const archivedTasks = [];
    const staleArchivedTasks = [];

    tasks.forEach(task => {
      if (task.completed) {
        const completedAt = new Date(task.completedTime || task.completedAt || task.createdAt || 0).getTime();
        if (retentionCutoff && completedAt && completedAt < retentionCutoff) {
          staleArchivedTasks.push(task);
          return;
        }
        archivedTasks.push(task);
      } else if (task.pinned) {
        pinnedTasks.push(task);
      } else if (isOverdue(task.due, now)) {
        overdueTasks.push(task);
      } else {
        activeTasks.push(task);
      }
    });

    const sortByDueAsc = (a, b) => {
      const aTime = a.due ? new Date(a.due).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.due ? new Date(b.due).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    };

    let html = '';

    // 渲染置顶区域
    if (pinnedTasks.length > 0) {
      html += `<div class="pinned-section">
                <div class="section-title">置顶 · ${pinnedTasks.length}</div>
                <ul>`;
      pinnedTasks.sort(sortByDueAsc).forEach(task => {
        html += generateTaskItemHtml(task);
      });
      html += '</ul></div>';
    }

    // 逾期任务优先展示
    if (overdueTasks.length > 0) {
      html += `<div class="overdue-section">
                <div class="section-title overdue-title">
                  <span>逾期 · ${overdueTasks.length}</span>
                  <button type="button" class="overdue-postpone-btn" title="顺延到最近的可执行时间（今天 18:00 或明天 12:00）">全部顺延</button>
                </div>
                <ul>`;
      overdueTasks.sort(sortByDueAsc).forEach(task => {
        html += generateTaskItemHtml(task);
      });
      html += '</ul></div>';
    }

    // 按创建日期分组剩余活动任务，组内按截止时间排序
    const tasksByDate = taskManager.groupTasksByDate(activeTasks);

    Object.keys(tasksByDate).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
      const dateObj = new Date(date);
      const label = isSameDay(dateObj, now)
        ? '今天'
        : isSameDay(dateObj, yesterday)
          ? '昨天'
          : date;
      const shouldExpand = expandedStates[date] !== undefined
        ? expandedStates[date]
        : (settings.autoExpandToday !== false && isSameDay(dateObj, now));

      const dayTasks = tasksByDate[date].sort(sortByDueAsc);

      html += `<div class="date-section">
                <div class="date-header" data-date="${date}">
                  ${label} · ${dayTasks.length}
                  <span class="toggle-icon">${shouldExpand ? '▼' : '▶'}</span>
                </div>
                <div class="date-content" style="${shouldExpand ? '' : 'display:none'}">
                  <ul>`;

      dayTasks.forEach(task => {
        html += generateTaskItemHtml(task);
      });

      html += `</ul></div></div>`;
    });

    // 渲染归档区域：默认折叠，避免挤占首屏
    if ((archivedTasks.length > 0 || staleArchivedTasks.length > 0) && settings.showCompletedTasks !== false) {
      const sortCompletedDesc = (a, b) => {
        const aTime = new Date(a.completedTime || a.completedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.completedTime || b.completedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      };

      archivedTasks.sort(sortCompletedDesc);

      const shouldExpandArchive = expandedStates['archive-folded'] === true;
      const olderHint = staleArchivedTasks.length > 0
        ? ` · 更早 ${staleArchivedTasks.length}`
        : '';

      html += `<div class="archive-section">
                <div class="date-header archive-folded-header" data-date="archive-folded" title="${staleArchivedTasks.length > 0 ? `另有 ${staleArchivedTasks.length} 条超出保留期，见下方分组` : ''}">
                  归档 · ${archivedTasks.length}${olderHint}
                  <span class="toggle-icon">${shouldExpandArchive ? '▼' : '▶'}</span>
                </div>
                <div class="date-content" style="${shouldExpandArchive ? '' : 'display:none'}">
                  <ul class="archive-grid">`;

      archivedTasks.forEach(task => {
        html += generateTaskItemHtml(task, true);
      });

      if (archivedTasks.length === 0) {
        html += `<li class="archive-empty-hint">近期没有已归档任务</li>`;
      }

      html += `</ul></div></div>`;

      // 超出保留期的归档任务仍可查看，不因展示过滤而彻底消失
      if (staleArchivedTasks.length > 0) {
        staleArchivedTasks.sort(sortCompletedDesc);
        const shouldExpandStale = expandedStates['archive-stale'] === true;

        html += `<div class="archive-section stale-archive-section">
                  <div class="date-header" data-date="archive-stale" title="已完成超过保留时长，默认折叠；可在设置中调整保留时长">
                    超出保留期 · ${staleArchivedTasks.length}
                    <span class="toggle-icon">${shouldExpandStale ? '▼' : '▶'}</span>
                  </div>
                  <div class="date-content" style="${shouldExpandStale ? '' : 'display:none'}">
                    <ul class="archive-grid">`;

        staleArchivedTasks.forEach(task => {
          html += generateTaskItemHtml(task, true);
        });

        html += `</ul></div></div>`;
      }
    }

    // 保存滚动条位置
    const currentScrollTop = taskList.scrollTop;

    taskList.innerHTML = html;

    // 恢复滚动条位置
    taskList.scrollTop = currentScrollTop;
  } catch (error) {
    console.error('渲染任务失败:', error);
    showMessage('渲染任务失败，请重试', 'error');
  }
}

// 生成任务项HTML的函数
function generateTaskItemHtml(task, isArchived = false, query = '') {
  const now = new Date();
  const dueDate = task.due ? new Date(task.due) : null;
  const overdue = !task.completed && isOverdue(task.due, now);
  const dueToday = dueDate && !overdue && !task.completed && isSameDay(dueDate, now);

  const notesHtml = (task.notes && task.notes.trim() !== '') ? `
    <div class="task-notes-indicator" title="查看/修改备注">
      <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="note-icon">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
      <span>备注</span>
    </div>
  ` : '';

  const priorityBadge = `
    <span class="priority-badge priority-${task.priority}">
      ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
    </span>
  `;

  const tagsHtml = task.tags && task.tags.length > 0 ? `
    <div class="task-tags">
      ${task.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
    </div>
  ` : '';

  const editableDue = !isArchived && !task.completed;
  const dueClass = `time-info${overdue ? ' is-overdue' : ''}${dueToday ? ' is-today' : ''}`;
  const dueLabel = `${overdue ? '逾期 · ' : ''}${formatDueShort(task.due, now)}`;
  const dueHtml = dueDate ? (
    editableDue
      ? `<button type="button" class="${dueClass} due-chip" data-due="${escapeHtml(task.due)}" title="截止 ${formatDateTime(task.due)} · 点击修改">
          <span class="time-value">${dueLabel}</span>
        </button>`
      : `<div class="${dueClass}" title="截止时间 ${formatDateTime(task.due)}">
          <span class="time-value">${dueLabel}</span>
        </div>`
  ) : '';

  const completedHtml = (isArchived && task.completedTime) ? `
    <div class="archived-completion-time">完成 ${formatDueShort(task.completedTime, now)}</div>
  ` : '';

  const metaParts = [completedHtml, dueHtml, tagsHtml, notesHtml].filter(Boolean);
  const metaHtml = metaParts.length > 0 ? `<div class="meta-row">${metaParts.join('')}</div>` : '';

  const taskText = escapeHtml(task.text || '');
  const taskNotes = escapeHtml(task.notes || '');
  const titleHtml = `${priorityBadge}${highlightText(task.text || '', query)}`;

  if (isArchived || task.completed) {
    // 归档任务：标题 + 完成时间 + 截止时间/标签/备注
    return `<li class="task-item archived" data-id="${escapeHtml(String(task.id))}">
              <div class="archived-task task-clickable" data-task-id="${escapeHtml(String(task.id))}" data-task-text="${taskText}" data-task-notes="${taskNotes}" data-is-archived="true" tabindex="0" role="button">
                <div class="archived-title">${titleHtml}</div>
                ${metaHtml}
              </div>
            </li>`;
  }

  // 活动任务
  return `<li class="task-item" data-id="${escapeHtml(String(task.id))}">
      <div class="task-container">
        <input type="checkbox" class="task-checkbox" aria-label="标记完成：${taskText}">
        
        <div class="info-container task-clickable" data-task-id="${escapeHtml(String(task.id))}" data-task-text="${taskText}" data-task-notes="${taskNotes}" data-is-archived="false" tabindex="0" role="button" title="点击查看备注，双击标题可编辑">
          <div class="task-title">${titleHtml}</div>
          ${metaHtml}
        </div>
        
        <div class="action-buttons">
          <button class="edit-btn" aria-label="编辑任务标题" title="编辑标题">✎</button>
          <button class="due-btn" aria-label="${task.due ? '修改截止时间' : '设置截止时间'}" title="${task.due ? '修改截止时间' : '设置截止时间'}">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"></circle>
              <polyline points="12 7 12 12 15 14"></polyline>
            </svg>
          </button>
          <button class="pin-btn" data-pinned="${task.pinned ? 'true' : 'false'}" aria-label="${task.pinned ? '取消置顶' : '置顶'}" aria-pressed="${task.pinned ? 'true' : 'false'}" title="${task.pinned ? '取消置顶' : '置顶'}">${task.pinned ? '★' : '☆'}</button>
          <button class="delete-btn" aria-label="删除任务" title="删除任务">×</button>
        </div>
      </div>
    </li>`;
}

// 为任务添加事件监听
function addTaskEventListeners() {
  const taskList = document.getElementById('task-list');

  const openNotesFor = (clickableElement) => {
    openNotesModal(
      parseInt(clickableElement.dataset.taskId),
      clickableElement.dataset.taskText,
      clickableElement.dataset.taskNotes,
      clickableElement.dataset.isArchived === 'true'
    );
  };

  // 单击标题打开备注，双击标题进入编辑：延迟单击以便区分
  let pendingClickTimer = null;

  // 添加点击事件委托
  taskList.addEventListener('click', async (e) => {
    const taskItem = e.target.closest('.task-item');

    if (e.target.closest('.overdue-postpone-btn')) {
      e.stopPropagation();
      await postponeOverdueTasks();
      return;
    }

    if (e.target.closest('.due-chip, .due-btn')) {
      if (!taskItem) return;
      e.stopPropagation();
      const chip = taskItem.querySelector('.due-chip');
      openTaskDueEditor(
        e.target.closest('.due-chip, .due-btn'),
        parseInt(taskItem.dataset.id),
        chip ? chip.dataset.due : null
      );
      return;
    }

    if (e.target.closest('.edit-btn')) {
      if (taskItem) startInlineEdit(taskItem);
      return;
    }

    if (e.target.closest('.pin-btn')) {
      if (!taskItem) return;
      const taskId = parseInt(taskItem.dataset.id);

      try {
        const task = await taskManager.toggleTaskPinned(taskId);
        await renderTasks();
        if (task && !task.pinned) {
          revealTaskItem(taskId);
        }
      } catch (error) {
        console.error('切换置顶状态失败:', error);
        showMessage('操作失败，请重试', 'error');
      }
      return;
    }

    if (e.target.closest('.delete-btn')) {
      if (!taskItem) return;
      await handleDeleteTask(parseInt(taskItem.dataset.id));
      return;
    }

    // 编辑输入框内的点击不应触发备注弹窗
    if (e.target.closest('input, textarea, button')) return;

    // 备注点击事件
    const clickableElement = e.target.closest('.task-clickable');
    if (!clickableElement) return;

    if (e.target.closest('.task-title')) {
      if (pendingClickTimer) clearTimeout(pendingClickTimer);
      pendingClickTimer = setTimeout(() => {
        pendingClickTimer = null;
        openNotesFor(clickableElement);
      }, 220);
    } else {
      openNotesFor(clickableElement);
    }
  });

  // 双击标题就地编辑
  taskList.addEventListener('dblclick', (e) => {
    if (pendingClickTimer) {
      clearTimeout(pendingClickTimer);
      pendingClickTimer = null;
    }
    if (!e.target.closest('.task-title') || e.target.closest('.task-title-input')) return;
    if (e.target.closest('.archived')) return;
    const taskItem = e.target.closest('.task-item');
    if (taskItem) startInlineEdit(taskItem);
  });

  // 键盘可访问性：Enter / Space 打开备注
  taskList.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('input, textarea, button')) return;
    const clickableElement = e.target.closest('.task-clickable');
    if (!clickableElement) return;
    e.preventDefault();
    openNotesFor(clickableElement);
  });

  // 添加复选框状态监听
  taskList.addEventListener('change', async (e) => {
    if (e.target.classList.contains('task-checkbox')) {
      const taskItem = e.target.closest('.task-item');
      const taskId = parseInt(taskItem.dataset.id);

      try {
        await taskManager.toggleTaskComplete(taskId);
        renderTasks();
      } catch (error) {
        console.error('切换任务状态失败:', error);
        showMessage('操作失败，请重试', 'error');
      }
    }
  });
}

// 标题就地编辑
async function startInlineEdit(taskItem) {
  if (taskItem.querySelector('.task-title-input')) return;
  const titleEl = taskItem.querySelector('.task-title');
  if (!titleEl) return;

  const taskId = parseInt(taskItem.dataset.id);
  const tasks = await taskManager.getAllTasks();
  const task = tasks.find(item => item.id === taskId);
  if (!task) return;

  const originalText = task.text || '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-title-input';
  input.value = originalText;
  input.maxLength = 200;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = async (shouldSave) => {
    if (finished) return;
    finished = true;
    const nextText = input.value.trim();

    if (!shouldSave || !nextText || nextText === originalText) {
      renderTasks();
      return;
    }

    try {
      await taskManager.updateTask(taskId, { text: nextText });
      showMessage('标题已更新');
    } catch (error) {
      console.error('编辑任务失败:', error);
      showMessage('保存失败，请重试', 'error');
    }
    renderTasks();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => e.stopPropagation());
}

// 删除任务（遵循 confirmDelete 设置，并提供撤销）
async function handleDeleteTask(taskId) {
  const settings = await taskManager.getSettings();
  if (settings.confirmDelete !== false && !confirm('确定要删除这个任务吗？')) {
    return;
  }

  const tasks = await taskManager.getAllTasks();
  const task = tasks.find(item => item.id === taskId);

  try {
    await taskManager.deleteTask(taskId);
    renderTasks();
    if (task) {
      showUndoToast(task);
    } else {
      showMessage('任务已删除');
    }
  } catch (error) {
    console.error('删除任务失败:', error);
    showMessage('删除失败，请重试', 'error');
  }
}

let undoTimer = null;

function showUndoToast(task) {
  document.querySelectorAll('.undo-toast').forEach(node => node.remove());
  if (undoTimer) clearTimeout(undoTimer);

  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = '<span>任务已删除</span><button type="button">撤销</button>';
  document.body.appendChild(toast);

  const dismiss = () => {
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = null;
    toast.remove();
  };

  toast.querySelector('button').addEventListener('click', async () => {
    try {
      await taskManager.restoreTask(task);
      renderTasks();
      showMessage('已撤销删除');
    } catch (error) {
      console.error('撤销删除失败:', error);
      showMessage('撤销失败，请重试', 'error');
    } finally {
      dismiss();
    }
  });

  undoTimer = setTimeout(dismiss, 5000);
}

// 备注模态框相关函数
function openNotesModal(taskId, taskTitle, currentNotes, isArchived) {
  // 移除已存在的模态框
  const existingModal = document.getElementById('notes-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // 创建模态框
  const modal = document.createElement('div');
  modal.id = 'notes-modal';
  modal.className = 'notes-modal';
  modal.dataset.taskId = taskId;
  
  const statusText = isArchived ? '（已归档）' : '';
  modal.innerHTML = `
    <div class="notes-modal-content">
      <div class="notes-modal-header">
        为任务添加备注${statusText}
        <button class="notes-modal-close">&times;</button>
      </div>
      <div style="margin-bottom: 15px; padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px; color: #666;">
        ${escapeHtml(taskTitle)}
      </div>
      <textarea 
        class="notes-textarea" 
        placeholder="请输入备注内容..."
        maxlength="500"
        ${isArchived ? 'readonly' : ''}
      >${currentNotes}</textarea>
      <div class="notes-modal-buttons">
        ${!isArchived ? '<button class="notes-modal-btn save">保存</button>' : ''}
        <button class="notes-modal-btn cancel">
          ${isArchived ? '关闭' : '取消'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // 添加模态框内部事件监听
  modal.addEventListener('click', async (e) => {
    if (e.target === modal) {
      // 点击模态框外部关闭
      closeNotesModal();
    } else if (e.target.classList.contains('notes-modal-close') || 
               e.target.classList.contains('cancel')) {
      // 点击关闭按钮或取消按钮
      closeNotesModal();
    } else if (e.target.classList.contains('save')) {
      // 点击保存按钮
      const currentTaskId = parseInt(modal.dataset.taskId);
      await saveNotes(currentTaskId);
    }
  });

  // 自动保存备注（设置开启时，输入停止 700ms 后落盘）
  if (!isArchived) {
    taskManager.getSettings().then((settings) => {
      if (settings.autoSaveNotes === false) return;
      const textarea = modal.querySelector('.notes-textarea');
      let timer = null;
      textarea.addEventListener('input', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => {
          if (!document.body.contains(modal)) return;
          try {
            await taskManager.saveTaskNotes(parseInt(modal.dataset.taskId), textarea.value.trim());
          } catch (error) {
            console.error('自动保存备注失败:', error);
          }
        }, 700);
      });
    });
  }

  // Ctrl/Cmd + Enter 快速保存
  modal.querySelector('.notes-textarea').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isArchived) {
      e.preventDefault();
      saveNotes(parseInt(modal.dataset.taskId));
    }
  });
  
  // 聚焦到文本框（如果不是归档任务）
  if (!isArchived) {
    const textarea = modal.querySelector('.notes-textarea');
    setTimeout(() => {
      textarea.focus();
      textarea.select();
    }, 100);
  }

  // ESC键关闭
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape') {
      closeNotesModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  });
}

async function saveNotes(taskId) {
  const modal = document.getElementById('notes-modal');
  const textarea = modal.querySelector('.notes-textarea');
  const newNotes = textarea.value.trim();

  try {
    await taskManager.saveTaskNotes(taskId, newNotes);
    closeNotesModal();
    renderTasks();
    showMessage(newNotes ? '备注已保存' : '备注已清空');
  } catch (error) {
    console.error('保存备注失败:', error);
    showMessage('保存失败，请重试', 'error');
  }
}

function closeNotesModal() {
  const modal = document.getElementById('notes-modal');
  if (modal) {
    modal.remove();
  }
}

// 阻止事件冒泡的辅助函数（用于防止点击备注区域时触发任务完成）
function stopPropagation(event) {
  event.stopPropagation();
}
