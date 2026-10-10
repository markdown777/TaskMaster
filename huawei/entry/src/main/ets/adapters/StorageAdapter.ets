/**
 * 存储适配器
 * 用 @ohos.data.preferences 替代 chrome.storage.local
 * 提供统一的 get/set/remove/getAll 接口，供业务层无感切换平台
 */
import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';

const PREF_STORE_NAME = 'taskmaster_store';

/**
 * 存储适配器单例
 * - 基本类型直接存储
 * - 复杂对象（数组/对象）序列化为 JSON 字符串后存储，读取时反序列化
 */
export class StorageAdapter {
  private static instance: StorageAdapter | null = null;
  private store: preferences.Preferences | null = null;

  private constructor() {}

  static getInstance(): StorageAdapter {
    if (!StorageAdapter.instance) {
      StorageAdapter.instance = new StorageAdapter();
    }
    return StorageAdapter.instance;
  }

  /**
   * 初始化 preferences 实例（需在 Ability onCreate 中调用）
   */
  static async init(context: common.UIAbilityContext): Promise<void> {
    const inst = StorageAdapter.getInstance();
    inst.store = await preferences.getPreferences(context, PREF_STORE_NAME);
  }

  private ensure(): preferences.Preferences {
    if (!this.store) {
      throw new Error('StorageAdapter 尚未初始化，请先调用 StorageAdapter.init(context)');
    }
    return this.store;
  }

  /**
   * 读取值并反序列化
   * @param key 键名
   * @returns 反序列化后的值；不存在则返回 null
   */
  async get<T = Object>(key: string): Promise<T | null> {
    const store = this.ensure();
    const raw = await store.get(key, '');
    if (raw == null || raw === '') return null;
    const str = String(raw);
    // 尝试 JSON 解析；失败则视为原始字符串
    try {
      return JSON.parse(str) as T;
    } catch {
      return str as unknown as T;
    }
  }

  /**
   * 读取原始字符串值（不解析）
   */
  async getRaw(key: string): Promise<string | null> {
    const store = this.ensure();
    const raw = await store.get(key, '');
    if (raw == null || raw === '') return null;
    return String(raw);
  }

  /**
   * 存储值（自动序列化对象/数组）
   */
  async set(key: string, value: Object): Promise<void> {
    const store = this.ensure();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await store.put(key, serialized);
    await store.flush();
  }

  /**
   * 删除键
   */
  async remove(key: string): Promise<void> {
    const store = this.ensure();
    await store.delete(key);
    await store.flush();
  }

  /**
   * 读取全部键值对（用于备份列表枚举）
   */
  async getAll(): Promise<Record<string, Object>> {
    const store = this.ensure();
    const all = await store.getAll();
    const result: Record<string, Object> = {};
    Object.keys(all).forEach(k => {
      const v = all[k];
      const str = String(v);
      try {
        result[k] = JSON.parse(str);
      } catch {
        result[k] = str;
      }
    });
    return result;
  }

  /**
   * 枚举所有键
   */
  async getAllKeys(): Promise<string[]> {
    const store = this.ensure();
    return await store.getAllKeys();
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    const store = this.ensure();
    await store.clear();
    await store.flush();
  }
}

/** 全局便捷访问实例 */
export const storageAdapter: StorageAdapter = StorageAdapter.getInstance();
