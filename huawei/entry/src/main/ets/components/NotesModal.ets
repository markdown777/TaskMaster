/**
 * 备注编辑弹窗
 * 对齐 popup.js 的 notes-modal：标题 banner + textarea(500) + 保存/关闭
 * 归档任务只读
 */
import { AppViewModel } from '../viewmodel/AppViewModel';
import { TaskManager } from '../services/TaskManager';

@Component
export struct NotesModal {
  @ObjectLink vm: AppViewModel;
  private tempNotes: string = '';

  aboutToAppear(): void {
    this.tempNotes = this.vm.notesContext?.notes ?? '';
  }

  build() {
    if (this.vm.modals.notes && this.vm.notesContext) {
      Column({ space: 16 }) {
        // 标题 banner
        Text(this.vm.notesContext.taskText)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.text_primary'))
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')

        // 备注 textarea
        TextArea({ text: this.tempNotes, placeholder: '输入备注...' })
          .fontSize(13)
          .fontColor($r('app.color.text_primary'))
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(8)
          .padding(12)
          .height(160)
          .maxLength(500)
          .enabled(!this.vm.notesContext.isArchived)
          .onChange((val: string) => { this.tempNotes = val; })

        // 操作按钮
        Row({ space: 12 }) {
          Button('关闭')
            .fontSize(13)
            .backgroundColor($r('app.color.bg_primary'))
            .fontColor($r('app.color.text_secondary'))
            .border({ width: 0.5, color: $r('app.color.border_light') })
            .borderRadius(6)
            .layoutWeight(1)
            .onClick(() => this.vm.closeModal('notes'))

          if (!this.vm.notesContext.isArchived) {
            Button('保存')
              .fontSize(13)
              .fontColor($r('app.color.bg_primary'))
              .backgroundColor($r('app.color.brand_color'))
              .borderRadius(6)
              .layoutWeight(1)
              .onClick(() => this.saveNotes())
          }
        }
        .width('100%')
      }
      .padding(20)
      .backgroundColor($r('app.color.bg_primary'))
      .borderRadius(12)
      .shadow({ radius: 32, color: '#1A000000', offsetX: 0, offsetY: 12 })
    }
  }

  /**
   * 保存备注
   */
  private async saveNotes(): Promise<void> {
    if (!this.vm.notesContext) return;
    const ctx = this.vm.notesContext;
    const trimmed = this.tempNotes.trim();
    try {
      await TaskManager.getInstance().saveTaskNotes(ctx.taskId, trimmed);
      await this.vm.refreshTasks();
      this.vm.showToast(trimmed ? '备注已保存' : '备注已清空');
    } catch (e) {
      this.vm.showToast('保存备注失败', 'error');
    }
    this.vm.closeModal('notes');
  }
}
