/**
 * 任务项组件
 * 对齐 popup.js generateTaskItemHtml 的两种变体：
 * - 活动变体：复选框 + 信息 + 置顶/删除按钮
 * - 归档变体：可点击查看备注，无操作按钮
 */
import { Task } from '../models/Task';
import { formatDateTime } from '../utils/CommonUtils';

@Component
export struct TaskItem {
  @Prop task: Task;
  @Prop isArchived: boolean = false;
  onComplete: (taskId: number) => void = () => {};
  onPin: (taskId: number) => void = () => {};
  onDelete: (taskId: number) => void = () => {};
  onOpenNotes: (task: Task) => void = () => {};

  /**
   * 优先级徽章文案与颜色
   */
  private priorityMeta(): { label: string; color: ResourceColor } {
    switch (this.task.priority) {
      case 'high': return { label: '高', color: $r('app.color.priority_high') };
      case 'low': return { label: '低', color: $r('app.color.priority_low') };
      default: return { label: '中', color: $r('app.color.priority_medium') };
    }
  }

  build() {
    Row({ space: 12 }) {
      // 活动任务：复选框；归档任务：无
      if (!this.isArchived) {
        Checkbox()
          .select(this.task.completed)
          .selectedColor($r('app.color.brand_color'))
          .width(20)
          .height(20)
          .onChange((checked: boolean) => {
            if (checked !== this.task.completed) {
              this.onComplete(this.task.id);
            }
          })
      }

      // 信息区
      Column({ space: 6 }) {
        // 标题行
        Row({ space: 8 }) {
          Text(this.task.text)
            .fontSize(15)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.task.completed ? $r('app.color.text_secondary') : $r('app.color.text_primary'))
            .layoutWeight(1)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          // 优先级徽章
          Text(this.priorityMeta().label)
            .fontSize(10)
            .fontColor(this.priorityMeta().color)
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .borderRadius(4)
            .border({ width: 0.5, color: this.priorityMeta().color })
        }
        .width('100%')

        // 时间信息
        if (!this.isArchived) {
          Text(`添加时间：${formatDateTime(this.task.id)}`)
            .fontSize(11)
            .fontColor($r('app.color.text_secondary'))
            .fontFamily('HarmonyOS Sans Mono')
        } else if (this.task.completedTime) {
          Text(`完成时间：${formatDateTime(this.task.completedTime)}`)
            .fontSize(11)
            .fontColor($r('app.color.text_secondary'))
            .fontFamily('HarmonyOS Sans Mono')
        }

        // 截止时间
        if (this.task.due) {
          Text(`截止时间：${formatDateTime(this.task.due)}`)
            .fontSize(11)
            .fontColor($r('app.color.text_secondary'))
            .fontFamily('HarmonyOS Sans Mono')
        }

        // 标签
        if (this.task.tags && this.task.tags.length > 0) {
          Flex({ wrap: FlexWrap.Wrap, spaceBasisLength: 6 }) {
            ForEach(this.task.tags, (tag: string) => {
              Text(`#${tag}`)
                .fontSize(11)
                .fontColor($r('app.color.text_secondary'))
                .fontFamily('HarmonyOS Sans Mono')
                .padding({ left: 4, right: 4 })
                .backgroundColor($r('app.color.bg_secondary'))
                .borderRadius(3)
                .margin({ right: 6, bottom: 4 })
            })
          }
          .width('100%')
        }

        // 备注指示器
        if (this.task.notes && this.task.notes.trim()) {
          Row({ space: 4 }) {
            Text('📝').fontSize(11)
            Text('有备注').fontSize(11).fontColor($r('app.color.text_secondary'))
          }
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .onClick(() => this.onOpenNotes(this.task))

      // 活动任务：置顶与删除按钮
      if (!this.isArchived) {
        Column({ space: 12 }) {
          // 置顶按钮
          if (!this.task.completed) {
            Text(this.task.pinned ? '★' : '☆')
              .fontSize(18)
              .fontColor(this.task.pinned ? $r('app.color.brand_color') : $r('app.color.text_secondary'))
              .onClick(() => this.onPin(this.task.id))
          }
          // 删除按钮
          Text('×')
            .fontSize(18)
            .fontColor($r('app.color.text_secondary'))
            .onClick(() => this.onDelete(this.task.id))
        }
        .alignItems(HorizontalAlign.Center)
      }
    }
    .width('100%')
    .padding({ top: 12, bottom: 12, left: 4, right: 4 })
    .borderRadius(8)
    .backgroundColor($r('app.color.bg_primary'))
  }
}
