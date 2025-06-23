document.addEventListener('DOMContentLoaded', () => {
  const todoList = document.getElementById('todoList');
  const todoInput = document.getElementById('todoInput');
  const addBtn = document.getElementById('addBtn');

  // 加载待办事项
  // 替换原有chrome.storage.local为同步存储
  // 新增同步失败处理
  chrome.storage.sync.get(['todos'], ({ todos }) => {
    if (chrome.runtime.lastError) {
      console.error('同步失败，尝试本地存储');
      chrome.storage.local.get(['todos'], ({ localTodos }) => {
        renderTodos(localTodos || []);
      });
    } else {
      renderTodos(todos);
    }
  });

  // 添加按钮点击事件
  addBtn.addEventListener('click', addTodo);
  
  // 回车键事件
  todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
  });

  function addTodo() {
    const text = todoInput.value.trim();
    if (text) {
      const newTodo = {
        id: Date.now(),
        text,
        priority: false,
        created: new Date().toISOString(),
        completed: null
      };
      
      chrome.storage.local.get(['todos'], ({ todos = [] }) => {
        const updated = [newTodo, ...todos];
        chrome.storage.local.set({ todos: updated }, () => {
          renderTodos(updated);
          todoInput.value = '';
        });
      });
    }
  }

  function renderTodos(todos) {
    todoList.innerHTML = todos.map(todo => `
      <li class="${todo.priority ? 'priority' : ''}">
        <span>${todo.text}</span>
        <div class="controls">
          <span class="timestamp">${formatDate(todo.created)}</span>
          <button class="priority-btn" data-id="${todo.id}">❗</button>
          <button class="delete-btn" data-id="${todo.id}">🗑️</button>
        </div>
      </li>
    `).join('');

    // 添加删除和优先级事件监听
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', deleteTodo);
    });

    document.querySelectorAll('.priority-btn').forEach(btn => {
      btn.addEventListener('click', togglePriority);
    });
  }

  function deleteTodo(e) {
    const id = Number(e.target.dataset.id);
    chrome.storage.local.get(['todos'], ({ todos }) => {
      const updated = todos.filter(t => t.id !== id);
      chrome.storage.local.set({ todos: updated }, () => renderTodos(updated));
    });
  }

  function togglePriority(e) {
    const id = Number(e.target.dataset.id);
    chrome.storage.local.get(['todos'], ({ todos }) => {
      const updated = todos.map(t => {
        if (t.id === id) return { ...t, priority: !t.priority };
        return t;
      }).sort((a, b) => b.priority - a.priority);
      
      chrome.storage.local.set({ todos: updated }, () => renderTodos(updated));
    });
  }

  function formatDate(isoString) {
    const date = new Date(isoString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString().slice(0,5)}`;
  }
  // 在保存前增加加密逻辑
  // 加密函数
  const encrypt = (text, key) => {
    return CryptoJS.AES.encrypt(text, key).toString();
  };
  
  // 解密函数
  const decrypt = (ciphertext, key) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  };
  
  // 在存储时调用加密
  chrome.storage.local.set({
    todos: encrypt(JSON.stringify(todos), encryptionKey)
  });
  
  // 读取时解密
  const decryptData = (ciphertext) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, 'secret-key');
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  };
});