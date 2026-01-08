// ============ State ============
const state = {
    currentPage: 'home',
    transactionType: 'expense',
    selectedCategory: null,
    selectedAccount: null,
    selectedFromAccount: null,
    selectedToAccount: null,
    editingTransactionId: null,
    currentMonth: new Date(),
    accounts: [],
    categories: [],
    transactions: [],
    transfers: [],
    rates: {}
};

// ============ API ============
const api = {
    async get(url) {
        const res = await fetch(url);
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Ошибка сервера');
        }
        return res.json();
    },
    async post(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Ошибка сервера');
        }
        return res.json();
    },
    async put(url, data) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Ошибка сервера');
        }
        return res.json();
    },
    async delete(url) {
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Ошибка сервера');
        }
        return res.json();
    }
};

// ============ Toast ============
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    // Haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
        if (type === 'error') {
            Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        } else if (type === 'success') {
            Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    }
    
    setTimeout(() => toast.remove(), 3000);
}

// ============ Init ============
document.addEventListener('DOMContentLoaded', async () => {
    // Telegram WebApp
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.expand();
        Telegram.WebApp.ready();
    }
    
    await loadData();
    setupEventListeners();
    renderAll();
    
    // Set today's date
    document.getElementById('transactionDate').valueAsDate = new Date();
});

async function loadData() {
    try {
        [state.accounts, state.categories, state.transactions, state.rates] = await Promise.all([
            api.get('/api/accounts'),
            api.get('/api/categories'),
            api.get('/api/transactions?limit=20'),
            api.get('/api/exchange-rates')
        ]);
    } catch (e) {
        console.error('Error loading data:', e);
        showToast('Ошибка загрузки данных', 'error');
    }
}

async function loadTransfers() {
    try {
        state.transfers = await api.get('/api/transfers?limit=20');
    } catch (e) {
        console.error('Error loading transfers:', e);
    }
}

// ============ Event Listeners ============
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });
    
    // Transaction type segments
    document.querySelectorAll('.segment').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.segment').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.transactionType = btn.dataset.type;
            state.selectedCategory = null;
            renderCategories();
        });
    });
    
    // Save transaction
    document.getElementById('saveTransaction').addEventListener('click', saveTransaction);
    
    // Cancel edit
    document.getElementById('cancelEdit').addEventListener('click', cancelEdit);
    
    // Save transfer
    document.getElementById('saveTransfer').addEventListener('click', saveTransfer);
    
    // Transfer amount change
    document.getElementById('transferAmount').addEventListener('input', updateConvertedAmount);
    
    // Month navigation
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    
    // Export
    document.getElementById('exportData').addEventListener('click', exportToExcel);
    
    // Settings buttons
    document.getElementById('addExpenseCategory').addEventListener('click', () => showCategoryModal('expense'));
    document.getElementById('addIncomeCategory').addEventListener('click', () => showCategoryModal('income'));
    document.getElementById('addAccount').addEventListener('click', showAccountModal);
    
    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
}

function navigateTo(page) {
    state.currentPage = page;
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `page-${page}`);
    });
    
    if (page === 'stats') loadStats();
    if (page === 'settings') renderSettings();
    if (page === 'transfer') {
        loadTransfers().then(() => renderTransfers());
        renderTransferAccounts();
    }
    if (page === 'add') {
        resetTransactionForm();
    }
}

// ============ Render Functions ============
function renderAll() {
    renderAccounts();
    renderTransactions();
    renderCategories();
    renderAccountsGrid();
    updateTotalBalance();
}

function renderAccounts() {
    const container = document.getElementById('accountsList');
    
    if (state.accounts.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Нет счетов</p></div>';
        return;
    }
    
    container.innerHTML = state.accounts.map((acc, i) => `
        <div class="account-card ${i === 1 ? 'secondary' : ''} ${acc.currency === 'USDT' ? 'crypto' : ''}">
            <div class="account-icon">${acc.icon}</div>
            <div class="account-name">${acc.name}</div>
            <div class="account-balance">${formatMoney(acc.balance)}</div>
            <div class="account-currency">${acc.currency}</div>
        </div>
    `).join('');
}

function renderTransactions() {
    const container = document.getElementById('transactionsList');
    
    if (state.transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📝</div>
                <p>Нет операций</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.transactions.map(t => `
        <div class="transaction-item" data-id="${t.id}" onclick="editTransaction(${t.id})">
            <div class="transaction-icon" style="background: ${t.category_color}20;">
                ${t.category_icon}
            </div>
            <div class="transaction-info">
                <div class="transaction-category">${t.category_name}</div>
                <div class="transaction-details">${t.account_name} • ${formatDate(t.date)}</div>
            </div>
            <div class="transaction-amount ${t.type}">
                ${t.type === 'expense' ? '-' : '+'}${formatMoney(t.amount)} ${t.account_currency}
            </div>
        </div>
    `).join('');
}

function renderCategories() {
    const container = document.getElementById('categoriesGrid');
    const filtered = state.categories.filter(c => c.type === state.transactionType);
    
    container.innerHTML = filtered.map(c => `
        <button class="category-btn ${state.selectedCategory === c.id ? 'selected' : ''}" 
                data-id="${c.id}" onclick="selectCategory(${c.id})">
            <span class="icon">${c.icon}</span>
            <span class="name">${c.name}</span>
        </button>
    `).join('');
}

function renderAccountsGrid() {
    const container = document.getElementById('accountsGrid');
    
    container.innerHTML = state.accounts.map(a => `
        <button class="account-btn ${state.selectedAccount === a.id ? 'selected' : ''}" 
                data-id="${a.id}" onclick="selectAccount(${a.id})">
            <span class="icon">${a.icon}</span>
            <span class="name">${a.name}</span>
        </button>
    `).join('');
}

function renderTransferAccounts() {
    const fromContainer = document.getElementById('fromAccountGrid');
    const toContainer = document.getElementById('toAccountGrid');
    
    fromContainer.innerHTML = state.accounts.map(a => `
        <button class="account-btn ${state.selectedFromAccount === a.id ? 'selected' : ''}" 
                data-id="${a.id}" onclick="selectFromAccount(${a.id})">
            <span class="icon">${a.icon}</span>
            <span class="name">${a.name}</span>
        </button>
    `).join('');
    
    toContainer.innerHTML = state.accounts.map(a => `
        <button class="account-btn ${state.selectedToAccount === a.id ? 'selected' : ''}" 
                data-id="${a.id}" onclick="selectToAccount(${a.id})">
            <span class="icon">${a.icon}</span>
            <span class="name">${a.name}</span>
        </button>
    `).join('');
}

function renderTransfers() {
    const container = document.getElementById('transfersList');
    
    if (state.transfers.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <div class="icon">🔄</div>
                <p>Нет переводов</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.transfers.map(t => `
        <div class="transfer-item">
            <div class="transfer-icon">🔄</div>
            <div class="transfer-info">
                <div class="transfer-accounts">${t.from_account_name} → ${t.to_account_name}</div>
                <div class="transfer-date">${formatDate(t.date)}</div>
            </div>
            <div class="transfer-amount">
                -${formatMoney(t.amount)} ${t.from_currency}
                <div class="transfer-converted">+${formatMoney(t.converted_amount)} ${t.to_currency}</div>
            </div>
        </div>
    `).join('');
}

function updateTotalBalance() {
    let total = 0;
    state.accounts.forEach(acc => {
        const rate = state.rates[acc.currency] || 1;
        total += acc.balance * rate;
    });
    document.getElementById('totalBalance').textContent = `${formatMoney(total)} BYN`;
}

// ============ Selection ============
function selectCategory(id) {
    state.selectedCategory = id;
    renderCategories();
}

function selectAccount(id) {
    state.selectedAccount = id;
    renderAccountsGrid();
}

function selectFromAccount(id) {
    state.selectedFromAccount = id;
    renderTransferAccounts();
    updateConvertedAmount();
}

function selectToAccount(id) {
    state.selectedToAccount = id;
    renderTransferAccounts();
    updateConvertedAmount();
}

// ============ Transaction ============
function resetTransactionForm() {
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    document.getElementById('transactionDate').valueAsDate = new Date();
    document.getElementById('editTransactionId').value = '';
    document.getElementById('cancelEdit').style.display = 'none';
    document.getElementById('saveTransaction').textContent = 'Сохранить';
    state.selectedCategory = null;
    state.selectedAccount = null;
    state.editingTransactionId = null;
    renderCategories();
    renderAccountsGrid();
}

function cancelEdit() {
    resetTransactionForm();
    showToast('Редактирование отменено', 'info');
}

async function editTransaction(id) {
    try {
        const transaction = await api.get(`/api/transactions/${id}`);
        
        // Set transaction type
        state.transactionType = transaction.type;
        document.querySelectorAll('.segment').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === transaction.type);
        });
        
        // Fill form
        document.getElementById('amount').value = transaction.amount;
        document.getElementById('description').value = transaction.description || '';
        document.getElementById('transactionDate').value = transaction.date.split('T')[0];
        document.getElementById('editTransactionId').value = id;
        
        // Select category and account
        state.selectedCategory = transaction.category_id;
        state.selectedAccount = transaction.account_id;
        state.editingTransactionId = id;
        
        // Update UI
        document.getElementById('cancelEdit').style.display = 'block';
        document.getElementById('saveTransaction').textContent = 'Обновить';
        
        renderCategories();
        renderAccountsGrid();
        navigateTo('add');
    } catch (e) {
        showToast('Ошибка загрузки транзакции', 'error');
    }
}

async function saveTransaction() {
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value;
    const date = document.getElementById('transactionDate').value;
    const editId = document.getElementById('editTransactionId').value;
    
    if (!amount || amount <= 0) {
        showToast('Введите сумму', 'error');
        return;
    }
    if (!state.selectedCategory) {
        showToast('Выберите категорию', 'error');
        return;
    }
    if (!state.selectedAccount) {
        showToast('Выберите счёт', 'error');
        return;
    }
    
    const data = {
        amount,
        type: state.transactionType,
        category_id: state.selectedCategory,
        account_id: state.selectedAccount,
        description,
        date: date || null
    };
    
    try {
        if (editId) {
            await api.put(`/api/transactions/${editId}`, data);
            showToast('Транзакция обновлена', 'success');
        } else {
            await api.post('/api/transactions', data);
            showToast('Транзакция добавлена', 'success');
        }
        
        resetTransactionForm();
        await loadData();
        renderAll();
        navigateTo('home');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ============ Transfers ============
function updateConvertedAmount() {
    const amount = parseFloat(document.getElementById('transferAmount').value) || 0;
    const fromAccount = state.accounts.find(a => a.id === state.selectedFromAccount);
    const toAccount = state.accounts.find(a => a.id === state.selectedToAccount);
    
    if (fromAccount && toAccount && fromAccount.currency !== toAccount.currency) {
        document.getElementById('convertedAmountGroup').style.display = 'block';
        
        const fromRate = state.rates[fromAccount.currency] || 1;
        const toRate = state.rates[toAccount.currency] || 1;
        const converted = (amount * fromRate) / toRate;
        
        document.getElementById('convertedAmount').value = converted.toFixed(2);
        document.getElementById('conversionHint').textContent = 
            `Курс: 1 ${fromAccount.currency} = ${(fromRate / toRate).toFixed(4)} ${toAccount.currency}`;
    } else {
        document.getElementById('convertedAmountGroup').style.display = 'none';
        document.getElementById('convertedAmount').value = amount;
    }
}

async function saveTransfer() {
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const convertedAmount = parseFloat(document.getElementById('convertedAmount').value) || amount;
    
    if (!amount || amount <= 0) {
        showToast('Введите сумму', 'error');
        return;
    }
    if (!state.selectedFromAccount) {
        showToast('Выберите счёт списания', 'error');
        return;
    }
    if (!state.selectedToAccount) {
        showToast('Выберите счёт зачисления', 'error');
        return;
    }
    if (state.selectedFromAccount === state.selectedToAccount) {
        showToast('Выберите разные счета', 'error');
        return;
    }
    
    try {
        await api.post('/api/transfers', {
            from_account_id: state.selectedFromAccount,
            to_account_id: state.selectedToAccount,
            amount,
            converted_amount: convertedAmount
        });
        
        showToast('Перевод выполнен', 'success');
        
        // Reset form
        document.getElementById('transferAmount').value = '';
        document.getElementById('convertedAmount').value = '';
        state.selectedFromAccount = null;
        state.selectedToAccount = null;
        
        await loadData();
        await loadTransfers();
        renderAll();
        renderTransferAccounts();
        renderTransfers();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ============ Stats ============
let categoryChart = null;
let dailyChart = null;

async function loadStats() {
    const month = formatMonth(state.currentMonth);
    document.getElementById('currentMonth').textContent = formatMonthDisplay(state.currentMonth);
    
    try {
        const stats = await api.get(`/api/stats/${month}`);
        
        document.getElementById('totalIncome').textContent = `${formatMoney(stats.total_income)} BYN`;
        document.getElementById('totalExpense').textContent = `${formatMoney(stats.total_expense)} BYN`;
        
        renderCategoryChart(stats.expenses_by_category);
        renderDailyChart(stats.daily_expenses);
        renderLimits(stats.expenses_by_category);
    } catch (e) {
        console.error('Error loading stats:', e);
    }
}

function renderCategoryChart(data) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    if (categoryChart) categoryChart.destroy();
    
    if (data.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        return;
    }
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                data: data.map(d => d.total),
                backgroundColor: data.map(d => d.color),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: '-apple-system, BlinkMacSystemFont, sans-serif' },
                        padding: 16
                    }
                }
            },
            cutout: '60%'
        }
    });
}

function renderDailyChart(data) {
    const ctx = document.getElementById('dailyChart').getContext('2d');
    
    if (dailyChart) dailyChart.destroy();
    
    if (data.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        return;
    }
    
    dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.day),
            datasets: [{
                data: data.map(d => d.total),
                backgroundColor: '#007AFF',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderLimits(data) {
    const container = document.getElementById('limitsList');
    const withLimits = data.filter(d => d.monthly_limit);
    
    if (withLimits.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Лимиты не установлены</p></div>';
        return;
    }
    
    container.innerHTML = withLimits.map(d => {
        const percent = Math.min((d.total / d.monthly_limit) * 100, 100);
        const status = percent >= 100 ? 'danger' : percent >= 80 ? 'warning' : 'ok';
        
        return `
            <div class="limit-item">
                <div class="limit-header">
                    <span class="limit-name">${d.icon} ${d.name}</span>
                    <span class="limit-values">${formatMoney(d.total)} / ${formatMoney(d.monthly_limit)}</span>
                </div>
                <div class="limit-bar">
                    <div class="limit-progress ${status}" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function changeMonth(delta) {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + delta);
    loadStats();
}

// ============ Export ============
function exportToExcel() {
    const month = formatMonth(state.currentMonth);
    window.open(`/api/export?month=${month}`, '_blank');
    showToast('Файл скачивается...', 'success');
}

// ============ Settings ============
function renderSettings() {
    const expenseCategories = state.categories.filter(c => c.type === 'expense');
    const incomeCategories = state.categories.filter(c => c.type === 'income');
    
    document.getElementById('expenseCategoriesList').innerHTML = 
        renderSettingsList(expenseCategories, 'category');
    document.getElementById('incomeCategoriesList').innerHTML = 
        renderSettingsList(incomeCategories, 'category');
    document.getElementById('settingsAccountsList').innerHTML = 
        renderSettingsList(state.accounts, 'account');
    
    // Rates
    document.getElementById('ratesList').innerHTML = Object.entries(state.rates)
        .map(([currency, rate]) => `
            <div class="rate-item">
                <span class="rate-currency">${currency}</span>
                <span class="rate-value">${rate.toFixed(4)} BYN</span>
            </div>
        `).join('');
}

function renderSettingsList(items, type) {
    if (items.length === 0) {
        return '<div class="empty-state"><p>Пусто</p></div>';
    }
    
    return items.map(item => `
        <div class="settings-item">
            <div class="settings-item-left">
                <div class="settings-item-icon" style="background: ${item.color || '#007AFF'}20;">
                    ${item.icon}
                </div>
                <span class="settings-item-text">
                    ${item.name}
                    ${item.monthly_limit ? `<small style="color: #8E8E93;"> (лимит: ${formatMoney(item.monthly_limit)})</small>` : ''}
                </span>
            </div>
            <div class="settings-item-actions">
                <button class="settings-item-edit" onclick="edit${type === 'category' ? 'Category' : 'Account'}(${item.id})">✏️</button>
                <button class="settings-item-delete" onclick="deleteItem('${type}', ${item.id})">🗑</button>
            </div>
        </div>
    `).join('');
}

async function deleteItem(type, id) {
    if (!confirm('Удалить? Все связанные транзакции тоже будут удалены.')) return;
    
    try {
        if (type === 'category') {
            await api.delete(`/api/categories/${id}`);
        } else {
            await api.delete(`/api/accounts/${id}`);
        }
        await loadData();
        renderSettings();
        renderAll();
        showToast('Удалено', 'success');
    } catch (e) {
        showToast('Ошибка удаления', 'error');
    }
}

// ============ Modals ============
function showModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// Icons and colors
const categoryIcons = ['🍔', '🚗', '🎮', '🛒', '💊', '📱', '🏠', '📚', '🎁', '💰', '📦', '✈️', '☕', '🎬', '👕', '💄', '🏋️', '🎵', '🍺', '🌐'];
const categoryColors = ['#FF9500', '#FF3B30', '#AF52DE', '#007AFF', '#34C759', '#5856D6', '#FF2D55', '#00C7BE', '#8E8E93', '#FFD60A'];

function showCategoryModal(type, editId = null) {
    const category = editId ? state.categories.find(c => c.id === editId) : null;
    const title = category 
        ? 'Редактировать категорию' 
        : (type === 'expense' ? 'Новая категория расходов' : 'Новая категория доходов');
    
    showModal(title, `
        <div class="input-group">
            <label>Название</label>
            <input type="text" id="newCategoryName" placeholder="Название" value="${category?.name || ''}">
        </div>
        <div class="input-group">
            <label>Иконка</label>
            <div class="categories-grid">
                ${categoryIcons.map((icon, i) => `
                    <button class="category-btn ${(category?.icon === icon || (!category && i === 0)) ? 'selected' : ''}" 
                            onclick="selectModalIcon(this, '${icon}')">
                        <span class="icon">${icon}</span>
                    </button>
                `).join('')}
            </div>
        </div>
        <div class="input-group">
            <label>Цвет</label>
            <div class="colors-grid">
                ${categoryColors.map((color, i) => `
                    <button class="color-btn ${(category?.color === color || (!category && i === 0)) ? 'selected' : ''}" 
                            style="background: ${color};"
                            onclick="selectModalColor(this, '${color}')">
                    </button>
                `).join('')}
            </div>
        </div>
        ${type === 'expense' ? `
        <div class="input-group">
            <label>Лимит в месяц (опционально)</label>
            <input type="number" id="newCategoryLimit" placeholder="0" value="${category?.monthly_limit || ''}">
        </div>
        ` : ''}
        <button class="btn-primary" onclick="saveCategory('${type}', ${editId || 'null'})">${category ? 'Сохранить' : 'Добавить'}</button>
    `);
    
    window.selectedIcon = category?.icon || categoryIcons[0];
    window.selectedColor = category?.color || categoryColors[0];
}

function selectModalIcon(btn, icon) {
    document.querySelectorAll('#modalContent .category-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.selectedIcon = icon;
}

function selectModalColor(btn, color) {
    document.querySelectorAll('#modalContent .color-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.selectedColor = color;
}

async function editCategory(id) {
    const category = state.categories.find(c => c.id === id);
    if (category) {
        showCategoryModal(category.type, id);
    }
}

async function saveCategory(type, editId = null) {
    const name = document.getElementById('newCategoryName').value;
    const limitEl = document.getElementById('newCategoryLimit');
    const limit = limitEl ? (parseFloat(limitEl.value) || null) : null;
    
    if (!name) {
        showToast('Введите название', 'error');
        return;
    }
    
    try {
        const data = {
            name,
            icon: window.selectedIcon,
            color: window.selectedColor,
            monthly_limit: limit
        };
        
        if (editId) {
            await api.put(`/api/categories/${editId}`, data);
            showToast('Категория обновлена', 'success');
        } else {
            await api.post('/api/categories', { ...data, type });
            showToast('Категория добавлена', 'success');
        }
        
        closeModal();
        await loadData();
        renderSettings();
        renderAll();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

function showAccountModal(editId = null) {
    const account = editId ? state.accounts.find(a => a.id === editId) : null;
    const icons = ['💳', '💵', '🪙', '🏦', '💎'];
    const currencies = ['BYN', 'USD', 'EUR', 'USDT'];
    
    showModal(account ? 'Редактировать счёт' : 'Новый счёт', `
        <div class="input-group">
            <label>Название</label>
            <input type="text" id="newAccountName" placeholder="Название" value="${account?.name || ''}">
        </div>
        <div class="input-group">
            <label>Валюта</label>
            <div class="accounts-grid">
                ${currencies.map((cur, i) => `
                    <button class="account-btn ${(account?.currency === cur || (!account && i === 0)) ? 'selected' : ''}" 
                            onclick="selectModalCurrency(this, '${cur}')">
                        <span class="name">${cur}</span>
                    </button>
                `).join('')}
            </div>
        </div>
        <div class="input-group">
            <label>Иконка</label>
            <div class="categories-grid">
                ${icons.map((icon, i) => `
                    <button class="category-btn ${(account?.icon === icon || (!account && i === 0)) ? 'selected' : ''}" 
                            onclick="selectModalAccountIcon(this, '${icon}')">
                        <span class="icon">${icon}</span>
                    </button>
                `).join('')}
            </div>
        </div>
        <button class="btn-primary" onclick="saveAccount(${editId || 'null'})">${account ? 'Сохранить' : 'Добавить'}</button>
    `);
    
    window.selectedAccountIcon = account?.icon || icons[0];
    window.selectedCurrency = account?.currency || currencies[0];
}

function selectModalCurrency(btn, currency) {
    document.querySelectorAll('#modalContent .account-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.selectedCurrency = currency;
}

function selectModalAccountIcon(btn, icon) {
    document.querySelectorAll('#modalContent .category-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.selectedAccountIcon = icon;
}

async function editAccount(id) {
    showAccountModal(id);
}

async function saveAccount(editId = null) {
    const name = document.getElementById('newAccountName').value;
    
    if (!name) {
        showToast('Введите название', 'error');
        return;
    }
    
    try {
        const data = {
            name,
            currency: window.selectedCurrency,
            icon: window.selectedAccountIcon
        };
        
        if (editId) {
            await api.put(`/api/accounts/${editId}`, data);
            showToast('Счёт обновлён', 'success');
        } else {
            await api.post('/api/accounts', data);
            showToast('Счёт добавлен', 'success');
        }
        
        closeModal();
        await loadData();
        renderSettings();
        renderAll();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

// ============ Helpers ============
function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatMonth(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthDisplay(date) {
    return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}