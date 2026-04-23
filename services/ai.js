// services/ai.js
class AIService {
  /**
   * 构造函数，初始化 AIService
   * @param {NetworkAdapter} networkAdapter - 网络适配器实例
   */
  constructor(networkAdapter) {
    this.network = networkAdapter;
    this.defaultDeepSeekUrl = 'https://api.deepseek.com/v1/chat/completions';
    this.defaultOpenAIUrl = 'https://api.openai.com/v1/chat/completions';
  }

  /**
   * 使用大语言模型将自然语言解析为任务对象
   * @param {string} text - 用户输入的自然语言文本
   * @param {string} apiKey - API 密钥
   * @param {string} provider - 服务提供商 ('deepseek' 或 'openai')
   * @param {string} customBaseUrl - 自定义的 Base URL (可选)
   * @returns {Promise<object>} 解析后的任务对象
   */
  async parseTaskFromText(text, apiKey, provider, customBaseUrl, configModel) {
    const baseUrl = customBaseUrl || (provider === 'openai' ? this.defaultOpenAIUrl : this.defaultDeepSeekUrl);
    // DeepSeek API is fully compatible with OpenAI's Chat Completion format
    const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const model = configModel || (provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat');

    // 1. 构建严格的本地 ISO 时间字符串，明确告知大模型当前时间
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const currentLocalTime = `${year}-${month}-${day}T${hours}:${minutes} (星期${weekDays[now.getDay()]})`;

    const systemPrompt = `你是一个专业的任务解析助手。请从用户的输入中提取待办任务的核心要素，并严格以JSON格式返回。
必须包含以下字段：
- "title": 任务的简短标题 (字符串)
- "due_date": 任务的截止时间 (如果提到)。请根据当前时间推理出具体的日期和时间，必须严格返回 "YYYY-MM-DDTHH:mm" 格式（不带秒）。当前时间是 ${currentLocalTime}。请注意：如果用户提到“后天截止”、“下周二”或“4月25日”等日期，请务必准确计算出该日期的具体时间（默认下午 18:00）。如果没有明确时间，返回 null。
- "priority": 优先级，必须是 "high", "medium" 或 "low"。默认为 "medium"。
- "tags": 标签数组 (字符串数组)，如 ["会议", "工作"]。
- "notes": 详细的备注信息，提炼用户的核心要点。

请不要输出任何 Markdown 标记（如 \`\`\`json），只输出纯 JSON 字符串。`;

    const body = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const response = await this.network.post(endpoint, headers, body);
    
    try {
      let content = response.choices[0].message.content.trim();
      // 容错：如果大模型仍然返回了 Markdown 的 ```json ... ```，将其清洗掉
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse LLM response as JSON:", response);
      throw new Error("模型返回的数据无法解析为JSON");
    }
  }

  /**
   * 使用视觉大模型将截图/图片解析为任务对象
   * @param {string} base64Image - 包含图片的 base64 数据
   * @param {string} apiKey - API 密钥
   * @param {string} provider - 服务提供商
   * @param {string} customBaseUrl - 自定义的 Base URL
   * @returns {Promise<object>} 解析后的任务对象
   */
  async parseTaskFromImage(base64Image, apiKey, provider, customBaseUrl, configModel) {
    const baseUrl = customBaseUrl || (provider === 'openai' ? this.defaultOpenAIUrl : this.defaultDeepSeekUrl);
    const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    let model = configModel || (provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat');
    
    if (provider === 'deepseek' && (!customBaseUrl || customBaseUrl.includes('api.deepseek.com'))) {
        throw new Error("DeepSeek 官方暂未开放视觉 API (deepseek-vl)。请在设置中切换为 OpenAI 或兼容视觉 API 的第三方平台，并填写对应的 API Key 与 Base URL。");
    }

    if (provider === 'deepseek' && customBaseUrl && !configModel) {
      model = 'gpt-4o'; // 尝试用通用的视觉模型名
    }

    const now = new Date();
    const currentLocalTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})`;

    const systemPrompt = `你是一个专业的任务解析助手。用户提供了一张聊天截图或其他包含任务信息的图片。请从中提取待办任务的核心要素，并严格以JSON格式返回。
必须包含以下字段：
- "title": 任务的简短标题 (字符串)
- "due_date": 任务的截止时间 (如果提到)。请根据当前时间推理出具体的日期和时间，必须严格返回 "YYYY-MM-DDTHH:mm" 格式（不带秒）。当前时间是 ${currentLocalTime}。请注意：如果图片里提到“后天截止”、“下周二”或“4月25日截止”，请务必结合当前时间准确计算出这天的具体日期和时间（默认下午 18:00）。如果没有明确时间，返回 null。
- "priority": 优先级，必须是 "high", "medium" 或 "low"。默认为 "medium"。
- "tags": 标签数组 (字符串数组)，如 ["会议", "工作"]。
- "notes": 详细的备注信息，提取图片中的关键对话和核心要点。

请不要输出任何 Markdown 标记（如 \`\`\`json），只输出纯 JSON 字符串。`;

    const body = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: "text", text: "请解析这张图片中的任务信息。" },
            { type: "image_url", image_url: { url: base64Image } }
          ]
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    let attemptResponse;
    try {
      attemptResponse = await this.network.post(endpoint, headers, body);
    } catch (e) {
      let errorMessage = e.message;
      try {
        const errObj = JSON.parse(e.message);
        if (errObj.error && errObj.error.message) {
          errorMessage = errObj.error.message;
        }
      } catch (parseErr) {}

      // 如果因为 response_format 报错（如某些模型不支持 json_object），则去掉该字段重试
      if (errorMessage.includes('response_format') || errorMessage.includes('json_object')) {
        console.warn("Model does not support response_format: json_object, retrying without it...");
        delete body.response_format;
        try {
          attemptResponse = await this.network.post(endpoint, headers, body);
        } catch (retryErr) {
          throw retryErr; // 若重试依然失败则抛出
        }
      } else {
        throw e; // 不是该错误则直接抛出
      }
    }

    try {
      let content = attemptResponse.choices[0].message.content.trim();
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse LLM response:", e);
      let errorMessage = e.message;
      try {
        const errObj = JSON.parse(e.message);
        if (errObj.error && errObj.error.message) {
          errorMessage = errObj.error.message;
        }
      } catch (parseErr) {
        // Not JSON
      }

      if (errorMessage.includes("unknown variant `image_url`") || errorMessage.includes("image_url")) {
         throw new Error("当前配置的大语言模型不支持图片解析 (Vision) 功能。请在设置中切换为支持视觉识别的模型（如 gpt-4o）。");
      }
      if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("invalid api key") || errorMessage.includes("invalid_api_key")) {
         throw new Error("API Key 无效或无权限访问该模型，请检查配置。");
      }
      throw new Error(`AI 解析失败: ${errorMessage}`);
    }
  }
}

window.aiService = new AIService(window.networkAdapter);
