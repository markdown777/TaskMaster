/**
 * TaskMaster 测试脚本
 * 用于验证扩展的核心功能
 */

// 测试任务管理器
async function testTaskManager() {
  console.log('=== 测试任务管理器 ===');
  
  try {
    const taskManager = new TaskManager();
    
    // 测试添加任务
    console.log('测试添加任务...');
    const newTask = await taskManager.addTask({
      text: '测试任务',
      priority: 'high',
      tags: ['测试', '重要'],
      due: new Date(Date.now() + 3600000).toISOString()
    });
    console.log('添加任务成功:', newTask);
    
    // 测试获取所有任务
    console.log('测试获取所有任务...');
    const tasks = await taskManager.getAllTasks();
    console.log('获取任务成功，共', tasks.length, '个任务');
    
    // 测试更新任务
    console.log('测试更新任务...');
    const updatedTask = await taskManager.updateTask(newTask.id, {
      text: '更新后的测试任务'
    });
    console.log('更新任务成功:', updatedTask);
    
    // 测试切换任务状态
    console.log('测试切换任务状态...');
    const toggledTask = await taskManager.toggleTaskComplete(newTask.id);
    console.log('切换任务状态成功，新状态:', toggledTask.completed);
    
    // 测试删除任务
    console.log('测试删除任务...');
    await taskManager.deleteTask(newTask.id);
    const tasksAfterDelete = await taskManager.getAllTasks();
    console.log('删除任务成功，剩余任务数:', tasksAfterDelete.length);
    
    console.log('=== 任务管理器测试完成 ===');
  } catch (error) {
    console.error('任务管理器测试失败:', error);
  }
}

// 测试分享管理器
function testShareManager() {
  console.log('=== 测试分享管理器 ===');
  
  try {
    const shareManager = new ShareManager();
    
    // 测试生成分享内容
    console.log('测试生成分享内容...');
    const testTasks = [
      {
        id: Date.now(),
        text: '测试任务1',
        completed: false,
        priority: 'high',
        tags: ['测试', '重要']
      },
      {
        id: Date.now() - 1000,
        text: '测试任务2',
        completed: true,
        priority: 'medium'
      }
    ];
    
    const shareContent = shareManager.generateShareContent(testTasks);
    console.log('生成分享内容成功:', shareContent);
    
    console.log('=== 分享管理器测试完成 ===');
  } catch (error) {
    console.error('分享管理器测试失败:', error);
  }
}

// 测试工具函数
function testUtils() {
  console.log('=== 测试工具函数 ===');
  
  try {
    // 测试HTML转义
    console.log('测试HTML转义...');
    const testHtml = '<script>alert("XSS")</script>';
    const escapedHtml = escapeHtml(testHtml);
    console.log('转义前:', testHtml);
    console.log('转义后:', escapedHtml);
    
    // 测试日期格式化
    console.log('测试日期格式化...');
    const testDate = new Date();
    const formattedDate = formatDateTime(testDate);
    console.log('格式化日期:', formattedDate);
    
    // 测试防抖函数
    console.log('测试防抖函数...');
    let callCount = 0;
    const debouncedFn = debounce(() => {
      callCount++;
      console.log('防抖函数被调用');
    }, 100);
    
    debouncedFn();
    debouncedFn();
    debouncedFn();
    
    setTimeout(() => {
      console.log('防抖函数调用次数:', callCount);
      console.log('=== 工具函数测试完成 ===');
    }, 200);
  } catch (error) {
    console.error('工具函数测试失败:', error);
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('开始运行TaskMaster测试...');
  
  await testTaskManager();
  testShareManager();
  testUtils();
  
  console.log('所有测试完成！');
}

// 当DOM加载完成后运行测试
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', runAllTests);
} else {
  // 在Node.js环境中运行
  runAllTests();
}
