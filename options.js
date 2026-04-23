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

// 导入加密/解密函数
// 注意：由于options.js在不同环境中运行，这里保留本地实现作为备份
async function encryptText(text, key) {
  if (!key || !text) return text;
  
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // 派生密钥
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('taskmaster-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      data
    );
    
    // 将iv和密文组合并编码
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('加密失败:', error);
    return text;
  }
}

async function decryptText(encryptedText, key) {
  if (!key || !encryptedText) return encryptedText;
  
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // 解码base64并分离iv和密文
    const combined = new Uint8Array([...atob(encryptedText)].map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // 派生密钥
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('taskmaster-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('解密失败:', error);
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
  chrome.storage.local.get(['tasks'], (localResult) => {
    const tasks = localResult.tasks || [];
    const activeTasks = tasks.filter(t => !t.completed).length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const tasksWithNotes = tasks.filter(t => t.notes && t.notes.trim()).length;
    
    const statsHtml = `
      <strong>数据统计：</strong><br>
      总任务数：${tasks.length}<br>
      已完成：${completedTasks}<br>
      活动中：${activeTasks}<br>
      有备注：${tasksWithNotes}<br>
      存储大小：约 ${Math.round(JSON.stringify(tasks).length / 1024)} KB
    `;
    
    document.getElementById('dataStats').innerHTML = statsHtml;
  });
}

// 加载设置
async function loadSettings() {
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

  const aiConfig = await window.storageAdapter.get('AI_CONFIG') || { provider: 'deepseek', baseUrl: '', enableEncryption: false };
  document.getElementById('aiProvider').value = aiConfig.provider || 'deepseek';
  document.getElementById('aiBaseUrl').value = aiConfig.baseUrl || '';
  document.getElementById('aiEnableEncryption').checked = aiConfig.enableEncryption || false;
  document.getElementById('aiPinCodeGroup').style.display = aiConfig.enableEncryption ? 'flex' : 'none';
  
  if (aiConfig.hasKey) {
    document.getElementById('aiApiKey').placeholder = aiConfig.enableEncryption ? '已配置 (已加密，请重新输入更新)' : '已配置 (未加密，请重新输入更新)';
  }

  toggleAiProvider();
}

// 保存设置
async function saveSettings() {
  const provider = document.getElementById('aiProvider').value;
  const baseUrl = document.getElementById('aiBaseUrl').value;
  const apiKey = document.getElementById('aiApiKey').value;
  const enableEncryption = document.getElementById('aiEnableEncryption').checked;
  const pinCode = document.getElementById('aiPinCode').value;

  const aiConfig = await window.storageAdapter.get('AI_CONFIG') || {};
  aiConfig.provider = provider;
  aiConfig.baseUrl = baseUrl;
  aiConfig.enableEncryption = enableEncryption;

  // 如果提供了新的 API Key
  if (apiKey) {
    if (enableEncryption) {
      if (pinCode.length < 4) {
        showMessage('启用加密时，PIN 码必须至少4位', 'error');
        return;
      }
      try {
        // 使用 options.js 本地提供的 encryptText 确保加密成功
        const encryptedKey = await encryptText(apiKey, pinCode);
        if (!encryptedKey || encryptedKey === apiKey) {
          throw new Error('加密失败，返回了明文');
        }
        await window.storageAdapter.set('AI_ENCRYPTED_KEY', encryptedKey);
        await window.storageAdapter.remove('AI_PLAINTEXT_KEY'); // 确保清除明文
        aiConfig.hasKey = true;
      } catch (e) {
        console.error("Encryption failed", e);
        showMessage('加密 API Key 失败，请重试。', 'error');
        return;
      }
    } else {
      // 不加密明文存储
      await window.storageAdapter.set('AI_PLAINTEXT_KEY', apiKey);
      await window.storageAdapter.remove('AI_ENCRYPTED_KEY'); // 确保清除密文
      aiConfig.hasKey = true;
    }
  } else if (enableEncryption && pinCode) {
    // 仅修改了PIN码，需要重新加密现有的明文或旧密文
    // 逻辑较复杂，这里简化处理：要求用户重新输入Key
    showMessage('更改加密状态或PIN码需要重新输入 API Key', 'error');
    return;
  } else if (enableEncryption && !pinCode && aiConfig.hasKey) {
     showMessage('已启用加密，请输入 PIN 码及 API Key 以完成设置', 'error');
     return;
  }

  await window.storageAdapter.set('AI_CONFIG', aiConfig);

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
  
  chrome.storage.sync.set({ settings }, async () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      showMessage('设置保存失败：' + chrome.runtime.lastError.message, 'error');
    } else {
      showMessage('设置保存成功！');
      
      const saveBtn = document.getElementById('saveSettings');
      saveBtn.textContent = '保存成功！';
      setTimeout(() => {
        saveBtn.textContent = '保存设置';
      }, 2000);
      
      // 如果启用了加密，重新加密所有任务数据
      if (settings.enableEncryption && settings.encryptionKey) {
        await encryptAllTasks(settings.encryptionKey);
      }
    }
  });
}

// 加密所有任务数据
async function encryptAllTasks(key) {
  try {
    const tasks = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['tasks'], (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.tasks || []);
        }
      });
    });
    
    // 异步加密每个任务
    const encryptedTasks = await Promise.all(tasks.map(async (task) => ({
      ...task,
      text: await encryptText(task.text, key),
      notes: task.notes ? await encryptText(task.notes, key) : task.notes
    })));
    
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ tasks: encryptedTasks }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
    
    showMessage('任务数据已加密');
  } catch (error) {
    console.error('加密所有任务失败:', error);
    showMessage('加密失败，请重试', 'error');
  }
}

// 切换加密选项显示
function toggleEncryptionOptions(show) {
  const options = document.getElementById('encryptionOptions');
  options.style.display = show ? 'block' : 'none';
}

// 切换AI提供商选项显示
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

// 切换加密 PIN 码显示
function toggleAiEncryption() {
  const enableEncryption = document.getElementById('aiEnableEncryption').checked;
  const pinCodeGroup = document.getElementById('aiPinCodeGroup');
  
  if (enableEncryption) {
    pinCodeGroup.style.display = 'flex';
    document.getElementById('aiApiKey').placeholder = '输入您的 API Key';
  } else {
    pinCodeGroup.style.display = 'none';
    document.getElementById('aiPinCode').value = ''; // 清除输入的 PIN 码
    document.getElementById('aiApiKey').placeholder = '输入您的 API Key (明文存储)';
  }
}

// 重置设置
function resetSettings() {
  if (confirm('确定要重置所有设置为默认值吗？此操作无法撤销。')) {
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
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
  chrome.storage.sync.get(['settings'], (syncResult) => {
    chrome.storage.local.get(['tasks'], async (localResult) => {
      const tasks = localResult.tasks || [];
      const settings = syncResult.settings || {};
      
      if (tasks.length === 0) {
        showMessage('没有任务数据可导出', 'error');
        return;
      }
      
      // 如果数据已加密，先解密再导出
      let exportTasks = [...tasks];
      if (settings.enableEncryption && settings.encryptionKey) {
        try {
          exportTasks = await Promise.all(tasks.map(async task => ({
            ...task,
            text: await decryptText(task.text, settings.encryptionKey),
            notes: task.notes ? await decryptText(task.notes, settings.encryptionKey) : task.notes
          })));
        } catch (error) {
          console.error('解密导出数据失败:', error);
          showMessage('解密导出数据失败', 'error');
          return;
        }
      }
      
      const exportData = {
        tasks: exportTasks,
        exportDate: new Date().toISOString(),
        version: '3.0.0'
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
      chrome.storage.sync.get(['settings'], async (result) => {
        const settings = result.settings || {};
        let finalTasks = [...tasks];
        
        if (settings.enableEncryption && settings.encryptionKey) {
          try {
            finalTasks = await Promise.all(tasks.map(async task => ({
              ...task,
              text: await encryptText(task.text, settings.encryptionKey),
              notes: task.notes ? await encryptText(task.notes, settings.encryptionKey) : task.notes
            })));
          } catch (error) {
            console.error('加密导入数据失败:', error);
            showMessage('加密导入数据失败', 'error');
            return;
          }
        }
        
        chrome.storage.local.set({tasks: finalTasks}, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
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
  if (confirm('警告：此操作将删除所有任务数据，无法撤销！\n\n确定要继续吗？')) {
    chrome.storage.local.set({tasks: []}, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        showMessage('清空失败：' + chrome.runtime.lastError.message, 'error');
      } else {
        showMessage('所有数据已清空');
        updateDataStats();
      }
    });
  }
}

// 导出所有的本地备份文件（将local存的备份列出来）
function showBackupList() {
  chrome.storage.local.get(null, (allData) => {
    const backupKeys = Object.keys(allData)
      .filter(key => key.startsWith(typeof STORAGE_KEYS !== 'undefined' ? STORAGE_KEYS.BACKUP_PREFIX : 'backup_data_'))
      .sort().reverse(); // 最新的在最上面
      
    if (backupKeys.length === 0) {
      showMessage('没有找到自动备份的数据', 'error');
      return;
    }
    
    let html = `<strong>发现 ${backupKeys.length} 份自动备份：</strong><br><br>`;
    backupKeys.forEach(key => {
      const backupTime = allData[key].backupTime ? new Date(allData[key].backupTime).toLocaleString() : '未知时间';
      const tasksCount = allData[key].data ? allData[key].data.length : 0;
      html += `<div style="margin-bottom:8px; padding:8px; border:1px solid #ddd; border-radius:4px; background:#fff;">
                 <span style="font-weight:bold;">${key.replace(typeof STORAGE_KEYS !== 'undefined' ? STORAGE_KEYS.BACKUP_PREFIX : 'backup_data_', '')}</span> 
                 <span style="color:#666; font-size:12px;">(${tasksCount} 个任务, ${backupTime})</span>
                 <button onclick="restoreFromBackupKey('${key}')" style="margin-left:10px; padding:2px 8px; cursor:pointer;">恢复此备份</button>
               </div>`;
    });
    
    const statsDiv = document.getElementById('dataStats');
    statsDiv.innerHTML = html;
  });
}

// 暴露到全局供内联 onclick 调用
window.restoreFromBackupKey = function(key) {
  if (confirm(`确定要使用 ${key} 的数据覆盖当前任务吗？`)) {
    chrome.storage.local.get(key, (result) => {
      const backupData = result[key];
      if (backupData && backupData.data) {
        chrome.storage.local.set({ tasks: backupData.data }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            showMessage('恢复失败：' + chrome.runtime.lastError.message, 'error');
          } else {
            showMessage('数据已成功恢复！');
            updateDataStats();
          }
        });
      }
    });
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  loadSettings();
  
  // 加密选项切换
  document.getElementById('enableEncryption').addEventListener('change', (e) => {
    toggleEncryptionOptions(e.target.checked);
  });

  // AI 助理配置选项切换
  document.getElementById('aiProvider').addEventListener('change', toggleAiProvider);
  document.getElementById('aiEnableEncryption').addEventListener('change', toggleAiEncryption);
  
  // 事件监听器
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('resetSettings').addEventListener('click', resetSettings);
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importData').addEventListener('click', importData);
  document.getElementById('importFile').addEventListener('change', handleFileImport);
  document.getElementById('clearAllData').addEventListener('click', clearAllData);
  document.getElementById('showBackupsBtn')?.addEventListener('click', showBackupList);
  
  // 定期更新数据统计
  setInterval(updateDataStats, 30000); // 每30秒更新一次
});
