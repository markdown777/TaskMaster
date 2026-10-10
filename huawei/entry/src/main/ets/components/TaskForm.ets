/**
 * 任务输入表单组件
 * 对齐 popup.html 的 taskForm：
 * - 输入框（AI 模式 placeholder 切换）
 * - 优先级选择 / 标签输入 / 时间按钮 / 创建
 */
import { AppViewModel } from '../viewmodel/AppViewModel';

@Component
export struct TaskForm {
  @ObjectLink vm: AppViewModel;
  onOpenDue: () => void = () => {};
  onSubmit: () => void = () => {};

  build() {
    Column({ space: 8 }) {
      // 输入框
      TextInput({ text: this.vm.formTitle, placeholder: this.vm.isAiMode ? '✨ AI 模式: 输入自然语言 或 粘贴聊天截图' : '添加新任务...' })
        .fontSize(15)
        .fontColor($r('app.color.text_primary'))
        .backgroundColor($r('app.color.bg_secondary'))
        .borderRadius(8)
        .padding({ left: 12, right: 12, top: 10, bottom: 10 })
        .onChange((val: string) => { this.vm.formTitle = val; })
        .onSubmit(() => this.onSubmit())

      // 选项行
      Row({ space: 8 }) {
        // 优先级
        Select([
          { value: '中优先级' },
          { value: '高优先级' },
          { value: '低优先级' }
        ])
          .selected(this.vm.formPriority === 'high' ? 1 : (this.vm.formPriority === 'low' ? 2 : 0))
          .value(this.vm.formPriority === 'high' ? '高' : (this.vm.formPriority === 'low' ? '低' : '中'))
          .font({ size: 12 })
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(6)
          .onSelect((index: number) => {
            this.vm.formPriority = index === 1 ? 'high' : (index === 2 ? 'low' : 'medium');
          })
          .layoutWeight(1)

        // 标签
        TextInput({ text: this.vm.formTags, placeholder: '标签' })
          .fontSize(12)
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(6)
          .padding({ left: 8, right: 8, top: 6, bottom: 6 })
          .onChange((val: string) => { this.vm.formTags = val; })
          .layoutWeight(1.2)

        // 时间按钮
        Button(this.vm.formDue ? '已设时间' : '时间')
          .fontSize(12)
          .fontColor(this.vm.formDue ? $r('app.color.brand_color') : $r('app.color.text_secondary'))
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(6)
          .padding({ left: 8, right: 8, top: 6, bottom: 6 })
          .onClick(() => this.onOpenDue())

        // 创建
        Button('创建')
          .fontSize(13)
          .fontColor($r('app.color.bg_primary'))
          .backgroundColor($r('app.color.brand_color'))
          .borderRadius(6)
          .padding({ left: 16, right: 16, top: 6, bottom: 6 })
          .onClick(() => this.onSubmit())
      }
      .width('100%')
    }
    .width('100%')
  }
}
