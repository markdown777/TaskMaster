// adapters/network.js
class NetworkAdapter {
  /**
   * 发起 POST 请求的封装，用于跨平台抽象网络请求
   * @param {string} url - 请求的 URL 地址
   * @param {object} headers - 请求头信息
   * @param {object} body - 请求体数据
   * @returns {Promise<object>} 解析后的 JSON 响应数据
   */
  async post(url, headers, body) {
    // 在 Chrome 扩展中，我们可以直接使用 fetch
    // 这种抽象允许将来在小程序中替换为 wx.request
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      // 返回结构化的错误以便上层处理
      throw new Error(errText);
    }

    return await response.json();
  }
}

window.networkAdapter = new NetworkAdapter();
