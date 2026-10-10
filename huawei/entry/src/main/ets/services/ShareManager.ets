/**
 * 分享管理器
 * 移植 shareManager.js
 * - 生成 Markdown 格式的任务清单
 * - 三种分享方式：复制剪贴板 / 邮件 / 系统分享
 */
import { Task } from '../models/Task';
import { copyToClipboard } from '../utils/CommonUtils';
import { common } from '@kit.AbilityKit';
import { wantAgent, WantAgent } from '@kit.AbilityKit';

/**
 * 分享管理器单例
 */
export class ShareManager {
  private static instance: ShareManager | null = null;

  private constructor() {}

  static getInstance(): ShareManager {
    if (!ShareManager.instance) {
      ShareManager.instance = new ShareManager();
    }
    return ShareManager.instance;
  }

  /**
   * 优先级标签（对齐 getPriorityLabel）
   */
  private getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'high': return '🔴 高';
      case 'medium': return '🟡 中';
      case 'low': return '🟢 低';
      default: return '⚪ 中';
    }
  }

  /**
   * 生成 Markdown 格式的分享内容（对齐 generateShareContent）
   */
  generateShareContent(tasks: Task[]): string {
    const dateStr = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let content = `# 我的待办清单（${dateStr}）\n\n`;
    let completedCount = 0;

    tasks.forEach((task, index) => {
      const num = index + 1;
      const checkbox = task.completed ? '[x]' : '[ ]';
      if (task.completed) completedCount++;

      // 标题行：勾选 + 加粗标题 + 优先级标签
      content += `${num}. ${checkbox} **${task.text}** [${this.getPriorityLabel(task.priority)}]`;

      // 标签
      if (task.tags && task.tags.length > 0) {
        const tagStr = task.tags.map(t => `\`${t}\``).join(', ');
        content += ` ${tagStr}`;
      }

      // 截止日期
      if (task.due) {
        const dueDate = new Date(task.due).toLocaleDateString('zh-CN');
        content += ` 📅 *${dueDate}*`;
      }

      content += '\n';

      // 备注（blockquote）
      if (task.notes && task.notes.trim()) {
        const noteLines = task.notes.replace(/\n/g, '\n   > ');
        content += `   > ${noteLines}\n`;
      }
    });

    content += `\n---\n📊 统计：共 ${tasks.length} 项任务，已完成 ${completedCount} 项`;
    return content;
  }

  /**
   * 复制到剪贴板
   */
  async copyAsText(content: string): Promise<boolean> {
    try {
      await copyToClipboard(content);
      return true;
    } catch (e) {
      console.error(`复制失败: ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * 通过邮件分享（构造 mailto 链接并启动邮件应用）
   */
  async shareByEmail(content: string, context: common.UIAbilityContext): Promise<boolean> {
    try {
      const subject = encodeURIComponent('我的待办事项清单');
      const body = encodeURIComponent(content);
      const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;

      // 用隐式 Want 启动邮件应用
      const want: Record<string, Object> = {
        action: 'ohos.want.action.sendData',
        uri: mailtoUrl
      };
      await context.startAbility(want);
      return true;
    } catch (e) {
      // 邮件应用不可用时，回退为复制 mailto 链接
      console.warn(`邮件分享不可用，回退复制: ${(e as Error).message}`);
      const subject = encodeURIComponent('我的待办事项清单');
      const body = encodeURIComponent(content);
      await copyToClipboard(`mailto:?subject=${subject}&body=${body}`);
      return false;
    }
  }

  /**
   * 系统分享（通过隐式 Want 调起系统分享面板）
   */
  async shareViaSystem(content: string, context: common.UIAbilityContext): Promise<boolean> {
    try {
      const want: Record<string, Object> = {
        action: 'ohos.want.action.sendData',
        type: 'text/plain',
        parameters: {
          'ability.params.stream': content
        }
      };
      await context.startAbility(want);
      return true;
    } catch (e) {
      // 系统分享不可用时回退为复制
      console.warn(`系统分享不可用，回退复制: ${(e as Error).message}`);
      await copyToClipboard(content);
      return false;
    }
  }
}

/** 全局便捷访问 */
export const shareManager: ShareManager = ShareManager.getInstance();
