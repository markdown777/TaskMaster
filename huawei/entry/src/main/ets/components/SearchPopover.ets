/**
 * 搜索弹层组件
 * 对齐 popup.js 的 search-popover：关键词 + 3 个过滤项
 */
import { AppViewModel } from '../viewmodel/AppViewModel';

@Component
export struct SearchPopover {
  @ObjectLink vm: AppViewModel;

  build() {
    if (this.vm.modals.search) {
      Column({ space: 12 }) {
        // 搜索框
        Row({ space: 8 }) {
          TextInput({ text: this.vm.searchState.query, placeholder: '搜索任务...' })
            .fontSize(14)
            .backgroundColor($r('app.color.bg_secondary'))
            .borderRadius(6)
            .padding({ left: 8, right: 8, top: 6, bottom: 6 })
            .layoutWeight(1)
            .onChange((val: string) => {
              this.vm.searchState.query = val.trim();
              this.vm.updateSearchState();
            })
          Button('×')
            .fontSize(16)
            .fontColor($r('app.color.text_secondary'))
            .backgroundColor($r('app.color.bg_secondary'))
            .borderRadius(6)
            .onClick(() => {
              this.vm.searchState.query = '';
              this.vm.updateSearchState();
            })
        }
        .width('100%')

        // 过滤项
        Row({ space: 16 }) {
          CheckboxWithName('活动', this.vm.searchState.showActive, (checked: boolean) => {
            this.vm.searchState.showActive = checked;
            this.vm.updateSearchState();
          })
          CheckboxWithName('已完成', this.vm.searchState.showCompleted, (checked: boolean) => {
            this.vm.searchState.showCompleted = checked;
            this.vm.updateSearchState();
          })
          CheckboxWithName('有备注', this.vm.searchState.showNotesOnly, (checked: boolean) => {
            this.vm.searchState.showNotesOnly = checked;
            this.vm.updateSearchState();
          })
        }
        .width('100%')

        Button('关闭')
          .fontSize(12)
          .backgroundColor($r('app.color.bg_primary'))
          .fontColor($r('app.color.text_secondary'))
          .border({ width: 0.5, color: $r('app.color.border_light') })
          .borderRadius(6)
          .width('100%')
          .onClick(() => {
            this.vm.resetSearch();
            this.vm.closeModal('search');
          })
      }
      .padding(16)
      .backgroundColor($r('app.color.bg_primary'))
      .borderRadius(12)
      .border({ width: 0.5, color: $r('app.color.border_light') })
      .shadow({ radius: 24, color: '#1A000000', offsetX: 0, offsetY: 8 })
    }
  }
}

/**
 * 带标签的复选框子组件
 */
@Component
struct CheckboxWithName {
  @Prop label: string;
  @Prop checked: boolean;
  onChange: (checked: boolean) => void = () => {};

  build() {
    Row({ space: 6 }) {
      Checkbox()
        .select(this.checked)
        .selectedColor($r('app.color.brand_color'))
        .size({ width: 16, height: 16 })
        .onChange((checked: boolean) => this.onChange(checked))
      Text(this.label)
        .fontSize(12)
        .fontColor($r('app.color.text_primary'))
    }
  }
}
