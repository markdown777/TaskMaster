/**
 * 全局常量定义模块
 * 统一管理键名、消息类型及默认值，避免代码中出现魔法字符串
 */

const STORAGE_KEYS = {
  TASKS: 'tasks',
  SETTINGS: 'settings',
  SYNC_CORE_TASKS: 'sync_core_tasks', // 用于sync存储轻量级任务数据
  BACKUP_PREFIX: 'backup_data_' // 用于local存储自动备份数据
};

const MESSAGE_TYPES = {
  NEW_TASK: 'NEW_TASK',
  SYNC_UPDATE: 'SYNC_UPDATE'
};

const TASK_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

const CONFIG = {
  BACKUP_PERIOD_MINUTES: 1440, // 自动备份周期：24小时
  MAX_BACKUP_COUNT: 7 // 最大保留备份数：7天
};

// 导出常量
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEYS,
    MESSAGE_TYPES,
    TASK_PRIORITY,
    CONFIG
  };
} else {
  // 使用 globalThis 兼容浏览器(window)和 Service Worker(self) 环境
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  
  root.STORAGE_KEYS = STORAGE_KEYS;
  root.MESSAGE_TYPES = MESSAGE_TYPES;
  root.TASK_PRIORITY = TASK_PRIORITY;
  root.CONFIG = CONFIG;
}
