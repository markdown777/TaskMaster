/**
 * 任务管理器
 * 移植 taskManager.js 的完整逻辑到 ArkTS
 * - 防抖批量写入（500ms）
 * - 任务 CRUD / 置顶 / 备注 / 搜索 / 分组 / 排序
 */
import { Task, toTask, tasksToRaw } from '../models/Task';
import { STORAGE_KEYS, TASK_PRIORITY, CONFIG } from '../constants/Constants';
import { storageAdapter } from '../adapters/StorageAdapter';
import { ReminderManager } from './ReminderManager';
import { generateId, debounce } from '../utils/CommonUtils';

/** 搜索过滤条件 */
export interface TaskFilters {
  showActive?: boolean;
  showCompleted?: boolean;
  showNotesOnly?: boolean;
  tags?: string[];
  priority?: string;
}

/** 按日期分组的任务映射 */
export interface GroupedTasks {
  [dateKey: string]: Task[];
}

/**
 * 任务管理器单例
 */
export class TaskManager {
  private static instance: TaskManager | null = null;
  tasks: Task[] = [];
  private _pendingSave: Task[] | null = null;
  private _isSaving = false;
  private _debouncedFlush: (() => void) | null = null;

  private constructor() {
    // 防抖写入：500ms 内的多次修改合并为一次持久化
    this._debouncedFlush = debounce(() => { this.flushWrite(); }, CONFIG.SAVE_DEBOUNCE_MS);
  }

  static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  /**
   * 加载任务（从 preferences）
   */
  async loadTasks(): Promise<Task[]> {
    try {
      const raw = await storageAdapter.get<Record<string, Object>[]>(STORAGE_KEYS.TASKS);
      if (raw && raw.length > 0) {
        this.tasks = raw.map(r => toTask(r));
      } else {
        this.tasks = [];
      }
      return this.tasks;
    } catch (e) {
      console.error(`加载任务失败: ${(e as Error).message}`);
      this.tasks = [];
      return this.tasks;
    }
  }

  /**
   * 保存任务（带防抖合并）
   */
  async saveTasks(tasks: Task[]): Promise<boolean> {
    this.tasks = tasks;
    this._pendingSave = [...tasks];
    return new Promise<boolean>((resolve) => {
      // 触发防抖写入
      this._debouncedFlush?.();
      // 立即返回成功（实际写入异步进行）
      setTimeout(() => resolve(true), CONFIG.SAVE_DEBOUNCE_MS + 50);
    });
  }

  /**
   * 实际执行写入
   */
  private async flushWrite(): Promise<void> {
    if (this._isSaving || !this._pendingSave) return;
    this._isSaving = true;
    const tasks = this._pendingSave;
    this._pendingSave = null;
    try {
      await storageAdapter.set(STORAGE_KEYS.TASKS, tasksToRaw(tasks));
    } catch (e) {
      console.error(`保存任务失败: ${(e as Error).message}`);
    } finally {
      this._isSaving = false;
    }
  }

  /** 添加任务 */
  async addTask(taskData: Partial<Task> & { text: string }): Promise<Task> {
    const newTask = new Task({
      id: generateId(),
      text: taskData.text,
      completed: false,
      createdAt: new Date().toISOString(),
      due: taskData.due ?? new Date(Date.now() + 3600000).toISOString(),
      priority: taskData.priority ?? TASK_PRIORITY.MEDIUM,
      tags: taskData.tags ?? [],
      notes: taskData.notes ?? ''
    });
    const tasks = await this.loadTasks();
    tasks.push(newTask);
    await this.saveTasks(tasks);

    // 注册到期提醒
    try {
      await ReminderManager.scheduleTaskReminder(newTask);
      await ReminderManager.notifyTaskAdded(newTask.text);
    } catch (e) {
      console.error(`注册提醒失败: ${(e as Error).message}`);
    }
    return newTask;
  }

  /** 更新任务 */
  async updateTask(taskId: number, updates: Partial<Task>): Promise<Task> {
    const tasks = await this.loadTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('任务未找到');
    const updated = new Task({ ...tasks[idx], ...updates });
    if (updated.completed && updated.pinned) updated.pinned = false;
    if (updated.completed && !updated.completedTime) updated.completedTime = Date.now();
    tasks[idx] = updated;
    await this.saveTasks(tasks);
    return updated;
  }

  /** 删除任务 */
  async deleteTask(taskId: number): Promise<boolean> {
    const tasks = await this.loadTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    await this.saveTasks(filtered);
    try { await ReminderManager.cancelTaskReminder(taskId); } catch (e) {}
    return true;
  }

  /** 批量删除 */
  async deleteTasks(taskIds: number[]): Promise<boolean> {
    const tasks = await this.loadTasks();
    const filtered = tasks.filter(t => !taskIds.includes(t.id));
    await this.saveTasks(filtered);
    return true;
  }

  /** 切换完成状态 */
  async toggleTaskComplete(taskId: number): Promise<Task> {
    const tasks = await this.loadTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('任务未找到');
    const task = tasks[idx];
    task.completed = !task.completed;
    if (task.completed) {
      task.completedTime = Date.now();
      task.pinned = false;
      try { await ReminderManager.cancelTaskReminder(taskId); } catch (e) {}
    } else {
      task.completedTime = undefined;
    }
    await this.saveTasks(tasks);
    return task;
  }

  /** 切换置顶 */
  async toggleTaskPinned(taskId: number): Promise<Task> {
    const tasks = await this.loadTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('任务未找到');
    const task = tasks[idx];
    if (!task.completed) {
      task.pinned = !task.pinned;
      await this.saveTasks(tasks);
    }
    return task;
  }

  /** 保存备注 */
  async saveTaskNotes(taskId: number, notes: string): Promise<Task> {
    const tasks = await this.loadTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('任务未找到');
    tasks[idx].notes = notes;
    await this.saveTasks(tasks);
    return tasks[idx];
  }

  /** 获取单个任务 */
  async getTask(taskId: number): Promise<Task | undefined> {
    const tasks = await this.loadTasks();
    return tasks.find(t => t.id === taskId);
  }

  /** 获取全部任务 */
  async getAllTasks(): Promise<Task[]> {
    return await this.loadTasks();
  }

  /** 按状态过滤 */
  async getTasksByStatus(completed: boolean): Promise<Task[]> {
    const tasks = await this.loadTasks();
    return tasks.filter(t => t.completed === completed);
  }

  /** 按标签过滤 */
  async getTasksByTag(tag: string): Promise<Task[]> {
    const tasks = await this.loadTasks();
    return tasks.filter(t => t.tags && t.tags.includes(tag));
  }

  /** 按优先级过滤 */
  async getTasksByPriority(priority: string): Promise<Task[]> {
    const tasks = await this.loadTasks();
    return tasks.filter(t => t.priority === priority);
  }

  /**
   * 搜索任务（对齐 taskManager.searchTasks）
   */
  async searchTasks(query: string, filters: TaskFilters = {}): Promise<Task[]> {
    const tasks = await this.loadTasks();
    const q = query.trim().toLowerCase();
    return tasks.filter(task => {
      if (filters.showActive === false && !task.completed) return false;
      if (filters.showCompleted === false && task.completed) return false;
      if (filters.showNotesOnly && (!task.notes || task.notes.trim() === '')) return false;
      if (filters.tags && filters.tags.length > 0) {
        if (!task.tags || !filters.tags.some(tag => task.tags.includes(tag))) return false;
      }
      if (filters.priority && task.priority !== filters.priority) return false;
      if (q) {
        const titleMatch = task.text.toLowerCase().includes(q);
        const notesMatch = task.notes && task.notes.toLowerCase().includes(q);
        const tagMatch = task.tags && task.tags.some(tag => tag.toLowerCase().includes(q));
        return titleMatch || notesMatch || tagMatch;
      }
      return true;
    });
  }

  /**
   * 按日期分组（对齐 groupTasksByDate）
   * 注意：插件用 task.id（时间戳）作为分组依据
   */
  groupTasksByDate(tasks: Task[]): GroupedTasks {
    const grouped: GroupedTasks = {};
    tasks.forEach(task => {
      const taskDate = new Date(task.id);
      const dateKey = taskDate.toLocaleDateString('zh-CN');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(task);
    });
    return grouped;
  }

  /**
   * 排序任务（对齐 sortTasks）
   */
  sortTasks(tasks: Task[], sortBy: string = 'createdAt', order: string = 'desc'): Task[] {
    const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return [...tasks].sort((a, b) => {
      let aValue: number;
      let bValue: number;
      switch (sortBy) {
        case 'due':
          aValue = new Date(a.due).getTime();
          bValue = new Date(b.due).getTime();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'priority':
          aValue = priorityOrder[a.priority] ?? 2;
          bValue = priorityOrder[b.priority] ?? 2;
          break;
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
      }
      return order === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }

  /**
   * 清空所有任务
   */
  async clearAll(): Promise<void> {
    this.tasks = [];
    await storageAdapter.remove(STORAGE_KEYS.TASKS);
  }
}

/** 全局便捷访问 */
export const taskManager: TaskManager = TaskManager.getInstance();
