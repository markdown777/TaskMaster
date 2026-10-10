/**
 * 分享菜单组件
 * 对齐 shareManager.showShareMenu：复制 / 邮件 / 系统分享 三种方式
 */
import { AppViewModel } from '../viewmodel/AppViewModel';
import { ShareManager } from '../services/ShareManager';
import { common } from '@kit.AbilityKit';

@Component
export struct ShareMenu {
  @ObjectLink vm: AppViewModel;

  build() {
    if (this.vm.modals.share) {
      Column({ space: 16 }) {
        Text('选择分享方式')
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.text_primary'))

        // 复制到剪贴板
        ShareButton({ label: '复制为文本', icon: '📋' })
          .onClick(() => this.copyShare())

        // 邮件分享
        ShareButton({ label: '邮件分享', icon: '✉️' })
          .onClick(() => this.emailShare())

        // 系统分享
        ShareButton({ label: '系统分享', icon: '📤' })
          .onClick(() => this.systemShare())

        // 取消
        Button('取消')
          .fontSize(13)
          .backgroundColor($r('app.color.bg_primary'))
          .fontColor($r('app.color.text_secondary'))
          .border({ width: 0.5, color: $r('app.color.border_light') })
          .borderRadius(6)
          .width('100%')
          .onClick(() => this.vm.closeModal('share'))
      }
      .padding(20)
      .backgroundColor($r('app.color.bg_primary'))
      .borderRadius(12)
      .shadow({ radius: 32, color: '#1A000000', offsetX: 0, offsetY: 12 })
    }
  }

  /**
   * 生成分享内容
   */
  private generateContent(): string {
    return ShareManager.getInstance().generateShareContent(this.vm.tasks);
  }

  private async copyShare(): Promise<void> {
    const ok = await ShareManager.getInstance().copyAsText(this.generateContent());
    this.vm.showToast(ok ? '内容已复制到剪贴板！' : '复制失败，请手动复制');
    this.vm.closeModal('share');
  }

  private async emailShare(): Promise<void> {
    const context = getContext(this) as common.UIAbilityContext;
    const ok = await ShareManager.getInstance().shareByEmail(this.generateContent(), context);
    this.vm.showToast(ok ? '已打开邮件应用' : '邮件链接已复制，请粘贴到浏览器地址栏');
    this.vm.closeModal('share');
  }

  private async systemShare(): Promise<void> {
    const context = getContext(this) as common.UIAbilityContext;
    const ok = await ShareManager.getInstance().shareViaSystem(this.generateContent(), context);
    if (!ok) {
      this.vm.showToast('系统分享不可用，内容已复制');
    }
    this.vm.closeModal('share');
  }
}

/**
 * 分享按钮子组件
 */
@Component
struct ShareButton {
  @Prop label: string;
  @Prop icon: string;

  build() {
    Row({ space: 12 }) {
      Text(this.icon).fontSize(18)
      Text(this.label)
        .fontSize(14)
        .fontColor($r('app.color.text_primary'))
        .layoutWeight(1)
    }
    .width('100%')
    .padding({ top: 12, bottom: 12, left: 16, right: 16 })
    .backgroundColor($r('app.color.bg_secondary'))
    .borderRadius(8)
  }
}
