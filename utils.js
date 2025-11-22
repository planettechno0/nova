// --- Markdown Configuration ---
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true
});

// Custom renderer to add Copy buttons to code blocks
const renderer = new marked.Renderer();
renderer.code = function(code, language) {
    const validLang = !!(language && hljs.getLanguage(language));
    const highlighted = validLang 
        ? hljs.highlight(code, { language }).value 
        : hljs.highlightAuto(code).value;
    
    // Escape code for the onclick attribute
    const escapedCode = code.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    
    return `<pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code class="hljs ${language}">${highlighted}</code></pre>`;
};
marked.use({ renderer });

// --- Helper Functions ---

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function copyCode(btn) {
    const pre = btn.parentElement;
    const code = pre.querySelector('code').innerText;
    
    navigator.clipboard.writeText(code).then(() => {
        const originalText = btn.innerText;
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = originalText, 2000);
    }).catch(err => console.error('Failed to copy:', err));
}

function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toast-message');
    const icon = document.getElementById('toast-icon');
    
    msg.innerText = message;
    
    if (type === 'success') {
        toast.classList.remove('bg-red-500');
        toast.classList.add('bg-emerald-600');
        icon.innerText = 'check_circle';
    } else {
        toast.classList.remove('bg-emerald-600');
        toast.classList.add('bg-red-500');
        icon.innerText = 'error';
    }
    
    toast.classList.remove('hidden');
    toast.classList.add('flex');
    
    setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
    }, 3000);
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}
