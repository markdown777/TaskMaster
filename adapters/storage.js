// adapters/storage.js
class StorageAdapter {
  constructor() {
    this.isChrome = typeof chrome !== 'undefined' && chrome.storage;
  }

  async get(key) {
    if (this.isChrome) {
      return new Promise(resolve => {
        chrome.storage.local.get([key], result => resolve(result[key]));
      });
    }
    // Fallback for future platforms (e.g. wx.getStorage)
    return localStorage.getItem(key);
  }

  async set(key, value) {
    if (this.isChrome) {
      return new Promise(resolve => {
        const obj = {};
        obj[key] = value;
        chrome.storage.local.set(obj, resolve);
      });
    }
    localStorage.setItem(key, value);
  }

  async remove(key) {
    if (this.isChrome) {
      return new Promise(resolve => {
        chrome.storage.local.remove(key, resolve);
      });
    }
    localStorage.removeItem(key);
  }
}

// Attach to window for global access
window.storageAdapter = new StorageAdapter();
