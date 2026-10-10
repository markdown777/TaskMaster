/**
 * 提醒管理器
 * 用 reminderAgentManager 替代 chrome.alarms
 * 用 notificationManager 替代 chrome.notifications
 * - 任务到期提醒（用户可见通知）
 * - 新任务添加通知
 */
import { Task } from '../models/Task';
import { common } from '@kit.AbilityKit';
import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { notificationManager } from '@kit.NotificationKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN = 0x5401;
const TAG = 'TaskMaster.Reminder';

/**
 * 提醒管理器单例
 */
export class ReminderManager {
  private static instance: ReminderManager | null = null;
  private static initialized = false;

  private constructor() {}

  static getInstance(): ReminderManager {
    if (!ReminderManager.instance) {
      ReminderManager.instance = new ReminderManager();
    }
    return ReminderManager.instance;
  }

  /**
   * 初始化（在 EntryAbility 中调用，启用通知）
   */
  static async init(context: common.UIAbilityContext): Promise<void> {
    if (ReminderManager.initialized) return;
    try {
      await notificationManager.requestEnableNotification(context);
      ReminderManager.initialized = true;
      hilog.info(DOMAIN, TAG, '通知已启用');
    } catch (e) {
      hilog.warn(DOMAIN, TAG, `启用通知失败（用户可能拒绝）: ${(e as Error).message}`);
    }
  }

  /**
   * 为任务注册到期提醒
   */
  static async scheduleTaskReminder(task: Task): Promise<void> {
    try {
      const dueTime = new Date(task.due).getTime();
      const now = Date.now();
      // 已过期的任务不注册提醒
      if (dueTime <= now) return;

      const reminderId = this.taskIdToReminderId(task.id);
      // 先取消旧的同 ID 提醒
      try { await reminderAgentManager.cancelReminder(reminderId); } catch (e) {}

      const targetDate = new Date(dueTime);
      const reminder: reminderAgentManager.ReminderRequestCalendar = {
        reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR,
        dateTime: {
          year: targetDate.getFullYear(),
          month: targetDate.getMonth() + 1,
          day: targetDate.getDate(),
          hour: targetDate.getHours(),
          minute: targetDate.getMinutes(),
          second: 0
        },
        title: '任务提醒',
        content: task.text,
        notificationId: reminderId,
        slotType: 3, // SOCIAL_COMMUNICATION
        actionButton: [
          { title: '关闭', type: reminderAgentManager.ActionButtonType.ACTION_BUTTON_TYPE_CLOSE }
        ]
      };

      await reminderAgentManager.publishReminder(reminder);
      hilog.info(DOMAIN, TAG, `任务提醒已注册: ${task.id}`);
    } catch (e) {
      hilog.error(DOMAIN, TAG, `注册任务提醒失败: ${(e as Error).message}`);
    }
  }

  /**
   * 取消任务的提醒
   */
  static async cancelTaskReminder(taskId: number): Promise<void> {
    try {
      const reminderId = this.taskIdToReminderId(taskId);
      await reminderAgentManager.cancelReminder(reminderId);
    } catch (e) {
      // 提醒不存在时忽略
    }
  }

  /**
   * 任务添加通知（对齐 background.js 的 NEW_TASK 通知）
   */
  static async notifyTaskAdded(text: string): Promise<void> {
    try {
      const request: notificationManager.NotificationRequest = {
        id: Date.now() % 2147483647,
        content: {
          notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
          normal: {
            title: '任务已添加',
            text: text,
            additionalText: ''
          }
        },
        deliveryTime: new Date().getTime(),
        notificationSlotType: notificationManager.SlotType.SOCIAL_COMMUNICATION
      };
      await notificationManager.publish(request);
    } catch (e) {
      hilog.warn(DOMAIN, TAG, `发送任务添加通知失败: ${(e as Error).message}`);
    }
  }

  /**
   * 将任务 ID 映射为 reminderId（reminderId 须为正整数且不超 int32）
   * 取任务 ID 的低 31 位
   */
  private static taskIdToReminderId(taskId: number): number {
    const id = Math.abs(taskId) % 2147483647;
    return id === 0 ? 1 : id;
  }
}
