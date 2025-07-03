// 全局搜索状态
let searchState = {
  query: '',
  showActive: true,
  showCompleted: true,
  showNotesOnly: false,
  isSearching: false
};

// 统一初始化逻辑
document.addEventListener('DOMContentLoaded', () => {
  // 添加存储操作日志
  console.log('[DEBUG] 开始初始化存储监听');

  // 表单元素获取
  const taskForm = document.getElementById('taskForm');
  const taskInput = document.getElementById('new-task');
  const taskList = document.getElementById('task-list');
  
  // 搜索元素获取
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchActive = document.getElementById('search-active');
  const searchCompleted = document.getElementById('search-completed');
  const searchNotes = document.getElementById('search-notes');

  // 增强存储回调验证
  // 增强存储回调验证
  if (chrome.storage) {
    chrome.storage.onChanged.addListener((changes) => {
      console.log('[DEBUG] 存储变更:', changes);
      if (changes.tasks) renderTasks();
    });
  } else {
    console.error('Chrome storage API不可用');
  }

  // 表单提交处理（保持不变）
  taskForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (taskInput.value.trim()) {
      const newTask = {
        id: Date.now(),
        text: taskInput.value.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
        due: new Date(Date.now() + 3600000)
      };

      chrome.storage.sync.get({tasks: []}, (result) => {
        const updatedTasks = [...result.tasks, newTask];
        chrome.storage.sync.set({ tasks: updatedTasks }, () => {
          if (chrome.runtime.lastError) {
            console.error('存储失败:', chrome.runtime.lastError);
            alert('保存失败，请检查存储空间');
            return;
          }
          
          taskInput.value = '';
          renderTasks();
          
          // 检查alarms API可用性
          if (chrome.alarms) {
            chrome.alarms.create(newTask.text, {
              when: newTask.due.getTime()
            });
          } else {
            console.warn('chrome.alarms API不可用，跳过创建提醒');
          }
          
          chrome.runtime.sendMessage({
            type: 'NEW_TASK',
            text: newTask.text
          });
        });
      });
    }
  });

  // 搜索功能事件监听
  initializeSearchEvents();
  
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
  
  // 搜索输入事件
  searchInput?.addEventListener('input', (e) => {
    searchState.query = e.target.value.trim();
    updateSearchState();
  });
  
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
function performSearch() {
  chrome.storage.sync.get({tasks: []}, (result) => {
    if (chrome.runtime.lastError) {
      console.error('搜索读取失败:', chrome.runtime.lastError);
      return;
    }
    
    const filteredTasks = filterTasks(result.tasks);
    renderSearchResults(filteredTasks);
  });
}

// 任务过滤函数
function filterTasks(tasks) {
  return tasks.filter(task => {
    // 状态过滤
    if (!searchState.showActive && !task.completed) return false;
    if (!searchState.showCompleted && task.completed) return false;
    
    // 备注过滤
    if (searchState.showNotesOnly && (!task.notes || task.notes.trim() === '')) {
      return false;
    }
    
    // 关键词搜索
    if (searchState.query) {
      const query = searchState.query.toLowerCase();
      const titleMatch = task.text.toLowerCase().includes(query);
      const notesMatch = task.notes && task.notes.toLowerCase().includes(query);
      return titleMatch || notesMatch;
    }
    
    return true;
  });
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
      📊 搜索结果：共 ${tasks.length} 项任务
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
      html += generateSearchTaskHtml(task);
    });
    html += '</ul></div>';
  }
  
  // 渲染已完成任务
  if (completedTasks.length > 0) {
    html += `<div class="search-section">
              <div class="search-section-title">已完成任务 (${completedTasks.length})</div>
              <ul>`;
    completedTasks.forEach(task => {
      html += generateSearchTaskHtml(task);
    });
    html += '</ul></div>';
  }
  
  taskList.innerHTML = html;
  
  // 添加搜索结果的事件监听
  addSearchResultsEventListeners();
}

// 生成搜索结果的任务HTML
function generateSearchTaskHtml(task) {
  const highlightedText = highlightSearchText(task.text, searchState.query);
  const highlightedNotes = task.notes ? highlightSearchText(task.notes, searchState.query) : '';
  
  const notesHtml = task.notes ? `
    <div class="task-notes">
      <span class="task-notes-label">备注：</span>${highlightedNotes}
    </div>
  ` : '';
  
  const timeLabel = task.completed ? '完成时间：' : '添加时间：';
  const timeValue = task.completed ? new Date(task.completedTime).toLocaleString() : new Date(task.id).toLocaleString();
  
  return `<li class="task-item ${task.completed ? 'archived' : ''}" data-id="${task.id}">
    <div class="task-container">
      <input type="checkbox" ${task.completed ? 'checked' : ''} class="task-checkbox">
      
      <div class="info-container task-clickable" data-task-id="${task.id}" data-task-text="${escapeHtml(task.text)}" data-task-notes="${task.notes || ''}" data-is-archived="${task.completed}">
        <div class="task-title ${task.completed ? 'completed' : ''}">${highlightedText}</div>
        <div class="time-info">
          <span class="time-label">${timeLabel}</span>
          <span class="time-value">${timeValue}</span>
        </div>
        ${notesHtml}
      </div>
      
      <div class="action-buttons">
        ${!task.completed ? `<button class="pin-btn" data-pinned="${task.pinned ? 'true' : 'false'}">${task.pinned ? '★' : '☆'}</button>` : ''}
        <button class="delete-btn">×</button>
      </div>
    </div>
  </li>`;
}

// 高亮搜索文本
function highlightSearchText(text, query) {
  if (!query || !text) return escapeHtml(text);
  
  const escapedText = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  
  return escapedText.replace(regex, '<span class="search-highlight">$1</span>');
}

// 为搜索结果添加事件监听
function addSearchResultsEventListeners() {
  const taskList = document.getElementById('task-list');
  
  // 删除现有的事件监听器（避免重复绑定）
  taskList.replaceWith(taskList.cloneNode(true));
  const newTaskList = document.getElementById('task-list');
  
  // 添加点击事件委托
  newTaskList.addEventListener('click', (e) => {
    if (e.target.classList.contains('pin-btn')) {
      const taskItem = e.target.closest('.task-item');
      const taskId = parseInt(taskItem.dataset.id);
      
      chrome.storage.sync.get({tasks: []}, (result) => {
        const taskIndex = result.tasks.findIndex(t => t.id === taskId);
        if (taskIndex > -1) {
          const task = result.tasks[taskIndex];
          task.pinned = !task.pinned;
          result.tasks[taskIndex] = task;
          chrome.storage.sync.set({ tasks: result.tasks }, () => {
            if (chrome.runtime.lastError) {
              console.error('更新失败:', chrome.runtime.lastError);
            } else {
              performSearch(); // 重新搜索以保持搜索状态
            }
          });
        }
      });
    }
    
    if (e.target.classList.contains('delete-btn')) {
      const taskId = parseInt(e.target.closest('.task-item').dataset.id);
      chrome.storage.sync.get({tasks: []}, (result) => {
        const filteredTasks = result.tasks.filter(t => t.id !== taskId);
        chrome.storage.sync.set({ tasks: filteredTasks }, () => {
          if (chrome.runtime.lastError) {
            console.error('删除失败:', chrome.runtime.lastError);
          } else {
            performSearch(); // 重新搜索以保持搜索状态
          }
        });
      });
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
  newTaskList.addEventListener('change', (e) => {
    if (e.target.classList.contains('task-checkbox')) {
      const taskItem = e.target.closest('.task-item');
      const taskId = parseInt(taskItem.dataset.id);
      
      chrome.storage.sync.get({tasks: []}, (result) => {
        const taskIndex = result.tasks.findIndex(t => t.id === taskId);
        if (taskIndex > -1) {
          const task = result.tasks[taskIndex];
          task.completed = e.target.checked;
          task.completedTime = Date.now();
          
          if (task.completed && task.pinned) {
            task.pinned = false;
          }
          
          chrome.storage.sync.set({ tasks: result.tasks }, () => {
            if (chrome.runtime.lastError) {
              console.error('状态更新失败:', chrome.runtime.lastError);
            } else {
              performSearch(); // 重新搜索以保持搜索状态
            }
          });
        }
      });
    }
  });
}

// 任务渲染功能
function renderTasks() {
  chrome.storage.sync.get({tasks: []}, (result) => {
    if (chrome.runtime.lastError) {
      console.error('读取失败:', chrome.runtime.lastError);
      return;
    }
    const taskList = document.getElementById('task-list');
    if (taskList) {
      // 获取今天和昨天的日期
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // 分离任务：置顶、活动、归档
      const pinnedTasks = [];
      const activeTasks = [];
      const archivedTasks = [];
      
      result.tasks.forEach(task => {
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
      const tasksByDate = {};
      activeTasks.forEach(task => {
        const taskDate = new Date(task.id);
        const dateKey = taskDate.toLocaleDateString();
        
        if (!tasksByDate[dateKey]) {
          tasksByDate[dateKey] = [];
        }
        tasksByDate[dateKey].push(task);
      });
      
      // 渲染日期分组
      Object.keys(tasksByDate).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
        const isToday = date === today.toLocaleDateString();
        const isYesterday = date === yesterday.toLocaleDateString();
        const shouldExpand = isToday || isYesterday;
        
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
      
      taskList.innerHTML = html;
      
      // 添加日期标题点击事件
      document.querySelectorAll('.date-header').forEach(header => {
        header.addEventListener('click', () => {
          const content = header.nextElementSibling;
          const isExpanded = content.style.display !== 'none';
          content.style.display = isExpanded ? 'none' : 'block';
          header.querySelector('.toggle-icon').textContent = isExpanded ? '▶' : '▼';
        });
      });
      
      // 添加删除事件委托
      taskList.addEventListener('click', (e) => {
        if (e.target.classList.contains('pin-btn')) {
          const taskItem = e.target.closest('.task-item');
          const taskId = parseInt(taskItem.dataset.id);
          
          chrome.storage.sync.get({tasks: []}, (result) => {
            const taskIndex = result.tasks.findIndex(t => t.id === taskId);
            
            if (taskIndex > -1) {
              const task = result.tasks[taskIndex];
              task.pinned = !task.pinned;
              result.tasks[taskIndex] = task;
              chrome.storage.sync.set({ tasks: result.tasks }, () => {
                if (chrome.runtime.lastError) {
                  console.error('更新失败:', chrome.runtime.lastError);
                } else {
                  renderTasks();
                }
              });
            }
          });
        }
        if (e.target.classList.contains('delete-btn')) {
          const taskId = parseInt(e.target.closest('.task-item').dataset.id);
          chrome.storage.sync.get({tasks: []}, (result) => {
            const filteredTasks = result.tasks.filter(t => t.id !== taskId);
            chrome.storage.sync.set({ tasks: filteredTasks }, () => {
              if (chrome.runtime.lastError) {
                console.error('删除失败:', chrome.runtime.lastError);
              } else {
                renderTasks();
              }
            });
          });
        }
        // 添加备注点击事件处理
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
      taskList.addEventListener('change', (e) => {
        if (e.target.classList.contains('task-checkbox')) {
          const taskItem = e.target.closest('.task-item');
          const taskId = parseInt(taskItem.dataset.id);
          
          chrome.storage.sync.get({tasks: []}, (result) => {
            const taskIndex = result.tasks.findIndex(t => t.id === taskId);
            if (taskIndex > -1) {
              const task = result.tasks[taskIndex];
              task.completed = e.target.checked;
              task.completedTime = Date.now();
              
              if (task.completed && task.pinned) {
                task.pinned = false;
              }
              
              chrome.storage.sync.set({ tasks: result.tasks }, () => {
                if (chrome.runtime.lastError) {
                  console.error('状态更新失败:', chrome.runtime.lastError);
                } else {
                  renderTasks();
                }
              });
            }
          });
        }
      });
    }
  });
}

// 生成任务项HTML的函数
function generateTaskItemHtml(task) {
  // 处理备注内容，防止XSS攻击
  const notesHtml = task.notes ? `
    <div class="task-notes">
      <span class="task-notes-label">备注：</span>${escapeHtml(task.notes)}
    </div>
  ` : '';

  if (task.completed) {
    // 归档任务：显示标题、完成时间和备注
    return `<li class="task-item archived" data-id="${task.id}">
              <div class="archived-task task-clickable" data-task-id="${task.id}" data-task-text="${escapeHtml(task.text)}" data-task-notes="${task.notes || ''}" data-is-archived="true">
                <div class="archived-title">${escapeHtml(task.text)}</div>
                <div class="archived-completion-time">${new Date(task.completedTime).toLocaleString()}</div>
                ${notesHtml}
              </div>
            </li>`;
  } else {
    // 活动任务
    return `<li class="task-item" data-id="${task.id}">
      <div class="task-container">
        <input type="checkbox" ${task.completed ? 'checked' : ''} class="task-checkbox">
        
        <div class="info-container task-clickable" data-task-id="${task.id}" data-task-text="${escapeHtml(task.text)}" data-task-notes="${task.notes || ''}" data-is-archived="false">
          <div class="task-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.text)}</div>
          <div class="time-info">
            <span class="time-label">添加时间：</span>
            <span class="time-value">${new Date(task.id).toLocaleString()}</span>
          </div>
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

// HTML转义函数，防止XSS攻击
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示消息提示
function showMessage(text) {
  const message = document.createElement('div');
  message.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4CAF50;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 1001;
    font-family: Arial, sans-serif;
  `;
  message.textContent = text;
  document.body.appendChild(message);
  
  setTimeout(() => {
    message.remove();
  }, 3000);
}

// 在DOMContentLoaded内添加按钮事件监听
document.addEventListener('DOMContentLoaded', () => {
  // 分享按钮事件
  document.getElementById('share-btn').addEventListener('click', () => {
    chrome.storage.sync.get({tasks: []}, (result) => {
      if (chrome.runtime.lastError) {
        console.error('分享读取失败:', chrome.runtime.lastError);
        return;
      }
      
      // 生成分享内容
      const shareContent = `📝 我的待办事项清单（${new Date().toLocaleString()}）\n\n` + 
        result.tasks.map((t, i) => {
          const status = t.completed ? '✅' : '❗';
          const date = new Date(t.id).toLocaleDateString();
          return `${status} ${i + 1}. ${t.text} (${date})`;
        }).join('\n') + 
        `\n\n📊 统计：共${result.tasks.length}项任务，已完成${result.tasks.filter(t => t.completed).length}项`;
      
      // 显示分享选项菜单
      showShareMenu(shareContent);
    });
  });
  
  // 显示分享菜单
  function showShareMenu(content) {
    // 移除已存在的菜单
    const existingMenu = document.getElementById('share-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    // 创建分享菜单
    const menu = document.createElement('div');
    menu.id = 'share-menu';
    menu.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1000;
      min-width: 280px;
      font-family: Arial, sans-serif;
    `;
    
    menu.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: #333;">选择分享方式</h3>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="copy-share" style="padding: 10px; border: 1px solid #4CAF50; background: #4CAF50; color: white; border-radius: 4px; cursor: pointer;">
          📋 复制到剪贴板
        </button>
        <button id="email-share" style="padding: 10px; border: 1px solid #2196F3; background: #2196F3; color: white; border-radius: 4px; cursor: pointer;">
          📧 邮件分享
        </button>
        <button id="web-share" style="padding: 10px; border: 1px solid #FF9800; background: #FF9800; color: white; border-radius: 4px; cursor: pointer; display: none;" data-supported="false">
          🔗 系统分享
        </button>
        <button id="close-menu" style="padding: 8px; border: 1px solid #ccc; background: #f5f5f5; color: #666; border-radius: 4px; cursor: pointer;">
          取消
        </button>
      </div>
    `;
    
    document.body.appendChild(menu);
    
    // 检查Web Share API支持
    if (navigator.share) {
      const webShareBtn = document.getElementById('web-share');
      webShareBtn.style.display = 'block';
      webShareBtn.dataset.supported = 'true';
    }
    
    // 添加事件监听
    document.getElementById('copy-share').addEventListener('click', () => {
      copyToClipboard(content);
      menu.remove();
      showMessage('内容已复制到剪贴板！');
    });
    
    document.getElementById('email-share').addEventListener('click', () => {
      const mailtoUrl = `mailto:?subject=${encodeURIComponent('我的待办事项清单')}&body=${encodeURIComponent(content)}`;
      try {
        window.open(mailtoUrl);
        menu.remove();
      } catch (error) {
        console.error('邮件分享失败:', error);
        // 备用方案：复制邮件链接
        copyToClipboard(mailtoUrl);
        menu.remove();
        showMessage('邮件链接已复制到剪贴板，请手动粘贴到浏览器地址栏');
      }
    });
    
    const webShareBtn = document.getElementById('web-share');
    if (webShareBtn.dataset.supported === 'true') {
      webShareBtn.addEventListener('click', async () => {
        try {
          await navigator.share({
            title: '我的待办事项清单',
            text: content
          });
          menu.remove();
        } catch (error) {
          console.error('系统分享失败:', error);
          copyToClipboard(content);
          menu.remove();
          showMessage('系统分享不可用，内容已复制到剪贴板');
        }
      });
    }
    
    document.getElementById('close-menu').addEventListener('click', () => {
      menu.remove();
    });
    
    // 点击菜单外部关闭
    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 100);
  }
  
  // 复制到剪贴板函数
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      // 备用方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }
  
  // 设置按钮事件 - 打开选项页面
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // 添加日期标题点击事件
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('date-header')) {
      const header = e.target;
      const content = header.nextElementSibling;
      const isExpanded = content.style.display !== 'none';
      content.style.display = isExpanded ? 'none' : 'block';
      header.querySelector('.toggle-icon').textContent = isExpanded ? '▶' : '▼';
    }
  });
});

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
        ${!isArchived ? `<button class="notes-modal-btn save">保存</button>` : ''}
        <button class="notes-modal-btn cancel">
          ${isArchived ? '关闭' : '取消'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // 添加模态框内部事件监听
  modal.addEventListener('click', (e) => {
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
      saveNotes(currentTaskId);
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

function closeNotesModal() {
  const modal = document.getElementById('notes-modal');
  if (modal) {
    modal.remove();
  }
}

function saveNotes(taskId) {
  const modal = document.getElementById('notes-modal');
  const textarea = modal.querySelector('.notes-textarea');
  const newNotes = textarea.value.trim();

  // 获取当前任务数据并更新
  chrome.storage.sync.get({tasks: []}, (result) => {
    if (chrome.runtime.lastError) {
      console.error('读取任务失败:', chrome.runtime.lastError);
      showMessage('保存失败，请重试');
      return;
    }

    const taskIndex = result.tasks.findIndex(t => t.id === taskId);
    if (taskIndex > -1) {
      // 更新任务的备注
      result.tasks[taskIndex].notes = newNotes;
      
      chrome.storage.sync.set({ tasks: result.tasks }, () => {
        if (chrome.runtime.lastError) {
          console.error('保存备注失败:', chrome.runtime.lastError);
          showMessage('保存失败，请检查存储空间');
        } else {
          closeNotesModal();
          renderTasks();
          showMessage(newNotes ? '备注已保存' : '备注已清空');
        }
      });
    } else {
      showMessage('任务未找到，请刷新页面重试');
    }
  });
}

// 阻止事件冒泡的辅助函数（用于防止点击备注区域时触发任务完成）
function stopPropagation(event) {
  event.stopPropagation();
}
