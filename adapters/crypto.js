// adapters/crypto.js
// 统一加密模块 - 使用静态盐 100K 迭代（向后兼容）
class CryptoAdapter {
  constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.SALT = this.encoder.encode('taskmaster-salt'); // 静态盐，保持兼容性
    this.ITERATIONS = 100000; // 保持 100K 迭代
  }

  /**
   * 派生加密密钥
   */
  async _deriveKey(pin) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(pin),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.SALT,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * 加密文本
   * @param {string} plaintext - 要加密的文本
   * @param {string} pin - PIN 码或密码
   * @returns {Promise<string|null>} Base64 编码的加密数据
   */
  async encrypt(plaintext, pin) {
    if (!plaintext || !pin) return null;

    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cryptoKey = await this._deriveKey(pin);
      const data = this.encoder.encode(plaintext);

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        data
      );

      // 格式：Base64([IV 12][Encrypted]) - 保持向后兼容
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      return btoa(String.fromCharCode.apply(null, combined));
    } catch (error) {
      console.error('加密失败:', error);
      return null;
    }
  }

  /**
   * 解密文本
   * @param {string} ciphertextB64 - Base64 编码的加密数据
   * @param {string} pin - PIN 码或密码
   * @returns {Promise<string|null>} 解密后的文本
   */
  async decrypt(ciphertextB64, pin) {
    if (!ciphertextB64 || !pin) return null;

    try {
      const combinedStr = atob(ciphertextB64);
      const combined = new Uint8Array(combinedStr.length);
      for (let i = 0; i < combinedStr.length; i++) {
        combined[i] = combinedStr.charCodeAt(i);
      }

      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const cryptoKey = await this._deriveKey(pin);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        data
      );

      return this.decoder.decode(decrypted);
    } catch (error) {
      console.error('解密失败:', error);
      return null;
    }
  }
}

// Attach to window for global access
window.cryptoAdapter = new CryptoAdapter();
