import { account } from './appwriteClient.js';

// DOM Elements
const requestPhase = document.getElementById('request-reset-phase');
const updatePhase = document.getElementById('update-password-phase');
const requestForm = document.getElementById('request-reset-form');
const updateForm = document.getElementById('update-password-form');
const themeCheckbox = document.getElementById('theme-checkbox');

// --- Notification Engine ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Optimization: Single DOM listener
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkRecoveryStatus();
});

function initTheme() {
    const themeCheckbox = document.getElementById('theme-checkbox');
    const savedTheme = localStorage.getItem('theme') || 'dark';

    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (themeCheckbox) themeCheckbox.checked = true;
    }

    themeCheckbox?.addEventListener('change', () => {
        const isLight = themeCheckbox.checked;
        document.body.classList.toggle('light-mode', isLight);
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

function checkRecoveryStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    const secret = urlParams.get('secret');

    if (userId && secret) {
        requestPhase.classList.add('hidden');
        updatePhase.classList.remove('hidden');
        showToast("Verificação concluída. Defina sua nova senha.", "success");
    }
}

// Phase 1: Request Reset
requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    const submitBtn = requestForm.querySelector('button');

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = "ENVIANDO...";

        const redirectUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/') + 'recuperar-senha.html';
        await account.createRecovery(email, redirectUrl);

        showToast("Link enviado para o seu e-mail", "success");
        requestForm.reset();
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "SOLICITAR LINK";
    }
});

// Phase 2: Update Password
updateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const submitBtn = updateForm.querySelector('button');

    if (newPassword !== confirmPassword) {
        return showToast("As senhas não coincidem", "error");
    }

    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    const secret = urlParams.get('secret');

    if (!userId || !secret) {
        return showToast("Token de recuperação ausente ou expirado", "error");
    }

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = "ATUALIZANDO...";

        await account.updateRecovery(userId, secret, newPassword, confirmPassword);

        showToast("Senha atualizada com sucesso!", "success");
        setTimeout(() => window.location.href = 'index.html', 2000);
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "ATUALIZAR ACESSO";
    }
});
