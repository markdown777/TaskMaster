importScripts('constants.js');

/**
 * 后台服务初始化
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[DEBUG] TaskMaster后台服务已安装/更新');
  initAutoBackup();
  checkCoreFiles();
});

/**
 * 初始化定时自动备份机制
 */
function initAutoBackup() {
  if (typeof chrome.alarms !== 'undefined') {
    chrome.alarms.get('ALARM_DAILY_BACKUP', (alarm) => {
      if (!alarm) {
        chrome.alarms.create('ALARM_DAILY_BACKUP', {
          periodInMinutes: CONFIG.BACKUP_PERIOD_MINUTES // 默认 1440 分钟（24小时）
        });
        console.log('[DEBUG] 已注册每日自动备份任务');
      }
    });
  }
}

/**
 * 监听闹钟触发
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  // 任务提醒
  if (alarm.name !== 'ALARM_DAILY_BACKUP') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '任务提醒',
      message: alarm.name
    });
  }
  
  // 每日自动备份
  if (alarm.name === 'ALARM_DAILY_BACKUP') {
    executeAutoBackup();
  }
});

/**
 * 执行全量数据自动备份
 */
async function executeAutoBackup() {
  try {
    chrome.storage.local.get([STORAGE_KEYS.TASKS], (result) => {
      const tasks = result[STORAGE_KEYS.TASKS];
      if (!tasks || tasks.length === 0) return;

      const dateStr = new Date().toISOString().split('T')[0]; // 例如: 2026-04-21
      const backupKey = `${STORAGE_KEYS.BACKUP_PREFIX}${dateStr}`;
      
      const backupData = {
        data: tasks,
        backupTime: new Date().toISOString()
      };

      // 1. 将数据另存为快照
      chrome.storage.local.set({ [backupKey]: backupData }, () => {
        if (!chrome.runtime.lastError) {
          console.log(`[DEBUG] 自动备份成功: ${backupKey}`);
          // 2. 清理过期备份
          cleanupOldBackups();
        }
      });
    });
  } catch (error) {
    console.error('自动备份失败:', error);
  }
}

/**
 * 清理过期的旧备份（保持最近 7 天）
 */
function cleanupOldBackups() {
  chrome.storage.local.get(null, (allData) => {
    const backupKeys = Object.keys(allData).filter(key => 
      key.startsWith(STORAGE_KEYS.BACKUP_PREFIX)
    );

    if (backupKeys.length > CONFIG.MAX_BACKUP_COUNT) {
      // 按日期字典序排列（旧的排在前面）
      backupKeys.sort();
      const keysToDelete = backupKeys.slice(0, backupKeys.length - CONFIG.MAX_BACKUP_COUNT);
      
      chrome.storage.local.remove(keysToDelete, () => {
        console.log(`[DEBUG] 已清理 ${keysToDelete.length} 个过期备份文件`);
      });
    }
  });
}

/**
 * 处理跨设备同步来的核心数据 (Merge 逻辑)
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[STORAGE_KEYS.SYNC_CORE_TASKS]) {
    const newCoreTasks = changes[STORAGE_KEYS.SYNC_CORE_TASKS].newValue;
    if (!newCoreTasks) return;
    
    console.log('[DEBUG] 检测到远端云端数据更新，准备与本地数据合并...');
    
    // 读取本地全量数据
    chrome.storage.local.get([STORAGE_KEYS.TASKS], (result) => {
      let localTasks = result[STORAGE_KEYS.TASKS] || [];
      let hasChanges = false;
      
      // 合并逻辑：以 updated 时间戳为准，或补齐新任务
      newCoreTasks.forEach(coreTask => {
        const localIndex = localTasks.findIndex(t => t.id === coreTask.id);
        
        if (localIndex === -1) {
          // 本地没有，说明是其他设备新建的任务，拉取到本地
          // (由于是核心数据，缺少notes等字段，需要设置默认值)
          localTasks.push({
            ...coreTask,
            notes: '',
            tags: [],
            createdAt: new Date(coreTask.id).toISOString()
          });
          hasChanges = true;
        } else {
          // 本地有，比较 updatedAt
          const localTask = localTasks[localIndex];
          if (coreTask.updatedAt && (!localTask.updatedAt || coreTask.updatedAt > localTask.updatedAt)) {
            // 远端较新，覆盖本地（保留本地的 notes/tags 这种未同步字段）
            localTasks[localIndex] = {
              ...localTask,
              completed: coreTask.completed,
              priority: coreTask.priority,
              due: coreTask.due,
              pinned: coreTask.pinned,
              updatedAt: coreTask.updatedAt
            };
            hasChanges = true;
          }
        }
      });
      
      if (hasChanges) {
        chrome.storage.local.set({ [STORAGE_KEYS.TASKS]: localTasks }, () => {
          console.log('[DEBUG] 跨设备数据合并完成并存入本地。');
        });
      }
    });
  }
});

/**
 * 新任务推送处理
 * 监听来自popup的消息，创建任务添加通知
 */
chrome.runtime.onMessage.addListener((req) => {
  if (req.type === MESSAGE_TYPES.NEW_TASK) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '任务已添加',
      message: req.text
    });
  }
});

/**
 * 核心文件检查
 */
function checkCoreFiles() {
  const REQUIRED_FILES = [
    'manifest.json',
    'popup.html',
    'icons/icon128.png'
  ];
  REQUIRED_FILES.forEach(file => {
    fetch(chrome.runtime.getURL(file))
      .catch(() => console.error(`核心文件缺失: ${file}`));
  });
}
