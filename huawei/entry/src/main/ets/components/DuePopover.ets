/**
 * 截止时间弹层组件
 * 对齐 popup.js 的 due-popover：datetime-local + 4 个快捷预设
 */
import { AppViewModel } from '../viewmodel/AppViewModel';
import { toDatetimeLocalValue } from '../utils/CommonUtils';

@Component
export struct DuePopover {
  @ObjectLink vm: AppViewModel;

  build() {
    if (this.vm.modals.due) {
      Column({ space: 12 }) {
        // 日期时间选择器
        Column({ space: 4 }) {
          Text('选择截止时间')
            .fontSize(12)
            .fontColor($r('app.color.text_secondary'))
          DatePicker({
            start: new Date(),
            selected: this.vm.formDue ? new Date(this.vm.formDue) : new Date()
          })
            .onChange((value: DatePickerResult) => {
              const d = new Date(value.year, value.month, value.day);
              this.vm.formDue = toDatetimeLocalValue(d);
            })
            .height(120)

          // 时间选择（小时:分钟）
          Row({ space: 12 }) {
            Text('时:分').fontSize(12).fontColor($r('app.color.text_secondary'))
            TimePicker({
              selected: this.vm.formDue ? new Date(this.vm.formDue) : new Date()
            })
              .onChange((value: TimePickerResult) => {
                if (this.vm.formDue) {
                  const d = new Date(this.vm.formDue);
                  d.setHours(value.hour, value.minute);
                  this.vm.formDue = toDatetimeLocalValue(d);
                }
              })
              .height(80)
          }
        }

        // 快捷预设
        Flex({ wrap: FlexWrap.Wrap, spaceBasisLength: 8 }) {
          Button('1小时后')
            .fontSize(11)
            .backgroundColor($r('app.color.bg_secondary'))
            .fontColor($r('app.color.text_primary'))
            .borderRadius(6)
            .padding({ left: 10, right: 10, top: 6, bottom: 6 })
            .margin({ right: 8, bottom: 8 })
            .onClick(() => this.applyPreset('plus60'))

          Button('今天18:00')
            .fontSize(11)
            .backgroundColor($r('app.color.bg_secondary'))
            .fontColor($r('app.color.text_primary'))
            .borderRadius(6)
            .padding({ left: 10, right: 10, top: 6, bottom: 6 })
            .margin({ right: 8, bottom: 8 })
            .onClick(() => this.applyPreset('today18'))

          Button('明天09:00')
            .fontSize(11)
            .backgroundColor($r('app.color.bg_secondary'))
            .fontColor($r('app.color.text_primary'))
            .borderRadius(6)
            .padding({ left: 10, right: 10, top: 6, bottom: 6 })
            .margin({ right: 8, bottom: 8 })
            .onClick(() => this.applyPreset('tomorrow09'))

          Button('清除')
            .fontSize(11)
            .backgroundColor($r('app.color.bg_secondary'))
            .fontColor($r('app.color.danger'))
            .borderRadius(6)
            .padding({ left: 10, right: 10, top: 6, bottom: 6 })
            .margin({ right: 8, bottom: 8 })
            .onClick(() => this.applyPreset('clear'))
        }
        .width('100%')

        Button('关闭')
          .fontSize(12)
          .backgroundColor($r('app.color.bg_primary'))
          .fontColor($r('app.color.text_secondary'))
          .border({ width: 0.5, color: $r('app.color.border_light') })
          .borderRadius(6)
          .width('100%')
          .onClick(() => this.vm.closeModal('due'))
      }
      .padding(16)
      .backgroundColor($r('app.color.bg_primary'))
      .borderRadius(12)
      .border({ width: 0.5, color: $r('app.color.border_light') })
      .shadow({ radius: 24, color: '#1A000000', offsetX: 0, offsetY: 8 })
    }
  }

  /**
   * 应用快捷预设（对齐 popup.js applyPreset）
   */
  private applyPreset(preset: string): void {
    const now = new Date();
    if (preset === 'clear') {
      this.vm.formDue = '';
    } else if (preset === 'plus60') {
      const d = new Date(now.getTime() + 60 * 60 * 1000);
      this.vm.formDue = toDatetimeLocalValue(d);
    } else if (preset === 'today18') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0);
      // 已过则顺延次日
      if (d.getTime() <= now.getTime()) {
        d.setDate(d.getDate() + 1);
      }
      this.vm.formDue = toDatetimeLocalValue(d);
    } else if (preset === 'tomorrow09') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
      d.setDate(d.getDate() + 1);
      this.vm.formDue = toDatetimeLocalValue(d);
    }
    this.vm.closeModal('due');
  }
}
