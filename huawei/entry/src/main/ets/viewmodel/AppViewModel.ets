/**
 * 应用全局状态 ViewModel
 * 移植 popup.js / options.js 中的状态管理与业务流程
 * - @Observed 响应式任务列表与设置
 * - AI 模式 / PIN 解锁 / 搜索状态 / 弹窗可见性
 * - 设置加载与保存（含 AI Key 加密迁移流程）
 */
import { Task } from '../models/Task';
import { TaskManager } from '../services/TaskManager';
import { AiService, ParsedTask } from '../services/AiService';
import { BackupManager } from '../services/BackupManager';
import { storageAdapter } from '../adapters/StorageAdapter';
import { cryptoAdapter } from '../adapters/CryptoAdapter';
import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  DEFAULT_AI_CONFIG,
  DEFAULT_VISION_CONFIG,
  DEFAULT_SEARCH_STATE,
  AppSettings,
  AiConfig,
  VisionConfig,
  SearchState
} from '../constants/Constants';
import { isToday, isYesterday, parseTags, toDatetimeLocalValue } from '../utils/CommonUtils';

/** 弹窗可见性状态 */
export interface ModalVisibility {
  pin: boolean;
  notes: boolean;
  share: boolean;
  due: boolean;
  search: boolean;
}

/** 当前编辑备注的任务 */
export interface NotesContext {
  taskId: number;
  taskText: string;
  notes: string;
  isArchived: boolean;
}

/** AI 解析结果填充到表单的暂存 */
export interface AiFormFill {
  title: string;
  priority: string;
  tags: string;
  due: string;
  notes: string;
}

/**
 * 应用全局状态单例
 */
@Observed
export class AppViewModel {
  private static instance: AppViewModel | null = null;

  // 任务数据
  tasks: Task[] = [];

  // 设置
  settings: AppSettings = { ...DEFAULT_SETTINGS };
  aiConfig: AiConfig = { ...DEFAULT_AI_CONFIG };
  visionConfig: VisionConfig = { ...DEFAULT_VISION_CONFIG };

  // 会话密钥（运行期解密后缓存，退出应用清除）
  sessionApiKey: string | null = null;
  sessionVisionKey: string | null = null;

  // AI 模式状态
  isAiMode = false;
  aiGuideSeen = false;
  pendingAiText = '';
  pendingAiIsImage = false;
  aiLoading = false;

  // 搜索状态
  searchState: SearchState = { ...DEFAULT_SEARCH_STATE };

  // 弹窗可见性
  modals: ModalVisibility = {
    pin: false,
    notes: false,
    share: false,
    due: false,
    search: false
  };

  // 备注编辑上下文
  notesContext: NotesContext | null = null;

  // 表单状态
  formTitle = '';
  formPriority: string = 'medium';
  formTags = '';
  formDue = '';
  currentTaskNotes = '';

  // 消息提示
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  toastVisible = false;

  // 折叠状态（内屏/外屏）
  isInnerScreen = true;

  private constructor() {}

  static getInstance(): AppViewModel {
    if (!AppViewModel.instance) {
      AppViewModel.instance = new AppViewModel();
    }
    return AppViewModel.instance;
  }

  /**
   * 启动时加载所有数据
   */
  async bootstrap(): Promise<void> {
    await this.loadSettings();
    await this.loadTasks();
    await this.loadAiGuideSeen();
  }

  /**
   * 加载任务列表
   */
  async loadTasks(): Promise<void> {
    this.tasks = await TaskManager.getInstance().loadTasks();
  }

  /**
   * 刷新任务（操作后调用）
   */
  async refreshTasks(): Promise<void> {
    await this.loadTasks();
  }

  // ============ 设置加载与保存 ============

  /**
   * 加载设置（对齐 options.js loadSettings）
   */
  async loadSettings(): Promise<void> {
    try {
      const saved = await storageAdapter.get<AppSettings>(STORAGE_KEYS.SETTINGS);
      if (saved) {
        this.settings = { ...DEFAULT_SETTINGS, ...saved };
      }
      const aiSaved = await storageAdapter.get<AiConfig>(STORAGE_KEYS.AI_CONFIG);
      if (aiSaved) {
        this.aiConfig = { ...DEFAULT_AI_CONFIG, ...aiSaved };
      }
      const visionSaved = await storageAdapter.get<VisionConfig>(STORAGE_KEYS.VISION_CONFIG);
      if (visionSaved) {
        this.visionConfig = { ...DEFAULT_VISION_CONFIG, ...visionSaved };
      }
    } catch (e) {
      console.error(`加载设置失败: ${(e as Error).message}`);
    }
  }

  /**
   * 保存基础设置（显示/行为/通知/安全）
   */
  async saveSettings(newSettings: AppSettings): Promise<void> {
    // 验证加密密钥长度
    if (newSettings.enableEncryption && newSettings.encryptionKey.length < 8) {
      throw new Error('加密密钥至少需要8位字符');
    }
    this.settings = newSettings;
    await storageAdapter.set(STORAGE_KEYS.SETTINGS, newSettings as unknown as Object);

    // 若启用加密且有密钥，重加密所有任务
    if (newSettings.enableEncryption && newSettings.encryptionKey) {
      await this.encryptAllTasks(newSettings.encryptionKey);
    }
  }

  /**
   * 加密所有任务数据（对齐 options.js encryptAllTasks）
   */
  private async encryptAllTasks(key: string): Promise<void> {
    try {
      const tasks = this.tasks;
      for (const task of tasks) {
        if (task.text) {
          const enc = await cryptoAdapter.encrypt(task.text, key);
          if (enc) task.text = enc;
        }
        if (task.notes && task.notes.trim()) {
          const enc = await cryptoAdapter.encrypt(task.notes, key);
          if (enc) task.notes = enc;
        }
      }
      await TaskManager.getInstance().saveTasks(tasks);
    } catch (e) {
      console.error(`加密任务数据失败: ${(e as Error).message}`);
    }
  }

  /**
   * 保存 AI 配置（含 API Key 加密迁移流程，对齐 options.js saveSettings 的 AI 部分）
   */
  async saveAiConfig(
    provider: string,
    baseUrl: string,
    enableEncryption: boolean,
    apiKeyInput: string,
    pinCode: string
  ): Promise<void> {
    const oldConfig = this.aiConfig;
    const newConfig: AiConfig = { ...oldConfig, provider, baseUrl, enableEncryption };

    if (apiKeyInput) {
      // 用户输入了新的 API Key
      if (enableEncryption) {
        if (pinCode.length < 4) throw new Error('PIN 码至少需要4位');
        const encrypted = await cryptoAdapter.encrypt(apiKeyInput, pinCode);
        if (!encrypted || encrypted === apiKeyInput) throw new Error('加密失败，返回了明文');
        await storageAdapter.set(STORAGE_KEYS.AI_ENCRYPTED_KEY, encrypted);
        await storageAdapter.remove(STORAGE_KEYS.AI_PLAINTEXT_KEY);
        newConfig.hasKey = true;
      } else {
        await storageAdapter.set(STORAGE_KEYS.AI_PLAINTEXT_KEY, apiKeyInput);
        await storageAdapter.remove(STORAGE_KEYS.AI_ENCRYPTED_KEY);
        newConfig.hasKey = true;
      }
    } else {
      // 未输入新 Key，处理加密状态变更
      if (enableEncryption) {
        const plaintext = await storageAdapter.get<string>(STORAGE_KEYS.AI_PLAINTEXT_KEY);
        const encrypted = await storageAdapter.get<string>(STORAGE_KEYS.AI_ENCRYPTED_KEY);
        if (plaintext) {
          // 场景 A：明文 → 加密
          if (pinCode.length < 4) throw new Error('PIN 码至少需要4位');
          const enc = await cryptoAdapter.encrypt(plaintext, pinCode);
          if (!enc) throw new Error('加密失败');
          await storageAdapter.set(STORAGE_KEYS.AI_ENCRYPTED_KEY, enc);
          await storageAdapter.remove(STORAGE_KEYS.AI_PLAINTEXT_KEY);
          newConfig.hasKey = true;
        } else if (encrypted) {
          // 场景 B：已有加密 Key，验证 PIN
          if (pinCode) {
            const decrypted = await cryptoAdapter.decrypt(encrypted, pinCode);
            if (!decrypted) throw new Error('认证失败，请检查 PIN 码');
          }
          newConfig.hasKey = true;
        } else if (!oldConfig.hasKey) {
          throw new Error('请先输入 API Key 以完成设置');
        }
      }
      // 不启用加密时不做额外处理
    }

    this.aiConfig = newConfig;
    await storageAdapter.set(STORAGE_KEYS.AI_CONFIG, newConfig as unknown as Object);
    // 清除会话密钥，强制重新解锁
    this.sessionApiKey = null;
  }

  /**
   * 保存 Vision 配置（与 AI 配置同构）
   */
  async saveVisionConfig(
    provider: string,
    baseUrl: string,
    model: string,
    enableEncryption: boolean,
    apiKeyInput: string,
    pinCode: string
  ): Promise<void> {
    const oldConfig = this.visionConfig;
    const newConfig: VisionConfig = { ...oldConfig, provider, baseUrl, model, enableEncryption };

    // 关闭 Vision 时清除 Key
    if (provider === 'off') {
      await storageAdapter.remove(STORAGE_KEYS.VISION_ENCRYPTED_KEY);
      await storageAdapter.remove(STORAGE_KEYS.VISION_PLAINTEXT_KEY);
      newConfig.hasKey = false;
      this.visionConfig = newConfig;
      await storageAdapter.set(STORAGE_KEYS.VISION_CONFIG, newConfig as unknown as Object);
      this.sessionVisionKey = null;
      return;
    }

    if (apiKeyInput) {
      if (enableEncryption) {
        if (pinCode.length < 4) throw new Error('PIN 码至少需要4位');
        const encrypted = await cryptoAdapter.encrypt(apiKeyInput, pinCode);
        if (!encrypted || encrypted === apiKeyInput) throw new Error('加密失败，返回了明文');
        await storageAdapter.set(STORAGE_KEYS.VISION_ENCRYPTED_KEY, encrypted);
        await storageAdapter.remove(STORAGE_KEYS.VISION_PLAINTEXT_KEY);
        newConfig.hasKey = true;
      } else {
        await storageAdapter.set(STORAGE_KEYS.VISION_PLAINTEXT_KEY, apiKeyInput);
        await storageAdapter.remove(STORAGE_KEYS.VISION_ENCRYPTED_KEY);
        newConfig.hasKey = true;
      }
    } else if (enableEncryption) {
      const plaintext = await storageAdapter.get<string>(STORAGE_KEYS.VISION_PLAINTEXT_KEY);
      const encrypted = await storageAdapter.get<string>(STORAGE_KEYS.VISION_ENCRYPTED_KEY);
      if (plaintext) {
        if (pinCode.length < 4) throw new Error('PIN 码至少需要4位');
        const enc = await cryptoAdapter.encrypt(plaintext, pinCode);
        if (!enc) throw new Error('加密失败');
        await storageAdapter.set(STORAGE_KEYS.VISION_ENCRYPTED_KEY, enc);
        await storageAdapter.remove(STORAGE_KEYS.VISION_PLAINTEXT_KEY);
        newConfig.hasKey = true;
      } else if (encrypted) {
        if (pinCode) {
          const decrypted = await cryptoAdapter.decrypt(encrypted, pinCode);
          if (!decrypted) throw new Error('认证失败，请检查 PIN 码');
        }
        newConfig.hasKey = true;
      } else if (!oldConfig.hasKey) {
        throw new Error('请先输入 API Key 以完成设置');
      }
    }

    this.visionConfig = newConfig;
    await storageAdapter.set(STORAGE_KEYS.VISION_CONFIG, newConfig as unknown as Object);
    this.sessionVisionKey = null;
  }

  // ============ AI 引导 ============

  private async loadAiGuideSeen(): Promise<void> {
    const seen = await storageAdapter.get<boolean>(STORAGE_KEYS.AI_GUIDE_SEEN);
    this.aiGuideSeen = seen === true;
  }

  async markAiGuideSeen(): Promise<void> {
    this.aiGuideSeen = true;
    await storageAdapter.set(STORAGE_KEYS.AI_GUIDE_SEEN, true);
  }

  // ============ AI 模式与 PIN 解锁 ============

  /**
   * 切换 AI 模式
   */
  toggleAiMode(): void {
    this.isAiMode = !this.isAiMode;
    if (this.isAiMode && !this.aiGuideSeen) {
      this.markAiGuideSeen();
    }
  }

  /**
   * 获取会话 AI Key（优先明文，其次会话缓存）
   */
  async getSessionApiKey(): Promise<string | null> {
    if (this.aiConfig.enableEncryption) {
      return this.sessionApiKey;
    }
    if (this.aiConfig.hasKey) {
      return await storageAdapter.get<string>(STORAGE_KEYS.AI_PLAINTEXT_KEY);
    }
    return null;
  }

  /**
   * 获取会话 Vision Key
   */
  async getSessionVisionKey(): Promise<string | null> {
    if (this.visionConfig.enableEncryption) {
      return this.sessionVisionKey;
    }
    if (this.visionConfig.hasKey) {
      return await storageAdapter.get<string>(STORAGE_KEYS.VISION_PLAINTEXT_KEY);
    }
    return null;
  }

  /**
   * 用 PIN 解锁 AI/Vision 密钥到会话
   * @returns 是否至少解锁了一个
   */
  async unlockWithPin(pin: string): Promise<boolean> {
    let anyDecrypted = false;
    if (this.aiConfig.enableEncryption && this.aiConfig.hasKey) {
      const encrypted = await storageAdapter.get<string>(STORAGE_KEYS.AI_ENCRYPTED_KEY);
      if (encrypted) {
        const decrypted = await cryptoAdapter.decrypt(encrypted, pin);
        if (decrypted) {
          this.sessionApiKey = decrypted;
          anyDecrypted = true;
        }
      }
    }
    if (this.visionConfig.enableEncryption && this.visionConfig.hasKey) {
      const encrypted = await storageAdapter.get<string>(STORAGE_KEYS.VISION_ENCRYPTED_KEY);
      if (encrypted) {
        const decrypted = await cryptoAdapter.decrypt(encrypted, pin);
        if (decrypted) {
          this.sessionVisionKey = decrypted;
          anyDecrypted = true;
        }
      }
    }
    return anyDecrypted;
  }

  /**
   * 处理 AI 输入（核心流程，对齐 popup.js processAiInput）
   * @param input 文本或 base64 图片
   * @param isImage 是否为图片
   * @returns 解析结果（用于填充表单）；若需要 PIN 则返回 null 并打开 PIN 弹窗
   */
  async processAiInput(input: string, isImage: boolean): Promise<ParsedTask | null> {
    let apiKey: string | null;
    let config: AiConfig | VisionConfig;
    if (isImage) {
      config = this.visionConfig;
      if (config.provider === 'off' || !config.hasKey) {
        throw new Error('请先在设置中配置 Vision 图片识别');
      }
      apiKey = await this.getSessionVisionKey();
    } else {
      config = this.aiConfig;
      if (config.provider === 'off' || !config.hasKey) {
        throw new Error('请先在设置中配置 AI 助理');
      }
      apiKey = await this.getSessionApiKey();
    }

    if (!apiKey && config.enableEncryption) {
      // 需要 PIN 解锁
      this.pendingAiText = input;
      this.pendingAiIsImage = isImage;
      this.modals.pin = true;
      return null;
    }
    if (!apiKey) {
      throw new Error('API Key 缺失，请检查配置');
    }

    this.aiLoading = true;
    try {
      let parsed: ParsedTask;
      if (isImage) {
        parsed = await AiService.getInstance().parseTaskFromImage(
          input, apiKey, config.provider, config.baseUrl, (config as VisionConfig).model
        );
      } else {
        parsed = await AiService.getInstance().parseTaskFromText(
          input, apiKey, config.provider, config.baseUrl
        );
      }
      return parsed;
    } finally {
      this.aiLoading = false;
    }
  }

  /**
   * 将 AI 解析结果转为表单填充数据（对齐 popup.js 的表单回填逻辑）
   */
  buildAiFormFill(parsed: ParsedTask, isImage: boolean, rawInput: string): AiFormFill {
    const title = parsed.title || (isImage ? '图片任务解析结果' : rawInput);
    let due = '';
    if (parsed.due_date) {
      let normalized = parsed.due_date.replace(/\//g, '-').replace(' ', 'T').substring(0, 16);
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
        due = normalized;
      } else {
        const parsed2 = new Date(parsed.due_date);
        if (!isNaN(parsed2.getTime())) {
          due = toDatetimeLocalValue(parsed2);
        }
      }
    }

    let notes = `[AI自动生成]\n原始信息：${isImage ? '[图片截图]' : rawInput}`;
    if (parsed.notes && parsed.notes.trim()) {
      const cleanedNotes = parsed.notes.split('\n').map((l: string) => l.trim()).join('\n');
      notes = `[AI提取要点]\n${cleanedNotes}\n\n${notes}`;
    }

    return {
      title,
      priority: parsed.priority || 'medium',
      tags: parsed.tags && parsed.tags.length > 0 ? parsed.tags.join(', ') : '',
      due,
      notes
    };
  }

  // ============ 搜索 ============

  /**
   * 更新搜索状态并判定是否处于搜索模式
   */
  updateSearchState(): void {
    const s = this.searchState;
    s.isSearching = s.query.length > 0 ||
      s.showNotesOnly ||
      s.showActive !== s.showCompleted; // 恰好一个被选中
  }

  /**
   * 重置搜索状态
   */
  resetSearch(): void {
    this.searchState = { ...DEFAULT_SEARCH_STATE };
  }

  // ============ 任务分组（用于渲染） ============

  /**
   * 获取分组后的任务（置顶 / 按日期分组的活动任务 / 归档）
   */
  getGroupedTasks(): { pinned: Task[]; activeGroups: { dateKey: string; tasks: Task[]; isToday: boolean; isYesterday: boolean }[]; archived: Task[] } {
    const pinned: Task[] = [];
    const active: Task[] = [];
    const archived: Task[] = [];

    this.tasks.forEach(t => {
      if (t.completed) {
        archived.push(t);
      } else if (t.pinned) {
        pinned.push(t);
      } else {
        active.push(t);
      }
    });

    // 活动任务按日期分组
    const grouped = TaskManager.getInstance().groupTasksByDate(active);
    const dateKeys = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const activeGroups = dateKeys.map(dateKey => ({
      dateKey,
      tasks: grouped[dateKey],
      isToday: isToday(new Date(dateKey)),
      isYesterday: isYesterday(new Date(dateKey))
    }));

    // 归档任务按完成时间倒序
    archived.sort((a, b) => (b.completedTime ?? 0) - (a.completedTime ?? 0));

    return { pinned, activeGroups, archived };
  }

  /**
   * 获取搜索结果
   */
  async getSearchResults(): Promise<Task[]> {
    return await TaskManager.getInstance().searchTasks(this.searchState.query, {
      showActive: this.searchState.showActive,
      showCompleted: this.searchState.showCompleted,
      showNotesOnly: this.searchState.showNotesOnly
    });
  }

  // ============ 备份 ============

  /**
   * 前台时检查补备份
   */
  async checkBackupOnForeground(): Promise<void> {
    try {
      await BackupManager.getInstance().checkAndBackupIfNeeded(this.tasks);
    } catch (e) {
      console.error(`检查备份失败: ${(e as Error).message}`);
    }
  }

  // ============ Toast 提示 ============

  /**
   * 显示 Toast 消息
   */
  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.toastVisible = true;
    // 3 秒后自动隐藏（由 UI 层定时器处理）
  }

  /**
   * 隐藏 Toast
   */
  hideToast(): void {
    this.toastVisible = false;
  }

  // ============ 弹窗控制 ============

  openModal(name: keyof ModalVisibility): void {
    this.modals[name] = true;
  }

  closeModal(name: keyof ModalVisibility): void {
    this.modals[name] = false;
  }

  /**
   * 打开备注编辑
   */
  openNotes(taskId: number, taskText: string, notes: string, isArchived: boolean): void {
    this.notesContext = { taskId, taskText, notes, isArchived };
    this.modals.notes = true;
  }

  /**
   * 折叠屏状态更新
   */
  setScreenType(isInner: boolean): void {
    this.isInnerScreen = isInner;
  }
}
