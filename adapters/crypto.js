// adapters/crypto.js
// 统一加密模块：新数据使用随机盐，同时兼容 3.5.0 的随机盐格式与更早的静态盐格式
class CryptoAdapter {
  constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.LEGACY_SALT = this.encoder.encode('taskmaster-salt');
    this.ITERATIONS = 100000;
    this.SALT_LENGTH = 16;
    this.IV_LENGTH = 12;
  }

  async _deriveKey(pin, salt) {
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
        salt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  _toBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  _fromBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  _concat(...parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      result.set(part, offset);
      offset += part.length;
    });
    return result;
  }

  /**
   * 加密文本
   * 格式：Base64([随机盐 16][IV 12][密文])
   * @param {string} plaintext - 要加密的文本
   * @param {string} pin - PIN 码或密码
   * @returns {Promise<string|null>} Base64 编码的加密数据
   */
  async encrypt(plaintext, pin) {
    if (!plaintext || !pin) return null;

    try {
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      const cryptoKey = await this._deriveKey(pin, salt);
      const data = this.encoder.encode(plaintext);

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );

      return this._toBase64(this._concat(salt, iv, new Uint8Array(encrypted)));
    } catch (error) {
      console.error('加密失败:', error);
      return null;
    }
  }

  async _decryptWithLayout(bytes, pin, saltLength) {
    const ivStart = saltLength;
    const dataStart = saltLength + this.IV_LENGTH;
    if (bytes.length <= dataStart) return null;

    const salt = saltLength > 0 ? bytes.slice(0, saltLength) : this.LEGACY_SALT;
    const iv = bytes.slice(ivStart, dataStart);
    const data = bytes.slice(dataStart);
    const cryptoKey = await this._deriveKey(pin, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );

    return this.decoder.decode(decrypted);
  }

  /**
   * 解密文本，依次尝试随机盐格式和旧的静态盐格式
   * @param {string} ciphertextB64 - Base64 编码的加密数据
   * @param {string} pin - PIN 码或密码
   * @returns {Promise<string|null>} 解密后的文本
   */
  async decrypt(ciphertextB64, pin) {
    if (!ciphertextB64 || !pin) return null;

    try {
      const bytes = this._fromBase64(ciphertextB64);
      const layouts = [this.SALT_LENGTH, 0];

      for (const saltLength of layouts) {
        try {
          const result = await this._decryptWithLayout(bytes, pin, saltLength);
          if (result !== null) return result;
        } catch (error) {
          // 尝试下一种格式
        }
      }

      console.warn('解密失败：PIN 码错误或数据格式不受支持');
      return null;
    } catch (error) {
      console.error('解密失败:', error);
      return null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CryptoAdapter };
}

if (typeof window !== 'undefined') {
  window.CryptoAdapter = CryptoAdapter;
  window.cryptoAdapter = new CryptoAdapter();
}
