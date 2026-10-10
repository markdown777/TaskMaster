/**
 * PIN 解锁弹窗
 * 对齐 popup.js 的 pin-modal：PIN 输入 + 解密流程 + 错误提示
 */
import { AppViewModel } from '../viewmodel/AppViewModel';

@Component
export struct PinModal {
  @ObjectLink vm: AppViewModel;
  @State pinInput: string = '';
  @State showError: boolean = false;
  @State submitting: boolean = false;

  build() {
    if (this.vm.modals.pin) {
      Column({ space: 16 }) {
        Text('解锁 AI 助理')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.text_primary'))

        Text('请输入您在设置中配置的 4 位安全 PIN 码以解密 API Key。')
          .fontSize(13)
          .fontColor($r('app.color.text_secondary'))
          .textAlign(TextAlign.Center)

        // PIN 输入
        TextInput({ placeholder: '****' })
          .type(InputType.Number)
          .maxLength(4)
          .fontSize(18)
          .textAlign(TextAlign.Center)
          .backgroundColor($r('app.color.bg_secondary'))
          .borderRadius(8)
          .padding({ top: 12, bottom: 12 })
          .onChange((val: string) => {
            this.pinInput = val;
            this.showError = false;
          })

        if (this.showError) {
          Text('PIN码错误或解密失败')
            .fontSize(12)
            .fontColor($r('app.color.danger'))
        }

        // 操作按钮
        Row({ space: 12 }) {
          Button('取消')
            .fontSize(13)
            .backgroundColor($r('app.color.bg_primary'))
            .fontColor($r('app.color.text_secondary'))
            .border({ width: 0.5, color: $r('app.color.border_light') })
            .borderRadius(6)
            .layoutWeight(1)
            .onClick(() => this.cancel())

          Button(this.submitting ? '解密中...' : '解锁')
            .fontSize(13)
            .fontColor($r('app.color.bg_primary'))
            .backgroundColor($r('app.color.brand_color'))
            .borderRadius(6)
            .layoutWeight(1)
            .enabled(!this.submitting)
            .onClick(() => this.submit())
        }
        .width('100%')
      }
      .padding(24)
      .backgroundColor($r('app.color.bg_primary'))
      .borderRadius(12)
      .shadow({ radius: 32, color: '#1A000000', offsetX: 0, offsetY: 12 })
    }
  }

  /**
   * 取消
   */
  private cancel(): void {
    this.pinInput = '';
    this.showError = false;
    this.vm.pendingAiText = '';
    this.vm.pendingAiIsImage = false;
    this.vm.closeModal('pin');
  }

  /**
   * 提交 PIN 解锁
   */
  private async submit(): Promise<void> {
    if (this.pinInput.length < 4) {
      this.showError = true;
      return;
    }
    this.submitting = true;
    try {
      const ok = await this.vm.unlockWithPin(this.pinInput);
      if (ok) {
        this.vm.closeModal('pin');
        // 恢复挂起的 AI 请求
        if (this.vm.pendingAiText) {
          const pending = this.vm.pendingAiText;
          const isImg = this.vm.pendingAiIsImage;
          this.vm.pendingAiText = '';
          this.vm.pendingAiIsImage = false;
          // 由页面层重新触发 processAiInput（通过返回值无法直接提交表单，交给 Index 页处理）
          AppViewModel.getInstance().showToast('已解锁，请重新提交');
        }
        this.pinInput = '';
        this.showError = false;
      } else {
        this.showError = true;
      }
    } catch (e) {
      this.showError = true;
    } finally {
      this.submitting = false;
    }
  }
}
