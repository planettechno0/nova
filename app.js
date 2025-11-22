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
    
    if (currentChat.messages.length === 0) {
        currentChat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        renderHistorySidebar();
    }

    const userMessageObj = { role: 'user', text: text, image: state.currentImage };
    currentChat.messages.push(userMessageObj);
    saveChats();

    // 3. Prepare History
    const apiHistory = currentChat.messages.map(msg => {
        const parts = [{ text: msg.text }];
        if (msg.image) {
            const base64Data = msg.image.split(',')[1];
            const mimeType = msg.image.substring(msg.image.indexOf(':') + 1, msg.image.indexOf(';'));
            parts.push({ inlineData: { mimeType, data: base64Data } });
        }
        return { role: msg.role === 'user' ? 'user' : 'model', parts };
    });

    removeImage();
    els.typingIndicator.classList.remove('hidden');
    scrollToBottom();

    // 4. Create Placeholder
    const aiDiv = appendMessageToUI('model', '...');
    const proseDiv = aiDiv.querySelector('.prose');
    proseDiv.innerHTML = ''; 

    // 5. Call API
    await streamGeminiResponse(
        state.apiKey,
        state.model,
        apiHistory,
        state.systemInstruction,
        (chunkText) => {
            els.typingIndicator.classList.add('hidden');
            proseDiv.innerHTML = marked.parse(chunkText);
            scrollToBottom();
        },
        (fullText) => {
            currentChat.messages.push({ role: 'model', text: fullText });
            saveChats();
            state.isGenerating = false;
            els.sendBtn.disabled = false;
            els.sendBtn.classList.remove('opacity-50');
            els.userInput.focus();
            hljs.highlightAll();
        },
        (errorMessage) => {
            els.typingIndicator.classList.add('hidden');
            
            // --- FIX FOR 404 ERROR ---
            if (errorMessage.includes('404')) {
                showToast("Model not found. Resetting to Gemini 1.5 Flash...");
                // Reset model to a known working one
                state.model = "gemini-1.5-flash";
                localStorage.setItem('nova_model', "gemini-1.5-flash");
                els.modelSelect.value = "gemini-1.5-flash";
                
                // Optional: Retry automatically (recursive call)
                // For now, we just stop and let the user try again
            } else {
                showToast(errorMessage);
            }
            
            proseDiv.innerHTML += `<br><span class="text-red-500 font-medium text-sm">[Error: ${errorMessage}. Please try again.]</span>`;
            state.isGenerating = false;
            els.sendBtn.disabled = false;
            els.sendBtn.classList.remove('opacity-50');
        }
    );
}
