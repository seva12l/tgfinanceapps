const state = {
    userId: null,
    currentPage: 'home',
    transactionType: 'expense',
    selectedCurrency: 'BYN',
    selectedCategory: null,
    selectedAccount: null,
    editingTransactionId: null,
    currentMonth: new Date(),
    accounts: [],
    categories: [],
    transactions: [],
    goals: [],
    rates: {}
};

function initTelegram() {
    if (window.Telegram?.WebApp) {
        const tg = Telegram.WebApp;
        tg.expand();
        tg.ready();
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        tg.setHeaderColor('#FFFFFF');
        tg.setBackgroundColor('#F2F2F7');
        if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
        if (tg.initDataUnsafe?.user?.id) state.userId = tg.initDataUnsafe.user.id;
        tg.onEvent('viewportChanged', function() { if (!tg.isExpanded) tg.expand(); });
    }
    if (!state.userId) {
        const urlParams = new URLSearchParams(window.location.search);
        state.userId = urlParams.get('user_id') || 1;
    }
}

const api = {
    get: async function(url) {
        const sep = url.includes('?') ? '&' : '?';
        const res = await fetch(url + sep + 'user_id=' + state.userId);
        if (!res.ok) {
            const err = await res.json().catch(function() { return {}; });
            throw new Error(err.detail || 'Ошибка сервера');
        }
        return res.json();
    },
    post: async function(url, data) {
        const res = await fetch(url + '?user_id=' + state.userId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(function() { return {}; });
            throw new Error(err.detail || 'Ошибка сервера');
        }
        return res.json();
    },
    put: async function(url, data) {
        const res = await fetch(url + '?user_id=' + state.userId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(function() { return {}; });
            throw new Error(err.detail || 'Ошибка сервера');
        }
        return res.json();
    },
    delete: async function(url) {
        const res = await fetch(url + '?user_id=' + state.userId, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json().catch(function() { return {}; });
            throw new Error(err.detail || 'Ошибка сервера');
        }
        return res.json();
    }
};

function showToast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    if (window.Telegram?.WebApp?.HapticFeedback) {
        if (type === 'error') Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        else if (type === 'success') Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
    setTimeout(function() { toast.remove(); }, 3000);
}

function showConfirm(title, message) {
    return new Promise(function(resolve) {
        const overlay = document.getElementById('confirmOverlay');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        overlay.classList.add('active');
        
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');
        
        function handleOk() {
            overlay.classList.remove('active');
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        }
        function handleCancel() {
            overlay.classList.remove('active');
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        }
        
        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    initTelegram();
    await loadData();
    setupEventListeners();
    renderAll();
    document.getElementById('transactionDate').valueAsDate = new Date();
});

async function loadData() {
    try {
        const results = await Promise.all([
            api.get('/api/accounts'),
            api.get('/api/categories'),
            api.get('/api/transactions?limit=30'),
            api.get('/api/exchange-rates'),
            api.get('/api/goals')
        ]);
        state.accounts = results[0];
        state.categories = results[1];
        state.transactions = results[2];
        state.rates = results[3];
        state.goals = results[4];
    } catch (e) {
        console.error('Load error:', e);
        showToast('Ошибка загрузки', 'error');
    }
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { navigateTo(btn.dataset.page); });
    });
    
    document.querySelectorAll('.segment').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.segment').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            state.transactionType = btn.dataset.type;
            state.selectedCategory = null;
            renderCategories();
        });
    });
    
    document.querySelectorAll('.currency-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.currency-btn').forEach(function(b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            state.selectedCurrency = btn.dataset.currency;
        });
    });
    
    document.getElementById('saveTransaction').addEventListener('click', saveTransaction);
    document.getElementById('cancelEdit').addEventListener('click', cancelEdit);
    document.getElementById('prevMonth').addEventListener('click', function() { changeMonth(-1); });
    document.getElementById('nextMonth').addEventListener('click', function() { changeMonth(1); });
    document.getElementById('exportData').addEventListener('click', exportToExcel);
    document.getElementById('addGoal').addEventListener('click', function() { showGoalModal(null); });
    document.getElementById('addExpenseCategory').addEventListener('click', function() { showCategoryModal('expense', null); });
    document.getElementById('addIncomeCategory').addEventListener('click', function() { showCategoryModal('income', null); });
    document.getElementById('addAccount').addEventListener('click', function() { showAccountModal(null); });
    document.getElementById('openTransfer').addEventListener('click', showTransferModal);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) closeModal();
    });
}

function navigateTo(page) {
    state.currentPage = page;
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach(function(p) {
        p.classList.toggle('active', p.id === 'page-' + page);
    });
    document.querySelector('.pages').scrollTop = 0;
    
    if (page === 'stats') loadStats();
    if (page === 'settings') renderSettings();
    if (page === 'goals') renderGoals();
    if (page === 'add') resetTransactionForm();
}

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
    
    let html = '';
    for (let i = 0; i < state.accounts.length; i++) {
        const acc = state.accounts[i];
        const balances = acc.balances || {};
        const balanceArr = [];
        let totalByn = 0;
        
        for (const cur in balances) {
            if (balances[cur] !== 0) {
                balanceArr.push(formatMoney(balances[cur]) + ' ' + cur);
            }
            totalByn += balances[cur] * (state.rates[cur] || 1);
        }
        
        const balanceLines = balanceArr.length > 0 ? balanceArr.join(' • ') : '0.00 BYN';
        const cardClass = i === 1 ? 'secondary' : '';
        const showTotal = Object.keys(balances).length > 1 || !balances['BYN'];
        
        html += '<div class="account-card ' + cardClass + '">';
        html += '<div class="account-icon">' + acc.icon + '</div>';
        html += '<div class="account-name">' + acc.name + '</div>';
        html += '<div class="account-balances">' + balanceLines + '</div>';
        if (showTotal) {
            html += '<div class="account-total">≈ ' + formatMoney(totalByn) + ' BYN</div>';
        }
        html += '</div>';
    }
    container.innerHTML = html;
}

function renderTransactions() {
    const container = document.getElementById('transactionsList');
    if (state.transactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📝</div><p>Нет операций</p></div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < state.transactions.length; i++) {
        const t = state.transactions[i];
        const sign = t.type === 'expense' ? '-' : '+';
        html += '<div class="transaction-wrapper" data-id="' + t.id + '">';
        html += '<div class="transaction-item">';
        html += '<div class="transaction-icon" style="background: ' + t.category_color + '20;">' + t.category_icon + '</div>';
        html += '<div class="transaction-info">';
        html += '<div class="transaction-category">' + t.category_name + '</div>';
        html += '<div class="transaction-details">' + t.account_name + ' • ' + formatDate(t.date) + '</div>';
        html += '</div>';
        html += '<div class="transaction-amount ' + t.type + '">' + sign + formatMoney(t.amount) + ' ' + t.currency + '</div>';
        html += '</div>';
        html += '<button class="transaction-delete-btn">🗑</button>';
        html += '</div>';
    }
    container.innerHTML = html;
    setupSwipeHandlers();
}

function setupSwipeHandlers() {
    const wrappers = document.querySelectorAll('.transaction-wrapper');
    wrappers.forEach(function(wrapper) {
        const item = wrapper.querySelector('.transaction-item');
        const deleteBtn = wrapper.querySelector('.transaction-delete-btn');
        let startX = 0, currentX = 0, isSwiping = false;
        
        item.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            isSwiping = true;
            item.style.transition = 'none';
        });
        
        item.addEventListener('touchmove', function(e) {
            if (!isSwiping) return;
            currentX = e.touches[0].clientX;
            const diff = startX - currentX;
            if (diff > 0 && diff < 100) {
                item.style.transform = 'translateX(-' + diff + 'px)';
            }
        });
        
        item.addEventListener('touchend', function() {
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
        
        item.addEventListener('click', function() {
            if (!item.classList.contains('swiped')) {
                editTransaction(parseInt(wrapper.dataset.id));
            } else {
                item.style.transform = 'translateX(0)';
                item.classList.remove('swiped');
            }
        });
        
        deleteBtn.addEventListener('click', function() {
            deleteTransaction(parseInt(wrapper.dataset.id));
        });
    });
}

function renderCategories() {
    const container = document.getElementById('categoriesGrid');
    const filtered = state.categories.filter(function(c) { return c.type === state.transactionType; });
    let html = '';
    for (let i = 0; i < filtered.length; i++) {
        const c = filtered[i];
        const selected = state.selectedCategory === c.id ? 'selected' : '';
        html += '<button type="button" class="category-btn ' + selected + '" onclick="selectCategory(' + c.id + ')">';
        html += '<span class="icon">' + c.icon + '</span>';
        html += '<span class="name">' + c.name + '</span>';
        html += '</button>';
    }
    container.innerHTML = html;
}

function renderAccountsGrid() {
    const container = document.getElementById('accountsGrid');
    let html = '';
    for (let i = 0; i < state.accounts.length; i++) {
        const a = state.accounts[i];
        const selected = state.selectedAccount === a.id ? 'selected' : '';
        html += '<button type="button" class="account-btn ' + selected + '" onclick="selectAccount(' + a.id + ')">';
        html += '<span class="icon">' + a.icon + '</span>';
        html += '<span class="name">' + a.name + '</span>';
        html += '</button>';
    }
    container.innerHTML = html;
}

function updateTotalBalance() {
    let totalByn = 0;
    for (let i = 0; i < state.accounts.length; i++) {
        const balances = state.accounts[i].balances || {};
        for (const cur in balances) {
            totalByn += balances[cur] * (state.rates[cur] || 1);
        }
    }
    const usdRate = state.rates['USD'] || 3.25;
    document.getElementById('totalBalance').textContent = formatMoney(totalByn) + ' BYN';
    document.getElementById('totalBalanceUsd').textContent = '≈ $' + formatMoney(totalByn / usdRate);
}

function selectCategory(id) {
    state.selectedCategory = id;
    renderCategories();
}

function selectAccount(id) {
    state.selectedAccount = id;
    renderAccountsGrid();
}

function resetTransactionForm() {
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    document.getElementById('transactionDate').valueAsDate = new Date();
    document.getElementById('editTransactionId').value = '';
    document.getElementById('cancelEdit').style.display = 'none';
    document.getElementById('saveTransaction').textContent = 'Сохранить';
    document.querySelectorAll('.currency-btn').forEach(function(b) { b.classList.remove('selected'); });
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
    showToast('Отменено');
}

async function editTransaction(id) {
    try {
        const t = await api.get('/api/transactions/' + id);
        state.transactionType = t.type;
        document.querySelectorAll('.segment').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.type === t.type);
        });
        document.getElementById('amount').value = t.amount;
        document.getElementById('description').value = t.description || '';
        document.getElementById('transactionDate').value = t.date.split('T')[0];
        document.getElementById('editTransactionId').value = id;
        document.querySelectorAll('.currency-btn').forEach(function(b) {
            b.classList.toggle('selected', b.dataset.currency === t.currency);
        });
        state.selectedCurrency = t.currency;
        state.selectedCategory = t.category_id;
        state.selectedAccount = t.account_id;
        state.editingTransactionId = id;
        document.getElementById('cancelEdit').style.display = 'block';
        document.getElementById('saveTransaction').textContent = 'Обновить';
        renderCategories();
        renderAccountsGrid();
        navigateTo('add');
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

async function saveTransaction() {
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value;
    const date = document.getElementById('transactionDate').value;
    const editId = document.getElementById('editTransactionId').value;
    
    if (!amount || amount <= 0) { showToast('Введите сумму', 'error'); return; }
    if (!state.selectedCategory) { showToast('Выберите категорию', 'error'); return; }
    if (!state.selectedAccount) { showToast('Выберите счёт', 'error'); return; }
    
    const data = {
        amount: amount,
        currency: state.selectedCurrency,
        type: state.transactionType,
        category_id: state.selectedCategory,
        account_id: state.selectedAccount,
        description: description,
        date: date || null
    };
    
    try {
        if (editId) {
            await api.put('/api/transactions/' + editId, data);
            showToast('Обновлено', 'success');
        } else {
            const res = await api.post('/api/transactions', data);
            showToast('Добавлено', 'success');
            if (res.limit_notifications && res.limit_notifications.length > 0) {
                for (let i = 0; i < res.limit_notifications.length; i++) {
                    const n = res.limit_notifications[i];
                    const icon = n.percent >= 100 ? '🚨' : '⚠️';
                    showToast(icon + ' Лимит "' + n.category_name + '"', n.percent >= 100 ? 'error' : 'warning');
                }
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
    const confirmed = await showConfirm('Удалить?', 'Транзакция будет удалена');
    if (!confirmed) return;
    try {
        await api.delete('/api/transactions/' + id);
        showToast('Удалено', 'success');
        await loadData();
        renderAll();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

function renderGoals() {
    const container = document.getElementById('goalsList');
    if (state.goals.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">🎯</div><p>Создай первую цель!</p></div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < state.goals.length; i++) {
        const g = state.goals[i];
        const percent = Math.min((g.current_amount / g.target_amount) * 100, 100);
        html += '<div class="goal-card">';
        html += '<div class="goal-header">';
        html += '<div class="goal-info"><span class="goal-icon">' + g.icon + '</span><span class="goal-name">' + g.name + '</span></div>';
        html += '<div class="goal-actions">';
        html += '<button type="button" class="goal-action-btn" onclick="showGoalModal(' + g.id + ')">✏️</button>';
        html += '<button type="button" class="goal-action-btn" onclick="deleteGoal(' + g.id + ')">🗑</button>';
        html += '</div></div>';
        html += '<div class="goal-progress">';
        html += '<div class="goal-progress-bar"><div class="goal-progress-fill" style="width: ' + percent + '%"></div></div>';
        html += '<div class="goal-progress-text"><span class="current">' + formatMoney(g.current_amount) + ' BYN</span>';
        html += '<span>' + formatMoney(g.target_amount) + ' BYN</span></div></div>';
        html += '<div class="goal-add-money">';
        html += '<input type="number" id="goalAmount' + g.id + '" placeholder="Сумма" inputmode="decimal">';
        html += '<button type="button" onclick="addMoneyToGoal(' + g.id + ')">+</button>';
        html += '</div></div>';
    }
    container.innerHTML = html;
}

function showGoalModal(editId) {
    const goal = editId ? state.goals.find(function(g) { return g.id === editId; }) : null;
    const icons = ['🎯', '🏠', '🚗', '✈️', '📱', '💻', '🎓', '💍', '🏖️', '💰'];
    
    let iconsHtml = '';
    for (let i = 0; i < icons.length; i++) {
        const icon = icons[i];
        const selected = (goal && goal.icon === icon) || (!goal && i === 0) ? 'selected' : '';
        iconsHtml += '<button type="button" class="category-btn ' + selected + '" onclick="selectGoalIcon(this, \'' + icon + '\')"><span class="icon">' + icon + '</span></button>';
    }
    
    const title = goal ? 'Редактировать цель' : 'Новая цель';
    const btnText = goal ? 'Сохранить' : 'Создать';
    const nameVal = goal ? goal.name : '';
    const targetVal = goal ? goal.target_amount : '';
    
    let content = '<div class="input-group"><label>Название</label>';
    content += '<input type="text" id="goalName" placeholder="На что копим?" value="' + nameVal + '"></div>';
    content += '<div class="input-group"><label>Сумма (BYN)</label>';
    content += '<input type="number" id="goalTarget" placeholder="0.00" inputmode="decimal" value="' + targetVal + '"></div>';
    content += '<div class="input-group"><label>Иконка</label>';
    content += '<div class="categories-grid" id="goalIconsGrid">' + iconsHtml + '</div></div>';
    content += '<button type="button" class="btn-primary" onclick="saveGoal(' + (editId || 'null') + ')">' + btnText + '</button>';
    
    showModal(title, content);
    window.selectedGoalIcon = goal ? goal.icon : icons[0];
}

function selectGoalIcon(btn, icon) {
    document.querySelectorAll('#goalIconsGrid .category-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    window.selectedGoalIcon = icon;
}

async function saveGoal(editId) {
    const name = document.getElementById('goalName').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);
    
    if (!name) { showToast('Введите название', 'error'); return; }
    if (!target || target <= 0) { showToast('Введите сумму', 'error'); return; }
    
    try {
        const data = { name: name, target_amount: target, icon: window.selectedGoalIcon };
        if (editId) {
            await api.put('/api/goals/' + editId, data);
            showToast('Обновлено', 'success');
        } else {
            await api.post('/api/goals', data);
            showToast('Создано!', 'success');
        }
        closeModal();
        state.goals = await api.get('/api/goals');
        renderGoals();
    } catch (e) {
        showToast('Ошибка: ' + e.message, 'error');
    }
}

async function addMoneyToGoal(id) {
    const input = document.getElementById('goalAmount' + id);
    const amount = parseFloat(input.value);
    if (!amount || amount <= 0) { showToast('Введите сумму', 'error'); return; }
    
    try {
        await api.post('/api/goals/' + id + '/add', { amount: amount });
        showToast('Добавлено!', 'success');
        input.value = '';
        state.goals = await api.get('/api/goals');
        renderGoals();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

async function deleteGoal(id) {
    const confirmed = await showConfirm('Удалить?', 'Прогресс будет потерян');
    if (!confirmed) return;
    try {
        await api.delete('/api/goals/' + id);
        showToast('Удалено', 'success');
        state.goals = await api.get('/api/goals');
        renderGoals();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

let categoryChart = null;
let dailyChart = null;

async function loadStats() {
    const month = formatMonth(state.currentMonth);
    document.getElementById('currentMonth').textContent = formatMonthDisplay(state.currentMonth);
    
    try {
        const stats = await api.get('/api/stats/' + month);
        document.getElementById('totalIncome').textContent = formatMoney(stats.total_income) + ' BYN';
        document.getElementById('totalExpense').textContent = formatMoney(stats.total_expense) + ' BYN';
        renderCategoryChart(stats.expenses_by_category);
        renderDailyChart(stats.daily_expenses);
        renderLimits(stats.expenses_by_category);
    } catch (e) {
        console.error('Stats error:', e);
    }
}

function renderCategoryChart(data) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (categoryChart) categoryChart.destroy();
    if (!data || data.length === 0) { ctx.canvas.style.display = 'none'; return; }
    ctx.canvas.style.display = 'block';
    
    const labels = [];
    const values = [];
    const colors = [];
    for (let i = 0; i < data.length; i++) {
        labels.push(data[i].name);
        values.push(data[i].total);
        colors.push(data[i].color);
    }
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }
    });
}

function renderDailyChart(data) {
    const ctx = document.getElementById('dailyChart').getContext('2d');
    if (dailyChart) dailyChart.destroy();
    if (!data || data.length === 0) { ctx.canvas.style.display = 'none'; return; }
    ctx.canvas.style.display = 'block';
    
    const labels = [];
    const values = [];
    for (let i = 0; i < data.length; i++) {
        labels.push(data[i].day);
        values.push(data[i].total);
    }
    
    dailyChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ data: values, backgroundColor: '#007AFF', borderRadius: 4 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } }
    });
}

function renderLimits(data) {
    const container = document.getElementById('limitsList');
    const withLimits = [];
    for (let i = 0; i < data.length; i++) {
        if (data[i].monthly_limit) withLimits.push(data[i]);
    }
    
    if (withLimits.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Лимиты не установлены</p></div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < withLimits.length; i++) {
        const d = withLimits[i];
        const percent = Math.min((d.total / d.monthly_limit) * 100, 100);
        let status = 'ok';
        if (percent >= 100) status = 'danger';
        else if (percent >= 80) status = 'warning';
        
        html += '<div class="limit-item">';
        html += '<div class="limit-header">';
        html += '<span class="limit-name">' + d.icon + ' ' + d.name + '</span>';
        html += '<span class="limit-values">' + formatMoney(d.total) + ' / ' + formatMoney(d.monthly_limit) + '</span>';
        html += '</div>';
        html += '<div class="limit-bar"><div class="limit-progress ' + status + '" style="width: ' + percent + '%"></div></div>';
        html += '</div>';
    }
    container.innerHTML = html;
}

function changeMonth(delta) {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + delta);
    loadStats();
}

function exportToExcel() {
    window.open('/api/export?month=' + formatMonth(state.currentMonth) + '&user_id=' + state.userId, '_blank');
    showToast('Скачивание...', 'success');
}

function renderSettings() {
    const expenseCats = [];
    const incomeCats = [];
    for (let i = 0; i < state.categories.length; i++) {
        if (state.categories[i].type === 'expense') expenseCats.push(state.categories[i]);
        else incomeCats.push(state.categories[i]);
    }
    
    document.getElementById('expenseCategoriesList').innerHTML = renderCategoryList(expenseCats);
    document.getElementById('incomeCategoriesList').innerHTML = renderCategoryList(incomeCats);
    document.getElementById('settingsAccountsList').innerHTML = renderAccountList();
    
    let ratesHtml = '';
    for (const cur in state.rates) {
        ratesHtml += '<div class="rate-item"><span class="rate-currency">' + cur + '</span>';
        ratesHtml += '<span class="rate-value">' + state.rates[cur].toFixed(4) + ' BYN</span></div>';
    }
    document.getElementById('ratesList').innerHTML = ratesHtml;
}

function renderCategoryList(categories) {
    if (categories.length === 0) return '<div class="empty-state"><p>Пусто</p></div>';
    
    let html = '';
    for (let i = 0; i < categories.length; i++) {
        const c = categories[i];
        const limitText = c.monthly_limit ? ' <small style="color:#8E8E93;">(лимит: ' + formatMoney(c.monthly_limit) + ')</small>' : '';
        html += '<div class="settings-item">';
        html += '<div class="settings-item-left">';
        html += '<div class="settings-item-icon" style="background: ' + c.color + '20;">' + c.icon + '</div>';
        html += '<span class="settings-item-text">' + c.name + limitText + '</span>';
        html += '</div>';
        html += '<div class="settings-item-actions">';
        html += '<button type="button" class="settings-item-edit" onclick="showCategoryModal(\'' + c.type + '\', ' + c.id + ')">✏️</button>';
        html += '<button type="button" class="settings-item-delete" onclick="deleteCategory(' + c.id + ')">🗑</button>';
        html += '</div></div>';
    }
    return html;
}

function renderAccountList() {
    if (state.accounts.length === 0) return '<div class="empty-state"><p>Пусто</p></div>';
    
    let html = '';
    for (let i = 0; i < state.accounts.length; i++) {
        const a = state.accounts[i];
        html += '<div class="settings-item">';
        html += '<div class="settings-item-left">';
        html += '<div class="settings-item-icon" style="background: #007AFF20;">' + a.icon + '</div>';
        html += '<span class="settings-item-text">' + a.name + '</span>';
        html += '</div>';
        html += '<div class="settings-item-actions">';
        html += '<button type="button" class="settings-item-edit" onclick="showAccountModal(' + a.id + ')">✏️</button>';
        html += '<button type="button" class="settings-item-delete" onclick="deleteAccount(' + a.id + ')">🗑</button>';
        html += '</div></div>';
    }
    return html;
}

function showModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

var catIcons = ['🍔', '🚗', '🎮', '🛒', '💊', '📱', '🏠', '📚', '🎁', '💰', '📦', '✈️', '☕', '🎬', '👕', '💄'];
var catColors = ['#FF9500', '#FF3B30', '#AF52DE', '#007AFF', '#34C759', '#5856D6', '#FF2D55', '#00C7BE'];

function showCategoryModal(type, editId) {
    var cat = null;
    if (editId) {
        for (var i = 0; i < state.categories.length; i++) {
            if (state.categories[i].id === editId) { cat = state.categories[i]; break; }
        }
    }
    
    var title = cat ? 'Редактировать' : (type === 'expense' ? 'Категория расходов' : 'Категория доходов');
    
    var iconsHtml = '';
    for (var i = 0; i < catIcons.length; i++) {
        var icon = catIcons[i];
        var selected = (cat && cat.icon === icon) || (!cat && i === 0) ? 'selected' : '';
        iconsHtml += '<button type="button" class="category-btn ' + selected + '" onclick="selectCatIcon(this, \'' + icon + '\')"><span class="icon">' + icon + '</span></button>';
    }
    
    var colorsHtml = '';
    for (var i = 0; i < catColors.length; i++) {
        var color = catColors[i];
        var selected = (cat && cat.color === color) || (!cat && i === 0) ? 'selected' : '';
        colorsHtml += '<button type="button" class="color-btn ' + selected + '" style="background:' + color + ';" onclick="selectCatColor(this, \'' + color + '\')"></button>';
    }
    
    var content = '<div class="input-group"><label>Название</label>';
    content += '<input type="text" id="catName" value="' + (cat ? cat.name : '') + '"></div>';
    content += '<div class="input-group"><label>Иконка</label>';
    content += '<div class="categories-grid" id="catIconsGrid">' + iconsHtml + '</div></div>';
    content += '<div class="input-group"><label>Цвет</label>';
    content += '<div class="colors-grid" id="catColorsGrid">' + colorsHtml + '</div></div>';
    
    if (type === 'expense') {
        content += '<div class="input-group"><label>Лимит (опционально)</label>';
        content += '<input type="number" id="catLimit" placeholder="0" value="' + (cat && cat.monthly_limit ? cat.monthly_limit : '') + '"></div>';
    }
    
    content += '<button type="button" class="btn-primary" onclick="saveCategory(\'' + type + '\', ' + (editId || 'null') + ')">' + (cat ? 'Сохранить' : 'Добавить') + '</button>';
    
    showModal(title, content);
    window.selectedCatIcon = cat ? cat.icon : catIcons[0];
    window.selectedCatColor = cat ? cat.color : catColors[0];
}

function selectCatIcon(btn, icon) {
    document.querySelectorAll('#catIconsGrid .category-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    window.selectedCatIcon = icon;
}

function selectCatColor(btn, color) {
    document.querySelectorAll('#catColorsGrid .color-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    window.selectedCatColor = color;
}

async function saveCategory(type, editId) {
    var name = document.getElementById('catName').value.trim();
    if (!name) { showToast('Введите название', 'error'); return; }
    
    var limitEl = document.getElementById('catLimit');
    var limit = limitEl ? parseFloat(limitEl.value) || null : null;
    
    try {
        var data = { name: name, icon: window.selectedCatIcon, color: window.selectedCatColor, monthly_limit: limit };
        if (editId) {
            await api.put('/api/categories/' + editId, data);
        } else {
            data.type = type;
            await api.post('/api/categories', data);
        }
        showToast('Сохранено', 'success');
        closeModal();
        await loadData();
        renderSettings();
        renderAll();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

async function deleteCategory(id) {
    var confirmed = await showConfirm('Удалить?', 'Категория будет удалена');
    if (!confirmed) return;
    try {
        await api.delete('/api/categories/' + id);
        showToast('Удалено', 'success');
        await loadData();
        renderSettings();
        renderAll();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

var accIcons = ['💳', '💵', '🪙', '🏦', '💎', '🏧'];

function showAccountModal(editId) {
    var acc = null;
    if (editId) {
        for (var i = 0; i < state.accounts.length; i++) {
            if (state.accounts[i].id === editId) { acc = state.accounts[i]; break; }
        }
    }
    
    var iconsHtml = '';
    for (var i = 0; i < accIcons.length; i++) {
        var icon = accIcons[i];
        var selected = (acc && acc.icon === icon) || (!acc && i === 0) ? 'selected' : '';
        iconsHtml += '<button type="button" class="category-btn ' + selected + '" onclick="selectAccIcon(this, \'' + icon + '\')"><span class="icon">' + icon + '</span></button>';
    }
    
    var content = '<div class="input-group"><label>Название</label>';
    content += '<input type="text" id="accName" value="' + (acc ? acc.name : '') + '"></div>';
    content += '<div class="input-group"><label>Иконка</label>';
    content += '<div class="categories-grid" id="accIconsGrid">' + iconsHtml + '</div></div>';
    content += '<button type="button" class="btn-primary" onclick="saveAccount(' + (editId || 'null') + ')">' + (acc ? 'Сохранить' : 'Добавить') + '</button>';
    
    showModal(acc ? 'Редактировать счёт' : 'Новый счёт', content);
    window.selectedAccIcon = acc ? acc.icon : accIcons[0];
}

function selectAccIcon(btn, icon) {
    document.querySelectorAll('#accIconsGrid .category-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    window.selectedAccIcon = icon;
}

async function saveAccount(editId) {
    var name = document.getElementById('accName').value.trim();
    if (!name) { showToast('Введите название', 'error'); return; }
    
    try {
        var data = { name: name, icon: window.selectedAccIcon };
        if (editId) {
            await api.put('/api/accounts/' + editId, data);
        } else {
            await api.post('/api/accounts', data);
        }
        showToast('Сохранено', 'success');
        closeModal();
        await loadData();
        renderSettings();
        renderAll();
    } catch (e) {
        showToast('Ошибка: ' + e.message, 'error');
    }
}

async function deleteAccount(id) {
    var confirmed = await showConfirm('Удалить?', 'Счёт будет удалён');
    if (!confirmed) return;
    try {
        await api.delete('/api/accounts/' + id);
        showToast('Удалено', 'success');
        await loadData();
        renderSettings();
        renderAll();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

function showTransferModal() {
    var accountsHtml1 = '';
    var accountsHtml2 = '';
    for (var i = 0; i < state.accounts.length; i++) {
        var a = state.accounts[i];
        accountsHtml1 += '<button type="button" class="account-btn" data-id="' + a.id + '" onclick="selectTransferFrom(this, ' + a.id + ')"><span class="icon">' + a.icon + '</span><span class="name">' + a.name + '</span></button>';
        accountsHtml2 += '<button type="button" class="account-btn" data-id="' + a.id + '" onclick="selectTransferTo(this, ' + a.id + ')"><span class="icon">' + a.icon + '</span><span class="name">' + a.name + '</span></button>';
    }
    
    var content = '<div class="input-group"><label>Со счёта</label>';
    content += '<div class="accounts-select" id="transferFrom">' + accountsHtml1 + '</div></div>';
    content += '<div class="transfer-arrow">↓</div>';
    content += '<div class="input-group"><label>На счёт</label>';
    content += '<div class="accounts-select" id="transferTo">' + accountsHtml2 + '</div></div>';
    content += '<div class="input-group"><label>Сумма</label>';
    content += '<div class="amount-input-row">';
    content += '<input type="number" id="transferAmount" placeholder="0.00" inputmode="decimal">';
    content += '<div class="currency-selector" id="transferCurrency">';
    content += '<button type="button" class="currency-btn selected" onclick="selectTransferCur(this, \'BYN\')">BYN</button>';
    content += '<button type="button" class="currency-btn" onclick="selectTransferCur(this, \'USD\')">USD</button>';
    content += '<button type="button" class="currency-btn" onclick="selectTransferCur(this, \'EUR\')">EUR</button>';
    content += '</div></div></div>';
    content += '<button type="button" class="btn-primary" onclick="saveTransfer()">Перевести</button>';
    
    showModal('Перевод', content);
    window.transferFromId = null;
    window.transferToId = null;
    window.transferCur = 'BYN';
}

function selectTransferFrom(btn, id) {
    document.querySelectorAll('#transferFrom .account-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    window.transferFromId = id;
}

function selectTransferTo(btn, id) {
    document.querySelectorAll('#transferTo .account-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    window.transferToId = id;
}

function selectTransferCur(btn, cur) {
    document.querySelectorAll('#transferCurrency .currency-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    window.transferCur = cur;
}

async function saveTransfer() {
    var amount = parseFloat(document.getElementById('transferAmount').value);
    if (!amount || amount <= 0) { showToast('Введите сумму', 'error'); return; }
    if (!window.transferFromId) { showToast('Выберите откуда', 'error'); return; }
    if (!window.transferToId) { showToast('Выберите куда', 'error'); return; }
    if (window.transferFromId === window.transferToId) { showToast('Выберите разные счета', 'error'); return; }
    
    try {
        await api.post('/api/transfers', {
            from_account_id: window.transferFromId,
            to_account_id: window.transferToId,
            amount: amount,
            currency: window.transferCur
        });
        showToast('Переведено!', 'success');
        closeModal();
        await loadData();
        renderAll();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function formatMoney(amount) {
    if (!amount) amount = 0;
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatDate(dateStr) {
    var date = new Date(dateStr);
    var months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return date.getDate() + ' ' + months[date.getMonth()];
}

function formatMonth(date) {
    var m = date.getMonth() + 1;
    return date.getFullYear() + '-' + (m < 10 ? '0' + m : m);
}

function formatMonthDisplay(date) {
    var months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return months[date.getMonth()] + ' ' + date.getFullYear();
}
