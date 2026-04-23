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
    const existingMenu = document.getElementById('share-modal');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    // 创建分享菜单容器 (使用最新的 TaskMaster v3.0.0 规范)
    const modal = document.createElement('div');
    modal.id = 'share-modal';
    modal.className = 'share-modal';
    
    modal.innerHTML = `
      <div class="share-modal-content">
        <h3 class="share-modal-title">选择分享方式</h3>
        <div class="share-options-group">
          <button id="copy-share" class="share-btn-item">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            复制为文本
          </button>
          <button id="email-share" class="share-btn-item">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            邮件发送
          </button>
          <button id="web-share" class="share-btn-item" style="display: none;" data-supported="false">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            系统分享
          </button>
        </div>
        <button id="close-share-menu" class="share-btn-cancel">取消</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 检查Web Share API支持 (需要 HTTPS)
    if (navigator.share) {
      const webShareBtn = document.getElementById('web-share');
      webShareBtn.style.display = 'flex';
      webShareBtn.dataset.supported = 'true';
    }
    
    // 添加事件监听
    document.getElementById('copy-share').addEventListener('click', async () => {
      try {
        await this.copyToClipboard(content);
        modal.remove();
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
        modal.remove();
      } catch (error) {
        console.error('邮件分享失败:', error);
        // 备用方案：复制邮件链接
        this.copyToClipboard(mailtoUrl).then(() => {
          modal.remove();
          this.showMessage('邮件链接已复制，请粘贴到浏览器地址栏');
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
          modal.remove();
        } catch (error) {
          console.error('系统分享失败:', error);
          this.copyToClipboard(content).then(() => {
            modal.remove();
            this.showMessage('系统分享不可用，内容已复制');
          });
        }
      });
    }
    
    const closeModal = () => {
      modal.remove();
    };

    document.getElementById('close-share-menu').addEventListener('click', closeModal);
    
    // 点击遮罩层关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // ESC 键关闭
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
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
   * 生成任务分享内容（Markdown 优化版）
   * @param {Array} tasks - 任务数组
   * @returns {string} 分享内容
   */
  generateShareContent(tasks) {
    const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    let shareContent = `# 我的待办清单（${dateStr}）\n\n`;
    
    tasks.forEach((t, i) => {
      const checkbox = t.completed ? '[x]' : '[ ]';
      const priority = this.getPriorityLabel(t.priority);
      const tags = t.tags && t.tags.length > 0 ? ` \`${t.tags.join('`, `')}\`` : '';
      const due = t.due ? ` 📅 *${new Date(t.due).toLocaleDateString()}*` : '';
      shareContent += `${i + 1}. ${checkbox} **${t.text}** [${priority}]${tags}${due}\n`;
      
      if (t.notes) {
        shareContent += `   > ${t.notes.replace(/\n/g, '\n   > ')}\n`;
      }
    });
    
    shareContent += `\n---\n📊 统计：共 ${tasks.length} 项任务，已完成 ${tasks.filter(t => t.completed).length} 项`;
    
    return shareContent;
  }

  /**
   * 获取优先级对应的文本标识
   * @param {string} priority - 优先级
   * @returns {string} 优先级文本
   */
  getPriorityLabel(priority) {
    switch (priority) {
      case 'high': return '🔴 高';
      case 'medium': return '🟡 中';
      case 'low': return '🟢 低';
      default: return '⚪ 中';
    }
  }

  /**
   * 显示消息提示
   * @param {string} text - 消息内容
   * @param {string} type - 消息类型 (success, error)
   */
  showMessage(text, type = 'success') {
    // 优先尝试调用 popup.js 中的全局 showMessage（样式统一）
    if (typeof window.showMessage === 'function') {
      window.showMessage(text, type);
      return;
    }
    
    // 后备独立样式
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#111111' : '#ff4444'};
      color: white;
      padding: 10px 20px;
      border-radius: 6px;
      z-index: 1001;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
      box-shadow: 0 8px 16px rgba(0,0,0,0.1);
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
