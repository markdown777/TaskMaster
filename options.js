// 默认设置
const DEFAULT_SETTINGS = {
  showCompletedTasks: true,
  autoExpandToday: true,
  showTaskStats: true,

  confirmDelete: true,
  autoSaveNotes: true,
  taskRetentionDays: 0,

  enableNotifications: true,
  soundNotifications: false,

  enableCloudSync: false
};

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

    // 同步设置
    const cloudSyncCheckbox = document.getElementById('enableCloudSync');
    if (cloudSyncCheckbox) {
      cloudSyncCheckbox.checked = settings.enableCloudSync;
    }
    
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

  // Load VISION_CONFIG
  const visionConfig = await window.storageAdapter.get('VISION_CONFIG') || { provider: 'off', baseUrl: '', model: '', enableEncryption: false };
  document.getElementById('visionProvider').value = visionConfig.provider || 'off';
  document.getElementById('visionBaseUrl').value = visionConfig.baseUrl || '';
  document.getElementById('visionModel').value = visionConfig.model || '';
  document.getElementById('visionEnableEncryption').checked = visionConfig.enableEncryption || false;

  if (visionConfig.hasKey) {
    document.getElementById('visionApiKey').placeholder = visionConfig.enableEncryption ? '已配置 (已加密，请重新输入更新)' : '已配置 (未加密，请重新输入更新)';
  }

  toggleVisionProvider();
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
        const encryptedKey = await window.cryptoAdapter.encrypt(apiKey, pinCode);
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
  } else {
    // 未提供新的 API Key：允许仅更新其他设置
    if (enableEncryption) {
      // 场景1：之前是明文 key，现在希望启用加密但不想重新输入 key
      const plainKey = await window.storageAdapter.get('AI_PLAINTEXT_KEY');
      if (plainKey) {
        if (pinCode.length < 4) {
          showMessage('启用加密时，PIN 码必须至少4位', 'error');
          return;
        }
        try {
          const encryptedKey = await window.cryptoAdapter.encrypt(plainKey, pinCode);
          if (!encryptedKey || encryptedKey === plainKey) {
            throw new Error('加密失败，返回了明文');
          }
          await window.storageAdapter.set('AI_ENCRYPTED_KEY', encryptedKey);
          await window.storageAdapter.remove('AI_PLAINTEXT_KEY');
          aiConfig.hasKey = true;
        } catch (e) {
          console.error("Encryption failed", e);
          showMessage('加密 API Key 失败，请重试。', 'error');
          return;
        }
      } else {
        // 场景2：已经是加密 key，仅验证 PIN 是否匹配（用于“复用 PIN”不误判为改 PIN）
        const existingEncrypted = await window.storageAdapter.get('AI_ENCRYPTED_KEY');
        if (existingEncrypted) {
          if (pinCode) {
            const decryptedKey = await window.cryptoAdapter.decrypt(existingEncrypted, pinCode);
            if (!decryptedKey) {
              showMessage('认证失败，请检查 PIN 码', 'error');
              return;
            }
          }
        } else if (!aiConfig.hasKey) {
          // 没有任何 key
          showMessage('请先输入 API Key 以完成设置', 'error');
          return;
        }
      }
    }
  }

  await window.storageAdapter.set('AI_CONFIG', aiConfig);

  // 保存 Vision 配置
  const visionProvider = document.getElementById('visionProvider').value;
  const visionConfig = await window.storageAdapter.get('VISION_CONFIG') || {};
  visionConfig.provider = visionProvider;

  if (visionProvider === 'off') {
    await window.storageAdapter.remove('VISION_ENCRYPTED_KEY');
    await window.storageAdapter.remove('VISION_PLAINTEXT_KEY');
    visionConfig.hasKey = false;
  } else {
    visionConfig.baseUrl = document.getElementById('visionBaseUrl').value;
    visionConfig.model = document.getElementById('visionModel').value;
    visionConfig.enableEncryption = document.getElementById('visionEnableEncryption').checked;
    const visionApiKey = document.getElementById('visionApiKey').value;

    if (visionApiKey) {
      if (visionConfig.enableEncryption) {
        if (pinCode.length < 4) {
          showMessage('启用 Vision 加密时，PIN 码必须至少4位', 'error');
          return;
        }
        try {
          const encryptedKey = await window.cryptoAdapter.encrypt(visionApiKey, pinCode);
          if (!encryptedKey || encryptedKey === visionApiKey) {
            throw new Error('加密失败，返回了明文');
          }
          await window.storageAdapter.set('VISION_ENCRYPTED_KEY', encryptedKey);
          await window.storageAdapter.remove('VISION_PLAINTEXT_KEY');
          visionConfig.hasKey = true;
        } catch (e) {
          console.error("Vision Encryption failed", e);
          showMessage('加密 Vision API Key 失败，请重试。', 'error');
          return;
        }
      } else {
        await window.storageAdapter.set('VISION_PLAINTEXT_KEY', visionApiKey);
        await window.storageAdapter.remove('VISION_ENCRYPTED_KEY');
        visionConfig.hasKey = true;
      }
    } else {
      // 未提供新的 Vision API Key：允许仅更新其他设置
      if (visionConfig.enableEncryption) {
        const plainVisionKey = await window.storageAdapter.get('VISION_PLAINTEXT_KEY');
        if (plainVisionKey) {
          if (pinCode.length < 4) {
            showMessage('启用 Vision 加密时，PIN 码必须至少4位', 'error');
            return;
          }
          try {
            const encryptedKey = await window.cryptoAdapter.encrypt(plainVisionKey, pinCode);
            if (!encryptedKey || encryptedKey === plainVisionKey) {
              throw new Error('加密失败，返回了明文');
            }
            await window.storageAdapter.set('VISION_ENCRYPTED_KEY', encryptedKey);
            await window.storageAdapter.remove('VISION_PLAINTEXT_KEY');
            visionConfig.hasKey = true;
          } catch (e) {
            console.error("Vision Encryption failed", e);
            showMessage('加密 Vision API Key 失败，请重试。', 'error');
            return;
          }
        } else {
          const existingEncrypted = await window.storageAdapter.get('VISION_ENCRYPTED_KEY');
          if (existingEncrypted) {
            if (pinCode) {
              const decryptedKey = await window.cryptoAdapter.decrypt(existingEncrypted, pinCode);
              if (!decryptedKey || decryptedKey === existingEncrypted) {
                showMessage('PIN 码不匹配。如需更换 PIN，请重新输入 Vision API Key。', 'error');
                return;
              }
            }
          } else if (!visionConfig.hasKey) {
            showMessage('请先输入 Vision API Key 以完成设置', 'error');
            return;
          }
        }
      }
    }
  }
  
  await window.storageAdapter.set('VISION_CONFIG', visionConfig);

  const settings = {
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
    soundNotifications: document.getElementById('soundNotifications').checked,

    // 同步设置
    enableCloudSync: document.getElementById('enableCloudSync')?.checked || false
  };
  
  // 合并已有设置，避免覆盖历史字段（如旧版加密配置）
  chrome.storage.sync.get(['settings'], (result) => {
    const mergedSettings = { ...(result.settings || {}), ...settings };

    chrome.storage.sync.set({ settings: mergedSettings }, async () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        showMessage('设置保存失败：' + chrome.runtime.lastError.message, 'error');
      } else {
        showMessage('设置保存成功！');

        if (!settings.enableCloudSync) {
          const syncKey = typeof STORAGE_KEYS !== 'undefined' ? STORAGE_KEYS.SYNC_CORE_TASKS : 'sync_core_tasks';
          chrome.storage.sync.remove(syncKey);
        }

        const saveBtn = document.getElementById('saveSettings');
        const actions = document.querySelector('.settings-actions');
        if (actions) actions.classList.remove('dirty');
        saveBtn.textContent = '保存成功！';
        setTimeout(() => {
          saveBtn.textContent = '保存设置';
        }, 2000);
      }
    });
  });
}

// 旧版“任务数据加密”已移除（浏览器端从未实现解密，启用后会显示密文）
// 这里做一次性修复：用历史密钥解密已加密任务，并关闭该开关
async function migrateLegacyTaskEncryption() {
  const { settings = {} } = await new Promise(resolve => {
    chrome.storage.sync.get(['settings'], resolve);
  });

  if (!settings.enableEncryption || !settings.encryptionKey) return false;

  const tasks = (await window.storageAdapter.get('tasks')) || [];
  if (tasks.length === 0) {
    chrome.storage.sync.set({ settings: { ...settings, enableEncryption: false } });
    return false;
  }

  try {
    const failures = { count: 0 };
    const looksEncrypted = (value) => typeof value === 'string'
      && value.length >= 40
      && /^[A-Za-z0-9+/]+={0,2}$/.test(value);

    const decryptField = async (value) => {
      if (!value || !looksEncrypted(value)) return value;
      const decrypted = await window.cryptoAdapter.decrypt(value, settings.encryptionKey);
      if (decrypted !== null) return decrypted;
      failures.count++;
      return value;
    };

    const decryptedTasks = await Promise.all(tasks.map(async (task) => ({
      ...task,
      text: await decryptField(task.text),
      notes: await decryptField(task.notes)
    })));

    if (failures.count > 0) {
      throw new Error(`有 ${failures.count} 个字段解密失败`);
    }

    await window.storageAdapter.set('tasks', decryptedTasks);
    chrome.storage.sync.set({ settings: { ...settings, enableEncryption: false } });
    showMessage('已解密历史任务数据并关闭已废弃的“任务数据加密”');
    return true;
  } catch (error) {
    console.error('迁移旧版任务加密失败:', error);
    showMessage('历史任务数据解密失败，请检查密钥或从备份恢复', 'error');
    return false;
  }
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

// 切换 Vision 配置显示
function toggleVisionProvider() {
  const provider = document.getElementById('visionProvider').value;
  const configGroup = document.getElementById('visionConfigGroup');
  const curlGroup = document.getElementById('visionCurlGroup');
  const baseUrlInput = document.getElementById('visionBaseUrl');
  
  if (provider === 'off') {
    configGroup.style.display = 'none';
  } else {
    configGroup.style.display = 'block';
    if (provider === 'doubao') {
      curlGroup.style.display = 'block';
      if (!baseUrlInput.value) {
        baseUrlInput.value = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      }
    } else {
      curlGroup.style.display = 'none';
    }
  }
}

// 解析 Doubao curl
function parseDoubaoCurl(curlText) {
  const urlMatch = curlText.match(/curl\s+(?:\\?[`'"])?(https?:\/\/[^\s`'"\\]+)/i);
  const authMatch = curlText.match(/Authorization:\s*Bearer\s+([^"\s\\]+)/i);
  const modelMatch = curlText.match(/"model"\s*:\s*"([^"]+)"/i);
  return {
    baseUrl: urlMatch ? urlMatch[1] : null,
    apiKey: authMatch ? authMatch[1] : null,
    model: modelMatch ? modelMatch[1] : null,
  };
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
            text: await window.cryptoAdapter.decrypt(task.text, settings.encryptionKey),
            notes: task.notes ? await window.cryptoAdapter.decrypt(task.notes, settings.encryptionKey) : task.notes
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

      if (!confirm(`导入将覆盖当前全部任务（共 ${tasks.length} 条），确定继续吗？`)) {
        event.target.value = '';
        return;
      }
      
      // 如果当前启用了加密，对导入的数据进行加密
      chrome.storage.sync.get(['settings'], async (result) => {
        const settings = result.settings || {};
        let finalTasks = [...tasks];
        
        if (settings.enableEncryption && settings.encryptionKey) {
          try {
            finalTasks = await Promise.all(tasks.map(async task => ({
              ...task,
              text: await window.cryptoAdapter.encrypt(task.text, settings.encryptionKey),
              notes: task.notes ? await window.cryptoAdapter.encrypt(task.notes, settings.encryptionKey) : task.notes
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
      const label = key.replace(typeof STORAGE_KEYS !== 'undefined' ? STORAGE_KEYS.BACKUP_PREFIX : 'backup_data_', '');
      html += `<div style="margin-bottom:8px; padding:8px; border:1px solid #ddd; border-radius:4px; background:#fff;">
                 <span style="font-weight:bold;">${escapeHtml(label)}</span> 
                 <span style="color:#666; font-size:12px;">(${tasksCount} 个任务, ${escapeHtml(backupTime)})</span>
                 <button class="restore-backup-btn" data-backup-key="${escapeHtml(key)}" style="margin-left:10px; padding:2px 8px; cursor:pointer;">恢复此备份</button>
               </div>`;
    });
    
    const backupListDiv = document.getElementById('backupList');
    if (backupListDiv) backupListDiv.innerHTML = html;
  });
}

function restoreFromBackupKey(key) {
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
}

/**
 * 发送一条测试通知，用于确认系统通知权限是否开启
 */
function sendTestNotification() {
  if (!document.getElementById('enableNotifications').checked) {
    showMessage('请先勾选「启用通知提醒」，否则到期提醒不会发送', 'error');
    return;
  }

  chrome.notifications.create(`taskmaster-test-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'TaskMaster 测试提醒',
    message: '如果你看到这条通知，说明系统通知权限已开启。',
    silent: !document.getElementById('soundNotifications').checked
  }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      showMessage('测试通知发送失败：' + chrome.runtime.lastError.message, 'error');
      return;
    }
    showMessage('测试通知已发送，若未看到请检查系统通知设置');
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  loadSettings();

  // 修复旧版任务数据加密遗留问题
  migrateLegacyTaskEncryption();

  // 未保存修改提示
  const settingsContainer = document.querySelector('.settings-container');
  const settingsActions = document.querySelector('.settings-actions');
  if (settingsContainer && settingsActions) {
    const markDirty = () => {
      settingsActions.classList.add('dirty');
      const saveBtn = document.getElementById('saveSettings');
      if (saveBtn && saveBtn.textContent === '保存设置') {
        saveBtn.textContent = '保存修改';
      }
    };
    settingsContainer.addEventListener('input', markDirty);
    settingsContainer.addEventListener('change', markDirty);

    window.addEventListener('beforeunload', (e) => {
      if (!settingsActions.classList.contains('dirty')) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  // AI 助理配置选项切换
  document.getElementById('aiProvider').addEventListener('change', toggleAiProvider);
  document.getElementById('aiEnableEncryption').addEventListener('change', toggleAiEncryption);
  
  // Vision 配置选项切换
  document.getElementById('visionProvider').addEventListener('change', toggleVisionProvider);

  // Vision Curl 解析
  document.getElementById('parseVisionCurlBtn').addEventListener('click', () => {
    const curlText = document.getElementById('visionCurlInput').value;
    if (!curlText.trim()) return;
    const parsed = parseDoubaoCurl(curlText);
    if (parsed.baseUrl) document.getElementById('visionBaseUrl').value = parsed.baseUrl;
    if (parsed.model) document.getElementById('visionModel').value = parsed.model;
    if (parsed.apiKey) document.getElementById('visionApiKey').value = parsed.apiKey;
    showMessage('已解析并填充 curl 配置，请点击保存设置！');
  });

  // 全局粘贴监听，拦截 curl
  document.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text && text.trim().startsWith('curl') && text.includes('ark.cn-beijing.volces.com')) {
      if (confirm('检测到 Doubao API cURL 配置，是否应用到图片识别配置？')) {
        const parsed = parseDoubaoCurl(text);
        document.getElementById('visionProvider').value = 'doubao';
        toggleVisionProvider();
        if (parsed.baseUrl) document.getElementById('visionBaseUrl').value = parsed.baseUrl;
        if (parsed.model) document.getElementById('visionModel').value = parsed.model;
        if (parsed.apiKey) document.getElementById('visionApiKey').value = parsed.apiKey;
        document.getElementById('visionCurlInput').value = text;
        showMessage('配置已填充，请点击底部保存设置。');
      }
    }
  });

  // 按钮事件绑定
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('resetSettings').addEventListener('click', resetSettings);
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importData').addEventListener('click', importData);
  document.getElementById('importFile').addEventListener('change', handleFileImport);
  document.getElementById('clearAllData').addEventListener('click', clearAllData);
  document.getElementById('showBackupsBtn')?.addEventListener('click', showBackupList);
  document.getElementById('testNotification')?.addEventListener('click', sendTestNotification);

  // MV3 禁止内联 onclick，备份恢复使用事件委托
  document.getElementById('dataStats').addEventListener('click', (e) => {
    const restoreBtn = e.target.closest('.restore-backup-btn');
    if (!restoreBtn) return;
    restoreFromBackupKey(restoreBtn.dataset.backupKey);
  });
  
  // 定期更新数据统计
  setInterval(updateDataStats, 30000); // 每30秒更新一次
});
