/**
 * 分享管理模块
 */

/**
 * 分享管理器类
 */
class ShareManager {
  /**
   * 显示分享选项菜单
   * @param {string} content - 要分享的内容
   */
  showShareMenu(content) {
    // 移除已存在的菜单
    const existingMenu = document.getElementById('share-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    // 创建分享菜单
    const menu = document.createElement('div');
    menu.id = 'share-menu';
    menu.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 1px solid #ccc;
      border-radius: 0;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1000;
      min-width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
      animation: fadeIn 0.3s ease-in-out;
    `;
    
    menu.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: #333;">选择分享方式</h3>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="copy-share" style="padding: 10px; border: 1px solid #4CAF50; background: #4CAF50; color: white; border-radius: 0; cursor: pointer; transition: background-color 0.3s;">
          复制到剪贴板
        </button>
        <button id="email-share" style="padding: 10px; border: 1px solid #2196F3; background: #2196F3; color: white; border-radius: 0; cursor: pointer; transition: background-color 0.3s;">
          邮件分享
        </button>
        <button id="web-share" style="padding: 10px; border: 1px solid #FF9800; background: #FF9800; color: white; border-radius: 0; cursor: pointer; display: none; transition: background-color 0.3s;" data-supported="false">
          系统分享
        </button>
        <button id="close-menu" style="padding: 8px; border: 1px solid #ccc; background: #f5f5f5; color: #666; border-radius: 0; cursor: pointer; transition: background-color 0.3s;">
          取消
        </button>
      </div>
    `;
    
    document.body.appendChild(menu);
    
    // 检查Web Share API支持
    if (navigator.share) {
      const webShareBtn = document.getElementById('web-share');
      webShareBtn.style.display = 'block';
      webShareBtn.dataset.supported = 'true';
    }
    
    // 添加事件监听
    document.getElementById('copy-share').addEventListener('click', async () => {
      try {
        await this.copyToClipboard(content);
        menu.remove();
        this.showMessage('内容已复制到剪贴板！');
      } catch (error) {
        console.error('复制失败:', error);
        this.showMessage('复制失败，请手动复制', 'error');
      }
    });
    
    document.getElementById('email-share').addEventListener('click', () => {
      const mailtoUrl = `mailto:?subject=${encodeURIComponent('我的待办事项清单')}&body=${encodeURIComponent(content)}`;
      try {
        window.open(mailtoUrl);
        menu.remove();
      } catch (error) {
        console.error('邮件分享失败:', error);
        // 备用方案：复制邮件链接
        this.copyToClipboard(mailtoUrl).then(() => {
          menu.remove();
          this.showMessage('邮件链接已复制到剪贴板，请手动粘贴到浏览器地址栏');
        });
      }
    });
    
    const webShareBtn = document.getElementById('web-share');
    if (webShareBtn.dataset.supported === 'true') {
      webShareBtn.addEventListener('click', async () => {
        try {
          await navigator.share({
            title: '我的待办事项清单',
            text: content
          });
          menu.remove();
        } catch (error) {
          console.error('系统分享失败:', error);
          this.copyToClipboard(content).then(() => {
            menu.remove();
            this.showMessage('系统分享不可用，内容已复制到剪贴板');
          });
        }
      });
    }
    
    document.getElementById('close-menu').addEventListener('click', () => {
      menu.remove();
    });
    
    // 点击菜单外部关闭
    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 100);
  }

  /**
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   * @returns {Promise} 复制操作的Promise
   */
  async copyToClipboard(text) {
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
   * 生成任务分享内容
   * @param {Array} tasks - 任务数组
   * @returns {string} 分享内容
   */
  generateShareContent(tasks) {
    const shareContent = `我的待办事项清单（${new Date().toLocaleString()}）\n\n` + 
      tasks.map((t, i) => {
        const status = t.completed ? '完成' : '待办';
        const priority = this.getPriorityLabel(t.priority);
        const tags = t.tags && t.tags.length > 0 ? ` [${t.tags.join(', ')}]` : '';
        const date = new Date(t.id).toLocaleDateString();
        return `${i + 1}. [${status}] [${priority}] ${t.text}${tags} (${date})`;
      }).join('\n') + 
      `\n\n统计：共${tasks.length}项任务，已完成${tasks.filter(t => t.completed).length}项`;
    
    return shareContent;
  }

  /**
   * 获取优先级对应的文本标识
   * @param {string} priority - 优先级
   * @returns {string} 优先级文本
   */
  getPriorityLabel(priority) {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '中';
    }
  }

  /**
   * 显示消息提示
   * @param {string} text - 消息内容
   * @param {string} type - 消息类型 (success, error)
   */
  showMessage(text, type = 'success') {
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
}

// 导出分享管理器
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShareManager;
} else {
  window.ShareManager = ShareManager;
}
