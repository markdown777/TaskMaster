// 推送系统核心
chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '任务提醒',
    message: alarm.name
  });
});

// 新任务推送
chrome.runtime.onMessage.addListener((req) => {
  if (req.type === 'NEW_TASK') {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '任务已添加',
    message: req.text
    });
  }
});

const REQUIRED_FILES = [
  'manifest.json',
  'popup.html',
  'icons/icon128.png'
];

chrome.runtime.onInstalled.addListener(() => {
  REQUIRED_FILES.forEach(file => {
    fetch(chrome.runtime.getURL(file))
      .catch(() => console.error(`核心文件缺失: ${file}`));
  });
});
