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
  const taskList = document.getElementById('task-list');
  
  // 搜索元素获取
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchActive = document.getElementById('search-active');
  const searchCompleted = document.getElementById('search-completed');
  const searchNotes = document.getElementById('search-notes');

  // AI 助理相关元素
  const aiToggleBtn = document.getElementById('ai-toggle-btn');
  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinSubmitBtn = document.getElementById('pin-submit-btn');
  const pinCancelBtn = document.getElementById('pin-cancel-btn');
  const pinError = document.getElementById('pin-error');
  
  let isAiMode = false;
  let pendingAiText = "";

  // 1. 初始化 AI 按钮首次引导状态
  window.storageAdapter.get('AI_GUIDE_SEEN').then(isAIGuideSeen => {
    if (!isAIGuideSeen && aiToggleBtn) {
      aiToggleBtn.classList.add('guide-glow');
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

    taskInput.placeholder = isAiMode ? "✨ AI 模式: 输入自然语言 (如: 明天下午3点开会)" : "添加新任务...";
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
        // Format cleaning: replace slashes with dashes, spaces with 'T'
        let dateStr = parsedTask.due_date.replace(/\//g, '-').replace(' ', 'T');
        if (dateStr.length > 16) {
          dateStr = dateStr.slice(0, 16); // Extract up to minutes (YYYY-MM-DDTHH:mm)
        }

        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) {
          document.getElementById('task-due').value = dateStr;
          const dueButton = document.getElementById('due-button');
          if (dueButton) {
            dueButton.textContent = '已设时间';
            dueButton.style.background = 'var(--brand-color)';
            dueButton.style.color = 'var(--bg-primary)';
          }
        } else {
          // Fallback: If LLM returns an unstandardized format, parse using Date and compensate for local timezone
          const dateObj = new Date(dateStr);
          if (!isNaN(dateObj.getTime())) {
            const tzOffset = dateObj.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
            document.getElementById('task-due').value = localISOTime;
            const dueButton = document.getElementById('due-button');
            if (dueButton) {
              dueButton.textContent = '已设时间';
              dueButton.style.background = 'var(--brand-color)';
              dueButton.style.color = 'var(--bg-primary)';
            }
          }
        }
      }
      
      // Auto submit
      taskForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      
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

  // 增强存储回调验证
  if (chrome.storage) {
    chrome.storage.onChanged.addListener((changes) => {
      console.log('[DEBUG] 存储变更:', changes);
      if (changes.tasks) renderTasks();
    });
  } else {
    console.error('Chrome storage API不可用');
  }

  /**
   * 表单提交处理 - 创建新任务
   */
  taskForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = taskInput.value.trim();
    if (!title) return;

    if (isAiMode) {
      taskInput.value = ''; // clear input immediately for UX
      await processAiInput(title);
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
        due: dueIso
      };

      try {
        await taskManager.addTask(taskData);
        
        // 清空表单
        taskInput.value = '';
        taskPriority.value = 'medium';
        taskTags.value = '';
        taskDue.value = '';
        updateDueButtonState(dueButton, taskDue.value);
        
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
  initializeDuePicker(dueButton, duePopover, duePopoverClose, taskDue);
  
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
    if (e.target.classList.contains('date-header')) {
      const header = e.target;
      const content = header.nextElementSibling;
      const isExpanded = content.style.display !== 'none';
      content.style.display = isExpanded ? 'none' : 'block';
      header.querySelector('.toggle-icon').textContent = isExpanded ? '▶' : '▼';
    }
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
 * @param {HTMLButtonElement|null} dueButton - 触发按钮
 * @param {HTMLElement|null} duePopover - 弹层容器
 * @param {HTMLButtonElement|null} duePopoverClose - 弹层关闭按钮
 * @param {HTMLInputElement|null} taskDueInput - datetime-local 输入框
 */
function initializeDuePicker(dueButton, duePopover, duePopoverClose, taskDueInput) {
  if (!dueButton || !duePopover || !taskDueInput) return;

  /**
   * 将 Date 转成 datetime-local 可用的本地时间字符串
   * @param {Date} date - 日期对象
   * @returns {string} yyyy-MM-ddTHH:mm
   */
  function toDatetimeLocalValue(date) {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

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
   * 应用快捷时间
   * @param {string} preset - 预设类型
   */
  function applyPreset(preset) {
    if (preset === 'clear') {
      taskDueInput.value = '';
      syncButtonState(taskDueInput.value);
      closePopover();
      return;
    }

    const now = new Date();
    let target = new Date(now);

    if (preset === 'plus60') {
      target = new Date(Date.now() + 60 * 60 * 1000);
    }

    if (preset === 'today18') {
      target.setHours(18, 0, 0, 0);
      if (target.getTime() < now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
    }

    if (preset === 'tomorrow09') {
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    }

    taskDueInput.value = toDatetimeLocalValue(target);
    syncButtonState(taskDueInput.value);
    closePopover();
  }

  dueButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (duePopover.hidden) openPopover();
    else closePopover();
  });

  duePopoverClose?.addEventListener('click', (e) => {
    e.preventDefault();
    closePopover();
  });

  taskDueInput.addEventListener('change', () => {
    syncButtonState(taskDueInput.value);
    closePopover();
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
    closePopover();
  });

  syncButtonState(taskDueInput.value);
}

/**
 * 更新截止时间按钮的视觉状态
 * 用 title 提示具体截止时间，按钮本身保持紧凑，避免表单区域变复杂
 * @param {HTMLButtonElement|null} dueButton - 触发按钮
 * @param {string} dueValue - datetime-local 的本地时间值
 */
function updateDueButtonState(dueButton, dueValue) {
  if (!dueButton) return;

  dueButton.textContent = '时间';

  if (!dueValue) {
    dueButton.removeAttribute('data-has-value');
    dueButton.title = '设置截止时间';
    return;
  }

  const date = new Date(dueValue);
  const label = date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  dueButton.setAttribute('data-has-value', 'true');
  dueButton.title = `截止：${label}`;
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
    
    const filteredTasks = await taskManager.searchTasks(searchState.query, filters);
    renderSearchResults(filteredTasks);
  } catch (error) {
    console.error('搜索失败:', error);
    showMessage('搜索失败，请重试', 'error');
  }
}

// 渲染搜索结果
function renderSearchResults(tasks) {
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
  
  let html = `
    <div class="search-stats">
      搜索结果：共 ${tasks.length} 项任务
      ${activeCount > 0 ? ` | 活动 ${activeCount} 项` : ''}
      ${completedCount > 0 ? ` | 已完成 ${completedCount} 项` : ''}
      ${withNotesCount > 0 ? ` | 有备注 ${withNotesCount} 项` : ''}
    </div>
  `;
  
  // 按完成状态分组
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  
  // 渲染活动任务
  if (activeTasks.length > 0) {
    html += `<div class="search-section">
              <div class="search-section-title">活动任务 (${activeTasks.length})</div>
              <ul>`;
    activeTasks.forEach(task => {
      html += generateTaskItemHtml(task);
    });
    html += '</ul></div>';
  }
  
  // 渲染已完成任务
  if (completedTasks.length > 0) {
    html += `<div class="search-section">
              <div class="search-section-title">已完成任务 (${completedTasks.length})</div>
              <ul>`;
    completedTasks.forEach(task => {
      html += generateTaskItemHtml(task);
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
    const tasks = await taskManager.getAllTasks();
    const taskList = document.getElementById('task-list');
    if (taskList) {
      // 获取今天和昨天的日期
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // 记录当前的折叠状态，避免重绘后丢失
      const expandedStates = {};
      document.querySelectorAll('.date-header').forEach(header => {
        const date = header.dataset.date;
        const content = header.nextElementSibling;
        if (date && content) {
          expandedStates[date] = content.style.display !== 'none';
        }
      });
      
      // 分离任务：置顶、活动、归档
      const pinnedTasks = [];
      const activeTasks = [];
      const archivedTasks = [];
      
      tasks.forEach(task => {
        if (task.completed) {
          archivedTasks.push(task);
        } else if (task.pinned) {
          pinnedTasks.push(task);
        } else {
          activeTasks.push(task);
        }
      });
      
      let html = '';
      
      // 渲染置顶区域
      if (pinnedTasks.length > 0) {
        html += `<div class="pinned-section">
                  <div class="section-title">置顶</div>
                  <ul>`;
        pinnedTasks.forEach(task => {
          html += generateTaskItemHtml(task);
        });
        html += '</ul></div>';
      }
      
      // 按日期分组活动任务
      const tasksByDate = taskManager.groupTasksByDate(activeTasks);
      
      // 渲染日期分组
      Object.keys(tasksByDate).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
        const isToday = date === today.toLocaleDateString();
        const isYesterday = date === yesterday.toLocaleDateString();
        
        // 优先使用用户之前的折叠状态，没有则使用默认逻辑（展开今天和昨天）
        let shouldExpand;
        if (expandedStates[date] !== undefined) {
          shouldExpand = expandedStates[date];
        } else {
          shouldExpand = isToday || isYesterday;
        }
        
        html += `<div class="date-section">
                  <div class="date-header" data-date="${date}">
                    ${date} 
                    <span class="toggle-icon">${shouldExpand ? '▼' : '▶'}</span>
                  </div>
                  <div class="date-content" style="${shouldExpand ? '' : 'display:none'}">
                    <ul>`;
        
        tasksByDate[date].forEach(task => {
          html += generateTaskItemHtml(task);
        });
        
        html += `</ul></div></div>`;
      });
      
      // 渲染归档区域
      if (archivedTasks.length > 0) {
        html += `<div class="archive-section">
                  <div class="archive-title">归档</div>
                  <ul>`;
        archivedTasks.forEach(task => {
          html += generateTaskItemHtml(task);
        });
        html += '</ul></div>';
      }
      
      // 保存滚动条位置
      const currentScrollTop = taskList.scrollTop;
      
      taskList.innerHTML = html;
      
      // 恢复滚动条位置
      taskList.scrollTop = currentScrollTop;
    }
  } catch (error) {
    console.error('渲染任务失败:', error);
    showMessage('渲染任务失败，请重试', 'error');
  }
}

// 生成任务项HTML的函数
function generateTaskItemHtml(task) {
  // 处理备注内容，防止XSS攻击
  const notesHtml = task.notes ? `
    <div class="task-notes">
      <span class="task-notes-label">备注：</span>${escapeHtml(task.notes)}
    </div>
  ` : '';

  // 处理优先级徽章
  const priorityBadge = `
    <span class="priority-badge priority-${task.priority}">
      ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
    </span>
  `;

  // 处理标签
  const tagsHtml = task.tags && task.tags.length > 0 ? `
    <div class="task-tags">
      ${task.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
    </div>
  ` : '';

  // 处理截止时间
  const dueHtml = task.due ? `
    <div class="time-info">
      <span class="time-label">截止时间：</span>
      <span class="time-value">${formatDateTime(task.due)}</span>
    </div>
  ` : '';

  if (task.completed) {
    // 归档任务：显示标题、完成时间和备注
    return `<li class="task-item archived" data-id="${task.id}">
              <div class="archived-task task-clickable" data-task-id="${task.id}" data-task-text="${escapeHtml(task.text)}" data-task-notes="${escapeHtml(task.notes || '')}" data-is-archived="true">
                <div class="archived-title">${priorityBadge}${escapeHtml(task.text)}</div>
                <div class="archived-completion-time">${formatDateTime(task.completedTime)}</div>
                ${dueHtml}
                ${tagsHtml}
                ${notesHtml}
              </div>
            </li>`;
  } else {
    // 活动任务
    return `<li class="task-item" data-id="${task.id}">
      <div class="task-container">
        <input type="checkbox" ${task.completed ? 'checked' : ''} class="task-checkbox">
        
        <div class="info-container task-clickable" data-task-id="${task.id}" data-task-text="${escapeHtml(task.text)}" data-task-notes="${escapeHtml(task.notes || '')}" data-is-archived="false">
          <div class="task-title ${task.completed ? 'completed' : ''}">${priorityBadge}${escapeHtml(task.text)}</div>
          <div class="time-info">
            <span class="time-label">添加时间：</span>
            <span class="time-value">${formatDateTime(task.id)}</span>
          </div>
          ${dueHtml}
          ${tagsHtml}
          ${notesHtml}
        </div>
        
        <div class="action-buttons">
          ${!task.completed ? `<button class="pin-btn" data-pinned="${task.pinned ? 'true' : 'false'}">${task.pinned ? '★' : '☆'}</button>` : ''}
          <button class="delete-btn">×</button>
        </div>
      </div>
    </li>`;
  }
}

// 为任务添加事件监听
function addTaskEventListeners() {
  const taskList = document.getElementById('task-list');
  
  // 添加点击事件委托
  taskList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('pin-btn')) {
      const taskItem = e.target.closest('.task-item');
      const taskId = parseInt(taskItem.dataset.id);
      
      try {
        await taskManager.toggleTaskPinned(taskId);
        renderTasks();
      } catch (error) {
        console.error('切换置顶状态失败:', error);
        showMessage('操作失败，请重试', 'error');
      }
    }
    
    if (e.target.classList.contains('delete-btn')) {
      const taskId = parseInt(e.target.closest('.task-item').dataset.id);
      
      if (confirm('确定要删除这个任务吗？')) {
        try {
          await taskManager.deleteTask(taskId);
          renderTasks();
          showMessage('任务已删除');
        } catch (error) {
          console.error('删除任务失败:', error);
          showMessage('删除失败，请重试', 'error');
        }
      }
    }
    
    // 备注点击事件
    if (e.target.closest('.task-clickable')) {
      const clickableElement = e.target.closest('.task-clickable');
      const taskId = parseInt(clickableElement.dataset.taskId);
      const taskText = clickableElement.dataset.taskText;
      const taskNotes = clickableElement.dataset.taskNotes;
      const isArchived = clickableElement.dataset.isArchived === 'true';
      
      openNotesModal(taskId, taskText, taskNotes, isArchived);
    }
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
