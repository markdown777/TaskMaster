/**
 * 任务管理模块
 */

/**
 * 任务管理器类
 */
class TaskManager {
  constructor() {
    this.tasks = [];
    this.loadTasks();
  }

  /**
   * 加载任务数据 (支持从 sync 迁移到 local)
   * @returns {Promise<Array>} 任务数组
   */
  async loadTasks() {
    return new Promise((resolve, reject) => {
      // 优先从 local 存储读取，如果 local 中没有数据，尝试从 sync 迁移
      chrome.storage.local.get({ tasks: null }, (localResult) => {
        if (chrome.runtime.lastError) {
          console.error('加载本地任务失败:', chrome.runtime.lastError);
          return reject(chrome.runtime.lastError);
        }

        if (localResult.tasks !== null) {
          this.tasks = localResult.tasks;
          return resolve(this.tasks);
        }

        // 如果 local 没有数据，尝试从旧的 sync读取并迁移
        chrome.storage.sync.get({ tasks: [], settings: {} }, (syncResult) => {
          if (chrome.runtime.lastError) {
            console.error('从同步存储加载任务失败:', chrome.runtime.lastError);
            return reject(chrome.runtime.lastError);
          }

          const syncTasks = syncResult.tasks || [];
          
          if (syncTasks.length > 0) {
            this.tasks = syncTasks;
            // 将数据保存到 local
            this.saveTasks(syncTasks).then(() => {
              console.log('[DEBUG] 成功将任务从旧的 sync 迁移到 local 存储');
              // 清理旧的 sync 存储以释放配额空间
              chrome.storage.sync.remove('tasks');
            }).catch(error => {
              console.error('迁移任务到本地失败:', error);
            });
          } else {
            this.tasks = [];
          }
          
          resolve(this.tasks);
        });
      });
    });
  }

  /**
   * 保存任务数据
   * @param {Array} tasks - 任务数组
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveTasks(tasks) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ tasks }, () => {
        if (chrome.runtime.lastError) {
          console.error('保存任务失败:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          this.tasks = tasks;
          // 同时将核心数据同步到云端
          this.syncCoreDataToCloud(tasks);
          resolve(true);
        }
      });
    });
  }

  /**
   * 将核心任务数据同步到 sync 存储
   * 只保留基础字段，避免超出 100KB 限制
   * @param {Array} tasks - 任务数组
   */
  syncCoreDataToCloud(tasks) {
    try {
      // 提取核心字段，过滤掉长文本(notes)等
      const coreTasks = tasks.map(task => ({
        id: task.id,
        text: task.text.length > 50 ? task.text.substring(0, 50) + '...' : task.text, // 截断超长标题
        completed: task.completed,
        priority: task.priority,
        due: task.due,
        pinned: task.pinned,
        updatedAt: Date.now() // 加入时间戳，解决跨设备冲突
      }));
      
      const syncKey = typeof STORAGE_KEYS !== 'undefined' ? STORAGE_KEYS.SYNC_CORE_TASKS : 'sync_core_tasks';
      chrome.storage.sync.set({ [syncKey]: coreTasks }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[DEBUG] 同步核心数据到云端受限:', chrome.runtime.lastError);
        } else {
          console.log('[DEBUG] 核心数据已同步到云端');
        }
      });
    } catch (error) {
      console.error('同步云端数据失败:', error);
    }
  }

  /**
   * 添加新任务
   * @param {Object} taskData - 任务数据
   * @returns {Promise<Object>} 新任务对象
   */
  async addTask(taskData) {
    try {
      const newTask = {
        id: Date.now(),
        text: taskData.text,
        completed: false,
        createdAt: new Date().toISOString(),
        due: taskData.due || new Date(Date.now() + 3600000).toISOString(),
        priority: taskData.priority || 'medium',
        tags: taskData.tags || [],
        notes: taskData.notes || ''
      };

      const tasks = await this.loadTasks();
      tasks.push(newTask);
      await this.saveTasks(tasks);

      // 创建提醒
      if (chrome.alarms) {
        chrome.alarms.create(newTask.text, {
          when: new Date(newTask.due).getTime()
        });
      }

      // 发送任务添加通知
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

      const updatedTask = { ...tasks[taskIndex], ...updates };
      tasks[taskIndex] = updatedTask;

      // 如果任务完成，取消置顶
      if (updatedTask.completed && updatedTask.pinned) {
        updatedTask.pinned = false;
      }

      // 如果任务完成，添加完成时间
      if (updatedTask.completed && !updatedTask.completedTime) {
        updatedTask.completedTime = Date.now();
      }

      await this.saveTasks(tasks);
      return updatedTask;
    } catch (error) {
      console.error('更新任务失败:', error);
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
      return true;
    } catch (error) {
      console.error('批量删除任务失败:', error);
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

      if (task.completed) {
        task.completedTime = Date.now();
        task.pinned = false; // 完成后取消置顶
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
