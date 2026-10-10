/**
 * 通用工具函数模块
 * 移植 utils.js 中的工具函数到 ArkTS
 */
import { pasteboard } from '@kit.BasicServicesKit';

/**
 * 防抖函数
 */
export function debounce<T extends (...args: Object[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  return (...args: Parameters<T>): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: Object[]) => void>(func: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>): void => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

/**
 * HTML 转义（ArkUI 文本默认安全，此函数仅用于导出/分享场景）
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

/**
 * 格式化日期时间（zh-CN）
 */
export function formatDateTime(date: Date | number | string): string {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 格式化日期（zh-CN，仅日期）
 */
export function formatDate(date: Date | number | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * 格式化日期为本地 datetime-local 输入值（YYYY-MM-DDTHH:mm）
 */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number): string => n < 10 ? `0${n}` : `${n}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 计算两个日期的天数差
 */
export function getDaysDifference(date1: Date | number | string, date2: Date | number | string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const timeDiff = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

/**
 * 判断是否为今天
 */
export function isToday(date: Date | number | string): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/**
 * 判断是否为昨天
 */
export function isYesterday(date: Date | number | string): boolean {
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

/**
 * 复制文本到剪贴板（使用 HarmonyOS pasteboard）
 */
export async function copyToClipboard(text: string): Promise<void> {
  const pasteData = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, text);
  const systemPasteboard = pasteboard.getSystemPasteboard();
  await systemPasteboard.setData(pasteData);
}

/**
 * 从剪贴板读取文本
 */
export async function readFromClipboard(): Promise<string> {
  const systemPasteboard = pasteboard.getSystemPasteboard();
  const data = await systemPasteboard.getData();
  return data.getPrimaryText();
}

/**
 * 验证输入是否安全（防 XSS 基础检查）
 */
export function validateInput(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const dangerousPatterns = /<script|javascript:|on\w+/i;
  return !dangerousPatterns.test(input);
}

/**
 * 生成唯一 ID（时间戳）
 */
export function generateId(): number {
  return Date.now();
}

/**
 * 拆分标签字符串
 */
export function parseTags(tagsStr: string): string[] {
  if (!tagsStr) return [];
  return tagsStr
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}
