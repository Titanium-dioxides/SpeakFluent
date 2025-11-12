// 应用状态管理
class AppState {
    constructor() {
        this.currentPage = 'introPage';
        this.conversations = [];
        this.currentConversation = null;
        this.messages = [];
        this.currentScenario = 'free_talk';
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.baseUrl = 'http://127.0.0.1:8000';
        this.speechRate = 1.0;
        this.userInfo = null;
        this.isOnline = false;
    }

    // 初始化应用状态
    init() {
        this.setupEventListeners();
        this.checkAuthentication();
    }

    // 检查认证状态 - 修复这个方法
    checkAuthentication() {
        const token = localStorage.getItem('auth_token');
        const user = localStorage.getItem('current_user');
        
        console.log('检查认证状态:', { token, user }); // 调试信息
        
        if (token && user) {
            this.userInfo = { username: user };
            this.isOnline = localStorage.getItem('online_mode') === 'true';
            console.log('用户已登录，跳转到主页面'); // 调试信息
            showPage('mainPage');
            this.updateUserDisplay();
            loadConversations(); // 确保加载对话列表
        } else {
            console.log('用户未登录，显示介绍页面'); // 调试信息
            showPage('introPage');
        }
    }

    // 更新用户显示
    updateUserDisplay() {
        const userNameElement = document.getElementById('currentUserName');
        if (userNameElement && this.userInfo) {
            userNameElement.textContent = this.userInfo.username;
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 确保表单提交事件正确绑定
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
    }

    // 修改登录处理方法
    async handleLogin(event) {
        if (event) event.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const messageDiv = document.getElementById('loginMessage');

        try {
            messageDiv.innerHTML = '<div class="loading">登录中...</div>';
            
            let user;
            
            // 先尝试在线登录
            try {
                console.log('尝试在线登录...');
                const data = await apiService.login(username, password);
                localStorage.setItem('auth_token', data.access_token);
                localStorage.setItem('current_user', username);
                localStorage.setItem('online_mode', 'true');
                this.isOnline = true;
                user = { username };
                console.log('在线登录成功');
            } catch (onlineError) {
                console.log('在线登录失败，尝试离线登录:', onlineError);
                
                // 离线登录
                user = offlineStorage.authenticateUser(username, password);
                localStorage.setItem('current_user', username);
                localStorage.setItem('online_mode', 'false');
                localStorage.setItem('auth_token', `offline_token_${Date.now()}`);
                this.isOnline = false;
                console.log('离线登录成功');
            }

            this.userInfo = user;
            messageDiv.innerHTML = '<div class="success">登录成功！正在跳转...</div>';
            
            // 确保有足够的延迟让用户看到成功消息
            setTimeout(() => {
                console.log('执行页面跳转到 mainPage');
                showPage('mainPage');
                this.updateUserDisplay();
                loadConversations(); // 加载对话列表
                document.getElementById('loginForm').reset();
            }, 1000);
            
        } catch (error) {
            console.error('登录错误:', error);
            messageDiv.innerHTML = `<div class="error">${error.message}</div>`;
        }
    }

    // 修改注册处理方法
    async handleRegister(event) {
        if (event) event.preventDefault();
        
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const messageDiv = document.getElementById('registerMessage');

        try {
            // 验证输入
            if (!username || !password) {
                throw new Error('请填写所有字段');
            }
            
            if (password !== confirmPassword) {
                throw new Error('两次输入的密码不一致');
            }
            
            if (password.length < 6) {
                throw new Error('密码长度至少6位');
            }

            messageDiv.innerHTML = '<div class="loading">注册中...</div>';
            
            let user;
            
            // 先尝试在线注册
            try {
                console.log('尝试在线注册...');
                const data = await apiService.register(username, password);
                user = data.user;
                localStorage.setItem('online_mode', 'true');
                this.isOnline = true;
                console.log('在线注册成功');
            } catch (onlineError) {
                console.log('在线注册失败，使用离线注册:', onlineError);
                
                // 离线注册
                user = offlineStorage.registerUser(username, password);
                localStorage.setItem('online_mode', 'false');
                this.isOnline = false;
                console.log('离线注册成功');
            }

            // 自动登录
            localStorage.setItem('current_user', username);
            localStorage.setItem('auth_token', `token_${Date.now()}`);
            this.userInfo = { username };
            
            messageDiv.innerHTML = '<div class="success">注册成功！正在跳转到主页面...</div>';
            
            setTimeout(() => {
                console.log('执行页面跳转到 mainPage');
                showPage('mainPage');
                this.updateUserDisplay();
                loadConversations(); // 加载对话列表
                document.getElementById('registerForm').reset();
            }, 1500);
            
        } catch (error) {
            console.error('注册错误:', error);
            messageDiv.innerHTML = `<div class="error">${error.message}</div>`;
        }
    }
}

// 创建全局应用状态实例
const appState = new AppState();

// 场景配置
const scenarios = {
    daily_life: { 
        name: '日常生活', 
        level: '初级', 
        description: '日常交流场景',
        prompt: 'You are a friendly native English speaker having a casual daily conversation. Use simple vocabulary and clear pronunciation.'
    },
    workplace: { 
        name: '职场商务', 
        level: '中级', 
        description: '商务沟通场景',
        prompt: 'You are a professional colleague in a business setting. Use formal but conversational English with business vocabulary.'
    },
    academic: { 
        name: '学术学习', 
        level: '中级', 
        description: '学术讨论场景',
        prompt: 'You are an academic tutor discussing educational topics. Use academic vocabulary and clear explanations.'
    },
    travel: { 
        name: '旅行度假', 
        level: '初级', 
        description: '旅行交流场景',
        prompt: 'You are a helpful local guide or travel companion. Use practical travel vocabulary and friendly tone.'
    },
    social: { 
        name: '社交活动', 
        level: '中级', 
        description: '社交互动场景',
        prompt: 'You are a friend at a social gathering. Use natural, conversational English with common expressions.'
    },
    free_talk: { 
        name: '自由对话', 
        level: '自适应', 
        description: '开放式对话',
        prompt: 'You are an adaptive English tutor. Adjust your language level based on the user\'s proficiency. Provide gentle corrections and encouragement.'
    }
};

// API 服务类
class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    async requestWithAuth(endpoint, options = {}) {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        return this.request(endpoint, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });
    }

    // 用户认证相关方法
    async login(username, password) {
        const form = new URLSearchParams();
        // OAuth2PasswordRequestForm 需要表单编码
        form.append('username', username);
        form.append('password', password);
        form.append('grant_type', 'password'); // OAuth2 密码模式需要为 'password'
        form.append('scope', '');            // 可留空
        form.append('client_id', '');        // 可留空
        form.append('client_secret', '');    // 可留空

        const response = await fetch(`${this.baseUrl}/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: form.toString()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    async register(username, password) {
        return this.request('/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    // 对话管理相关方法
    async getConversations() {
        return this.requestWithAuth('/conversations');
    }

    async createConversation(title, scenario, level) {
        return this.requestWithAuth('/conversations', {
            method: 'POST',
            body: JSON.stringify({ title, scenario, level })
        });
    }

    async sendChatMessage(conversationId, formData) {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/chat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async deleteConversation(conversationId) {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
}

// 创建API服务实例
const apiService = new ApiService('http://127.0.0.1:8000');

// 离线存储服务
class OfflineStorage {
    constructor() {
        this.usersKey = 'speakfluent_users';
        this.conversationsKey = 'speakfluent_conversations';
    }

    // ✅ 优先在线注册，失败则离线注册
    async register(username, password) {
        try {
            const response = await fetch('http://127.0.0.1:8000/register', {  // 建议用 http
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail?.[0]?.msg || '注册失败');
            }

            const result = await response.json();
            console.log('✅ 服务器注册成功:', result);

            localStorage.setItem('online_mode', 'true');
            localStorage.setItem('current_user', username);
            return result;
        } catch (error) {
            console.warn('🌐 在线注册失败，转为离线注册:', error.message);
            const user = this.registerUser(username, password);
            localStorage.setItem('online_mode', 'false');
            localStorage.setItem('current_user', username);
            return user;
        }
    }

    // ✅ 优先在线登录，失败则离线验证
    async login(username, password) {
        try {
            const response = await fetch('http://127.0.0.1:8000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail?.[0]?.msg || '登录失败');
            }

            const result = await response.json();
            console.log('✅ 服务器登录成功:', result);

            localStorage.setItem('auth_token', result.access_token);
            localStorage.setItem('current_user', username);
            localStorage.setItem('online_mode', 'true');

            return { username, online: true };

        } catch (error) {
            console.warn('🌐 在线登录失败，尝试离线登录:', error.message);
            const user = this.authenticateUser(username, password);

            localStorage.setItem('auth_token', `offline_token_${Date.now()}`);
            localStorage.setItem('current_user', username);
            localStorage.setItem('online_mode', 'false');

            return { username, online: false };
        }
    }

    // ==========================
    // 🧩 以下是你原有的离线逻辑
    // ==========================

    // 用户管理
    registerUser(username, password) {
        const users = this.getUsers();
        
        if (users.find(u => u.username === username)) {
            throw new Error('用户名已存在');
        }

        const newUser = {
            id: Date.now().toString(),
            username,
            password: btoa(password), // ⚠️ 简单编码，仅演示
            created_at: new Date().toISOString()
        };

        users.push(newUser);
        localStorage.setItem(this.usersKey, JSON.stringify(users));
        
        return newUser;
    }

    authenticateUser(username, password) {
        const users = this.getUsers();
        const user = users.find(u => u.username === username && u.password === btoa(password));
        
        if (!user) {
            throw new Error('用户名或密码错误');
        }

        return user;
    }

    getUsers() {
        return JSON.parse(localStorage.getItem(this.usersKey) || '[]');
    }

    // 对话管理
    createConversation(title, scenario, level) {
        const conversations = this.getConversations();
        const user = localStorage.getItem('current_user');
        
        const newConversation = {
            id: `conv_${Date.now()}`,
            title,
            scenario,
            level,
            user,
            created_at: new Date().toISOString(),
            message_count: 0,
            messages: []
        };

        conversations.unshift(newConversation);
        localStorage.setItem(this.conversationsKey, JSON.stringify(conversations));
        
        return newConversation;
    }

    getConversations() {
        const user = localStorage.getItem('current_user');
        const allConversations = JSON.parse(localStorage.getItem(this.conversationsKey) || '[]');
        return allConversations.filter(conv => conv.user === user);
    }

    addMessage(conversationId, message) {
        const conversations = this.getConversations();
        const conversation = conversations.find(conv => conv.id === conversationId);
        
        if (conversation) {
            conversation.messages.push({
                ...message,
                id: `msg_${Date.now()}`,
                timestamp: new Date().toISOString()
            });
            conversation.message_count = conversation.messages.length;
            localStorage.setItem(this.conversationsKey, JSON.stringify(conversations));
        }
    }

    getConversationMessages(conversationId) {
        const conversations = this.getConversations();
        const conversation = conversations.find(conv => conv.id === conversationId);
        return conversation ? conversation.messages : [];
    }
}

// ✅ 创建唯一实例（供全局使用）
const offlineStorage = new OfflineStorage();

// 页面控制函数 - 修复这些函数
function showPage(pageId) {
    console.log('显示页面:', pageId); // 调试信息
    
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {page.classList.remove('active');});
    document.getElementById(pageId).classList.add('active');
    
    // 显示目标页面
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        appState.currentPage = pageId;
        console.log('页面切换成功:', pageId);
    } else {
        console.error('找不到页面:', pageId);
    }
    
    // 页面特定的初始化
    if (pageId === 'mainPage') {
        console.log('初始化主页面');
        // 确保用户信息显示正确
        appState.updateUserDisplay();
        // 加载对话列表
        setTimeout(() => {
            loadConversations();
            showScenarioPage();
        }, 100);
    }
}

function computeMessagesHeight() {
  const chatPage = document.getElementById('chatPage');
  if (!chatPage) return;

  const header = chatPage.querySelector('.chat-header');
  const controls = chatPage.querySelector('.chat-controls');
  const messagesContainer = chatPage.querySelector('.messages-container');

  // 如果没有 messagesContainer，就退出
  if (!messagesContainer) return;

  // 获取 header / controls 的实际高度（包括 margin）
  const headerRect = header ? header.getBoundingClientRect() : { height: 0 };
  const controlsRect = controls ? controls.getBoundingClientRect() : { height: 0 };

  // 计算占用空间（加上小幅余量），然后用视口高度减去它们得到 messages 区高度
  const reserved = headerRect.height + controlsRect.height + 40; // 40 = 额外间距，可微调
  const h = Math.max(150, window.innerHeight - reserved); // 最小高度保护

  // 强制 messagesContainer 成为可滚动区域，并设置高度
  messagesContainer.style.overflowY = 'auto';
  messagesContainer.style.webkitOverflowScrolling = 'touch';
  messagesContainer.style.height = h + 'px';
  messagesContainer.style.minHeight = '200px';
  messagesContainer.style.maxHeight = 'calc(100vh - ' + (reserved - 20) + 'px)'; // 兼容
}

function showChatPage() {
    console.log('显示聊天页面');

    // 隐藏其他 content-page
    document.querySelectorAll('.content-page').forEach(page => {
        page.classList.remove('active');
    });

    const chatPage = document.getElementById('chatPage');
    if (chatPage) {
        chatPage.classList.add('active');

        // 禁止页面整体滚动（只在聊天页时）
        document.body.style.overflow = 'hidden';

        // 计算并设置 messages 容器高度、允许其滚动
        computeMessagesHeight();

        // 确保 messages 容器滚到底
        const messagesContainer = chatPage.querySelector('.messages-container');
        if (messagesContainer) {
            // small timeout to let layout 稳定后滚动
            setTimeout(() => { messagesContainer.scrollTop = messagesContainer.scrollHeight; }, 50);
        }
    } else {
        console.error('找不到 chatPage');
    }
}

function showScenarioPage() {
    console.log('显示场景选择页面');

    // 隐藏所有 content-page
    document.querySelectorAll('.content-page').forEach(page => {
        page.classList.remove('active');
    });

    const scenarioPage = document.getElementById('scenarioPage');
    if (scenarioPage) scenarioPage.classList.add('active');

    // 恢复整页滚动
    document.body.style.overflow = 'auto';

    // 清除 messages 容器的强制高度（若有）
    const chatPage = document.getElementById('chatPage');
    if (chatPage) {
        const messagesContainer = chatPage.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.style.height = '';
            messagesContainer.style.maxHeight = '';
            messagesContainer.style.overflowY = '';
        }
    }
}

/* ========== 窗口尺寸变化时保持高度正确 ========== */
window.addEventListener('resize', () => {
  // 只有当聊天页显示时才重新计算高度
  const chatPage = document.getElementById('chatPage');
  if (chatPage && chatPage.classList.contains('active')) {
    computeMessagesHeight();
  }
});

/* ========== 安全：当用户刷新或直接进入聊天页，确保 body overflow 正确 ==========
  （可选）当页面加载时，如果 chatPage 是 active，则调用 showChatPage() */
document.addEventListener('DOMContentLoaded', () => {
  const chatPage = document.getElementById('chatPage');
  if (chatPage && chatPage.classList.contains('active')) {
    showChatPage();
  }
});


// 对话管理函数
async function loadConversations() {
    const conversationsList = document.getElementById('conversationsList');
    
    try {
        conversationsList.innerHTML = '<div class="loading">加载对话记录...</div>';
        
        if (appState.isOnline) {
            // 在线模式
            appState.conversations = await apiService.getConversations();
        } else {
            // 离线模式
            appState.conversations = offlineStorage.getConversations();
        }
        
        renderConversationsList();
    } catch (error) {
        console.error('加载对话错误:', error);
        
        // 如果在线模式失败，切换到离线模式
        if (appState.isOnline) {
            appState.isOnline = false;
            localStorage.setItem('online_mode', 'false');
            loadConversations(); // 重新加载
            return;
        }
        
        conversationsList.innerHTML = `
            <div class="empty-state">
                <p>加载对话失败</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

function renderConversationsList() {
    const conversationsList = document.getElementById('conversationsList');
    
    if (appState.conversations.length === 0) {
        conversationsList.innerHTML = `
            <div class="empty-state">
                <p>还没有对话记录</p>
                <small>开始新的对话来创建记录</small>
            </div>
        `;
    } else {
        conversationsList.innerHTML = appState.conversations.map(conv => `
            <div class="conversation-item ${appState.currentConversation?.id === conv.id ? 'active' : ''}" 
                 onclick="openConversation('${conv.id}')">
                <div class="conversation-info">
                    <h4>${conv.title || '未命名对话'}</h4>
                    <span>${formatConversationDate(conv.created_at)} • ${conv.message_count || 0} 条消息</span>
                    ${!appState.isOnline ? '<small style="color: var(--warning);">离线</small>' : ''}
                </div>
            </div>
        `).join('');
    }
}

function formatConversationDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return '今天';
    } else if (diffDays === 2) {
        return '昨天';
    } else if (diffDays <= 7) {
        return `${diffDays - 1}天前`;
    } else {
        return date.toLocaleDateString('zh-CN');
    }
}

async function createNewConversation() {
    try {
        const scenario = scenarios[appState.currentScenario];
        let conversation;
        
        if (appState.isOnline) {
            conversation = await apiService.createConversation(
                `${scenario.name}对话`,
                appState.currentScenario,
                scenario.level
            );
        } else {
            conversation = offlineStorage.createConversation(
                `${scenario.name}对话`,
                appState.currentScenario,
                scenario.level
            );
        }
        
        appState.conversations.unshift(conversation);
        appState.currentConversation = conversation;
        appState.messages = [];
        
        renderConversationsList();
        showChatPage();
        renderMessages();
        
        // 添加欢迎消息
        addMessage('ai', getWelcomeMessage(scenario));
        
    } catch (error) {
        console.error('创建对话错误:', error);
        showError(`创建对话失败: ${error.message}`);
    }
}

function getWelcomeMessage(scenario) {
    const welcomeMessages = {
        daily_life: "Hello! I'm here to practice daily English conversations with you. We can talk about shopping, food, transportation, or anything else from daily life. What would you like to discuss?",
        workplace: "Hello! I'll be your professional colleague for this business English practice. We can discuss meetings, projects, or any workplace topics. How can I assist you today?",
        academic: "Welcome to our academic English session! I'm here to help you practice educational discussions. We can talk about studies, research, or any academic topics you're interested in.",
        travel: "Hi there! I'll be your travel companion for this English practice. We can discuss hotels, attractions, directions, or any travel-related topics. Where shall we go today?",
        social: "Hey! Great to see you at this social gathering. Let's practice some casual English conversation. We can chat about hobbies, events, or anything that interests you!",
        free_talk: "Hello! I'm your adaptive English tutor. I'll adjust to your level and help you improve through natural conversation. What would you like to talk about today?"
    };
    
    return welcomeMessages[appState.currentScenario] || welcomeMessages.free_talk;
}

function selectScenario(scenarioId) {
    appState.currentScenario = scenarioId;
    const scenario = scenarios[scenarioId];
    
    document.getElementById('chatScenario').textContent = scenario.name;
    document.getElementById('chatLevel').textContent = scenario.level;
    
    createNewConversation();
}

function openConversation(conversationId) {
    appState.currentConversation = appState.conversations.find(c => c.id === conversationId);
    if (appState.currentConversation) {
        loadConversationHistory(conversationId);
        renderConversationsList();
        showChatPage();
    }
}

function loadConversationHistory(conversationId) {
    try {
        if (appState.isOnline) {
            // 在线模式：从API加载历史消息
            // 这里需要实现API调用
            appState.messages = [
                {
                    type: 'ai',
                    text: "Hello! I'm your English practice assistant. Let's continue our conversation!",
                    timestamp: new Date(Date.now() - 300000)
                }
            ];
        } else {
            // 离线模式：从本地存储加载
            const messages = offlineStorage.getConversationMessages(conversationId);
            appState.messages = messages.map(msg => ({
                type: msg.type,
                text: msg.text,
                pronunciation: msg.pronunciation,
                feedback: msg.feedback,
                timestamp: new Date(msg.timestamp)
            }));
        }
        
        renderMessages();
    } catch (error) {
        console.error('加载对话历史失败:', error);
        appState.messages = [];
        renderMessages();
    }
}

function endConversation() {
    appState.currentConversation = null;
    appState.messages = [];
    showScenarioPage();
}

// 消息显示函数
function renderMessages() {
    const container = document.getElementById('messagesContainer');
    
    if (appState.messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <div class="ai-message">
                    <div class="message-content">
                        <p>Hello! I'm your English practice assistant. Let's start our conversation! What would you like to talk about today?</p>
                        <span class="message-time">刚刚</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = appState.messages.map(msg => `
            <div class="message ${msg.type}-message">
                <div class="message-content">
                    <p>${msg.text}</p>
                    ${msg.pronunciation ? `<div class="pronunciation-hint">🎯 发音建议: ${msg.pronunciation}</div>` : ''}
                    ${msg.feedback ? `<div class="feedback">📝 学习反馈: ${msg.feedback}</div>` : ''}
                    <span class="message-time">${formatMessageTime(msg.timestamp)}</span>
                </div>
            </div>
        `).join('');
        
        container.scrollTop = container.scrollHeight;
    }
}

function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return '刚刚';
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}小时前`;
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function addMessage(type, text, pronunciation = null, feedback = null) {
    const message = {
        type,
        text,
        pronunciation,
        feedback,
        timestamp: new Date()
    };
    
    appState.messages.push(message);
    
    // 保存到离线存储
    if (appState.currentConversation && !appState.isOnline) {
        offlineStorage.addMessage(appState.currentConversation.id, message);
    }
    
    renderMessages();
}

// 录音功能
async function toggleRecording() {
    if (!appState.isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
}

async function startRecording() {
    try {
        if (!appState.mediaRecorder) {
            await initRecorder();
        }

        appState.audioChunks = [];
        appState.mediaRecorder.start(100);
        appState.isRecording = true;
        
        updateRecordingUI('recording');
        
    } catch (error) {
        console.error('启动录音失败:', error);
        showError('无法启动录音: ' + error.message);
    }
}

function stopRecording() {
    if (appState.mediaRecorder && appState.isRecording) {
        appState.mediaRecorder.stop();
        appState.isRecording = false;
        updateRecordingUI('stopped');
    }
}

async function initRecorder() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        
        appState.mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        appState.audioChunks = [];
        
        appState.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                appState.audioChunks.push(event.data);
            }
        };

        appState.mediaRecorder.onstop = async () => {
            await handleRecordingStop();
        };
        
    } catch (error) {
        console.error('无法访问麦克风:', error);
        throw error;
    }
}

async function handleRecordingStop() {
    try {
        updateRecordingUI('processing');
        
        // 添加用户消息占位符
        addMessage('user', '[录音处理中...]');
        
        // 转换为WAV格式
        const audioBlob = await convertToWav(appState.audioChunks);
        
        // 发送到聊天接口
        await sendToChat(audioBlob);
        
    } catch (error) {
        console.error('处理录音失败:', error);
        updateRecordingUI('error');
        addMessage('ai', '抱歉，处理您的语音时出现了问题。请重试。');
    }
}

async function convertToWav(audioChunks) {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    return encodeAudioBufferToWav(audioBuffer);
}

function encodeAudioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * numChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);

    const interleaved = new Int16Array(length / 2);
    let index = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
            interleaved[index] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            index++;
        }
    }
    
    const int16Array = new Int16Array(buffer, 44);
    int16Array.set(interleaved);

    return new Blob([buffer], { type: 'audio/wav' });
}

async function sendToChat(audioBlob) {
    try {
        let result;
        
        if (appState.isOnline) {
            // 在线模式
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.wav');
            
            if (appState.currentConversation?.id) {
                // 后端通过路径参数接收会话 ID，这里无需再放到表单里
            }
            
            formData.append('scenario', appState.currentScenario);

            result = await apiService.sendChatMessage(appState.currentConversation?.id, formData);
        } else {
            // 离线模式：模拟AI回复
            await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟处理时间
            
            const responses = [
                "That's a great question! Let me think about how to respond in English.",
                "I understand what you're saying. Here's my response in English.",
                "Interesting point! Let me continue our conversation in English.",
                "I appreciate your input. Here's what I think about that topic.",
                "That's a good practice sentence. Let me help you continue the conversation."
            ];
            
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            
            result = {
                reply: randomResponse,
                pronunciation: "Your pronunciation was clear, but try to stress the important words more.",
                feedback: "Good job! Remember to use complete sentences for better practice."
            };
        }
        
        // 更新用户消息为实际转写的文字
        const lastUserMessage = appState.messages[appState.messages.length - 1];
        if (lastUserMessage && lastUserMessage.type === 'user') {
            // 后端目前返回字段为 reply（AI 回复），未返回用户转写文本，这里保持占位
            lastUserMessage.text = lastUserMessage.text === '[录音处理中...]' ? '[语音消息]' : lastUserMessage.text;
        }
        
        // 显示AI回复
        const aiText = result.reply || result.text_response || '...';
        addMessage('ai', aiText, result.pronunciation, result.feedback);
        
        // 使用TTS播放语音
        if (aiText) {
            await tts.speak(aiText, appState.speechRate);
        }
        
        // 更新对话列表显示
        loadConversations();
        
        updateRecordingUI('idle');
        
    } catch (error) {
        console.error('发送聊天请求失败:', error);
        updateRecordingUI('error');
        addMessage('ai', '抱歉，与服务器通信时出现了问题。请检查网络连接后重试。');
    }
}

function updateRecordingUI(state) {
    const button = document.getElementById('recordButton');
    const status = document.getElementById('recordStatus');
    
    if (!button) return;

    switch (state) {
        case 'recording':
            button.innerHTML = '<span class="record-icon">⏹️</span><span class="record-text">停止录音</span>';
            button.classList.add('recording');
            if (status) status.innerHTML = '<span>🎤 录音中... 请讲话</span>';
            break;
        case 'processing':
            button.innerHTML = '<span class="record-icon">⏳</span><span class="record-text">处理中...</span>';
            button.disabled = true;
            if (status) status.innerHTML = '<span>🔄 处理音频中...</span>';
            break;
        case 'idle':
            button.innerHTML = '<span class="record-icon">🎤</span><span class="record-text">开始录音</span>';
            button.classList.remove('recording');
            button.disabled = false;
            if (status) status.innerHTML = `<span>点击按钮开始英语对话 ${!appState.isOnline ? '(离线模式)' : ''}</span>`;
            break;
        case 'error':
            button.innerHTML = '<span class="record-icon">🎤</span><span class="record-text">开始录音</span>';
            button.classList.remove('recording');
            button.disabled = false;
            if (status) status.innerHTML = '<span>❌ 录音失败，请重试</span>';
            break;
    }
}

// TTS 控制函数
function repeatLastMessage() {
    const lastAIMessage = [...appState.messages].reverse().find(msg => msg.type === 'ai');
    if (lastAIMessage) {
        tts.speak(lastAIMessage.text, appState.speechRate);
    }
}

function adjustSpeechRate() {
    const speeds = [0.8, 1.0, 1.2];
    const currentIndex = speeds.indexOf(appState.speechRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    appState.speechRate = speeds[nextIndex];
    
    const speedBtn = document.getElementById('speedBtn');
    const icons = ['🐢', '👤', '🐇'];
    const labels = ['慢速播放', '正常播放', '快速播放'];
    
    speedBtn.innerHTML = `${icons[nextIndex]} ${labels[nextIndex]}`;
    
    // 重复上条消息以演示新速度
    repeatLastMessage();
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('online_mode');
    
    appState.conversations = [];
    appState.currentConversation = null;
    appState.messages = [];
    appState.userInfo = null;
    appState.isOnline = false;
    
    showPage('introPage');
}

// 工具函数
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--error);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 1000;
        max-width: 300px;
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// 添加调试工具
window.debugApp = {
    showState: () => {
        console.log('应用状态:', {
            currentPage: appState.currentPage,
            userInfo: appState.userInfo,
            isOnline: appState.isOnline,
            conversations: appState.conversations,
            currentConversation: appState.currentConversation,
            localStorage: {
                auth_token: localStorage.getItem('auth_token'),
                current_user: localStorage.getItem('current_user'),
                online_mode: localStorage.getItem('online_mode')
            }
        });
    },
    forceShowPage: (pageId) => {
        showPage(pageId);
    },
    clearStorage: () => {
        localStorage.clear();
        location.reload();
    },
    testLogin: (username = 'testuser', password = 'password') => {
        document.getElementById('username').value = username;
        document.getElementById('password').value = password;
        appState.handleLogin(new Event('submit'));
    }
};

console.log('调试命令已加载: debugApp.showState(), debugApp.forceShowPage(), debugApp.clearStorage(), debugApp.testLogin()');

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 加载完成，初始化应用...');
    
    // 先初始化应用状态
    appState.init();
    
    // 然后初始化TTS
    tts.init().then(() => {
        console.log('TTS 初始化完成');
    }).catch(error => {
        console.error('TTS 初始化失败:', error);
    });
    
    // 添加调试信息，显示当前状态
    console.log('初始页面状态:', {
        currentPage: appState.currentPage,
        userInfo: appState.userInfo,
        isOnline: appState.isOnline
    });
});

// 全局函数供HTML调用
window.showPage = showPage;
window.handleLogin = (e) => appState.handleLogin(e);
window.handleRegister = (e) => appState.handleRegister(e);
window.logout = logout;
window.createNewConversation = createNewConversation;
window.selectScenario = selectScenario;
window.showScenarioPage = showScenarioPage;
window.openConversation = openConversation;
window.endConversation = endConversation;
window.toggleRecording = toggleRecording;
window.repeatLastMessage = repeatLastMessage;
window.adjustSpeechRate = adjustSpeechRate;

let conversationToDelete = null;

// 打开弹窗
function showDeleteModal(conversationId) {
  conversationToDelete = conversationId;
  document.getElementById('deleteModal').classList.add('active');
}

// 关闭弹窗
function closeDeleteModal() {
  conversationToDelete = null;
  document.getElementById('deleteModal').classList.remove('active');
}

// 点击确认按钮后执行的删除
document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  if (conversationToDelete) {
    confirmDeleteConversation(conversationToDelete);
    closeDeleteModal();
  }
});

// 真正删除对话的函数
function confirmDeleteConversation(conversationId) {
  if (appState.isOnline) {
    apiService.deleteConversation(conversationId)
      .then(() => {
        // 删除成功后从服务端刷新，避免状态不一致
        return apiService.getConversations();
      })
      .then((list) => {
        appState.conversations = list || [];
        if (appState.currentConversation && appState.currentConversation.id === conversationId) {
          appState.currentConversation = null;
          showScenarioPage();
        }
        renderConversationsList();
      })
      .catch(err => {
        console.error('删除对话失败:', err);
        showError(`删除失败: ${err.message}`);
      });
  } else {
    let conversations = offlineStorage.getConversations();
    conversations = conversations.filter(c => c.id !== conversationId);
    localStorage.setItem(offlineStorage.conversationsKey, JSON.stringify(conversations));
    appState.conversations = conversations;
    renderConversationsList();
    showScenarioPage();
  }
}

// 渲染对话列表
function renderConversationsList() {
  const conversationsList = document.getElementById('conversationsList');
  if (appState.conversations.length === 0) {
    conversationsList.innerHTML = `
      <div class="empty-state">
        <p>还没有对话记录</p>
        <small>开始新的对话来创建记录</small>
      </div>`;
    return;
  }

  conversationsList.innerHTML = appState.conversations.map(conv => `
    <div class="conversation-item ${appState.currentConversation?.id === conv.id ? 'active' : ''}">
      <div class="conversation-info" onclick="openConversation('${conv.id}')">
        <h4>${conv.title || '未命名对话'}</h4>
        <span>${formatConversationDate(conv.created_at)} • ${conv.message_count || 0} 条消息</span>
      </div>
      <button class="delete-btn" onclick="showDeleteModal('${conv.id}')">🗑️</button>
    </div>
  `).join('');
}
document.addEventListener('DOMContentLoaded', () => {
  const convList = document.getElementById('conversationsList');
  convList.addEventListener('click', (e) => {
    const item = e.target.closest('.conversation-item');
    if (!item) return;
    const chatId = item.dataset.chatId;
    loadChat(chatId);
    showChatPage();
  });
});
