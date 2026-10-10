/**
 * 设置页
 * 对齐 options.html / options.js：
 * - 安全（启用加密 + 密钥≥8位）
 * - AI 助理（提供商/BaseUrl/Key/PIN 加密）
 * - Vision 图片识别（提供商/BaseUrl/Model/Key + cURL 解析）
 * - 显示 / 行为（含保留天数）/ 通知
 * - 数据管理（导出/导入/查看备份/清空）
 */
import { AppViewModel } from '../viewmodel/AppViewModel';
import { TaskManager } from '../services/TaskManager';
import { BackupManager, BackupEntry } from '../services/BackupManager';
import { storageAdapter } from '../adapters/StorageAdapter';
import { STORAGE_KEYS, DEFAULT_SETTINGS, AppSettings } from '../constants/Constants';
import { router, promptAction } from '@kit.ArkUI';
import { fileIo } from '@kit.CoreFileKit';
import { common } from '@kit.AbilityKit';

@Entry
@Component
struct Settings {
  @State vm: AppViewModel = AppViewModel.getInstance();
  // 表单本地状态
  @State enableEncryption: boolean = false;
  @State encryptionKey: string = '';
  @State showCompletedTasks: boolean = true;
  @State autoExpandToday: boolean = true;
  @State showTaskStats: boolean = true;
  @State confirmDelete: boolean = true;
  @State autoSaveNotes: boolean = true;
  @State taskRetentionDays: number = 90;
  @State enableNotifications: boolean = true;
  @State soundNotifications: boolean = false;

  // AI 助理表单
  @State aiProvider: string = 'deepseek';
  @State aiBaseUrl: string = '';
  @State aiApiKey: string = '';
  @State aiEnableEncryption: boolean = false;
  @State aiPinCode: string = '';

  // Vision 表单
  @State visionProvider: string = 'off';
  @State visionBaseUrl: string = '';
  @State visionModel: string = '';
  @State visionApiKey: string = '';
  @State visionEnableEncryption: boolean = false;
  @State visionCurlInput: string = '';

  @State backups: BackupEntry[] = [];
  @State dataStats: string = '';

  aboutToAppear(): void {
    this.loadForm();
  }

  build() {
    Column() {
      // Header
      Row({ space: 12 }) {
        Text('‹')
          .fontSize(22)
          .fontColor($r('app.color.text_primary'))
          .onClick(() => router.back())
        Text('设置')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.text_primary'))
          .layoutWeight(1)
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 16, bottom: 12 })

      Scroll() {
        Column({ space: 32 }) {
          // 安全
          this.SecuritySection()
          // AI 助理
          this.AiSection()
          // Vision
          this.VisionSection()
          // 显示
          this.DisplaySection()
          // 行为
          this.BehaviorSection()
          // 通知
          this.NotificationSection()
          // 数据管理
          this.DataSection()

          // 保存/重置按钮
          Row({ space: 16 }) {
            Button('保存设置')
              .fontSize(14)
              .fontColor($r('app.color.bg_primary'))
              .backgroundColor($r('app.color.brand_color'))
              .borderRadius(8)
              .layoutWeight(1)
              .onClick(() => this.saveAll())
            Button('恢复默认')
              .fontSize(14)
              .fontColor($r('app.color.text_secondary'))
              .backgroundColor(Color.Transparent)
              .layoutWeight(1)
              .onClick(() => this.resetDefaults())
          }
          .width('100%')
          .padding({ top: 16, bottom: 40 })
        }
        .width('100%')
        .padding({ left: 20, right: 20 })
      }
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('app.color.bg_primary'))
  }

  @Builder
  SectionTitle(title: string) {
    Text(title)
      .fontSize(13)
      .fontWeight(FontWeight.Bold)
      .fontColor($r('app.color.text_secondary'))
      .padding({ left: 8, right: 8, top: 4, bottom: 4 })
      .backgroundColor($r('app.color.bg_secondary'))
      .borderRadius(4)
      .margin({ bottom: 16 })
  }

  @Builder
  SecuritySection() {
    Column({ space: 16 }) {
      this.SectionTitle('安全')
      Row({ space: 12 }) {
        Checkbox()
          .select(this.enableEncryption)
          .selectedColor($r('app.color.brand_color'))
          .onChange((v: boolean) => this.enableEncryption = v)
        Column({ space: 2 }) {
          Text('启用加密').fontSize(15).fontWeight(FontWeight.Medium)
          Text('加密存储任务数据，提高本地数据安全性').fontSize(12).fontColor($r('app.color.text_secondary'))
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      }
      if (this.enableEncryption) {
        TextInput({ placeholder: '请输入至少8位密钥', text: this.encryptionKey })
          .type(InputType.Password)
          .fontSize(14)
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(8)
          .padding(12)
          .onChange((v: string) => this.encryptionKey = v)
        Text('请妥善保管密钥，忘记密钥将无法恢复数据。')
          .fontSize(11)
          .fontColor($r('app.color.danger'))
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  @Builder
  AiSection() {
    Column({ space: 16 }) {
      this.SectionTitle('✨ AI 助理配置')
      Text('配置大语言模型接口，启用智能自然语言解析与截图任务提取功能。')
        .fontSize(12).fontColor($r('app.color.text_secondary'))

      Row({ space: 12 }) {
        Checkbox()
          .select(this.aiEnableEncryption)
          .selectedColor($r('app.color.brand_color'))
          .onChange((v: boolean) => this.aiEnableEncryption = v)
        Column({ space: 2 }) {
          Text('启用 API 安全加密').fontSize(15).fontWeight(FontWeight.Medium)
          Text('使用 PIN 码对 API Key 进行 AES-256 加密').fontSize(12).fontColor($r('app.color.text_secondary'))
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      }

      // 提供商
      Column({ space: 4 }) {
        Text('模型提供商').fontSize(13).fontWeight(FontWeight.Medium)
        Select([
          { value: 'DeepSeek (默认，推荐)' },
          { value: 'OpenAI (兼容格式)' }
        ])
          .selected(this.aiProvider === 'openai' ? 1 : 0)
          .value(this.aiProvider === 'openai' ? 'OpenAI' : 'DeepSeek')
          .font({ size: 13 })
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(8)
          .onSelect((i: number) => this.aiProvider = i === 1 ? 'openai' : 'deepseek')
      }.width('100%').alignItems(HorizontalAlign.Start)

      if (this.aiProvider === 'openai') {
        Column({ space: 4 }) {
          Text('自定义接口地址 (Base URL)').fontSize(13).fontWeight(FontWeight.Medium)
          TextInput({ placeholder: '例如: https://api.deepseek.com/v1', text: this.aiBaseUrl })
            .fontSize(13)
            .backgroundColor($r('app.color.bg_secondary'))
            .borderRadius(8)
            .padding(12)
            .onChange((v: string) => this.aiBaseUrl = v)
        }.width('100%').alignItems(HorizontalAlign.Start)
      }

      Column({ space: 4 }) {
        Text('API Key').fontSize(13).fontWeight(FontWeight.Medium)
        TextInput({ placeholder: '输入您的 API Key', text: this.aiApiKey })
          .type(InputType.Password)
          .fontSize(13)
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(8)
          .padding(12)
          .onChange((v: string) => this.aiApiKey = v)
      }.width('100%').alignItems(HorizontalAlign.Start)

      if (this.aiEnableEncryption) {
        Column({ space: 4 }) {
          Text('安全加密 PIN 码').fontSize(13).fontWeight(FontWeight.Medium)
          TextInput({ placeholder: '设置4位数PIN码', text: this.aiPinCode })
            .type(InputType.Number)
            .maxLength(4)
            .fontSize(13)
            .backgroundColor($r('app.color.bg_secondary'))
            .borderRadius(8)
            .padding(12)
            .onChange((v: string) => this.aiPinCode = v)
        }.width('100%').alignItems(HorizontalAlign.Start)
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  @Builder
  VisionSection() {
    Column({ space: 16 }) {
      this.SectionTitle('🖼️ 图片识别 (Vision/OCR) 配置')
      Text('独立配置图片解析大模型，支持聊天截图一键提取为任务。')
        .fontSize(12).fontColor($r('app.color.text_secondary'))

      Column({ space: 4 }) {
        Text('模型提供商').fontSize(13).fontWeight(FontWeight.Medium)
        Select([
          { value: '关闭 (默认)' },
          { value: 'Doubao / 火山方舟' },
          { value: 'OpenAI (或兼容接口)' }
        ])
          .selected(this.visionProvider === 'doubao' ? 1 : (this.visionProvider === 'openai' ? 2 : 0))
          .value(this.visionProvider === 'doubao' ? 'Doubao' : (this.visionProvider === 'openai' ? 'OpenAI' : '关闭'))
          .font({ size: 13 })
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(8)
          .onSelect((i: number) => {
            this.visionProvider = i === 1 ? 'doubao' : (i === 2 ? 'openai' : 'off');
            if (this.visionProvider === 'doubao' && !this.visionBaseUrl) {
              this.visionBaseUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
            }
          })
      }.width('100%').alignItems(HorizontalAlign.Start)

      if (this.visionProvider !== 'off') {
        Column({ space: 4 }) {
          Text('接口地址 (Base URL)').fontSize(13).fontWeight(FontWeight.Medium)
          TextInput({ text: this.visionBaseUrl })
            .fontSize(13)
            .backgroundColor($r('app.color.bg_secondary'))
            .borderRadius(8)
            .padding(12)
            .onChange((v: string) => this.visionBaseUrl = v)
        }.width('100%').alignItems(HorizontalAlign.Start)

        Column({ space: 4 }) {
          Text('模型 ID (Model)').fontSize(13).fontWeight(FontWeight.Medium)
          TextInput({ text: this.visionModel })
            .fontSize(13)
            .backgroundColor($r('app.color.bg_secondary'))
            .borderRadius(8)
            .padding(12)
            .onChange((v: string) => this.visionModel = v)
        }.width('100%').alignItems(HorizontalAlign.Start)

        Column({ space: 4 }) {
          Text('API Key').fontSize(13).fontWeight(FontWeight.Medium)
          TextInput({ text: this.visionApiKey })
            .type(InputType.Password)
            .fontSize(13)
            .backgroundColor($r('app.color.bg_secondary'))
            .borderRadius(8)
            .padding(12)
            .onChange((v: string) => this.visionApiKey = v)
        }.width('100%').alignItems(HorizontalAlign.Start)

        Row({ space: 12 }) {
          Checkbox()
            .select(this.visionEnableEncryption)
            .selectedColor($r('app.color.brand_color'))
            .onChange((v: boolean) => this.visionEnableEncryption = v)
          Column({ space: 2 }) {
            Text('复用 API 安全加密').fontSize(15).fontWeight(FontWeight.Medium)
            Text('与上方 AI 助理共用 PIN 码').fontSize(12).fontColor($r('app.color.text_secondary'))
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        }

        if (this.visionProvider === 'doubao') {
          Column({ space: 4 }) {
            Text('Doubao API 快捷接入 (粘贴 cURL)').fontSize(13).fontWeight(FontWeight.Medium)
            TextArea({ text: this.visionCurlInput })
              .fontSize(11)
              .backgroundColor($r('app.color.bg_secondary'))
              .borderRadius(8)
              .padding(12)
              .height(80)
              .onChange((v: string) => this.visionCurlInput = v)
            Button('解析并填充')
              .fontSize(12)
              .backgroundColor($r('app.color.bg_primary'))
              .fontColor($r('app.color.text_primary'))
              .border({ width: 0.5, color: $r('app.color.border_light') })
              .borderRadius(6)
              .margin({ top: 8 })
              .onClick(() => this.parseCurl())
          }.width('100%').alignItems(HorizontalAlign.Start)
        }
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  @Builder
  DisplaySection() {
    Column({ space: 16 }) {
      this.SectionTitle('显示')
      SettingCheckbox({ label: '显示已完成任务', desc: '在主列表中保留已完成内容', checked: this.showCompletedTasks, onChange: (v: boolean) => this.showCompletedTasks = v })
      SettingCheckbox({ label: '自动展开今天', desc: '启动时自动展开今天的任务', checked: this.autoExpandToday, onChange: (v: boolean) => this.autoExpandToday = v })
      SettingCheckbox({ label: '显示统计信息', desc: '在搜索结果中显示任务统计', checked: this.showTaskStats, onChange: (v: boolean) => this.showTaskStats = v })
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  @Builder
  BehaviorSection() {
    Column({ space: 16 }) {
      this.SectionTitle('行为')
      SettingCheckbox({ label: '删除前确认', desc: '删除任务前弹出确认提示', checked: this.confirmDelete, onChange: (v: boolean) => this.confirmDelete = v })
      SettingCheckbox({ label: '自动保存备注', desc: '离开备注输入区域时自动保存', checked: this.autoSaveNotes, onChange: (v: boolean) => this.autoSaveNotes = v })
      Column({ space: 4 }) {
        Text('已完成任务保留时间').fontSize(13).fontWeight(FontWeight.Medium)
        Select([
          { value: '30天' }, { value: '90天' }, { value: '180天' }, { value: '1年' }, { value: '永久保留' }
        ])
          .selected(this.taskRetentionDays === 30 ? 0 : (this.taskRetentionDays === 90 ? 1 : (this.taskRetentionDays === 180 ? 2 : (this.taskRetentionDays === 365 ? 3 : 4))))
          .value(`${this.taskRetentionDays === 0 ? '永久' : this.taskRetentionDays + '天'}`)
          .font({ size: 13 })
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(8)
          .onSelect((i: number) => {
            this.taskRetentionDays = i === 0 ? 30 : (i === 1 ? 90 : (i === 2 ? 180 : (i === 3 ? 365 : 0)));
          })
      }.width('100%').alignItems(HorizontalAlign.Start)
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  @Builder
  NotificationSection() {
    Column({ space: 16 }) {
      this.SectionTitle('通知')
      SettingCheckbox({ label: '启用通知提醒', desc: '到期任务显示通知', checked: this.enableNotifications, onChange: (v: boolean) => this.enableNotifications = v })
      SettingCheckbox({ label: '声音提醒', desc: '通知出现时播放提示音', checked: this.soundNotifications, onChange: (v: boolean) => this.soundNotifications = v })
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  @Builder
  DataSection() {
    Column({ space: 16 }) {
      this.SectionTitle('数据管理')
      Text('更换设备或重装应用前，建议先导出备份。')
        .fontSize(12).fontColor($r('app.color.text_secondary'))

      Flex({ wrap: FlexWrap.Wrap, spaceBasisLength: 12 }) {
        Button('导出数据')
          .fontSize(12)
          .backgroundColor($r('app.color.bg_secondary'))
          .fontColor($r('app.color.text_primary'))
          .borderRadius(6)
          .margin({ right: 12, bottom: 12 })
          .onClick(() => this.exportData())
        Button('导入数据')
          .fontSize(12)
          .backgroundColor($r('app.color.bg_secondary'))
          .fontColor($r('app.color.text_primary'))
          .borderRadius(6)
          .margin({ right: 12, bottom: 12 })
          .onClick(() => this.importData())
        Button('查看自动备份')
          .fontSize(12)
          .backgroundColor($r('app.color.bg_secondary'))
          .fontColor($r('app.color.text_primary'))
          .borderRadius(6)
          .margin({ right: 12, bottom: 12 })
          .onClick(() => this.showBackups())
        Button('清空所有数据')
          .fontSize(12)
          .backgroundColor($r('app.color.bg_secondary'))
          .fontColor($r('app.color.danger'))
          .borderRadius(6)
          .margin({ right: 12, bottom: 12 })
          .onClick(() => this.clearAllData())
      }.width('100%')

      if (this.dataStats) {
        Text(this.dataStats)
          .fontSize(11)
          .fontColor($r('app.color.text_secondary'))
          .fontFamily('HarmonyOS Sans Mono')
          .padding(16)
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(8)
          .width('100%')
      }

      // 备份列表
      if (this.backups.length > 0) {
        Column({ space: 8 }) {
          ForEach(this.backups, (b: BackupEntry) => {
            Row({ space: 8 }) {
              Column({ space: 2 }) {
                Text(`备份：${b.dateStr}`).fontSize(12).fontWeight(FontWeight.Medium)
                Text(`${b.taskCount} 条任务 · ${b.backupTime}`).fontSize(10).fontColor($r('app.color.text_secondary'))
              }.alignItems(HorizontalAlign.Start).layoutWeight(1)
              Button('恢复')
                .fontSize(11)
                .backgroundColor($r('app.color.bg_primary'))
                .fontColor($r('app.color.text_primary'))
                .border({ width: 0.5, color: $r('app.color.border_light') })
                .borderRadius(6)
                .onClick(() => this.restoreBackup(b.key))
            }
            .width('100%')
            .padding(12)
            .backgroundColor($r('app.color.bg_secondary'))
            .borderRadius(8)
          }, (b: BackupEntry) => b.key)
        }.width('100%')
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  // ============ 表单加载与保存 ============

  private loadForm(): void {
    const s = this.vm.settings;
    this.enableEncryption = s.enableEncryption;
    this.encryptionKey = s.encryptionKey;
    this.showCompletedTasks = s.showCompletedTasks;
    this.autoExpandToday = s.autoExpandToday;
    this.showTaskStats = s.showTaskStats;
    this.confirmDelete = s.confirmDelete;
    this.autoSaveNotes = s.autoSaveNotes;
    this.taskRetentionDays = s.taskRetentionDays;
    this.enableNotifications = s.enableNotifications;
    this.soundNotifications = s.soundNotifications;

    this.aiProvider = this.vm.aiConfig.provider;
    this.aiBaseUrl = this.vm.aiConfig.baseUrl;
    this.aiEnableEncryption = this.vm.aiConfig.enableEncryption;
    this.visionProvider = this.vm.visionConfig.provider;
    this.visionBaseUrl = this.vm.visionConfig.baseUrl;
    this.visionModel = this.vm.visionConfig.model;
    this.visionEnableEncryption = this.vm.visionConfig.enableEncryption;

    this.updateDataStats();
  }

  private async saveAll(): Promise<void> {
    try {
      // 保存 AI 配置
      await this.vm.saveAiConfig(
        this.aiProvider, this.aiBaseUrl, this.aiEnableEncryption, this.aiApiKey, this.aiPinCode
      );
      // 保存 Vision 配置
      await this.vm.saveVisionConfig(
        this.visionProvider, this.visionBaseUrl, this.visionModel,
        this.visionEnableEncryption, this.visionApiKey, this.aiPinCode
      );
      // 保存基础设置
      const settings: AppSettings = {
        enableEncryption: this.enableEncryption,
        encryptionKey: this.encryptionKey,
        showCompletedTasks: this.showCompletedTasks,
        autoExpandToday: this.autoExpandToday,
        showTaskStats: this.showTaskStats,
        confirmDelete: this.confirmDelete,
        autoSaveNotes: this.autoSaveNotes,
        taskRetentionDays: this.taskRetentionDays,
        enableNotifications: this.enableNotifications,
        soundNotifications: this.soundNotifications
      };
      await this.vm.saveSettings(settings);
      promptAction.showToast({ message: '设置保存成功！' });
    } catch (e) {
      promptAction.showToast({ message: (e as Error).message });
    }
  }

  private async resetDefaults(): Promise<void> {
    promptAction.showDialog({
      title: '重置设置',
      message: '确定要重置所有设置为默认值吗？此操作无法撤销。',
      buttons: [
        { text: '取消', color: '#888888' },
        { text: '确定', color: '#111111' }
      ]
    }).then(async (result) => {
      if (result.index === 1) {
        await storageAdapter.set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS as unknown as Object);
        this.vm.settings = { ...DEFAULT_SETTINGS };
        this.loadForm();
        promptAction.showToast({ message: '设置已重置为默认值' });
      }
    });
  }

  // ============ cURL 解析 ============

  private parseCurl(): void {
    if (!this.visionCurlInput) return;
    const urlMatch = this.visionCurlInput.match(/curl\s+(?:\\?[`'"])?(https?:\/\/[^\s`'"\\]+)/i);
    const tokenMatch = this.visionCurlInput.match(/Authorization:\s*Bearer\s+([^"\s\\]+)/i);
    const modelMatch = this.visionCurlInput.match(/"model"\s*:\s*"([^"]+)"/i);
    if (urlMatch) this.visionBaseUrl = urlMatch[1];
    if (modelMatch) this.visionModel = modelMatch[1];
    if (tokenMatch) this.visionApiKey = tokenMatch[1];
    promptAction.showToast({ message: '已解析并填充 curl 配置，请点击保存设置！' });
  }

  // ============ 数据管理 ============

  private updateDataStats(): void {
    const tasks = this.vm.tasks;
    const total = tasks.length;
    const active = tasks.filter(t => !t.completed).length;
    const completed = tasks.filter(t => t.completed).length;
    const withNotes = tasks.filter(t => t.notes && t.notes.trim()).length;
    const sizeKb = Math.round(JSON.stringify(tasks).length / 1024);
    this.dataStats = `总计：${total} 条\n活动：${active} 条\n已完成：${completed} 条\n含备注：${withNotes} 条\n存储占用：约 ${sizeKb} KB`;
  }

  private async exportData(): Promise<void> {
    try {
      if (this.vm.tasks.length === 0) {
        promptAction.showToast({ message: '没有任务数据可导出' });
        return;
      }
      const payload = {
        tasks: this.vm.tasks,
        exportDate: new Date().toISOString(),
        version: '3.0.0'
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `taskmaster-backup-${dateStr}.json`;

      const context = getContext(this) as common.UIAbilityContext;
      const filesDir = context.filesDir;
      const filePath = `${filesDir}/${fileName}`;
      const file = fileIo.openSync(filePath, fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE);
      fileIo.writeSync(file.fd, jsonStr);
      fileIo.closeSync(file);

      promptAction.showToast({ message: `成功导出 ${this.vm.tasks.length} 条任务（已保存到应用沙盒）` });
    } catch (e) {
      promptAction.showToast({ message: `导出失败: ${(e as Error).message}` });
    }
  }

  private async importData(): Promise<void> {
    // 简化：通过提示用户将文件放入应用沙盒后点击恢复；完整文件选择需 photoAccessHelper / picker
    promptAction.showToast({ message: '请将备份 JSON 放入应用 filesDir 后使用"查看自动备份"恢复' });
  }

  private async showBackups(): Promise<void> {
    this.backups = await BackupManager.getInstance().listBackups();
    if (this.backups.length === 0) {
      promptAction.showToast({ message: '没有找到自动备份的数据' });
    }
  }

  private async restoreBackup(key: string): Promise<void> {
    promptAction.showDialog({
      title: '恢复备份',
      message: `确定要使用 ${key} 的数据覆盖当前任务吗？`,
      buttons: [
        { text: '取消', color: '#888888' },
        { text: '确定', color: '#111111' }
      ]
    }).then(async (result) => {
      if (result.index === 1) {
        try {
          const tasks = await BackupManager.getInstance().restoreFromBackup(key);
          await this.vm.refreshTasks();
          this.updateDataStats();
          promptAction.showToast({ message: '数据已成功恢复！' });
        } catch (e) {
          promptAction.showToast({ message: `恢复失败: ${(e as Error).message}` });
        }
      }
    });
  }

  private async clearAllData(): Promise<void> {
    promptAction.showDialog({
      title: '清空数据',
      message: '警告：此操作将删除所有任务数据，无法撤销！\n\n确定要继续吗？',
      buttons: [
        { text: '取消', color: '#888888' },
        { text: '确定清空', color: '#FF4444' }
      ]
    }).then(async (result) => {
      if (result.index === 1) {
        await TaskManager.getInstance().clearAll();
        await this.vm.refreshTasks();
        this.updateDataStats();
        promptAction.showToast({ message: '所有数据已清空' });
      }
    });
  }
}

/**
 * 设置项复选框子组件
 */
@Component
struct SettingCheckbox {
  @Prop label: string;
  @Prop desc: string;
  @Prop checked: boolean;
  onChange: (checked: boolean) => void = () => {};

  build() {
    Row({ space: 12 }) {
      Checkbox()
        .select(this.checked)
        .selectedColor($r('app.color.brand_color'))
        .onChange((v: boolean) => this.onChange(v))
      Column({ space: 2 }) {
        Text(this.label).fontSize(15).fontWeight(FontWeight.Medium)
        Text(this.desc).fontSize(12).fontColor($r('app.color.text_secondary'))
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
    }.width('100%')
  }
}
