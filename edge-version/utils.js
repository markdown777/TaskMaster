/**
 * 通用工具函数模块
 */

/**
 * HTML转义函数，防止XSS攻击（包括属性注入）
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  // 替换引号，确保在HTML属性中使用也是安全的
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
 * 加密文本（使用Web Crypto API）
 * @param {string} text - 要加密的文本
 * @param {string} key - 加密密钥
 * @returns {Promise<string>} 加密后的文本
 */
async function encryptText(text, key) {
  if (!key || !text) return text;
  
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // 派生密钥
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('taskmaster-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      data
    );
    
    // 将iv和密文组合并编码
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('加密失败:', error);
    return text;
  }
}

/**
 * 解密文本（使用Web Crypto API）
 * @param {string} encryptedText - 加密的文本
 * @param {string} key - 解密密钥
 * @returns {Promise<string>} 解密后的文本
 */
async function decryptText(encryptedText, key) {
  if (!key || !encryptedText) return encryptedText;
  
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // 解码base64并分离iv和密文
    const combined = new Uint8Array([...atob(encryptedText)].map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // 派生密钥
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('taskmaster-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('解密失败:', error);
    return encryptedText;
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

// 导出工具函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    showMessage,
    debounce,
    throttle,
    copyToClipboard,
    encryptText,
    decryptText,
    validateInput,
    formatDateTime,
    formatDate,
    getDaysDifference,
    isToday,
    isYesterday
  };
}
