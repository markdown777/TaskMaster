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
  async parseTaskFromText(text, apiKey, provider, customBaseUrl) {
    const baseUrl = customBaseUrl || (provider === 'openai' ? this.defaultOpenAIUrl : this.defaultDeepSeekUrl);
    // DeepSeek API is fully compatible with OpenAI's Chat Completion format
    const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const model = provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat';

    const systemPrompt = `你是一个专业的任务解析助手。请从用户的输入中提取待办任务的核心要素，并严格以JSON格式返回。
必须包含以下字段：
- "title": 任务的简短标题 (字符串)
- "due_date": 任务的截止时间 (如果提到)，格式必须是 "YYYY-MM-DD HH:mm:ss"。当前时间是 ${new Date().toLocaleString('zh-CN')}。如果没有明确时间，返回 null。
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
      const content = response.choices[0].message.content.trim();
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse LLM response as JSON:", response);
      throw new Error("模型返回的数据无法解析为JSON");
    }
  }
}

window.aiService = new AIService(window.networkAdapter);
