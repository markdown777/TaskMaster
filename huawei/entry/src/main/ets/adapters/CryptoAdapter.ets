/**
 * 加密适配器
 * 用 @ohos.security.cryptoFramework 替代 Web Crypto API
 * 算法：PBKDF2(100K 迭代, SHA-256, 静态盐) 派生密钥 + AES-256-GCM 加密
 * 输出格式：Base64([IV 12 字节][密文])，与浏览器插件 cryptoAdapter 完全兼容
 */
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { buffer } from '@kit.ArkTS';

const SALT_TEXT = 'taskmaster-salt';
const ITERATIONS = 100000;
const IV_LEN = 12;

/**
 * 加密适配器单例
 */
export class CryptoAdapter {
  private static instance: CryptoAdapter | null = null;
  private saltBytes: Uint8Array;
  private encoder: TextEncoder;

  private constructor() {
    this.encoder = new TextEncoder();
    this.saltBytes = this.encoder.encode(SALT_TEXT);
  }

  static getInstance(): CryptoAdapter {
    if (!CryptoAdapter.instance) {
      CryptoAdapter.instance = new CryptoAdapter();
    }
    return CryptoAdapter.instance;
  }

  /**
   * PBKDF2 派生 AES-256 密钥
   * 使用 cryptoFramework.createKdf('PBKDF2|SHA256') 完成 100K 迭代派生
   */
  private async deriveKey(pin: string): Promise<CryptoFrameworkKeyProxy> {
    try {
      const kdf = cryptoFramework.createKdf('PBKDF2|SHA256');
      const spec: cryptoFramework.PBKDF2Spec = {
        password: this.encoder.encode(pin),
        salt: this.saltBytes,
        iterations: ITERATIONS,
        keySize: 32,
        algName: 'PBKDF2'
      };
      const keyMaterial = await kdf.generateSecret(spec);
      const aesGenerator = cryptoFramework.createSymKeyGenerator('AES256');
      const symKey = await aesGenerator.convertSymKey({
        data: keyMaterial.data
      } as cryptoFramework.SymKeyMaterial);
      return new CryptoFrameworkKeyProxy(symKey);
    } catch (e) {
      throw new Error(`密钥派生失败: ${(e as Error).message}`);
    }
  }

  /**
   * 加密文本
   * @param plaintext 明文
   * @param pin PIN 码或密码
   * @returns Base64 编码的 [IV|密文]；失败返回 null
   */
  async encrypt(plaintext: string, pin: string): Promise<string | null> {
    if (!plaintext || !pin) return null;
    try {
      const iv = this.randomBytes(IV_LEN);
      const keyProxy = await this.deriveKey(pin);

      const cipher = cryptoFramework.createCipher('AES256|GCM|NoPadding');
      const spec: cryptoFramework.GcmParamsSpec = {
        algName: 'GcmParamsSpec',
        iv: { data: iv },
        aad: { data: new Uint8Array(0) },
        authTag: { data: new Uint8Array(16) }
      };
      await cipher.init(cryptoFramework.CryptoMode.ENCRYPT_MODE, keyProxy.getKey(), spec);

      const plainData = this.encoder.encode(plaintext);
      const encrypted = await cipher.doFinal({ data: plainData });

      // GCM 模式下 doFinal 返回的密文末尾包含 authTag（16 字节）
      // 组合格式：[IV 12][密文+authTag]，与 Web Crypto 的 encrypted.byteLength 一致
      const combined = new Uint8Array(iv.length + encrypted.data.length);
      combined.set(iv, 0);
      combined.set(encrypted.data, iv.length);

      return buffer.from(combined).toString('base64');
    } catch (e) {
      console.error(`加密失败: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * 解密文本
   * @param ciphertextB64 Base64 编码的 [IV|密文+authTag]
   * @param pin PIN 码或密码
   * @returns 解密后的明文；失败返回 null
   */
  async decrypt(ciphertextB64: string, pin: string): Promise<string | null> {
    if (!ciphertextB64 || !pin) return null;
    try {
      const combined = new Uint8Array(buffer.from(ciphertextB64, 'base64').buffer);
      const iv = combined.slice(0, IV_LEN);
      const cipherWithTag = combined.slice(IV_LEN);

      // GCM 的 authTag 在密文末尾 16 字节
      const tagLen = 16;
      const cipherLen = cipherWithTag.length - tagLen;
      const cipherData = cipherWithTag.slice(0, cipherLen);
      const authTag = cipherWithTag.slice(cipherLen);

      const keyProxy = await this.deriveKey(pin);
      const cipher = cryptoFramework.createCipher('AES256|GCM|NoPadding');
      const spec: cryptoFramework.GcmParamsSpec = {
        algName: 'GcmParamsSpec',
        iv: { data: new Uint8Array(0) },
        aad: { data: new Uint8Array(0) },
        authTag: { data: new Uint8Array(16) }
      };
      await cipher.init(cryptoFramework.CryptoMode.DECRYPT_MODE, keyProxy.getKey(), spec);

      const decrypted = await cipher.doFinal({ data: cipherData });
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(decrypted.data);
    } catch (e) {
      console.error(`解密失败: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * 生成随机字节（用于 GCM 的 IV）
   */
  private randomBytes(len: number): Uint8Array {
    const random = cryptoFramework.createRandom();
    const result = random.generateRandomSync(len);
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = result.data[i];
    }
    return arr;
  }
}

/**
 * cryptoFramework SymKey 的轻量代理，便于类型传递
 */
class CryptoFrameworkKeyProxy {
  private symKey: cryptoFramework.SymKey;
  constructor(symKey: cryptoFramework.SymKey) {
    this.symKey = symKey;
  }
  getKey(): cryptoFramework.SymKey {
    return this.symKey;
  }
}

/** 全局便捷访问实例 */
export const cryptoAdapter: CryptoAdapter = CryptoAdapter.getInstance();
