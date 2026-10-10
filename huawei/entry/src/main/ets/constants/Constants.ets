/**
 * 全局常量定义
 * 对齐插件 constants.js，统一管理键名、消息类型及默认值
 */

/** 持久化存储键名 */
export const STORAGE_KEYS = {
  TASKS: 'tasks',
  SETTINGS: 'settings',
  BACKUP_PREFIX: 'backup_data_',
  AI_CONFIG: 'AI_CONFIG',
  AI_ENCRYPTED_KEY: 'AI_ENCRYPTED_KEY',
  AI_PLAINTEXT_KEY: 'AI_PLAINTEXT_KEY',
  VISION_CONFIG: 'VISION_CONFIG',
  VISION_ENCRYPTED_KEY: 'VISION_ENCRYPTED_KEY',
  VISION_PLAINTEXT_KEY: 'VISION_PLAINTEXT_KEY',
  AI_GUIDE_SEEN: 'AI_GUIDE_SEEN'
};

/** 消息类型（仅用于内部事件总线，对齐插件 MESSAGE_TYPES） */
export const MESSAGE_TYPES = {
  NEW_TASK: 'NEW_TASK',
  SYNC_UPDATE: 'SYNC_UPDATE'
};

/** 任务优先级 */
export const TASK_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
} as const;

/** 全局配置 */
export const CONFIG = {
  BACKUP_PERIOD_MINUTES: 1440,
  MAX_BACKUP_COUNT: 7,
  SAVE_DEBOUNCE_MS: 500,
  SEARCH_DEBOUNCE_MS: 300
};

/** 默认应用设置（对齐 options.js DEFAULT_SETTINGS） */
export const DEFAULT_SETTINGS: AppSettings = {
  enableEncryption: false,
  encryptionKey: '',
  showCompletedTasks: true,
  autoExpandToday: true,
  showTaskStats: true,
  confirmDelete: true,
  autoSaveNotes: true,
  taskRetentionDays: 90,
  enableNotifications: true,
  soundNotifications: false
};

/** AI 助理默认配置 */
export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'deepseek',
  baseUrl: '',
  enableEncryption: false,
  hasKey: false
};

/** Vision 图片识别默认配置 */
export const DEFAULT_VISION_CONFIG: VisionConfig = {
  provider: 'off',
  baseUrl: '',
  model: '',
  enableEncryption: false,
  hasKey: false
};

/** 默认搜索状态 */
export const DEFAULT_SEARCH_STATE: SearchState = {
  query: '',
  showActive: true,
  showCompleted: true,
  showNotesOnly: false,
  isSearching: false
};

/** AI 服务默认端点 */
export const AI_ENDPOINTS = {
  DEEPSEEK: 'https://api.deepseek.com/v1/chat/completions',
  OPENAI: 'https://api.openai.com/v1/chat/completions'
};

/** 默认模型 */
export const AI_DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
  visionFallback: 'gpt-4o'
};

/** 应用数据模型定义 */
export interface AppSettings {
  enableEncryption: boolean;
  encryptionKey: string;
  showCompletedTasks: boolean;
  autoExpandToday: boolean;
  showTaskStats: boolean;
  confirmDelete: boolean;
  autoSaveNotes: boolean;
  taskRetentionDays: number;
  enableNotifications: boolean;
  soundNotifications: boolean;
}

export interface AiConfig {
  provider: string;        // 'deepseek' | 'openai'
  baseUrl: string;
  enableEncryption: boolean;
  hasKey: boolean;
}

export interface VisionConfig {
  provider: string;        // 'off' | 'doubao' | 'openai'
  baseUrl: string;
  model: string;
  enableEncryption: boolean;
  hasKey: boolean;
}

export interface SearchState {
  query: string;
  showActive: boolean;
  showCompleted: boolean;
  showNotesOnly: boolean;
  isSearching: boolean;
}
