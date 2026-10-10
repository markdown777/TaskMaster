/**
 * 网络适配器
 * 用 @ohos.net.http 替代浏览器 fetch
 * 对齐 adapters/network.js 的 post 接口
 */
import http from '@ohos.net.http';
import { BusinessError } from '@kit.BasicServicesKit';

/**
 * 网络适配器单例
 */
export class NetworkAdapter {
  private static instance: NetworkAdapter | null = null;

  private constructor() {}

  static getInstance(): NetworkAdapter {
    if (!NetworkAdapter.instance) {
      NetworkAdapter.instance = new NetworkAdapter();
    }
    return NetworkAdapter.instance;
  }

  /**
   * 发起 POST 请求
   * @param url 请求地址
   * @param headers 请求头
   * @param body 请求体对象（会被 JSON.stringify）
   * @returns 解析后的 JSON 响应
   * @throws Error 非 2xx 时抛出包含响应体的错误，便于上层解析
   */
  async post(url: string, headers: Record<string, string>, body: Object): Promise<Object> {
    const httpRequest = http.createHttp();
    try {
      const response = await httpRequest.request(url, {
        method: http.RequestMethod.POST,
        header: headers,
        extraData: JSON.stringify(body),
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 30000,
        readTimeout: 60000
      });

      if (response.responseCode < 200 || response.responseCode >= 300) {
        const errText = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
        throw new Error(errText);
      }

      const resultStr = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
      return JSON.parse(resultStr) as Object;
    } catch (e) {
      const err = e as BusinessError | Error;
      const message = (err as Error).message || String(err);
      // 保留结构化错误文本（便于上层识别 response_format 等错误）
      throw new Error(message);
    } finally {
      httpRequest.destroy();
    }
  }

  /**
   * 发起 GET 请求（预留，当前插件未使用）
   */
  async get(url: string, headers: Record<string, string>): Promise<string> {
    const httpRequest = http.createHttp();
    try {
      const response = await httpRequest.request(url, {
        method: http.RequestMethod.GET,
        header: headers,
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 30000,
        readTimeout: 60000
      });
      if (response.responseCode < 200 || response.responseCode >= 300) {
        throw new Error(`HTTP ${response.responseCode}`);
      }
      return typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
    } finally {
      httpRequest.destroy();
    }
  }
}

/** 全局便捷访问实例 */
export const networkAdapter: NetworkAdapter = NetworkAdapter.getInstance();
