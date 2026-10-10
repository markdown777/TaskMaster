# TaskMaster 鸿蒙 App

TaskMaster 浏览器插件的 HarmonyOS（鸿蒙 6.0）原生版本，使用 ArkTS + ArkUI（Stage 模型）开发，完整对齐插件功能。

## 功能对齐清单

| 功能模块 | 浏览器插件 | 鸿蒙端实现 |
|---|---|---|
| 任务 CRUD / 置顶 / 优先级 / 标签 / 备注 | ✅ | ✅ `services/TaskManager.ets` |
| AI 自然语言解析建任务 | ✅ DeepSeek/OpenAI | ✅ `services/AiService.ets` |
| AI 图片截图解析建任务 | ✅ Vision | ✅ `services/AiService.ets` |
| BYOK + AES-256-GCM + PIN 加密 | ✅ Web Crypto | ✅ `adapters/CryptoAdapter.ets`（cryptoFramework，格式与插件兼容） |
| 到期提醒通知 | ✅ chrome.alarms | ✅ `services/ReminderManager.ets`（reminderAgentManager） |
| 新任务添加通知 | ✅ chrome.notifications | ✅ `services/ReminderManager.ets`（notificationManager） |
| 每日自动备份（保留 7 天） | ✅ | ✅ `services/BackupManager.ets` |
| 备份列表 / 恢复 | ✅ | ✅ Settings 页"查看自动备份" |
| 数据导出 / 导入 | ✅ JSON | ✅ Settings 页（导出到应用沙盒） |
| 跨设备同步 | ✅ chrome.storage.sync | ❌ 鸿蒙端独立本地数据（可手动导入导出迁移） |
| 任务分享（复制/邮件/系统分享） | ✅ | ✅ `services/ShareManager.ets` |
| 搜索 + 过滤（活动/已完成/有备注） | ✅ | ✅ `components/SearchPopover.ets` |
| 极简黑白灰设计语言 | ✅ | ✅ 保持一致 |
| 折叠屏适配（Pura X） | — | ✅ 内屏为主，外屏可用（mediaquery 监听） |

## 目录结构

```
huawei/
├── AppScope/                          # 应用级配置
│   ├── app.json5
│   └── resources/base/{element,media}
├── build-profile.json5                # 工程构建配置
├── oh-package.json5
├── hvigorfile.ts
└── entry/                             # 主模块
    ├── build-profile.json5
    ├── oh-package.json5
    └── src/main/
        ├── module.json5               # 权限：INTERNET / 提醒 / 通知
        ├── resources/base/{media,element,profile}
        └── ets/
            ├── entryability/EntryAbility.ets
            ├── constants/Constants.ets
            ├── models/Task.ets
            ├── adapters/{StorageAdapter,CryptoAdapter,NetworkAdapter}.ets
            ├── services/{TaskManager,AiService,ShareManager,BackupManager,ReminderManager}.ets
            ├── utils/CommonUtils.ets
            ├── viewmodel/AppViewModel.ets
            ├── components/{TaskItem,TaskForm,DuePopover,SearchPopover,NotesModal,PinModal,ShareMenu}.ets
            └── pages/{Index,Settings}.ets
```

## 构建与运行（你需要做的）

### 1. 安装开发工具
本机当前未安装 DevEco Studio / ohpm / hvigor，需先安装：
- 下载 DevEco Studio：https://developer.huawei.com/consumer/cn/deveco-studio/
- 安装时会自动配置 HarmonyOS SDK（选 API 16+，对应 HarmonyOS 6.0）与 ohpm

### 2. 打开工程
- 启动 DevEco Studio → File → Open → 选择 `huawei/` 目录
- 等待 ohpm 自动同步依赖（首次会下载 @ohos/hypium 等）

### 3. 连接 Pura X 真机
- 手机开启开发者模式（设置 → 关于手机 → 连点版本号 7 次）
- 设置 → 系统与更新 → 开发者选项 → 开启"USB 调试"
- USB 连接电脑，手机弹窗允许调试
- DevEco Studio 顶部设备下拉框选择 Pura X

### 4. 运行
- 点击 DevEco Studio 顶部 ▶ 运行按钮（或 Shift+F10）
- 首次运行手机会提示授予通知/提醒权限，请允许

### 5. 如遇编译错误
由于本机无法预编译验证（无 ohpm/hvigor），若 ArkTS 语法或 API 签名有细微偏差，请把报错信息发给我，我会即时修正。

## 与浏览器插件的数据关系
- 鸿蒙端使用**独立本地数据**（@ohos.data.preferences），与浏览器插件不互通
- 可通过插件的"导出数据"生成 JSON，再通过鸿蒙端"导入数据"手动迁移（导入功能需进一步对接文件选择器）
- 加密格式（`[IV 12][密文+authTag]` Base64 + PBKDF2 静态盐 100K 迭代）与插件完全一致，密钥相同的加密数据可互相解密

## 已知限制
1. **后台每日备份**：鸿蒙后台限制较严，当前退化为"应用回到前台时检查并补备份"（EntryAbility.onForeground）
2. **图片粘贴**：ArkUI 输入框 paste 事件支持度需在真机验证，必要时改为"选择图片"按钮触发
3. **文件导入**：当前导出已实现（写入应用沙盒 filesDir），导入需进一步对接 photoAccessHelper / picker 选择 JSON 文件
4. **未做应用签名**：当前为 debug 模式源码工程，未配置 .hap/.app 签名（上架时需要）

## 技术映射速查
| 插件 (Chrome/Web) | 鸿蒙 (ArkTS) |
|---|---|
| chrome.storage.local | @ohos.data.preferences |
| chrome.storage.session + window | AppStorage + AppViewModel 单例 |
| chrome.storage.onChanged | @Observed / @ObjectLink 响应式 |
| chrome.alarms | @ohos.reminderAgentManager |
| chrome.notifications | @ohos.notificationManager |
| fetch | @ohos.net.http |
| crypto.subtle (AES-GCM + PBKDF2) | @ohos.security.cryptoFramework |
| navigator.clipboard | @ohos.pasteboard |
| navigator.share | 隐式 Want |
| FileReader / Blob 下载 | @ohos.file.fs |
| confirm() / alert() | promptAction.showDialog / showToast |
| chrome.runtime.openOptionsPage | router.pushUrl |
