// adapters/crypto.js
class CryptoAdapter {
  /**
   * Generates an AES-GCM key from a user PIN using PBKDF2
   */
  async _getKeyMaterial(pin) {
    const enc = new TextEncoder();
    return crypto.subtle.importKey(
      "raw", 
      enc.encode(pin), 
      { name: "PBKDF2" }, 
      false, 
      ["deriveBits", "deriveKey"]
    );
  }

  async _getKey(keyMaterial, salt) {
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypts plaintext using AES-256-GCM with a user-provided PIN
   */
  async encrypt(plaintext, pin) {
    if (!plaintext || !pin) return null;
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const keyMaterial = await this._getKeyMaterial(pin);
    const key = await this._getKey(keyMaterial, salt);
    
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(plaintext)
    );
    
    // Combine salt, iv, and ciphertext into a single base64 string
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode.apply(null, combined));
  }

  /**
   * Decrypts ciphertext using AES-256-GCM with a user-provided PIN
   */
  async decrypt(ciphertextB64, pin) {
    if (!ciphertextB64 || !pin) return null;
    
    try {
      const combinedStr = atob(ciphertextB64);
      const combined = new Uint8Array(combinedStr.length);
      for (let i = 0; i < combinedStr.length; i++) {
        combined[i] = combinedStr.charCodeAt(i);
      }
      
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const data = combined.slice(28);
      
      const keyMaterial = await this._getKeyMaterial(pin);
      const key = await this._getKey(keyMaterial, salt);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
      );
      
      const dec = new TextDecoder();
      return dec.decode(decrypted);
    } catch (e) {
      console.error("Decryption failed:", e);
      return null;
    }
  }
}

// Attach to window for global access
window.cryptoAdapter = new CryptoAdapter();
