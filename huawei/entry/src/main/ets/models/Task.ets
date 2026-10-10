/**
 * 任务数据模型
 * 对齐插件任务对象结构，作为 ArkTS 的可观察数据模型
 */
import { TASK_PRIORITY } from '../constants/Constants';

/** 任务优先级枚举 */
export type TaskPriority = 'high' | 'medium' | 'low';

/**
 * 任务实体
 * 字段与浏览器插件任务对象完全一致，保证导入导出 JSON 可互通
 */
@Observed
export class Task {
  id: number;               // 任务ID（时间戳）
  text: string;             // 任务内容
  completed: boolean;       // 完成状态
  createdAt: string;        // 创建时间（ISO 格式）
  due: string;              // 截止时间（ISO 格式）
  completedTime?: number;   // 完成时间（时间戳）
  pinned: boolean;          // 是否置顶
  notes: string;            // 任务备注
  priority: TaskPriority;   // 优先级
  tags: string[];           // 标签数组
  updatedAt?: number;       // 更新时间戳（用于合并冲突解决）

  constructor(fields: Partial<Task> & { id: number; text: string }) {
    this.id = fields.id;
    this.text = fields.text;
    this.completed = fields.completed ?? false;
    this.createdAt = fields.createdAt ?? new Date().toISOString();
    this.due = fields.due ?? new Date(Date.now() + 3600000).toISOString();
    this.completedTime = fields.completedTime;
    this.pinned = fields.pinned ?? false;
    this.notes = fields.notes ?? '';
    this.priority = (fields.priority as TaskPriority) ?? TASK_PRIORITY.MEDIUM;
    this.tags = fields.tags ?? [];
    this.updatedAt = fields.updatedAt;
  }
}

/**
 * 从纯 JS 对象构建 Task 实例（用于从 preferences 反序列化）
 */
export function toTask(raw: Record<string, Object>): Task {
  const tagsRaw = raw['tags'];
  let tags: string[] = [];
  if (tagsRaw instanceof Array) {
    tags = tagsRaw.map((t: Object) => String(t));
  }
  return new Task({
    id: Number(raw['id']),
    text: String(raw['text'] ?? ''),
    completed: Boolean(raw['completed']),
    createdAt: raw['createdAt'] ? String(raw['createdAt']) : new Date(Number(raw['id'])).toISOString(),
    due: raw['due'] ? String(raw['due']) : new Date(Number(raw['id']) + 3600000).toISOString(),
    completedTime: raw['completedTime'] != null ? Number(raw['completedTime']) : undefined,
    pinned: Boolean(raw['pinned']),
    notes: raw['notes'] ? String(raw['notes']) : '',
    priority: (raw['priority'] as TaskPriority) ?? TASK_PRIORITY.MEDIUM,
    tags,
    updatedAt: raw['updatedAt'] != null ? Number(raw['updatedAt']) : undefined
  });
}

/**
 * 将 Task 数组转为可持久化的纯对象数组
 */
export function tasksToRaw(tasks: Task[]): Record<string, Object>[] {
  return tasks.map(t => ({
    id: t.id,
    text: t.text,
    completed: t.completed,
    createdAt: t.createdAt,
    due: t.due,
    completedTime: t.completedTime,
    pinned: t.pinned,
    notes: t.notes,
    priority: t.priority,
    tags: t.tags,
    updatedAt: t.updatedAt
  }));
}
