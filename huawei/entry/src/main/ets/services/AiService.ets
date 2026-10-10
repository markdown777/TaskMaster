/**
 * AI 服务
 * 移植 services/ai.js
 * - 自然语言解析建任务
 * - 图片截图解析建任务（Vision）
 * - 端点拼接、模型选择、JSON 清洗容错、response_format 重试
 */
import { networkAdapter } from '../adapters/NetworkAdapter';
import { AI_ENDPOINTS, AI_DEFAULT_MODELS } from '../constants/Constants';

/** AI 解析后的任务对象 */
export interface ParsedTask {
  title: string;
  due_date: string | null;
  priority: string;
  tags: string[];
  notes: string;
}

/**
 * AI 服务单例
 */
export class AiService {
  private static instance: AiService | null = null;

  private constructor() {}

  static getInstance(): AiService {
    if (!AiService.instance) {
      AiService.instance = new AiService();
    }
    return AiService.instance;
  }

  /**
   * 构造本地时间字符串，注入到提示词中
   */
  private currentLocalTime(): string {
    const now = new Date();
    const pad = (n: number): string => n < 10 ? `0${n}` : `${n}`;
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())} (星期${weekDays[now.getDay()]})`;
  }

  /**
   * 规范化 endpoint：确保以 /chat/completions 结尾
   */
  private buildEndpoint(baseUrl: string, provider: string): string {
    const base = baseUrl || (provider === 'openai' ? AI_ENDPOINTS.OPENAI : AI_ENDPOINTS.DEEPSEEK);
    if (base.endsWith('/chat/completions')) return base;
    return `${base.replace(/\/$/, '')}/chat/completions`;
  }

  /**
   * 清洗模型返回内容（去除 Markdown 包裹）
   */
  private cleanContent(content: string): string {
    let c = content.trim();
    if (c.startsWith('```')) {
      c = c.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }
    return c;
  }

  /**
   * 文本解析为任务
   */
  async parseTaskFromText(
    text: string,
    apiKey: string,
    provider: string,
    customBaseUrl: string,
    configModel?: string
  ): Promise<ParsedTask> {
    const endpoint = this.buildEndpoint(customBaseUrl, provider);
    const model = configModel || (provider === 'openai' ? AI_DEFAULT_MODELS.openai : AI_DEFAULT_MODELS.deepseek);

    const systemPrompt = `你是一个专业的任务解析助手。请从用户的输入中提取待办任务的核心要素，并严格以JSON格式返回。
必须包含以下字段：
- "title": 任务的简短标题 (字符串)
- "due_date": 任务的截止时间 (如果提到)。请根据当前时间推理出具体的日期和时间，必须严格返回 "YYYY-MM-DDTHH:mm" 格式（不带秒）。当前时间是 ${this.currentLocalTime()}。请注意：如果用户提到"后天截止"、"下周二"或"4月25日"等日期，请务必准确计算出该日期的具体时间（默认下午 18:00）。如果没有明确时间，返回 null。
- "priority": 优先级，必须是 "high", "medium" 或 "low"。默认为 "medium"。
- "tags": 标签数组 (字符串数组)，如 ["会议", "工作"]。
- "notes": 详细的备注信息，提炼用户的核心要点。

请不要输出任何 Markdown 标记（如 \`\`\`json），只输出纯 JSON 字符串。`;

    const body: Record<string, Object> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const response = await networkAdapter.post(endpoint, headers, body) as Record<string, Object>;
    return this.parseResponse(response);
  }

  /**
   * 图片解析为任务
   */
  async parseTaskFromImage(
    base64Image: string,
    apiKey: string,
    provider: string,
    customBaseUrl: string,
    configModel?: string
  ): Promise<ParsedTask> {
    const endpoint = this.buildEndpoint(customBaseUrl, provider);
    let model = configModel || (provider === 'openai' ? AI_DEFAULT_MODELS.openai : AI_DEFAULT_MODELS.deepseek);

    // DeepSeek 官方不支持视觉 API
    if (provider === 'deepseek' && (!customBaseUrl || customBaseUrl.includes('api.deepseek.com'))) {
      throw new Error('DeepSeek 官方暂未开放视觉 API (deepseek-vl)。请在设置中切换为 OpenAI 或兼容视觉 API 的第三方平台，并填写对应的 API Key 与 Base URL。');
    }
    if (provider === 'deepseek' && customBaseUrl && !configModel) {
      model = AI_DEFAULT_MODELS.visionFallback;
    }

    const systemPrompt = `你是一个专业的任务解析助手。用户提供了一张聊天截图或其他包含任务信息的图片。请从中提取待办任务的核心要素，并严格以JSON格式返回。
必须包含以下字段：
- "title": 任务的简短标题 (字符串)
- "due_date": 任务的截止时间 (如果提到)。请根据当前时间推理出具体的日期和时间，必须严格返回 "YYYY-MM-DDTHH:mm" 格式（不带秒）。当前时间是 ${this.currentLocalTime()}。请注意：如果图片里提到"后天截止"、"下周二"或"4月25日截止"，请务必结合当前时间准确计算出这天的具体日期和时间（默认下午 18:00）。如果没有明确时间，返回 null。
- "priority": 优先级，必须是 "high", "medium" 或 "low"。默认为 "medium"。
- "tags": 标签数组 (字符串数组)，如 ["会议", "工作"]。
- "notes": 详细的备注信息，提取图片中的关键对话和核心要点。

请不要输出任何 Markdown 标记（如 \`\`\`json），只输出纯 JSON 字符串。`;

    const body: Record<string, Object> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请解析这张图片中的任务信息。' },
            { type: 'image_url', image_url: { url: base64Image } }
          ]
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    let response: Record<string, Object>;
    try {
      response = await networkAdapter.post(endpoint, headers, body) as Record<string, Object>;
    } catch (e) {
      const errorMessage = (e as Error).message;
      // 如果因 response_format 报错，去掉该字段重试
      if (errorMessage.includes('response_format') || errorMessage.includes('json_object')) {
        delete body['response_format'];
        response = await networkAdapter.post(endpoint, headers, body) as Record<string, Object>;
      } else {
        throw e;
      }
    }

    try {
      return this.parseResponse(response);
    } catch (e) {
      const errorMessage = (e as Error).message;
      if (errorMessage.includes('image_url')) {
        throw new Error('当前配置的大语言模型不支持图片解析 (Vision) 功能。请在设置中切换为支持视觉识别的模型（如 gpt-4o）。');
      }
      if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('invalid api key') || errorMessage.includes('invalid_api_key')) {
        throw new Error('API Key 无效或无权限访问该模型，请检查配置。');
      }
      throw new Error(`AI 解析失败: ${errorMessage}`);
    }
  }

  /**
   * 解析 LLM 响应为 ParsedTask
   */
  private parseResponse(response: Record<string, Object>): ParsedTask {
    try {
      const choices = response['choices'] as Object[];
      const firstChoice = choices[0] as Record<string, Object>;
      const message = firstChoice['message'] as Record<string, Object>;
      const content = this.cleanContent(String(message['content']));
      const parsed = JSON.parse(content) as Record<string, Object>;
      const tagsRaw = parsed['tags'];
      let tags: string[] = [];
      if (tagsRaw instanceof Array) {
        tags = tagsRaw.map((t: Object) => String(t));
      }
      return {
        title: parsed['title'] ? String(parsed['title']) : '',
        due_date: parsed['due_date'] != null ? String(parsed['due_date']) : null,
        priority: parsed['priority'] ? String(parsed['priority']) : 'medium',
        tags,
        notes: parsed['notes'] ? String(parsed['notes']) : ''
      };
    } catch (e) {
      console.error(`解析 LLM 响应失败: ${(e as Error).message}`);
      throw new Error('模型返回的数据无法解析为JSON');
    }
  }
}

/** 全局便捷访问 */
export const aiService: AiService = AiService.getInstance();
