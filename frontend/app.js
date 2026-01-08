// ============ State ============
const state = {
    userId: null,
    currentPage: 'home',
    transactionType: 'expense',
    selectedCurrency: 'BYN',
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
    goals: [],
    rates: {}
};

// ============ Telegram WebApp Init ============
function initTelegram() {
    if (window.Telegram?.WebApp) {
        const tg = Telegram.WebApp;
        
        // Expand to full screen
        tg.expand();
        tg.ready();
        
        // Enable closing confirmation
        tg.enableClosingConfirmation();
        
        // Get user ID
        if (tg.initDataUnsafe?.user?.id) {
            state.userId = tg.initDataUnsafe.user.id;
        }
        
        // Apply Telegram theme
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.backgroundColor || '#F2F2F7');
        
        // Set header color
        tg.setHeaderColor('#FFFFFF');
        tg.setBackgroundColor('#F2F2F7');
    }
    
    // Fallback: get user_id from URL
    if (!state.userId) {
        const urlParams = new URLSearchParams(window.location.search);
        state.userId = urlParams.get('user_id') || 1;
    }
}

// ============ API ============
const api = {
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'X-User-Id': String(state.userId)
        };
    },
    
    async get(url) {
        const separator = url.includes('?') ? '&' : '?';
        const res = await fetch(`${url}${separator}user_id=${state.userId}`, {
            headers: this.getHeaders()
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
            throw new Error(error.detail || 'Ошибка сервера');
        }
        return res.json();
    },
    
    async post(url, data) {
        const res = await fetch(`${url}?user_id=${state.userId}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
            throw new Error(error.detail || 'Ошибка сервера');
        }
        return res.json();
    },
    
    async put(url, data) {
        const res = await fetch(`${url}?user_id=${state.userId}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
            throw new Error(error.detail || 'Ошибка сервера');
        }
        return res.json();
    },
    
    async delete(url) {
        const res = await fetch(`${url}?user_id=${state.userId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
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

// ============ Confirm Dialog ============
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirmOverlay');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        overlay.classList.add('active');
        
        const handleOk = () => {
            overlay.classList.remove('active');
            cleanup();
            resolve(true);
        };
        
        const handleCancel = () => {
            overlay.classList.remove('active');
            cleanup();
            resolve(false);
        };
        
        const cleanup = () => {
            document.getElementById('confirmOk').removeEventListener('click', handleOk);
            document.getElementById('confirmCancel').removeEventListener('click', handleCancel);
        };
        
        document.getElementById('confirmOk').addEventListener('click', handleOk);
        document.getElementById('confirmCancel').addEventListener('click', handleCancel);
    });
}

// ============ Init ============
document.addEventListener('DOMContentLoaded', async () => {
    initTelegram();
    await loadData();
    setupEventListeners();
    renderAll();
    
    // Set today's date
    document.getElementById('transactionDate').valueAsDate = new Date();
});

async function loadData() {
    try {
        const [accounts, categories, transactions, rates, goals] = await Promise.all([
            api.get('/api/accounts'),
            api.get('/api/categories'),
            api.get('/api/transactions?limit=30'),
            api.get('/api/exchange-rates'),
            api.get('/api/goals')
        ]);
        
        state.accounts = accounts;
        state.categories = categories;
        state.transactions = transactions;
        state.rates = rates;
        state.goals = goals;
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
    
    // Currency selector
    document.querySelectorAll('.currency-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.selectedCurrency = btn.dataset.currency;
        });
    });
    
    // Save transaction
    document.getElementById('saveTransaction').addEventListener('click', saveTransaction);
    
    // Cancel edit
    document.getElementById('cancelEdit').addEventListener('click', cancelEdit);
    
    // Month navigation
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    
    // Export
    document.getElementById('exportData').addEventListener('click', exportToExcel);
    
    // Goals
    document.getElementById('addGoal').addEventListener('click', showGoalModal);
    
    // Settings buttons
    document.getElementById('addExpenseCategory').addEventListener('click', () => showCategoryModal('expense'));
    document.getElementById('addIncomeCategory').addEventListener('click', () => showCategoryModal('income'));
    document.getElementById('addAccount').addEventListener('click', showAccountModal);
    document.getElementById('openTransfer').addEventListener('click', showTransferModal);
    
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
    
    // Scroll to top
    document.querySelector('.pages').scrollTop = 0;
    
    if (page === 'stats') loadStats();
    if (page === 'settings') renderSettings();
    if (page === 'goals') renderGoals();
    if (page === 'add') resetTransactionForm();
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
    
    container.innerHTML = state.accounts.map((acc, i) => {
        const balances = acc.balances || {};
        const balanceLines = Object.entries(balances)
            .filter(([_, val]) => val !== 0)
            .map(([cur, val]) => `${formatMoney(val)} ${cur}`)
            .join(' • ') || '0.00 BYN';
        
        // Calculate total in BYN
        let totalByn = 0;
        Object.entries(balances).forEach(([cur, val]) => {
            const rate = state.rates[cur] || 1;
            totalByn += val * rate;
        });
        
        const cardClass = i === 1 ? 'secondary' : (Object.keys(balances).includes('USDT') ? 'crypto' : '');
        
        return `
            <div class="account-card ${cardClass}">
                <div class="account-icon">${acc.icon}</div>
                <div class="account-name">${acc.name}</div>
                <div class="account-balances">${balanceLines}</div>
                ${Object.keys(balances).length > 1 || !balances['BYN'] ? 
                    `<div class="account-total">≈ ${formatMoney(totalByn)} BYN</div>` : ''}
            </div>
        `;
    }).join('');
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
        <div class="transaction-wrapper" data-id="${t.id}">
            <div class="transaction-item" data-id="${t.id}">
                <div class="transaction-icon" style="background: ${t.category_color}20;">
                    ${t.category_icon}
                </div>
                <div class="transaction-info">
                    <div class="transaction-category">${t.category_name}</div>
                    <div class="transaction-details">${t.account_name} • ${formatDate(t.date)}</div>
                </div>
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'expense' ? '-' : '+'}${formatMoney(t.amount)} ${t.currency}
                </div>
            </div>
            <button class="transaction-delete-btn" onclick="deleteTransaction(${t.id})">🗑</button>
        </div>
    `).join('');
    
    // Setup swipe handlers
    setupSwipeHandlers();
}

function setupSwipeHandlers() {
    document.querySelectorAll('.transaction-wrapper').forEach(wrapper => {
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;
        
        const item = wrapper.querySelector('.transaction-item');
        
        item.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isSwiping = true;
            item.style.transition = 'none';
        });
        
        item.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            currentX = e.touches[0].clientX;
            const diff = startX - currentX;
            
            if (diff > 0 && diff < 100) {
                item.style.transform = `translateX(-${diff}px)`;
            }
        });
        
        item.addEventListener('touchend', () => {
            isSwiping = false;
            item.style.transition = 'transform 0.3s ease';
            
            const diff = startX - currentX;
            if (diff > 60) {
                item.classList.add('swiped');
            } else {
                item.style.transform = 'translateX(0)';
                item.classList.remove('swiped');
            }
        });
        
        // Click to edit (if not swiped)
        item.addEventListener('click', () => {
            if (!item.classList.contains('swiped')) {
                editTransaction(parseInt(wrapper.dataset.id));
            } else {
                item.style.transform = 'translateX(0)';
                item.classList.remove('swiped');
            }
        });
    });
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

function updateTotalBalance() {
    let totalByn = 0;
    
    state.accounts.forEach(acc => {
        const balances = acc.balances || {};
        Object.entries(balances).forEach(([cur, val]) => {
            const rate = state.rates[cur] || 1;
            totalByn += val * rate;
        });
    });
    
    const usdRate = state.rates['USD'] || 3.25;
    const totalUsd = totalByn / usdRate;
    
    document.getElementById('totalBalance').textContent = `${formatMoney(totalByn)} BYN`;
    document.getElementById('totalBalanceUsd').textContent = `≈ $${formatMoney(totalUsd)}`;
}

// ============ Selection ============
function selectCategory(id) {
    state.selectedCategory = id;
    renderCategories();
    
    // Haptic
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.selectionChanged();
    }
}

function selectAccount(id) {
    state.selectedAccount = id;
    renderAccountsGrid();
    
    // Haptic
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.selectionChanged();
    }
}
// ============ Transaction ============
function resetTransactionForm() {
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    document.getElementById('transactionDate').valueAsDate = new Date();
    document.getElementById('editTransactionId').value = '';
    document.getElementById('cancelEdit').style.display = 'none';
    document.getElementById('saveTransaction').textContent = 'Сохранить';
    
    // Reset currency
    document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.currency-btn[data-currency="BYN"]').classList.add('selected');
    state.selectedCurrency = 'BYN';
    
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
        
        // Set currency
        document.querySelectorAll('.currency-btn').forEach(b => {
            b.classList.toggle('selected', b.dataset.currency === transaction.currency);
        });
        state.selectedCurrency = transaction.currency;
        
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
        currency: state.selectedCurrency,
        type: state.transactionType,
        category_id: state.selectedCategory,
        account_id: state.selectedAccount,
        description,
        date: date || null
    };
    
    try {
        let response;
        if (editId) {
            response = await api.put(`/api/transactions/${editId}`, data);
            showToast('Транзакция обновлена', 'success');
        } else {
            response = await api.post('/api/transactions', data);
            showToast('Транзакция добавлена', 'success');
            
            // Check for limit notifications
            if (response.limit_notifications && response.limit_notifications.length > 0) {
                response.limit_notifications.forEach(n => {
                    const msg = n.percent >= 100 
                        ? `🚨 Превышен лимит на "${n.category_name}"!`
                        : `⚠️ 80% лимита на "${n.category_name}"`;
                    showToast(msg, n.percent >= 100 ? 'error' : 'warning');
                    
                    // Send to Telegram bot
                    sendLimitNotification(n);
                });
            }
        }
        
        resetTransactionForm();
        await loadData();
        renderAll();
        navigateTo('home');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteTransaction(id) {
    const confirmed = await showConfirm('Удалить транзакцию?', 'Это действие нельзя отменить');
    if (!confirmed) return;
    
    try {
        await api.delete(`/api/transactions/${id}`);
        showToast('Транзакция удалена', 'success');
        await loadData();
        renderAll();
    } catch (e) {
        showToast('Ошибка удаления', 'error');
    }
}

function sendLimitNotification(notification) {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.sendData(JSON.stringify({
            type: 'limit_notification',
            ...notification
        }));
    }
}

// ============ Goals ============
function renderGoals() {
    const container = document.getElementById('goalsList');
    
    if (state.goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">🎯</div>
                <p>Поставь свою первую финансовую цель!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.goals.map(goal => {
        const percent = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        const remaining = goal.target_amount - goal.current_amount;
        
        return `
            <div class="goal-card" data-id="${goal.id}">
                <div class="goal-header">
                    <div class="goal-info">
                        <span class="goal-icon">${goal.icon}</span>
                        <span class="goal-name">${goal.name}</span>
                    </div>
                    <div class="goal-actions">
                        <button class="goal-action-btn" onclick="editGoal(${goal.id})">✏️</button>
                        <button class="goal-action-btn" onclick="deleteGoal(${goal.id})">🗑</button>
                    </div>
                </div>
                <div class="goal-progress">
                    <div class="goal-progress-bar">
                        <div class="goal-progress-fill" style="width: ${percent}%"></div>
                    </div>
                    <div class="goal-progress-text">
                        <span class="current">${formatMoney(goal.current_amount)} BYN</span>
                        <span>${formatMoney(goal.target_amount)} BYN</span>
                    </div>
                </div>
                <div class="goal-add-money">
                    <input type="number" id="goalAmount${goal.id}" placeholder="Сумма" inputmode="decimal">
                    <button onclick="addMoneyToGoal(${goal.id})">+ Добавить</button>
                </div>
            </div>
        `;
    }).join('');
}

async function addMoneyToGoal(id) {
    const input = document.getElementById(`goalAmount${id}`);
    const amount = parseFloat(input.value);
    
    if (!amount || amount <= 0) {
        showToast('Введите сумму', 'error');
        return;
    }
    
    try {
        await api.post(`/api/goals/${id}/add`, { amount });
        showToast('Добавлено!', 'success');
        input.value = '';
        
        state.goals = await api.get('/api/goals');
        renderGoals();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

function showGoalModal(editId = null) {
    const goal = editId ? state.goals.find(g => g.id === editId) : null;
    const icons = ['🎯', '🏠', '🚗', '✈️', '📱', '💻', '🎓', '💍', '🏖️', '💰'];
    
    showModal(goal ? 'Редактировать цель' : 'Новая цель', `
        <div class="input-group">
            <label>Название</label>
            <input type="text" id="goalName" placeholder="На что копим?" value="${goal?.name || ''}">
        </div>
        <div class="input-group">
            <label>Сумма цели (BYN)</label>
            <input type="number" id="goalTarget" placeholder="0.00" value="${goal?.target_amount || ''}">
        </div>
        <div class="input-group">
            <label>Иконка</label>
            <div class="categories-grid">
                ${icons.map((icon, i) => `
                    <button class="category-btn ${(goal?.icon === icon || (!goal && i === 0)) ? 'selected' : ''}" 
                            onclick="selectGoalIcon(this, '${icon}')">
                        <span class="icon">${icon}</span>
                    </button>
                `).join('')}
            </div>
        </div>
        <button class="btn-primary" onclick="saveGoal(${editId || 'null'})">${goal ? 'Сохранить' : 'Создать'}</button>
    `);
    
    window.selectedGoalIcon = goal?.icon || icons[0];
}

function selectGoalIcon(btn, icon) {
    document.querySelectorAll('#modalContent .category-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.selectedGoalIcon = icon;
}

async function saveGoal(editId = null) {
    const name = document.getElementById('goalName').value;
    const target = parseFloat(document.getElementById('goalTarget').value);
    
    if (!name) {
        showToast('Введите название', 'error');
        return;
    }
    if (!target || target <= 0) {
        showToast('Введите сумму цели', 'error');
        return;
    }
    
    try {
        if (editId) {
            await api.put(`/api/goals/${editId}`, {
                name,
                target_amount: target,
                icon: window.selectedGoalIcon
            });
            showToast('Цель обновлена', 'success');
        } else {
            await api.post('/api/goals', {
                name,
                target_amount: target,
                icon: window.selectedGoalIcon
            });
            showToast('Цель создана!', 'success');
        }
        
        closeModal();
        state.goals = await api.get('/api/goals');
        renderGoals();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

async function editGoal(id) {
    showGoalModal(id);
}

async function deleteGoal(id) {
    const confirmed = await showConfirm('Удалить цель?', 'Прогресс будет потерян');
    if (!confirmed) return;
    
    try {
        await api.delete(`/api/goals/${id}`);
        showToast('Цель удалена', 'success');
        state.goals = await api.get('/api/goals');
        renderGoals();
    } catch (e) {
        showToast('Ошибка удаления', 'error');
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
        ctx.canvas.style.display = 'none';
        return;
    }
    ctx.canvas.style.display = 'block';
    
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
                        font: { family: '-apple-system, sans-serif', size: 12 },
                        padding: 12,
                        usePointStyle: true
                    }
                }
            },
            cutout: '65%'
        }
    });
}

function renderDailyChart(data) {
    const ctx = document.getElementById('dailyChart').getContext('2d');
    
    if (dailyChart) dailyChart.destroy();
    
    if (data.length === 0) {
        ctx.canvas.style.display = 'none';
        return;
    }
    ctx.canvas.style.display = 'block';
    
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
                y: { beginAtZero: true, grid: { color: '#F2F2F7' } },
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

function exportToExcel() {
    const month = formatMonth(state.currentMonth);
    window.open(`/api/export?month=${month}&user_id=${state.userId}`, '_blank');
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
    const confirmed = await showConfirm('Удалить?', 'Все связанные данные тоже будут удалены');
    if (!confirmed) return;
    
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

// Category Modal
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
                ${categoryIcons.map((icon) => `
                    <button class="category-btn ${(category?.icon === icon || (!category && icon === categoryIcons[0])) ? 'selected' : ''}" 
                            onclick="selectModalIcon(this, '${icon}')">
                        <span class="icon">${icon}</span>
                    </button>
                `).join('')}
            </div>
        </div>
        <div class="input-group">
            <label>Цвет</label>
            <div class="colors-grid">
                ${categoryColors.map((color) => `
                    <button class="color-btn ${(category?.color === color || (!category && color === categoryColors[0])) ? 'selected' : ''}" 
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
    if (category) showCategoryModal(category.type, id);
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

// Account Modal
function showAccountModal(editId = null) {
    const account = editId ? state.accounts.find(a => a.id === editId) : null;
    const icons = ['💳', '💵', '🪙', '🏦', '💎', '🏧'];
    
    showModal(account ? 'Редактировать счёт' : 'Новый счёт', `
        <div class="input-group">
            <label>Название</label>
            <input type="text" id="newAccountName" placeholder="Название" value="${account?.name || ''}">
        </div>
        <div class="input-group">
            <label>Иконка</label>
            <div class="categories-grid">
                ${icons.map((icon) => `
                    <button class="category-btn ${(account?.icon === icon || (!account && icon === icons[0])) ? 'selected' : ''}" 
                            onclick="selectModalAccountIcon(this, '${icon}')">
                        <span class="icon">${icon}</span>
                    </button>
                `).join('')}
            </div>
        </div>
        <button class="btn-primary" onclick="saveAccount(${editId || 'null'})">${account ? 'Сохранить' : 'Добавить'}</button>
    `);
    
    window.selectedAccountIcon = account?.icon || icons[0];
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
        const data = { name, icon: window.selectedAccountIcon };
        
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

// Transfer Modal
function showTransferModal() {
    const currencies = ['BYN', 'USD', 'EUR', 'USDT'];
    
    showModal('Перевод между счетами', `
        <div class="transfer-form">
            <div class="input-group">
                <label>Со счёта</label>
                <div class="accounts-select" id="transferFromAccounts">
                    ${state.accounts.map(a => `
                        <button class="account-btn" data-id="${a.id}" onclick="selectTransferFrom(${a.id}, this)">
                            <span class="icon">${a.icon}</span>
                            <span class="name">${a.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div class="transfer-arrow">↓</div>
            
            <div class="input-group">
                <label>На счёт</label>
                <div class="accounts-select" id="transferToAccounts">
                    ${state.accounts.map(a => `
                        <button class="account-btn" data-id="${a.id}" onclick="selectTransferTo(${a.id}, this)">
                            <span class="icon">${a.icon}</span>
                            <span class="name">${a.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div class="input-group">
                <label>Сумма и валюта списания</label>
                <div class="amount-input-row">
                    <input type="number" id="transferAmount" placeholder="0.00" inputmode="decimal">
                    <div class="currency-selector">
                        ${currencies.map((c, i) => `
                            <button class="currency-btn ${i === 0 ? 'selected' : ''}" data-currency="${c}" onclick="selectTransferFromCurrency(this, '${c}')">${c}</button>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="input-group">
                <label>Сумма и валюта зачисления</label>
                <div class="amount-input-row">
                    <input type="number" id="transferConvertedAmount" placeholder="0.00" inputmode="decimal">
                    <div class="currency-selector">
                        ${currencies.map((c, i) => `
                            <button class="currency-btn ${i === 0 ? 'selected' : ''}" data-currency="${c}" onclick="selectTransferToCurrency(this, '${c}')">${c}</button>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <button class="btn-primary" onclick="saveTransfer()">Перевести</button>
        </div>
    `);
    
    window.transferFromAccount = null;
    window.transferToAccount = null;
    window.transferFromCurrency = 'BYN';
    window.transferToCurrency = 'BYN';
}

function selectTransferFrom(id, btn) {
    document.querySelectorAll('#transferFromAccounts .account-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.transferFromAccount = id;
}

function selectTransferTo(id, btn) {
    document.querySelectorAll('#transferToAccounts .account-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.transferToAccount = id;
}

function selectTransferFromCurrency(btn, currency) {
    btn.parentElement.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.transferFromCurrency = currency;
}

function selectTransferToCurrency(btn, currency) {
    btn.parentElement.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.transferToCurrency = currency;
}

async function saveTransfer() {
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const convertedAmount = parseFloat(document.getElementById('transferConvertedAmount').value);
    
    if (!amount || amount <= 0) {
        showToast('Введите сумму списания', 'error');
        return;
    }
    if (!convertedAmount || convertedAmount <= 0) {
        showToast('Введите сумму зачисления', 'error');
        return;
    }
    if (!window.transferFromAccount) {
        showToast('Выберите счёт списания', 'error');
        return;
    }
    if (!window.transferToAccount) {
        showToast('Выберите счёт зачисления', 'error');
        return;
    }
    if (window.transferFromAccount === window.transferToAccount) {
        showToast('Выберите разные счета', 'error');
        return;
    }
    
    try {
        await api.post('/api/transfers', {
            from_account_id: window.transferFromAccount,
            to_account_id: window.transferToAccount,
            amount,
            from_currency: window.transferFromCurrency,
            to_currency: window.transferToCurrency,
            converted_amount: convertedAmount
        });
        
        showToast('Перевод выполнен!', 'success');
        closeModal();
        await loadData();
        renderAll();
    } catch (e) {
        showToast(e.message, 'error');
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
