/**
 * 任务管理模块
 */

/**
 * 任务管理器类
 */
class TaskManager {
  constructor() {
    this.tasks = [];
    this._loaded = false;
    this._loadPromise = null;
    this._pendingSave = null;
    this._flushPromise = null;
    this._lastTaskId = 0;
    this.loadTasks();
  }

  /**
   * 加载任务数据 (支持从 sync 迁移到 local)
   * 首次加载后使用内存缓存，避免写入延迟期间读到旧数据
   * @returns {Promise<Array>} 任务数组
   */
  async loadTasks() {
    if (this._loaded) {
      return this.tasks;
    }

    if (!this._loadPromise) {
      this._loadPromise = this._readInitialTasks().finally(() => {
        this._loadPromise = null;
      });
    }

    return this._loadPromise;
  }

  async _readInitialTasks() {
    return new Promise((resolve, reject) => {
      // 优先从 local 存储读取，如果 local 中没有数据，尝试从 sync 迁移
      chrome.storage.local.get({ tasks: null }, (localResult) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('加载本地任务失败:', chrome.runtime.lastError);
          return reject(chrome.runtime.lastError);
        }

        if (localResult.tasks !== null) {
          this.tasks = localResult.tasks;
          this._loaded = true;
          return resolve(this.tasks);
        }

        // 如果 local 没有数据，尝试从旧的 sync读取并迁移
        chrome.storage.sync.get({ tasks: [], settings: {} }, (syncResult) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error('从同步存储加载任务失败:', chrome.runtime.lastError);
            return reject(chrome.runtime.lastError);
          }

          const syncTasks = syncResult.tasks || [];
          this.tasks = syncTasks;
          this._loaded = true;

          if (syncTasks.length > 0) {
            this.saveTasks(syncTasks).then(() => {
              console.log('[DEBUG] 成功将任务从旧的 sync 迁移到 local 存储');
              chrome.storage.sync.remove('tasks');
            }).catch(error => {
              console.error('迁移任务到本地失败:', error);
            });
          }

          resolve(this.tasks);
        });
      });
    });
  }

  /**
   * 外部写入（后台跨设备合并等）后刷新内存缓存
   * @param {Array} tasks - 最新的任务数组
   */
  syncFromStorage(tasks) {
    if (!Array.isArray(tasks)) return;
    this.tasks = tasks;
    this._loaded = true;
  }

  /**
   * 保存任务数据：串行写队列，合并期间的多次修改，且不丢弃任何调用方的 Promise
   * @param {Array} tasks - 任务数组
   * @returns {Promise<boolean>} 所有待写数据落盘后 resolve
   */
  async saveTasks(tasks) {
    this.tasks = tasks;
    this._loaded = true;
    this._pendingSave = tasks;

    if (!this._flushPromise) {
      this._flushPromise = this._drainWrites();
    }

    return this._flushPromise;
  }

  async _drainWrites() {
    try {
      while (this._pendingSave) {
        const tasks = this._pendingSave;
        this._pendingSave = null;
        await this._writeTasks(tasks);
      }
      return true;
    } finally {
      this._flushPromise = null;
    }
  }

  _writeTasks(tasks) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ tasks }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('保存任务失败:', chrome.runtime.lastError);
          // 保留待写状态，下一次保存时重试
          if (!this._pendingSave) {
            this._pendingSave = tasks;
          }
          reject(chrome.runtime.lastError);
          return;
        }

        this.syncCoreDataToCloud(tasks);
        resolve(true);
      });
    });
  }

  async _getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ settings: {} }, (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve({});
          return;
        }
        resolve(result.settings || {});
      });
    });
  }

  getSettings() {
    return this._getSettings();
  }

  _alarmName(taskId) {
    return `task-${taskId}`;
  }

  _scheduleAlarm(task) {
    if (!chrome.alarms || !task || task.completed || !task.due) return;

    const when = new Date(task.due).getTime();
    if (Number.isNaN(when) || when <= Date.now()) return;

    chrome.alarms.create(this._alarmName(task.id), { when });
  }

  _clearAlarm(taskId) {
    if (chrome.alarms) {
      chrome.alarms.clear(this._alarmName(taskId));
    }
  }

  _nextTaskId() {
    const id = Math.max(Date.now(), this._lastTaskId + 1);
    this._lastTaskId = id;
    return id;
  }

  isSaving() {
    return Boolean(this._flushPromise || this._pendingSave);
  }

  /**
   * 将核心任务数据同步到 sync 存储
   * 仅在设置中显式开启 enableCloudSync 时执行，避免静默上传
   * @param {Array} tasks - 任务数组
   */
  syncCoreDataToCloud(tasks) {
    this._getSettings().then((settings) => {
      if (!settings.enableCloudSync) return;

      try {
        const coreTasks = tasks.map(task => ({
          id: task.id,
          text: task.text,
          completed: task.completed,
          priority: task.priority,
          due: task.due,
          pinned: task.pinned,
          updatedAt: task.updatedAt || Date.now()
        }));

        const syncKey = typeof STORAGE_KEYS !== 'undefined' ? STORAGE_KEYS.SYNC_CORE_TASKS : 'sync_core_tasks';
        chrome.storage.sync.set({ [syncKey]: coreTasks }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn('[DEBUG] 同步核心数据到云端受限:', chrome.runtime.lastError);
          }
        });
      } catch (error) {
        console.error('同步云端数据失败:', error);
      }
    });
  }

  /**
   * 添加新任务
   * @param {Object} taskData - 任务数据
   * @returns {Promise<Object>} 新任务对象
   */
  async addTask(taskData) {
    try {
      const now = Date.now();
      const newTask = {
        id: this._nextTaskId(),
        text: taskData.text,
        completed: false,
        createdAt: new Date(now).toISOString(),
        due: taskData.due || null,
        priority: taskData.priority || 'medium',
        tags: taskData.tags || [],
        notes: taskData.notes || '',
        updatedAt: now
      };

      const tasks = await this.loadTasks();
      tasks.push(newTask);
      await this.saveTasks(tasks);

      // 创建提醒
      this._scheduleAlarm(newTask);

      // 发送任务添加通知（后台会根据设置决定是否展示）
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: typeof MESSAGE_TYPES !== 'undefined' ? MESSAGE_TYPES.NEW_TASK : 'NEW_TASK',
          text: newTask.text
        });
      }

      return newTask;
    } catch (error) {
      console.error('添加任务失败:', error);
      throw error;
    }
  }

  /**
   * 更新任务
   * @param {number} taskId - 任务ID
   * @param {Object} updates - 更新内容
   * @returns {Promise<Object>} 更新后的任务对象
   */
  async updateTask(taskId, updates) {
    try {
      const tasks = await this.loadTasks();
      const taskIndex = tasks.findIndex(t => t.id === taskId);

      if (taskIndex === -1) {
        throw new Error('任务未找到');
      }

      const updatedTask = { ...tasks[taskIndex], ...updates, updatedAt: Date.now() };
      tasks[taskIndex] = updatedTask;

      // 如果任务完成，取消置顶
      if (updatedTask.completed && updatedTask.pinned) {
        updatedTask.pinned = false;
      }

      // 如果任务完成，添加完成时间
      if (updatedTask.completed && !updatedTask.completedTime) {
        updatedTask.completedTime = Date.now();
      }

      if (updatedTask.completed) {
        this._clearAlarm(updatedTask.id);
      } else {
        this._clearAlarm(updatedTask.id);
        if (updatedTask.due) {
          this._scheduleAlarm(updatedTask);
        }
      }

      await this.saveTasks(tasks);
      return updatedTask;
    } catch (error) {
      console.error('更新任务失败:', error);
      throw error;
    }
  }

  /**
   * 批量设置截止时间（单次落盘，供逾期任务批量顺延使用）
   * @param {Array<number>} taskIds - 任务ID数组
   * @param {string|null} due - ISO 时间或 null（清除）
   * @returns {Promise<Array<Object>>} 已更新的任务
   */
  async setTasksDue(taskIds, due) {
    try {
      const ids = new Set((taskIds || []).map(Number));
      if (ids.size === 0) return [];

      const tasks = await this.loadTasks();
      const dueValue = due || null;
      const updatedAt = Date.now();
      const updated = [];

      tasks.forEach((task) => {
        if (!ids.has(task.id) || task.completed) return;

        task.due = dueValue;
        task.updatedAt = updatedAt;
        updated.push(task);

        this._clearAlarm(task.id);
        if (dueValue) {
          this._scheduleAlarm(task);
        }
      });

      if (updated.length > 0) {
        await this.saveTasks(tasks);
      }

      return updated;
    } catch (error) {
      console.error('批量设置截止时间失败:', error);
      throw error;
    }
  }

  /**
   * 删除任务
   * @param {number} taskId - 任务ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  async deleteTask(taskId) {
    try {
      const tasks = await this.loadTasks();
      const filteredTasks = tasks.filter(t => t.id !== taskId);
      await this.saveTasks(filteredTasks);
      this._clearAlarm(taskId);
      return true;
    } catch (error) {
      console.error('删除任务失败:', error);
      throw error;
    }
  }

  /**
   * 批量删除任务
   * @param {Array<number>} taskIds - 任务ID数组
   * @returns {Promise<boolean>} 删除是否成功
   */
  async deleteTasks(taskIds) {
    try {
      const tasks = await this.loadTasks();
      const filteredTasks = tasks.filter(t => !taskIds.includes(t.id));
      await this.saveTasks(filteredTasks);
      taskIds.forEach(taskId => this._clearAlarm(taskId));
      return true;
    } catch (error) {
      console.error('批量删除任务失败:', error);
      throw error;
    }
  }

  /**
   * 恢复被删除的任务（保留原 id，用于撤销删除）
   * @param {Object} task - 任务对象
   * @returns {Promise<Object>} 恢复后的任务
   */
  async restoreTask(task) {
    try {
      if (!task || !task.id) {
        throw new Error('无效的任务');
      }

      const tasks = await this.loadTasks();
      const existing = tasks.find(item => item.id === task.id);
      if (existing) return existing;

      tasks.push(task);
      await this.saveTasks(tasks);

      this._lastTaskId = Math.max(this._lastTaskId, task.id);
      if (!task.completed) {
        this._scheduleAlarm(task);
      }

      return task;
    } catch (error) {
      console.error('恢复任务失败:', error);
      throw error;
    }
  }

  /**
   * 切换任务完成状态
   * @param {number} taskId - 任务ID
   * @returns {Promise<Object>} 更新后的任务对象
   */
  async toggleTaskComplete(taskId) {
    try {
      const tasks = await this.loadTasks();
      const taskIndex = tasks.findIndex(t => t.id === taskId);

      if (taskIndex === -1) {
        throw new Error('任务未找到');
      }

      const task = tasks[taskIndex];
      task.completed = !task.completed;
      task.updatedAt = Date.now();

      if (task.completed) {
        task.completedTime = Date.now();
        task.pinned = false; // 完成后取消置顶
        this._clearAlarm(task.id);
      } else {
        delete task.completedTime;
        if (task.due) {
          this._scheduleAlarm(task);
        }
      }

      await this.saveTasks(tasks);
      return task;
    } catch (error) {
      console.error('切换任务状态失败:', error);
      throw error;
    }
  }

  /**
   * 切换任务置顶状态
   * @param {number} taskId - 任务ID
   * @returns {Promise<Object>} 更新后的任务对象
   */
  async toggleTaskPinned(taskId) {
    try {
      const tasks = await this.loadTasks();
      const taskIndex = tasks.findIndex(t => t.id === taskId);

      if (taskIndex === -1) {
        throw new Error('任务未找到');
      }

      const task = tasks[taskIndex];
      if (!task.completed) {
        task.pinned = !task.pinned;
        task.updatedAt = Date.now();
        await this.saveTasks(tasks);
      }

      return task;
    } catch (error) {
      console.error('切换任务置顶状态失败:', error);
      throw error;
    }
  }

  /**
   * 保存任务备注
   * @param {number} taskId - 任务ID
   * @param {string} notes - 备注内容
   * @returns {Promise<Object>} 更新后的任务对象
   */
  async saveTaskNotes(taskId, notes) {
    try {
      const tasks = await this.loadTasks();
      const taskIndex = tasks.findIndex(t => t.id === taskId);

      if (taskIndex === -1) {
        throw new Error('任务未找到');
      }

      tasks[taskIndex].notes = notes;
      tasks[taskIndex].updatedAt = Date.now();
      await this.saveTasks(tasks);
      return tasks[taskIndex];
    } catch (error) {
      console.error('保存任务备注失败:', error);
      throw error;
    }
  }

  /**
   * 获取任务
   * @param {number} taskId - 任务ID
   * @returns {Promise<Object>} 任务对象
   */
  async getTask(taskId) {
    try {
      const tasks = await this.loadTasks();
      const task = tasks.find(t => t.id === taskId);
      return task;
    } catch (error) {
      console.error('获取任务失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有任务
   * @returns {Promise<Array>} 任务数组
   */
  async getAllTasks() {
    try {
      return await this.loadTasks();
    } catch (error) {
      console.error('获取所有任务失败:', error);
      throw error;
    }
  }

  /**
   * 按状态获取任务
   * @param {boolean} completed - 是否完成
   * @returns {Promise<Array>} 任务数组
   */
  async getTasksByStatus(completed) {
    try {
      const tasks = await this.loadTasks();
      return tasks.filter(t => t.completed === completed);
    } catch (error) {
      console.error('按状态获取任务失败:', error);
      throw error;
    }
  }

  /**
   * 按标签获取任务
   * @param {string} tag - 标签
   * @returns {Promise<Array>} 任务数组
   */
  async getTasksByTag(tag) {
    try {
      const tasks = await this.loadTasks();
      return tasks.filter(t => t.tags && t.tags.includes(tag));
    } catch (error) {
      console.error('按标签获取任务失败:', error);
      throw error;
    }
  }

  /**
   * 按优先级获取任务
   * @param {string} priority - 优先级 (high, medium, low)
   * @returns {Promise<Array>} 任务数组
   */
  async getTasksByPriority(priority) {
    try {
      const tasks = await this.loadTasks();
      return tasks.filter(t => t.priority === priority);
    } catch (error) {
      console.error('按优先级获取任务失败:', error);
      throw error;
    }
  }

  /**
   * 搜索任务
   * @param {string} query - 搜索关键词
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>} 任务数组
   */
  async searchTasks(query, filters = {}) {
    try {
      const tasks = await this.loadTasks();
      
      return tasks.filter(task => {
        // 状态过滤
        if (filters.showActive !== undefined && !filters.showActive && !task.completed) {
          return false;
        }
        if (filters.showCompleted !== undefined && !filters.showCompleted && task.completed) {
          return false;
        }
        
        // 备注过滤
        if (filters.showNotesOnly && (!task.notes || task.notes.trim() === '')) {
          return false;
        }
        
        // 标签过滤
        if (filters.tags && filters.tags.length > 0) {
          if (!task.tags || !filters.tags.some(tag => task.tags.includes(tag))) {
            return false;
          }
        }
        
        // 优先级过滤
        if (filters.priority && task.priority !== filters.priority) {
          return false;
        }
        
        // 关键词搜索
        if (query) {
          const lowerQuery = query.toLowerCase();
          const titleMatch = task.text.toLowerCase().includes(lowerQuery);
          const notesMatch = task.notes && task.notes.toLowerCase().includes(lowerQuery);
          const tagMatch = task.tags && task.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
          return titleMatch || notesMatch || tagMatch;
        }
        
        return true;
      });
    } catch (error) {
      console.error('搜索任务失败:', error);
      throw error;
    }
  }

  /**
   * 按日期分组任务
   * @param {Array} tasks - 任务数组
   * @returns {Object} 按日期分组的任务
   */
  groupTasksByDate(tasks) {
    const grouped = {};
    
    tasks.forEach(task => {
      const taskDate = new Date(task.id);
      const dateKey = taskDate.toLocaleDateString();
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(task);
    });
    
    return grouped;
  }

  /**
   * 排序任务
   * @param {Array} tasks - 任务数组
   * @param {string} sortBy - 排序字段 (due, createdAt, priority)
   * @param {string} order - 排序顺序 (asc, desc)
   * @returns {Array} 排序后的任务数组
   */
  sortTasks(tasks, sortBy = 'createdAt', order = 'desc') {
    return tasks.sort((a, b) => {
      let aValue, bValue;
      
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
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority] || 2;
          bValue = priorityOrder[b.priority] || 2;
          break;
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
      }
      
      if (order === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }
}

// 导出任务管理器
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskManager;
} else {
  window.TaskManager = TaskManager;
}
