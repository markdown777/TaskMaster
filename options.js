// 默认设置
const DEFAULT_SETTINGS = {
  // 安全设置
  enableEncryption: false,
  encryptionKey: '',
  
  // 显示设置
  showCompletedTasks: true,
  autoExpandToday: true,
  showTaskStats: true,
  
  // 行为设置
  confirmDelete: true,
  autoSaveNotes: true,
  taskRetentionDays: 90,
  
  // 提醒设置
  enableNotifications: true,
  soundNotifications: false
};

// 简单的加密/解密函数
function simpleEncrypt(text, key) {
  if (!key || !text) return text;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(result); // Base64编码
}

function simpleDecrypt(encryptedText, key) {
  if (!key || !encryptedText) return encryptedText;
  try {
    const text = atob(encryptedText); // Base64解码
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    console.error('解密失败:', e);
    return encryptedText;
  }
}

// 显示状态消息
function showMessage(text, type = 'success') {
  // 创建消息元素
  const message = document.createElement('div');
  message.className = `status-message ${type}`;
  message.textContent = text;
  message.style.display = 'block';
  
  // 添加到页面
  document.body.appendChild(message);
  
  // 3秒后自动移除
  setTimeout(() => {
    if (message.parentNode) {
      message.parentNode.removeChild(message);
    }
  }, 3000);
}

// 更新数据统计
function updateDataStats() {
  chrome.storage.sync.get(['tasks', 'settings'], (result) => {
    const tasks = result.tasks || [];
    const activeTasks = tasks.filter(t => !t.completed).length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const tasksWithNotes = tasks.filter(t => t.notes && t.notes.trim()).length;
    
    const statsHtml = `
      <strong>数据统计：</strong><br>
      📝 总任务数：${tasks.length}<br>
      ✅ 已完成：${completedTasks}<br>
      ⭐ 活动中：${activeTasks}<br>
      📄 有备注：${tasksWithNotes}<br>
      💾 存储大小：约 ${Math.round(JSON.stringify(tasks).length / 1024)} KB
    `;
    
    document.getElementById('dataStats').innerHTML = statsHtml;
  });
}

// 加载设置
function loadSettings() {
  chrome.storage.sync.get(['settings'], (result) => {
    const settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
    
    // 安全设置
    document.getElementById('enableEncryption').checked = settings.enableEncryption;
    document.getElementById('encryptionKey').value = settings.encryptionKey;
    toggleEncryptionOptions(settings.enableEncryption);
    
    // 显示设置
    document.getElementById('showCompletedTasks').checked = settings.showCompletedTasks;
    document.getElementById('autoExpandToday').checked = settings.autoExpandToday;
    document.getElementById('showTaskStats').checked = settings.showTaskStats;
    
    // 行为设置
    document.getElementById('confirmDelete').checked = settings.confirmDelete;
    document.getElementById('autoSaveNotes').checked = settings.autoSaveNotes;
    document.getElementById('taskRetentionDays').value = settings.taskRetentionDays;
    
    // 提醒设置
    document.getElementById('enableNotifications').checked = settings.enableNotifications;
    document.getElementById('soundNotifications').checked = settings.soundNotifications;
    
    // 更新数据统计
    updateDataStats();
  });
}

// 保存设置
function saveSettings() {
  const settings = {
    // 安全设置
    enableEncryption: document.getElementById('enableEncryption').checked,
    encryptionKey: document.getElementById('encryptionKey').value,
    
    // 显示设置
    showCompletedTasks: document.getElementById('showCompletedTasks').checked,
    autoExpandToday: document.getElementById('autoExpandToday').checked,
    showTaskStats: document.getElementById('showTaskStats').checked,
    
    // 行为设置
    confirmDelete: document.getElementById('confirmDelete').checked,
    autoSaveNotes: document.getElementById('autoSaveNotes').checked,
    taskRetentionDays: parseInt(document.getElementById('taskRetentionDays').value),
    
    // 提醒设置
    enableNotifications: document.getElementById('enableNotifications').checked,
    soundNotifications: document.getElementById('soundNotifications').checked
  };
  
  // 验证加密密钥
  if (settings.enableEncryption && settings.encryptionKey.length < 8) {
    showMessage('加密密钥至少需要8位字符', 'error');
    return;
  }
  
  chrome.storage.sync.set({ settings }, () => {
    if (chrome.runtime.lastError) {
      showMessage('设置保存失败：' + chrome.runtime.lastError.message, 'error');
    } else {
      showMessage('设置保存成功！');
      
      // 如果启用了加密，重新加密所有任务数据
      if (settings.enableEncryption && settings.encryptionKey) {
        encryptAllTasks(settings.encryptionKey);
      }
    }
  });
}

// 加密所有任务数据
function encryptAllTasks(key) {
  chrome.storage.sync.get(['tasks'], (result) => {
    const tasks = result.tasks || [];
    const encryptedTasks = tasks.map(task => ({
      ...task,
      text: simpleEncrypt(task.text, key),
      notes: task.notes ? simpleEncrypt(task.notes, key) : task.notes
    }));
    
    chrome.storage.sync.set({ tasks: encryptedTasks }, () => {
      if (!chrome.runtime.lastError) {
        showMessage('任务数据已加密');
      }
    });
  });
}

// 切换加密选项显示
function toggleEncryptionOptions(show) {
  const options = document.getElementById('encryptionOptions');
  options.style.display = show ? 'block' : 'none';
}

// 重置设置
function resetSettings() {
  if (confirm('确定要重置所有设置为默认值吗？此操作无法撤销。')) {
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
      if (chrome.runtime.lastError) {
        showMessage('重置失败：' + chrome.runtime.lastError.message, 'error');
      } else {
        loadSettings();
        showMessage('设置已重置为默认值');
      }
    });
  }
}

// 数据导出功能
function exportData() {
  chrome.storage.sync.get(['tasks', 'settings'], (result) => {
    const tasks = result.tasks || [];
    const settings = result.settings || {};
    
    if (tasks.length === 0) {
      showMessage('没有任务数据可导出', 'error');
      return;
    }
    
    // 如果数据已加密，先解密再导出
    let exportTasks = [...tasks];
    if (settings.enableEncryption && settings.encryptionKey) {
      exportTasks = tasks.map(task => ({
        ...task,
        text: simpleDecrypt(task.text, settings.encryptionKey),
        notes: task.notes ? simpleDecrypt(task.notes, settings.encryptionKey) : task.notes
      }));
    }
    
    const exportData = {
      tasks: exportTasks,
      exportDate: new Date().toISOString(),
      version: '2.9.0'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskmaster-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage(`成功导出 ${tasks.length} 条任务`);
  });
}

// 数据导入功能
function importData() {
  document.getElementById('importFile').click();
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      let tasks = [];
      
      // 支持旧格式和新格式
      if (Array.isArray(importedData)) {
        tasks = importedData; // 旧格式：直接是任务数组
      } else if (importedData.tasks && Array.isArray(importedData.tasks)) {
        tasks = importedData.tasks; // 新格式：包含元数据
      } else {
        throw new Error('无效的数据格式');
      }
      
      // 验证任务结构
      const isValid = tasks.every(task => 
        task.id && task.text && typeof task.completed === 'boolean'
      );
      
      if (!isValid) throw new Error('数据格式错误：缺少必要字段');
      
      // 如果当前启用了加密，对导入的数据进行加密
      chrome.storage.sync.get(['settings'], (result) => {
        const settings = result.settings || {};
        let finalTasks = [...tasks];
        
        if (settings.enableEncryption && settings.encryptionKey) {
          finalTasks = tasks.map(task => ({
            ...task,
            text: simpleEncrypt(task.text, settings.encryptionKey),
            notes: task.notes ? simpleEncrypt(task.notes, settings.encryptionKey) : task.notes
          }));
        }
        
        chrome.storage.sync.set({tasks: finalTasks}, () => {
          if (chrome.runtime.lastError) {
            showMessage(`导入失败: ${chrome.runtime.lastError.message}`, 'error');
          } else {
            showMessage(`成功导入 ${tasks.length} 条任务`);
            updateDataStats();
            event.target.value = ''; // 重置文件输入
          }
        });
      });
      
    } catch (error) {
      showMessage(`导入失败: ${error.message}`, 'error');
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

// 清空所有数据
function clearAllData() {
  if (confirm('⚠️ 警告：此操作将删除所有任务数据，无法撤销！\n\n确定要继续吗？')) {
    chrome.storage.sync.set({tasks: []}, () => {
      if (chrome.runtime.lastError) {
        showMessage('清空失败：' + chrome.runtime.lastError.message, 'error');
      } else {
        showMessage('所有数据已清空');
        updateDataStats();
      }
    });
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  loadSettings();
  
  // 加密选项切换
  document.getElementById('enableEncryption').addEventListener('change', (e) => {
    toggleEncryptionOptions(e.target.checked);
  });
  
  // 事件监听器
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('resetSettings').addEventListener('click', resetSettings);
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importData').addEventListener('click', importData);
  document.getElementById('importFile').addEventListener('change', handleFileImport);
  document.getElementById('clearAllData').addEventListener('click', clearAllData);
  
  // 定期更新数据统计
  setInterval(updateDataStats, 30000); // 每30秒更新一次
});
