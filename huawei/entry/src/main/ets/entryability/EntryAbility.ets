/**
 * 入口 Ability
 * 负责 preferences 初始化、备份定时注册、加载首页
 */
import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { StorageAdapter } from '../adapters/StorageAdapter';
import { ReminderManager } from '../services/ReminderManager';
import { AppViewModel } from '../viewmodel/AppViewModel';

const DOMAIN = 0x5401;
const TAG = 'TaskMaster.EntryAbility';

export default class EntryAbility extends UIAbility {
  async onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): Promise<void> {
    hilog.info(DOMAIN, TAG, 'onCreate: TaskMaster 启动');

    try {
      // 初始化全局存储适配器（preferences 实例需要 ability context）
      await StorageAdapter.init(this.context);
      hilog.info(DOMAIN, TAG, 'StorageAdapter 初始化完成');

      // 初始化提醒服务
      await ReminderManager.init(this.context);
      hilog.info(DOMAIN, TAG, 'ReminderManager 初始化完成');

      // 加载全局状态到 AppStorage
      const vm = AppViewModel.getInstance();
      await vm.bootstrap();
      hilog.info(DOMAIN, TAG, 'AppViewModel 数据加载完成');
    } catch (e) {
      hilog.error(DOMAIN, TAG, `初始化失败: ${(e as Error).message}`);
    }
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(DOMAIN, TAG, 'onNewWant');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    hilog.info(DOMAIN, TAG, 'onWindowStageCreate');
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, TAG, `加载首页失败: ${JSON.stringify(err)}`);
        return;
      }
      hilog.info(DOMAIN, TAG, '首页加载完成');
    });
  }

  onWindowStageDestroy(): void {
    hilog.info(DOMAIN, TAG, 'onWindowStageDestroy');
  }

  onForeground(): void {
    hilog.info(DOMAIN, TAG, 'onForeground');
    // 应用回到前台时触发一次备份检查（弥补后台限制下的备份遗漏）
    AppViewModel.getInstance().checkBackupOnForeground();
  }

  onBackground(): void {
    hilog.info(DOMAIN, TAG, 'onBackground');
  }
}
