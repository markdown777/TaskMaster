# TaskMaster - 极简高级智能待办事项管理扩展

TaskMaster 是一款基于现代极简设计美学构建的高级待办管理扩展，支持跨设备同步、本地安全加密与智能定时备份，让您的工作与生活井然有序。

## 功能特性 (v3.0.0)

- 🎯 **现代极简设计美学**：由留白、字重驱动的“高级排版设计”，结合流畅的阻尼微动效。
- ⚡ **闪电般的任务录入**：紧凑型悬浮时间选择器，支持快捷时间设定。
- ☁️ **无缝跨设备同步**：通过 Sync + Local 混合双驱存储架构，跨端漫游，突破配额限制。
- 🕰️ **后台全自动静默备份**：Service Worker 后台自动生成每日快照（保留 7 天）。
- 🔐 **银行级数据加密**：支持 AES-256 本地数据加密。
- 🔍 **高效检索与多维过滤**：支持基于状态筛选，并能在搜索结果中高亮匹配关键词。

<p align="center">
  <img src="https://raw.githubusercontent.com/markdown777/TaskMaster/refs/heads/main/%E5%8A%9F%E8%83%BD%E6%BC%94%E7%A4%BA%E5%9B%BE%E7%89%87.png" alt="TaskMaster 功能演示" width="48%">
  <img src="https://raw.githubusercontent.com/markdown777/TaskMaster/refs/heads/main/%E8%AE%BE%E7%BD%AE%E6%BC%94%E7%A4%BA%E5%9B%BE%E7%89%87.png" alt="TaskMaster 设置演示" width="48%">
</p>

## 安装说明

开发者本地安装：
```bash
# 克隆仓库
git clone https://github.com/markdown777/TaskMaster.git

# 在浏览器中加载扩展：
# 1. 访问 chrome://extensions/ (Chrome) 或 edge://extensions/ (Edge)
# 2. 开启"开发者模式"
# 3. 点击"加载已解压的扩展程序"
# 4. 选择项目目录
```

## 技术架构

- Chrome Extension Manifest V3
- Service Worker
- 混合双驱存储引擎 (Sync + Local)
- 原生 CSS3 阻尼动画 & DOM 优化

## 版本历史

- v3.0.0 - 架构重构与极简 UI 升级版
- v2.9.0 - 包含基础的任务提醒和管理功能