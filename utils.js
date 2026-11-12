/**
 * 通用工具函数模块
 */

/**
 * HTML转义函数，防止XSS攻击（包括属性注入）
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

/**
 * 转义文本并高亮搜索命中片段（先转义再匹配，避免注入）
 * @param {string} text - 原始文本
 * @param {string} query - 搜索关键词
 * @returns {string} 可安全插入 innerHTML 的 HTML
 */
function highlightText(text, query) {
  const escaped = escapeHtml(text);
  if (!query) return escaped;

  const escapedQuery = escapeHtml(query).trim();
  if (!escapedQuery) return escaped;

  const pattern = escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(
    new RegExp(pattern, 'gi'),
    (match) => `<mark class="search-hit">${match}</mark>`
  );
}

/**
 * 显示消息提示
 * @param {string} text - 消息内容
 * @param {string} type - 消息类型 (success, error)
 */
function showMessage(text, type = 'success') {
  const message = document.createElement('div');
  message.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#4CAF50' : '#f44336'};
    color: white;
    padding: 10px 20px;
    border-radius: 0;
    z-index: 1001;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
    animation: fadeIn 0.3s ease-in-out;
  `;
  message.textContent = text;
  document.body.appendChild(message);
  
  setTimeout(() => {
    message.style.animation = 'fadeOut 0.3s ease-in-out';
    setTimeout(() => {
      message.remove();
    }, 300);
  }, 3000);
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖处理后的函数
 */
function debounce(func, wait) {
  let timeout;
  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, arguments), wait);
  };
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流处理后的函数
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    if (!inThrottle) {
      func.apply(this, arguments);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise} 复制操作的Promise
 */
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // 备用方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * 验证输入是否安全
 * @param {string} input - 要验证的输入
 * @returns {boolean} 是否安全
 */
function validateInput(input) {
  if (!input || typeof input !== 'string') return false;
  // 检查危险字符
  const dangerousPatterns = /<script|javascript:|on\w+/i;
  return !dangerousPatterns.test(input);
}

/**
 * 格式化日期时间
 * @param {Date|number|string} date - 日期对象、时间戳或日期字符串
 * @returns {string} 格式化后的日期时间字符串
 */
function formatDateTime(date) {
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
 * 格式化日期
 * @param {Date|number|string} date - 日期对象、时间戳或日期字符串
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * 计算两个日期之间的天数差
 * @param {Date|number|string} date1 - 第一个日期
 * @param {Date|number|string} date2 - 第二个日期
 * @returns {number} 天数差
 */
function getDaysDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const timeDiff = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

/**
 * 检查日期是否为今天
 * @param {Date|number|string} date - 要检查的日期
 * @returns {boolean} 是否为今天
 */
function isToday(date) {
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/**
 * 检查日期是否为昨天
 * @param {Date|number|string} date - 要检查的日期
 * @returns {boolean} 是否为昨天
 */
function isYesterday(date) {
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

/**
 * 判断两个时间是否落在本地同一天
 */
function isSameDay(date1, date2 = new Date()) {
  const a = new Date(date1);
  const b = new Date(date2);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/**
 * 判断截止时间是否已过期
 */
function isOverdue(due, now = new Date()) {
  if (!due) return false;
  const time = new Date(due).getTime();
  return !Number.isNaN(time) && time < now.getTime();
}

/**
 * 压缩展示截止时间：今天 18:00 / 明天 09:00 / 11-15 09:00
 */
function formatDueShort(date, now = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (isSameDay(d, now)) return `今天 ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(d, tomorrow)) return `明天 ${time}`;

  const monthDay = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (d.getFullYear() === now.getFullYear()) return `${monthDay} ${time}`;
  return `${d.getFullYear()}-${monthDay} ${time}`;
}

/**
 * 新建任务按钮文案：未选时间显示“时间”，已选则直接显示所选时间
 */
function formatDueButtonLabel(dueValue, now = new Date()) {
  if (!dueValue) return '时间';
  return formatDueShort(dueValue, now) || '时间';
}

/**
 * 将 Date 转成 datetime-local 可用的本地时间字符串
 * @param {Date} date - 日期对象
 * @returns {string} yyyy-MM-ddTHH:mm
 */
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * 计算截止时间快捷预设
 * @param {string} preset - plus60 / today18 / tomorrow12 / plus1d / plus1w
 * @param {Date} now - 当前时间
 * @returns {Date|null} 目标时间，未知预设返回 null
 */
function computeDuePreset(preset, now = new Date()) {
  if (preset === 'plus60') {
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  const target = new Date(now);
  if (preset === 'plus1d') {
    target.setDate(target.getDate() + 1);
    return target;
  }

  if (preset === 'plus1w') {
    target.setDate(target.getDate() + 7);
    return target;
  }

  if (preset === 'today18') {
    target.setHours(18, 0, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  if (preset === 'tomorrow12') {
    target.setDate(target.getDate() + 1);
    target.setHours(12, 0, 0, 0);
    return target;
  }

  return null;
}

// 导出工具函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    highlightText,
    showMessage,
    debounce,
    throttle,
    copyToClipboard,
    validateInput,
    formatDateTime,
    formatDate,
    getDaysDifference,
    isToday,
    isYesterday,
    isSameDay,
    isOverdue,
    formatDueShort,
    formatDueButtonLabel,
    toDatetimeLocalValue,
    computeDuePreset
  };
}
