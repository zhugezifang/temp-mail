import CONFIG from './config.js';

// State management with localStorage
const getStoredEmail = () => localStorage.getItem(CONFIG.EMAIL_KEY);
const getStoredSession = () => localStorage.getItem(CONFIG.SESSION_KEY);
const setStoredEmail = (email) => localStorage.setItem(CONFIG.EMAIL_KEY, email);
const setStoredSession = (sid) => localStorage.setItem(CONFIG.SESSION_KEY, sid);
const clearStoredData = () => {
    localStorage.removeItem(CONFIG.EMAIL_KEY);
    localStorage.removeItem(CONFIG.SESSION_KEY);
};

// Initialize state from localStorage
let currentEmail = getStoredEmail() || '';
let sessionId = getStoredSession() || '';

// DOM Elements
const elements = {
    emailInput: document.getElementById('addr'),
    emailTable: document.getElementById('emails').querySelector('tbody'),
    loadingSpinner: document.getElementById('loading-spinner'),
    errorMessage: document.getElementById('error-message'),
    autoRefreshCheckbox: document.getElementById('auto-refresh'),
    refreshIntervalSelect: document.getElementById('refresh-interval'),
    emailSearch: document.getElementById('email-search'),
    statusLed: document.getElementById('status-led'),
    statusText: document.getElementById('status-text')
};

// Error handling
function showError(message, isSuccess = false) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    elements.errorMessage.style.backgroundColor = isSuccess ? '#DEF7EC' : '#FEE2E2';
    elements.errorMessage.style.color = isSuccess ? '#03543F' : '#DC2626';
    
    setTimeout(() => {
        elements.errorMessage.classList.add('hidden');
    }, 3000);
}

// Loading state
function setLoading(isLoading) {
    if (isLoading) {
        elements.loadingSpinner.classList.remove('hidden');
    } else {
        elements.loadingSpinner.classList.add('hidden');
    }
}

function updateSystemStatus(status) {
    // System status update functionality
}

function setOnline() {
    updateSystemStatus('ONLINE');
}

function setOffline() {
    updateSystemStatus('OFFLINE');
}

function setLoadingStatus() {
    updateSystemStatus('LOADING');
}

// Get session ID
async function getSession() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}?f=get_email_address`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        sessionId = data.sid_token;
        currentEmail = data.email_addr;
        setStoredSession(sessionId);
        setStoredEmail(currentEmail);
        setOnline();
        return sessionId;
    } catch (error) {
        console.error('Error getting session:', error);
        throw error;
    }
}

// Generate random email
async function genEmail() {
    try {
        setLoading(true);
        
        if (!sessionId) {
            await getSession();
        }

        const randomStr = Math.random().toString(36).substring(2, 8);
        const domain = CONFIG.DOMAINS[Math.floor(Math.random() * CONFIG.DOMAINS.length)];
        
        const response = await fetch(`${CONFIG.API_BASE}?f=set_email_user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `sid_token=${sessionId}&email_user=${randomStr}&domain=${domain}`
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        currentEmail = data.email_addr;
        setStoredEmail(currentEmail);
        elements.emailInput.value = currentEmail;
        await refreshMail();
        showError('Новый адрес электронной почты создан!', true);
    } catch (error) {
        console.error('Error generating email:', error);
        showError(`Ошибка создания нового адреса электронной почты: ${error.message}`);
        clearStoredData();
        sessionId = '';
        
        setTimeout(genEmail, CONFIG.RETRY_DELAY);
    } finally {
        setLoading(false);
    }
}

// Copy email to clipboard
async function copyEmail() {
    const email = elements.emailInput.value;
    if (!email) {
        showError('Нет адреса электронной почты для копирования');
        return;
    }

    try {
        await navigator.clipboard.writeText(email);
        showError('Адрес электронной почты скопирован в буфер обмена!', true);
    } catch (error) {
        showError('Ошибка копирования адреса электронной почты: ' + error.message);
    }
}

// Refresh emails
async function refreshMail() {
    if (!currentEmail || !sessionId) {
        showError('Нет активной сессии электронной почты');
        return;
    }
    
    try {
        setLoading(true);
        elements.errorMessage.classList.add('hidden');

        const response = await fetch(`${CONFIG.API_BASE}?f=get_email_list&offset=0&sid_token=${sessionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        updateEmailTable(data.list);
    } catch (error) {
        console.error('Error refreshing mail:', error);
        showError('Ошибка получения писем');
        if (error.message.includes('401')) {
            clearStoredData();
            sessionId = '';
        }
    } finally {
        setLoading(false);
    }
}

// Update email table
function updateEmailTable(emails) {
    elements.emailTable.innerHTML = '';
    
    if (!emails || emails.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="5" class="text-center py-8 text-gray-500 dark:text-gray-400">Нет писем</td>';
        elements.emailTable.appendChild(emptyRow);
        return;
    }

    emails.forEach(email => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200';
        row.innerHTML = `
            <td class="py-4 px-6 text-sm font-mono text-gray-900 dark:text-white">${email.mail_id}</td>
            <td class="py-4 px-6 text-sm text-gray-900 dark:text-white max-w-xs truncate">${email.mail_from}</td>
            <td class="py-4 px-6 text-sm text-gray-900 dark:text-white max-w-xs truncate">${email.mail_subject}</td>
            <td class="py-4 px-6 text-sm text-gray-600 dark:text-gray-300">${new Date(email.mail_timestamp * 1000).toLocaleString('ru-RU')}</td>
            <td class="py-4 px-6">
                <div class="flex items-center gap-2">
                    <button onclick="viewEmail('${email.mail_id}')" 
                            class="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200" 
                            title="Просмотреть детали">
                        <i class="fa-solid fa-eye text-sm"></i>
                    </button>
                    <button onclick="deleteEmail('${email.mail_id}')" 
                            class="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200" 
                            title="Удалить письмо">
                        <i class="fa-solid fa-trash text-sm"></i>
                    </button>
                </div>
            </td>
        `;
        elements.emailTable.appendChild(row);
    });
}

// View email content
async function viewEmail(id) {
    if (!sessionId) {
        showError('Нет активной сессии');
        return;
    }

    try {
        setLoading(true);
        const response = await fetch(`${CONFIG.API_BASE}?f=fetch_email&email_id=${id}&sid_token=${sessionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const email = await response.json();
        showEmailModal(email);
    } catch (error) {
        console.error('Error viewing email:', error);
        showError('Ошибка загрузки содержимого письма');
    } finally {
        setLoading(false);
    }
}

// Show email modal (Russian version)
function showEmailModal(email) {
    const modal = document.createElement('div');
    modal.className = 'email-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="email-modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-90vh overflow-hidden">
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <i class="fa-solid fa-envelope text-white"></i>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-gray-900 dark:text-white truncate max-w-md">${email.mail_subject || '(Без темы)'}</h2>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Детали письма</p>
                    </div>
                </div>
                <button class="close-btn w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200" 
                        onclick="this.closest('.email-modal').remove()">
                    <i class="fa-solid fa-times text-lg"></i>
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto max-h-96">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div class="space-y-3">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-user text-blue-600 dark:text-blue-400"></i>
                            <span class="font-semibold text-gray-900 dark:text-white">Отправитель:</span>
                        </div>
                        <p class="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 break-all">${email.mail_from}</p>
                    </div>
                    <div class="space-y-3">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-calendar text-green-600 dark:text-green-400"></i>
                            <span class="font-semibold text-gray-900 dark:text-white">Время получения:</span>
                        </div>
                        <p class="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">${new Date(email.mail_timestamp * 1000).toLocaleString('ru-RU')}</p>
                    </div>
                </div>
                
                <div class="space-y-3 mb-6">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-file-text text-purple-600 dark:text-purple-400"></i>
                        <span class="font-semibold text-gray-900 dark:text-white">Содержимое письма:</span>
                    </div>
                    <div class="email-body bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 max-h-80 overflow-y-auto">
                        <div class="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                            ${email.mail_body || '<p class="text-gray-500 dark:text-gray-400 italic">Это письмо не содержит текста</p>'}
                        </div>
                    </div>
                </div>
                
                ${email.mail_attachments?.length ? `
                    <div class="space-y-3">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-paperclip text-orange-600 dark:text-orange-400"></i>
                            <span class="font-semibold text-gray-900 dark:text-white">Вложения (${email.mail_attachments.length}):</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            ${email.mail_attachments.map(att => `
                                <button onclick="downloadAttachment('${email.mail_id}', '${att.name}')" 
                                        class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg transition-all duration-200 text-left">
                                    <i class="fa-solid fa-download text-blue-600 dark:text-blue-400"></i>
                                    <span class="text-gray-900 dark:text-white truncate">${att.name}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Download attachment
async function downloadAttachment(emailId, filename) {
    if (!sessionId) {
        showError('Нет активной сессии');
        return;
    }

    try {
        showError('Загрузка вложения...', true);
        const response = await fetch(`${CONFIG.API_BASE}?f=fetch_attachment&email_id=${emailId}&sid_token=${sessionId}&file_name=${filename}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showError('Вложение успешно загружено!', true);
    } catch (error) {
        console.error('Error downloading attachment:', error);
        showError('Ошибка загрузки вложения');
    }
}

// Delete email
async function deleteEmail(id) {
    if (!sessionId) {
        showError('Нет активной сессии');
        return;
    }

    if (!confirm('Вы уверены, что хотите удалить это письмо?')) {
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_BASE}?f=del_email&sid_token=${sessionId}&email_ids[]=${id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        refreshMail();
        showError('Письмо успешно удалено!', true);
    } catch (error) {
        console.error('Error deleting email:', error);
        showError('Ошибка удаления письма');
    }
}

// Auto refresh functionality
let refreshInterval;

const loadAutoRefreshSettings = () => {
    const autoRefresh = localStorage.getItem(CONFIG.AUTO_REFRESH_KEY) === 'true';
    const interval = localStorage.getItem(CONFIG.REFRESH_INTERVAL_KEY) || '30';
    
    elements.autoRefreshCheckbox.checked = autoRefresh;
    elements.refreshIntervalSelect.value = interval;
    
    if (autoRefresh) {
        refreshInterval = setInterval(refreshMail, interval * 1000);
    }
};

elements.autoRefreshCheckbox.addEventListener('change', function(e) {
    localStorage.setItem(CONFIG.AUTO_REFRESH_KEY, e.target.checked);
    if (e.target.checked) {
        const interval = elements.refreshIntervalSelect.value;
        refreshInterval = setInterval(refreshMail, interval * 1000);
    } else {
        clearInterval(refreshInterval);
    }
});

elements.refreshIntervalSelect.addEventListener('change', function(e) {
    localStorage.setItem(CONFIG.REFRESH_INTERVAL_KEY, e.target.value);
    if (elements.autoRefreshCheckbox.checked) {
        clearInterval(refreshInterval);
        refreshInterval = setInterval(refreshMail, e.target.value * 1000);
    }
});

// Search functionality
elements.emailSearch.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#emails tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
});

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    loadAutoRefreshSettings();
    if (currentEmail && sessionId) {
        elements.emailInput.value = currentEmail;
        refreshMail();
    } else {
        await genEmail();
    }
});

// Export functions for global access
window.genEmail = genEmail;
window.copyEmail = copyEmail;
window.refreshMail = refreshMail;
window.viewEmail = viewEmail;
window.deleteEmail = deleteEmail;
window.downloadAttachment = downloadAttachment; 