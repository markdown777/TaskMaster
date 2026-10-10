/**
 * 主页
 * 对齐 popup.html / popup.js：
 * - header（标题 + AI 切换✨ + 搜索🔍）
 * - TaskForm 任务输入表单
 * - 任务列表（置顶区 / 按日期分组可折叠 / 归档区最近 6 条 + 更多折叠）
 * - 底栏（分享 / 设置）
 * - 各弹窗（DuePopover / SearchPopover / NotesModal / PinModal / ShareMenu）
 */
import { AppViewModel } from '../viewmodel/AppViewModel';
import { TaskManager } from '../services/TaskManager';
import { ParsedTask } from '../services/AiService';
import { Task } from '../models/Task';
import { TaskForm } from '../components/TaskForm';
import { TaskItem } from '../components/TaskItem';
import { DuePopover } from '../components/DuePopover';
import { SearchPopover } from '../components/SearchPopover';
import { NotesModal } from '../components/NotesModal';
import { PinModal } from '../components/PinModal';
import { ShareMenu } from '../components/ShareMenu';
import { router, mediaquery } from '@kit.ArkUI';
import { parseTags } from '../utils/CommonUtils';

@Entry
@Component
struct Index {
  @State vm: AppViewModel = AppViewModel.getInstance();
  @State collapsedDates: Set<string> = new Set();
  @State archiveFolded: boolean = true;
  private toastTimer: number = -1;

  aboutToAppear(): void {
    // 监听折叠屏状态（内屏宽度 ≥ 600vp）
    const listener = mediaquery.matchMediaSync('(min-width: 600vp)');
    this.vm.setScreenType(listener.matches);
    listener.on('change', (result: mediaquery.MediaQueryResult) => {
      this.vm.setScreenType(result.matches);
    });
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Column() {
        // Header
        Row({ space: 12 }) {
          Text('TaskMaster')
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.text_primary'))
            .layoutWeight(1)

          // AI 切换按钮
          Text('✨')
            .fontSize(20)
            .padding(6)
            .borderRadius(8)
            .backgroundColor(this.vm.isAiMode ? $r('app.color.bg_secondary') : Color.Transparent)
            .onClick(() => this.vm.toggleAiMode())

          // 搜索按钮
          Text('🔍')
            .fontSize(18)
            .padding(6)
            .borderRadius(8)
            .backgroundColor(this.vm.modals.search ? $r('app.color.bg_secondary') : Color.Transparent)
            .onClick(() => {
              if (this.vm.modals.search) {
                this.vm.resetSearch();
                this.vm.closeModal('search');
              } else {
                this.vm.openModal('search');
              }
            })
        }
        .width('100%')
        .padding({ left: 20, right: 20, top: 16, bottom: 12 })

        // TaskForm
        Column() {
          TaskForm({
            vm: this.vm,
            onOpenDue: () => this.vm.openModal('due'),
            onSubmit: () => this.submitForm()
          })
        }
        .padding({ left: 20, right: 20, bottom: 12 })

        // 搜索弹层（条件展开）
        Column() {
          SearchPopover({ vm: this.vm })
        }
        .padding({ left: 20, right: 20 })
        .margin({ bottom: 8 })

        // 时间弹层（条件展开）
        Column() {
          DuePopover({ vm: this.vm })
        }
        .padding({ left: 20, right: 20 })
        .margin({ bottom: 8 })

        // 任务列表
        if (this.vm.searchState.isSearching) {
          this.SearchResultsList()
        } else {
          this.TaskList()
        }

        // 底栏
        Row({ space: 12 }) {
          Button('分享')
            .fontSize(13)
            .backgroundColor($r('app.color.bg_primary'))
            .fontColor($r('app.color.text_primary'))
            .border({ width: 0.5, color: $r('app.color.border_light') })
            .borderRadius(8)
            .layoutWeight(1)
            .onClick(() => this.vm.openModal('share'))

          Button('设置')
            .fontSize(13)
            .backgroundColor($r('app.color.bg_primary'))
            .fontColor($r('app.color.text_primary'))
            .border({ width: 0.5, color: $r('app.color.border_light') })
            .borderRadius(8)
            .layoutWeight(1)
            .onClick(() => router.pushUrl({ url: 'pages/Settings' }))
        }
        .width('100%')
        .padding({ left: 20, right: 20, top: 12, bottom: 16 })
      }
      .width('100%')
      .height('100%')
      .backgroundColor($r('app.color.bg_primary'))

      // 弹窗层
      if (this.vm.modals.notes) {
        Column() {
          NotesModal({ vm: this.vm })
        }
        .width('88%')
        .alignSelf(ItemAlign.Center)
      }
      if (this.vm.modals.pin) {
        Column() {
          PinModal({ vm: this.vm })
        }
        .width('80%')
      }
      if (this.vm.modals.share) {
        Column() {
          ShareMenu({ vm: this.vm })
        }
        .width('80%')
      }

      // Toast
      if (this.vm.toastVisible) {
        Text(this.vm.toastMessage)
          .fontSize(13)
          .fontColor($r('app.color.bg_primary'))
          .backgroundColor(this.vm.toastType === 'error' ? $r('app.color.danger') : $r('app.color.brand_color'))
          .padding({ left: 16, right: 16, top: 10, bottom: 10 })
          .borderRadius(8)
          .shadow({ radius: 16, color: '#1A000000', offsetX: 0, offsetY: 4 })
          .margin({ top: 40 })
          .alignSelf(ItemAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
  }

  /**
   * 任务列表（置顶 / 按日期分组 / 归档）
   */
  @Builder
  TaskList() {
    Scroll() {
      Column({ space: 16 }) {
        if (this.vm.getGroupedTasks().pinned.length > 0) {
          // 置顶区
          Column({ space: 8 }) {
            Text('置顶')
              .fontSize(13)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.text_secondary'))
              .width('100%')

            ForEach(this.vm.getGroupedTasks().pinned, (task: Task) => {
              TaskItem({
                task: task,
                isArchived: false,
                onComplete: (id: number) => this.handleComplete(id),
                onPin: (id: number) => this.handlePin(id),
                onDelete: (id: number) => this.handleDelete(id),
                onOpenNotes: (t: Task) => this.vm.openNotes(t.id, t.text, t.notes, t.completed)
              })
            }, (task: Task) => task.id.toString())
          }
          .width('100%')
        }

        // 活动任务按日期分组
        ForEach(this.vm.getGroupedTasks().activeGroups, (group: { dateKey: string; tasks: Task[]; isToday: boolean; isYesterday: boolean }) => {
          Column({ space: 8 }) {
            // 日期头部（可折叠）
            Row() {
              Text(group.dateKey + (group.isToday ? '（今天）' : (group.isYesterday ? '（昨天）' : '')))
                .fontSize(13)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.text_secondary'))
                .layoutWeight(1)
              Text(this.isCollapsed(group.dateKey) ? '▶' : '▼')
                .fontSize(12)
                .fontColor($r('app.color.text_secondary'))
            }
            .width('100%')
            .onClick(() => this.toggleCollapse(group.dateKey))

            if (!this.isCollapsed(group.dateKey)) {
              ForEach(group.tasks, (task: Task) => {
                TaskItem({
                  task: task,
                  isArchived: false,
                  onComplete: (id: number) => this.handleComplete(id),
                  onPin: (id: number) => this.handlePin(id),
                  onDelete: (id: number) => this.handleDelete(id),
                  onOpenNotes: (t: Task) => this.vm.openNotes(t.id, t.text, t.notes, t.completed)
                })
              }, (task: Task) => task.id.toString())
            }
          }
          .width('100%')
        }, (group: { dateKey: string }) => group.dateKey)

        // 归档区
        if (this.vm.getGroupedTasks().archived.length > 0) {
          Column({ space: 8 }) {
            Text('已归档')
              .fontSize(13)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.text_secondary'))
              .width('100%')

            // 最近 6 条
            ForEach(this.vm.getGroupedTasks().archived.slice(0, 6), (task: Task) => {
              TaskItem({
                task: task,
                isArchived: true,
                onComplete: () => {},
                onPin: () => {},
                onDelete: () => {},
                onOpenNotes: (t: Task) => this.vm.openNotes(t.id, t.text, t.notes, t.completed)
              })
            }, (task: Task) => task.id.toString())

            // 更多已归档
            if (this.vm.getGroupedTasks().archived.length > 6) {
              Row() {
                Text(`更多已归档任务 (${this.vm.getGroupedTasks().archived.length - 6})`)
                  .fontSize(12)
                  .fontColor($r('app.color.text_secondary'))
                  .layoutWeight(1)
                Text(this.archiveFolded ? '▶' : '▼')
                  .fontSize(12)
                  .fontColor($r('app.color.text_secondary'))
              }
              .width('100%')
              .onClick(() => this.archiveFolded = !this.archiveFolded)

              if (!this.archiveFolded) {
                ForEach(this.vm.getGroupedTasks().archived.slice(6), (task: Task) => {
                  TaskItem({
                    task: task,
                    isArchived: true,
                    onComplete: () => {},
                    onPin: () => {},
                    onDelete: () => {},
                    onOpenNotes: (t: Task) => this.vm.openNotes(t.id, t.text, t.notes, t.completed)
                  })
                }, (task: Task) => task.id.toString())
              }
            }
          }
          .width('100%')
        }
      }
      .width('100%')
      .padding({ left: 20, right: 20, bottom: 20 })
    }
    .layoutWeight(1)
    .align(Alignment.Top)
  }

  /**
   * 搜索结果列表
   */
  @Builder
  SearchResultsList() {
    Scroll() {
      Column({ space: 12 }) {
        // 统计行
        Text(`共 ${this.vm.tasks.length} 项任务`)
          .fontSize(12)
          .fontColor($r('app.color.text_secondary'))
          .width('100%')

        // 搜索结果（异步获取后展示）
        ForEach(this.vm.tasks.filter((t: Task) => {
          const q = this.vm.searchState.query.toLowerCase();
          const matchQ = !q || t.text.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q));
          const matchActive = this.vm.searchState.showActive || !t.completed ? true : false;
          const matchCompleted = this.vm.searchState.showCompleted || t.completed ? true : false;
          const matchNotes = !this.vm.searchState.showNotesOnly || (t.notes && t.notes.trim());
          return matchQ && (t.completed ? this.vm.searchState.showCompleted : this.vm.searchState.showActive) && matchNotes;
        }), (task: Task) => {
          TaskItem({
            task: task,
            isArchived: task.completed,
            onComplete: (id: number) => this.handleComplete(id),
            onPin: (id: number) => this.handlePin(id),
            onDelete: (id: number) => this.handleDelete(id),
            onOpenNotes: (t: Task) => this.vm.openNotes(t.id, t.text, t.notes, t.completed)
          })
        }, (task: Task) => task.id.toString())
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 8, bottom: 20 })
    }
    .layoutWeight(1)
    .align(Alignment.Top)
  }

  // ============ 表单提交 ============

  /**
   * 提交表单（AI 模式走解析，普通模式直接添加）
   */
  private async submitForm(): Promise<void> {
    const title = this.vm.formTitle.trim();
    if (!title) return;

    if (this.vm.isAiMode) {
      // AI 解析路径
      this.vm.formTitle = '';
      try {
        const parsed = await this.vm.processAiInput(title, false);
        if (parsed) {
          await this.applyAiResult(parsed, false, title);
        }
        // 若返回 null 表示需要 PIN，弹窗已打开，等待用户解锁
      } catch (e) {
        this.vm.showToast(`AI 解析失败: ${(e as Error).message}`, 'error');
      }
      return;
    }

    // 普通添加路径
    try {
      const tags = parseTags(this.vm.formTags);
      const due = this.vm.formDue ? new Date(this.vm.formDue).toISOString() : new Date(Date.now() + 3600000).toISOString();
      await TaskManager.getInstance().addTask({
        text: title,
        priority: this.vm.formPriority as 'high' | 'medium' | 'low',
        tags,
        due,
        notes: this.vm.currentTaskNotes
      });
      this.resetForm();
      await this.vm.refreshTasks();
      this.vm.showToast('任务已添加');
    } catch (e) {
      this.vm.showToast('添加任务失败，请重试', 'error');
    }
  }

  /**
   * 应用 AI 解析结果到表单并添加任务
   */
  private async applyAiResult(parsed: ParsedTask, isImage: boolean, rawInput: string): Promise<void> {
    const fill = this.vm.buildAiFormFill(parsed, isImage, rawInput);
    const tags = parseTags(fill.tags);
    const due = fill.due ? new Date(fill.due).toISOString() : new Date(Date.now() + 3600000).toISOString();

    try {
      await TaskManager.getInstance().addTask({
        text: fill.title,
        priority: fill.priority as 'high' | 'medium' | 'low',
        tags,
        due,
        notes: fill.notes
      });
      this.vm.isAiMode = false;
      this.resetForm();
      await this.vm.refreshTasks();
      this.vm.showToast('✨ AI 解析成功并已添加任务');
    } catch (e) {
      this.vm.showToast('添加任务失败', 'error');
    }
  }

  /**
   * 重置表单
   */
  private resetForm(): void {
    this.vm.formTitle = '';
    this.vm.formPriority = 'medium';
    this.vm.formTags = '';
    this.vm.formDue = '';
    this.vm.currentTaskNotes = '';
  }

  // ============ 任务操作 ============

  private async handleComplete(taskId: number): Promise<void> {
    try {
      await TaskManager.getInstance().toggleTaskComplete(taskId);
      await this.vm.refreshTasks();
    } catch (e) {
      this.vm.showToast('操作失败', 'error');
    }
  }

  private async handlePin(taskId: number): Promise<void> {
    try {
      await TaskManager.getInstance().toggleTaskPinned(taskId);
      await this.vm.refreshTasks();
    } catch (e) {
      this.vm.showToast('操作失败', 'error');
    }
  }

  private async handleDelete(taskId: number): Promise<void> {
    // 确认弹窗
    try {
      await TaskManager.getInstance().deleteTask(taskId);
      await this.vm.refreshTasks();
      this.vm.showToast('任务已删除');
    } catch (e) {
      this.vm.showToast('删除失败', 'error');
    }
  }

  // ============ 折叠状态 ============

  private isCollapsed(dateKey: string): boolean {
    return this.collapsedDates.has(dateKey);
  }

  private toggleCollapse(dateKey: string): void {
    if (this.collapsedDates.has(dateKey)) {
      this.collapsedDates.delete(dateKey);
    } else {
      this.collapsedDates.add(dateKey);
    }
    // 触发刷新
    this.collapsedDates = new Set(this.collapsedDates);
  }
}
