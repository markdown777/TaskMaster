# Edge 本地自动发布脚本设计

**日期**: 2026-06-08
**时间**: 北京时间
**项目**: TaskMaster Edge Extension
**目标目录**: `edge-version/local-publish/`
**目标版本**: 3.5.0

## 1. 背景

当前 `edge-version/` 已升级到 3.5.0，并已生成可提交的扩展压缩包 `TaskMaster-Edge-v3.5.0.zip`。微软 Edge 商店中已经存在该扩展的 3.0.0 上架记录，因此本次需要补充一个仅供本地使用的自动发布脚本，用于通过 Microsoft Edge Add-ons Publish API 自动上传并发布 3.5.0 更新包。

用户明确要求：

- 发布脚本必须使用本地环境变量读取凭据。
- 发布脚本及其测试文件不能进入 Git 仓库。
- 文件应放在 `edge-version/` 目录内，利用现有忽略规则避免误提交。

## 2. 目标

本次设计目标如下：

1. 在 `edge-version/` 下提供一套本地可运行的 Edge Publish API 自动发布脚本。
2. 脚本支持校验 ZIP、鉴权、上传、查询上传状态、触发发布、查询发布状态。
3. 所有敏感信息都通过环境变量传入，不写入代码。
4. 提供本地测试脚本，用于校验配置与 ZIP，不直接触发线上发布。
5. 增加误发布保护，避免因为误执行直接向商店发起正式发布。

## 3. 非目标

以下内容不在本次设计范围内：

- 不修改 Edge 插件业务代码。
- 不替代 Partner Center 中的文案、截图人工维护工作。
- 不将发布脚本纳入正式仓库跟踪。
- 不实现复杂 CI/CD 流水线，只提供本地手动触发的自动发布能力。

## 4. 已确认输入

- Edge 商店已存在旧版本，允许走更新发布流程。
- 已知 Product ID：`c3a54be3-f6f5-4593-aea4-437362bb4750`
- 本地 ZIP 路径为：`edge-version/TaskMaster-Edge-v3.5.0.zip`
- 脚本实现形式选择为 Node.js。
- 发布相关文件全部放在 `edge-version/` 目录下，不推送到仓库。

## 5. 目录与文件设计

### 5.1 目录位置

所有发布相关文件都放在以下目录：

- `edge-version/local-publish/`

这样做的原因：

- 根目录 `.gitignore` 已忽略整个 `edge-version/`
- 本地发布脚本天然不会进入 Git 跟踪
- 与 Edge 发行目录放在一起，便于发布时就近读取 ZIP

### 5.2 文件结构

建议采用以下结构：

- `edge-version/local-publish/publish.js`
- `edge-version/local-publish/lib/config.js`
- `edge-version/local-publish/lib/client.js`
- `edge-version/local-publish/lib/logger.js`
- `edge-version/local-publish/tests/test_publish_config.js`
- `edge-version/local-publish/tests/test_publish_zip.js`
- `edge-version/local-publish/.env.example`

### 5.3 职责划分

- `publish.js`
  - 作为主入口
  - 串联整个发布流程
- `lib/config.js`
  - 读取并校验环境变量
  - 校验 ZIP 路径和 Product ID
- `lib/client.js`
  - 封装与 Edge Publish API 的 HTTP 请求
  - 处理鉴权、上传、查询和发布接口
- `lib/logger.js`
  - 统一输出日志
  - 提供清晰的阶段性提示和错误提示
- `tests/test_publish_config.js`
  - 验证配置校验逻辑
- `tests/test_publish_zip.js`
  - 验证 ZIP 校验逻辑

## 6. 配置设计

### 6.1 环境变量

脚本只通过环境变量读取配置：

- `EDGE_CLIENT_ID`
- `EDGE_API_KEY`
- `EDGE_PRODUCT_ID`
- `EDGE_ZIP_PATH`
- `EDGE_PUBLISH_CONFIRM`

### 6.2 配置约束

- `EDGE_CLIENT_ID` 不能为空
- `EDGE_API_KEY` 不能为空
- `EDGE_PRODUCT_ID` 必须与当前扩展对应
- `EDGE_ZIP_PATH` 必须指向存在的 ZIP 文件
- `EDGE_PUBLISH_CONFIRM` 必须等于 `YES` 才允许真实发布

### 6.3 默认值策略

为了减少手误，可以提供以下默认策略：

- 若未设置 `EDGE_PRODUCT_ID`，可默认回退到本次已确认的 Product ID
- 若未设置 `EDGE_ZIP_PATH`，可默认使用 `edge-version/TaskMaster-Edge-v3.5.0.zip`

但脚本在日志中必须明确打印最终实际使用的值，避免误发到错误产品或错误包。

## 7. 发布流程设计

### 7.1 流程总览

主流程按以下顺序执行：

1. 读取并校验环境变量
2. 检查 ZIP 是否存在且结构正常
3. 读取 ZIP 中的 `manifest.json`
4. 确认版本号为 `3.5.0`
5. 请求 Publish API 鉴权
6. 上传扩展包
7. 轮询上传状态直到成功或失败
8. 检查是否允许真实发布
9. 触发发布
10. 轮询发布状态直到完成、失败或超时

### 7.2 ZIP 校验

在上传前执行以下检查：

- ZIP 文件存在
- ZIP 可正常打开
- ZIP 中存在 `manifest.json`
- `manifest.version` 等于 `3.5.0`
- ZIP 根目录没有多包一层目录

如任一条件不满足，脚本直接退出，不发起上传。

### 7.3 鉴权设计

脚本需要封装统一的鉴权逻辑，用于获取调用 Publish API 所需的访问能力。鉴权失败时：

- 输出 HTTP 状态码
- 输出错误响应摘要
- 不自动重试敏感鉴权请求

### 7.4 上传设计

上传阶段需具备以下能力：

- 将 ZIP 文件上传到指定 Product ID
- 输出上传开始时间和目标 Product ID
- 记录上传结果中的状态信息，供后续轮询使用

### 7.5 状态轮询设计

上传和发布都不是同步完成，因此需要轮询。

轮询策略：

- 间隔采用固定秒数
- 总等待时间采用常量限制
- 超时后退出并提示当前卡住的阶段

至少区分以下状态：

- 处理中
- 成功
- 失败
- 超时

### 7.6 发布保护

为避免误发，脚本必须在真正调用发布接口前再次检查：

- 当前 ZIP 版本是否仍为 `3.5.0`
- `EDGE_PUBLISH_CONFIRM` 是否等于 `YES`

如果未设置确认开关，则脚本只执行到“上传完成并准备发布”或“预检完成”，并明确提示用户当前没有执行真实发布。

## 8. 日志与错误处理设计

### 8.1 日志原则

日志要面向非专业用户，尽量清晰直白。建议输出如下阶段提示：

- 正在检查环境变量
- 正在检查 ZIP 包
- 正在读取扩展版本
- 正在请求鉴权
- 正在上传扩展包
- 正在等待上传完成
- 正在触发发布
- 正在等待商店返回最终状态

### 8.2 错误分级

错误至少分为以下几类：

- 配置错误
  - 如缺少环境变量、ZIP 路径错误
- 输入错误
  - 如 ZIP 版本不是 3.5.0
- 网络错误
  - 如请求失败、超时
- 接口错误
  - 如鉴权失败、上传失败、发布失败

### 8.3 错误输出策略

错误输出必须尽量保留有效排查信息，但不能打印完整密钥。输出时：

- 可以显示 HTTP 状态码
- 可以显示响应体摘要
- 不回显完整 API Key

## 9. 测试设计

### 9.1 测试文件位置

测试文件放在：

- `edge-version/local-publish/tests/`

继续遵守“测试文件单独存放”的原则，同时因为位于 `edge-version/` 下，也不会进入仓库。

### 9.2 测试范围

本次只做低风险本地测试：

- 配置校验测试
- ZIP 校验测试

不做真实线上发布测试脚本，以避免误调商店接口。

### 9.3 验证重点

- 缺少环境变量时能否正确报错
- ZIP 路径错误时能否正确报错
- 非 3.5.0 ZIP 是否会被阻止
- 未设置 `EDGE_PUBLISH_CONFIRM=YES` 时是否会阻止真实发布

## 10. 安全与隐私约束

### 10.1 凭据管理

- 凭据只能来自环境变量
- 不写入脚本源码
- 不写入测试文件
- 不写入文档示例中的真实值

### 10.2 仓库隔离

发布脚本放在 `edge-version/` 下，利用仓库根目录现有 `.gitignore` 规则避免误提交。

这意味着：

- 可以在本地自由修改和调试
- 不会进入正常 Git 跟踪
- 不会随着仓库同步被推送

### 10.3 防误发布

- 默认不真实发布
- 必须显式设置 `EDGE_PUBLISH_CONFIRM=YES`
- 发布前输出目标 Product ID、ZIP 路径和 ZIP 版本

## 11. 实施步骤

1. 创建 `edge-version/local-publish/` 目录结构
2. 实现配置模块
3. 实现日志模块
4. 实现 API 客户端模块
5. 实现主入口脚本
6. 实现本地测试脚本
7. 执行本地静态验证
8. 由用户在本地填入环境变量后执行真实发布

## 12. 成功标准

当满足以下条件时，本设计视为达成：

1. 本地存在可运行的 Node.js 自动发布脚本
2. 脚本能校验 ZIP、鉴权、上传、查询、触发发布
3. 默认不会误发布
4. 所有发布相关文件都位于 `edge-version/` 下
5. 不需要把任何发布脚本推送到仓库

## 13. 风险与注意事项

- Microsoft Publish API 的接口细节可能随版本变化，实际实现前需按当前官方文档核对参数
- 如果凭据权限不足，脚本会在鉴权或上传阶段失败
- 如果 ZIP 虽然结构正确但商店后台仍有审核要求，自动发布也不能绕过审核
- 该脚本主要解决“自动上传和发起发布”，不替代商店后台的人审流程

## 14. 后续入口

本规格确认后，下一步进入实现计划阶段，输出可执行的本地发布脚本实施计划，随后再开始写脚本文件。
