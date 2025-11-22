// --- State ---
const DEFAULT_API_KEY = ""; 
let state = {
    apiKey: localStorage.getItem('nova_api_key') || DEFAULT_API_KEY,
    model: localStorage.getItem('nova_model') || "gemini-1.5-flash",
    systemInstruction: localStorage.getItem('nova_sys_instruction') || "",
    theme: localStorage.getItem('nova_theme') || "dark",
    chats: JSON.parse(localStorage.getItem('nova_chats') || "[]"),
    currentChatId: null,
    isGenerating: false,
    currentImage: null
};

// --- DOM Elements ---
const els = {
    app: document.documentElement,
    chatContainer: document.getElementById('chat-container'),
    messagesList: document.getElementById('messages-list'),
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    welcomeScreen: document.getElementById('welcome-screen'),
    typingIndicator: document.getElementById('typing-indicator'),
    imagePreview: document.getElementById('image-preview'),
    previewImg: document.getElementById('preview-img'),
    settingsModal: document.getElementById('settings-modal'),
    settingsContent: document.getElementById('settings-content'),
    sidebar: document.getElementById('sidebar'),
    historyList: document.getElementById('history-list'),
    themeIcon: document.getElementById('theme-icon'),
    // Inputs
    apiKeyInput: document.getElementById('api-key-input'),
    modelSelect: document.getElementById('model-select'),
    sysInstructionInput: document.getElementById('system-instruction-input')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(state.theme);
    renderHistorySidebar();
    
    // Load Settings
    els.apiKeyInput.value = state.apiKey;
    els.modelSelect.value = state.model;
    els.sysInstructionInput.value = state.systemInstruction;

    // Start new chat or load most recent
    if (state.chats.length > 0) {
        loadChat(state.chats[0].id);
    } else {
        startNewChat();
    }
});

// --- Logic ---

function applyTheme(theme) {
    if (theme === 'dark') {
        els.app.classList.add('dark');
        els.themeIcon.innerText = 'light_mode';
    } else {
        els.app.classList.remove('dark');
        els.themeIcon.innerText = 'dark_mode';
    }
    localStorage.setItem('nova_theme', theme);
    state.theme = theme;
}

function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

function toggleSettings() {
    const isHidden = els.settingsModal.classList.contains('hidden');
    if (isHidden) {
        els.settingsModal.classList.remove('hidden');
        requestAnimationFrame(() => {
            els.settingsModal.classList.remove('opacity-0');
            els.settingsContent.classList.remove('scale-95');
            els.settingsContent.classList.add('scale-100');
        });
    } else {
        els.settingsModal.classList.add('opacity-0');
        els.settingsContent.classList.remove('scale-100');
        els.settingsContent.classList.add('scale-95');
        setTimeout(() => els.settingsModal.classList.add('hidden'), 300);
    }
}

function saveSettings() {
    state.apiKey = els.apiKeyInput.value.trim();
    state.model = els.modelSelect.value;
    state.systemInstruction = els.sysInstructionInput.value.trim();

    localStorage.setItem('nova_api_key', state.apiKey);
    localStorage.setItem('nova_model', state.model);
    localStorage.setItem('nova_sys_instruction', state.systemInstruction);

    toggleSettings();
    showToast('Settings Saved', 'success');
}

function toggleSidebar() {
    els.sidebar.classList.toggle('hidden');
    els.sidebar.classList.toggle('absolute');
    els.sidebar.classList.toggle('z-30');
    els.sidebar.classList.toggle('h-full');
}

function startNewChat() {
    state.currentChatId = generateId();
    const newChat = {
        id: state.currentChatId,
        title: "New Conversation",
        timestamp: Date.now(),
        messages: []
    };
    state.chats.unshift(newChat);
    saveChats();
    renderHistorySidebar();
    clearChatUI();
    
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) els.sidebar.classList.add('hidden');
}

function loadChat(id) {
    const chat = state.chats.find(c => c.id === id);
    if (!chat) return;

    state.currentChatId = id;
    clearChatUI();
    
    if (chat.messages.length > 0) {
        els.welcomeScreen.classList.add('hidden');
        els.messagesList.classList.remove('hidden');
        chat.messages.forEach(msg => {
            appendMessageToUI(msg.role, msg.text, msg.image, false);
        });
        scrollToBottom();
    }
    
    renderHistorySidebar();
    if (window.innerWidth < 768) els.sidebar.classList.add('hidden');
}

function saveChats() {
    localStorage.setItem('nova_chats', JSON.stringify(state.chats));
}

function renderHistorySidebar() {
    els.historyList.innerHTML = '';
    state.chats.forEach(chat => {
        const btn = document.createElement('button');
        const isActive = chat.id === state.currentChatId;
        btn.className = `w-full text-left p-3 rounded-lg text-sm transition-colors flex flex-col gap-1 ${
            isActive 
            ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-medium' 
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`;
        btn.onclick = () => loadChat(chat.id);
        
        btn.innerHTML = `
            <span class="truncate block">${chat.title}</span>
            <span class="text-xs opacity-60">${formatDate(chat.timestamp)}</span>
        `;
        els.historyList.appendChild(btn);
    });
}

function clearChatUI() {
    els.messagesList.innerHTML = '';
    els.messagesList.classList.add('hidden');
    els.welcomeScreen.classList.remove('hidden');
    removeImage();
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast("Image too large (Max 5MB)");
        return;
    }
    const reader = new FileReader();
    reader.onloadend = function() {
        state.currentImage = reader.result;
        els.previewImg.src = state.currentImage;
        els.imagePreview.classList.remove('hidden');
    }
    reader.readAsDataURL(file);
    event.target.value = ''; 
}

function removeImage() {
    state.currentImage = null;
    els.imagePreview.classList.add('hidden');
    els.previewImg.src = '';
}

function setPrompt(text) {
    els.userInput.value = text;
    autoResize(els.userInput);
    els.userInput.focus();
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function appendMessageToUI(role, text, image = null, animate = true) {
    els.welcomeScreen.classList.add('hidden');
    els.messagesList.classList.remove('hidden');

    const div = document.createElement('div');
    div.className = `w-full ${animate ? 'message-enter' : ''}`;
    
    if (role === 'user') {
        div.innerHTML = `
            <div class="flex justify-end gap-3">
                <div class="flex flex-col items-end max-w-[85%] md:max-w-[75%]">
                    ${image ? `<img src="${image}" class="h-32 rounded-lg mb-2 border border-slate-200 dark:border-slate-700 object-cover">` : ''}
                    <div class="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-none shadow-md text-sm md:text-base leading-relaxed">
                        ${text.replace(/\n/g, '<br>')}
                    </div>
                </div>
            </div>
        `;
    } else {
        const parsedMarkdown = marked.parse(text);
        div.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-indigo-500/20">
                    <span class="material-symbols-rounded text-white text-sm">auto_awesome</span>
                </div>
                <div class="flex-1 min-w-0 overflow-hidden">
                    <div class="prose dark:prose-invert max-w-none text-sm md:text-base">
                        ${parsedMarkdown}
                    </div>
                </div>
            </div>
        `;
    }

    els.messagesList.appendChild(div);
    return div;
}

function scrollToBottom() {
    els.chatContainer.scrollTo({ top: els.chatContainer.scrollHeight, behavior: 'smooth' });
}

async function sendMessage() {
    const text = els.userInput.value.trim();
    if (!text && !state.currentImage) return;
    if (state.isGenerating) return;

    if (!state.apiKey) {
        toggleSettings();
        showToast("Please enter API Key");
        return;
    }

    // UI Updates
    els.userInput.value = '';
    els.userInput.style.height = 'auto';
    state.isGenerating = true;
    els.sendBtn.disabled = true;
    els.sendBtn.classList.add('opacity-50');

    // 1. Add User Message
    appendMessageToUI('user', text, state.currentImage);
    
    // 2. Update Data Model
    const currentChat = state.chats.find(c => c.id === state.currentChatId);
    
    // Update Title if it's the first message
    if (currentChat.messages.length === 0) {
        currentChat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        renderHistorySidebar();
    }

    const userMessageObj = { role: 'user', text: text, image: state.currentImage };
    currentChat.messages.push(userMessageObj);
    saveChats();

    // 3. Prepare History for API (Convert to Gemini Format)
    const apiHistory = currentChat.messages.map(msg => {
        const parts = [{ text: msg.text }];
        if (msg.image) {
            const base64Data = msg.image.split(',')[1];
            const mimeType = msg.image.substring(msg.image.indexOf(':') + 1, msg.image.indexOf(';'));
            parts.push({ inlineData: { mimeType, data: base64Data } });
        }
        return { role: msg.role === 'user' ? 'user' : 'model', parts };
    });

    // Remove the last message from history array passed to API (as we are sending it now? No, Gemini expects full history including current prompt)
    // Actually, for streamGeminiResponse, we pass the full history.

    removeImage();
    els.typingIndicator.classList.remove('hidden');
    scrollToBottom();

    // 4. Create Placeholder for AI Response
    const aiDiv = appendMessageToUI('model', '...');
    const proseDiv = aiDiv.querySelector('.prose');
    proseDiv.innerHTML = ''; // Clear "..."

    // 5. Call API
    await streamGeminiResponse(
        state.apiKey,
        state.model,
        apiHistory,
        state.systemInstruction,
        (chunkText) => {
            // On Chunk
            els.typingIndicator.classList.add('hidden');
            proseDiv.innerHTML = marked.parse(chunkText);
            scrollToBottom();
        },
        (fullText) => {
            // On Complete
            currentChat.messages.push({ role: 'model', text: fullText });
            saveChats();
            state.isGenerating = false;
            els.sendBtn.disabled = false;
            els.sendBtn.classList.remove('opacity-50');
            els.userInput.focus();
            hljs.highlightAll();
        },
        (errorMessage) => {
            // On Error
            els.typingIndicator.classList.add('hidden');
            showToast(errorMessage);
            proseDiv.innerHTML += `<br><span class="text-red-500 font-medium">[Error: ${errorMessage}]</span>`;
            state.isGenerating = false;
            els.sendBtn.disabled = false;
            els.sendBtn.classList.remove('opacity-50');
        }
    );
}
