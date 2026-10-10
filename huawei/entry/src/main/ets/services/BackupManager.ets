/**
 * 备份管理器
 * 移植 background.js 的自动备份逻辑
 * - 每日全量快照（key = backup_data_YYYY-MM-DD）
 * - 保留最近 7 天，自动清理过期备份
 * - 备份列表枚举与恢复
 */
import { Task, tasksToRaw } from '../models/Task';
import { STORAGE_KEYS, CONFIG } from '../constants/Constants';
import { storageAdapter } from '../adapters/StorageAdapter';

/** 备份条目 */
export interface BackupEntry {
  key: string;
  dateStr: string;
  taskCount: number;
  backupTime: string;
  tasks: Task[];
}

/**
 * 备份管理器单例
 */
export class BackupManager {
  private static instance: BackupManager | null = null;
  private lastBackupDate: string = '';

  private constructor() {}

  static getInstance(): BackupManager {
    if (!BackupManager.instance) {
      BackupManager.instance = new BackupManager();
    }
    return BackupManager.instance;
  }

  /**
   * 执行全量备份
   */
  async executeBackup(tasks: Task[]): Promise<boolean> {
    try {
      if (!tasks || tasks.length === 0) return false;

      const dateStr = new Date().toISOString().split('T')[0];
      const backupKey = `${STORAGE_KEYS.BACKUP_PREFIX}${dateStr}`;

      // 若今日已备份则跳过
      if (this.lastBackupDate === dateStr) return false;

      const backupData = {
        data: tasksToRaw(tasks),
        backupTime: new Date().toISOString()
      };

      await storageAdapter.set(backupKey, backupData);
      this.lastBackupDate = dateStr;

      // 清理过期备份
      await this.cleanupOldBackups();
      return true;
    } catch (e) {
      console.error(`自动备份失败: ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * 检查并补备份（应用回到前台时调用，弥补后台限制）
   */
  async checkAndBackupIfNeeded(tasks: Task[]): Promise<void> {
    const todayStr = new Date().toISOString().split('T')[0];
    if (this.lastBackupDate !== todayStr) {
      await this.executeBackup(tasks);
    }
  }

  /**
   * 清理过期备份（保留最近 7 天）
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const allKeys = await storageAdapter.getAllKeys();
      const backupKeys = allKeys.filter(k => k.startsWith(STORAGE_KEYS.BACKUP_PREFIX));

      if (backupKeys.length > CONFIG.MAX_BACKUP_COUNT) {
        backupKeys.sort();
        const keysToDelete = backupKeys.slice(0, backupKeys.length - CONFIG.MAX_BACKUP_COUNT);
        for (const key of keysToDelete) {
          await storageAdapter.remove(key);
        }
      }
    } catch (e) {
      console.error(`清理备份失败: ${(e as Error).message}`);
    }
  }

  /**
   * 获取所有备份列表（按时间倒序）
   */
  async listBackups(): Promise<BackupEntry[]> {
    try {
      const all = await storageAdapter.getAll();
      const entries: BackupEntry[] = [];

      Object.keys(all).forEach(key => {
        if (!key.startsWith(STORAGE_KEYS.BACKUP_PREFIX)) return;
        const raw = all[key] as Record<string, Object>;
        const dataRaw = raw['data'];
        let taskCount = 0;
        let tasks: Task[] = [];
        if (dataRaw instanceof Array) {
          tasks = (dataRaw as Record<string, Object>[]).map(r => {
            return {
              id: Number(r['id']),
              text: String(r['text'] ?? ''),
              completed: Boolean(r['completed']),
              createdAt: String(r['createdAt'] ?? ''),
              due: String(r['due'] ?? ''),
              completedTime: r['completedTime'] != null ? Number(r['completedTime']) : undefined,
              pinned: Boolean(r['pinned']),
              notes: String(r['notes'] ?? ''),
              priority: (r['priority'] as 'high' | 'medium' | 'low') ?? 'medium',
              tags: r['tags'] instanceof Array ? (r['tags'] as Object[]).map(String) : [],
              updatedAt: r['updatedAt'] != null ? Number(r['updatedAt']) : undefined
            } as Task;
          });
          taskCount = tasks.length;
        }
        const dateStr = key.replace(STORAGE_KEYS.BACKUP_PREFIX, '');
        entries.push({
          key,
          dateStr,
          taskCount,
          backupTime: raw['backupTime'] ? String(raw['backupTime']) : dateStr,
          tasks
        });
      });

      // 按备份时间倒序
      entries.sort((a, b) => new Date(b.backupTime).getTime() - new Date(a.backupTime).getTime());
      return entries;
    } catch (e) {
      console.error(`获取备份列表失败: ${(e as Error).message}`);
      return [];
    }
  }

  /**
   * 从指定备份恢复任务
   */
  async restoreFromBackup(key: string): Promise<Task[]> {
    try {
      const raw = await storageAdapter.get<Record<string, Object>>(key);
      if (!raw) throw new Error('备份不存在');
      const dataRaw = raw['data'];
      if (!(dataRaw instanceof Array)) throw new Error('备份数据格式错误');

      const tasks: Task[] = (dataRaw as Record<string, Object>[]).map(r => ({
        id: Number(r['id']),
        text: String(r['text'] ?? ''),
        completed: Boolean(r['completed']),
        createdAt: String(r['createdAt'] ?? ''),
        due: String(r['due'] ?? ''),
        completedTime: r['completedTime'] != null ? Number(r['completedTime']) : undefined,
        pinned: Boolean(r['pinned']),
        notes: String(r['notes'] ?? ''),
        priority: (r['priority'] as 'high' | 'medium' | 'low') ?? 'medium',
        tags: r['tags'] instanceof Array ? (r['tags'] as Object[]).map(String) : [],
        updatedAt: r['updatedAt'] != null ? Number(r['updatedAt']) : undefined
      }) as Task);

      // 写回任务存储
      await storageAdapter.set(STORAGE_KEYS.TASKS, tasksToRaw(tasks));
      return tasks;
    } catch (e) {
      console.error(`恢复备份失败: ${(e as Error).message}`);
      throw e;
    }
  }
}

/** 全局便捷访问 */
export const backupManager: BackupManager = BackupManager.getInstance();
