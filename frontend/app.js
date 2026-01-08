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
        tg.onEvent('viewportChanged', () => { if (!tg.isExpanded) tg.expand(); });
    }
    if (!state.userId) {
        const urlParams = new URLSearchParams(window.location.search);
        state.userId = urlParams.get('user_id') || 1;
    }
}

const api = {
    async get(url) {
        const sep = url.includes('?') ? '&' : '?';
        const res = await fetch(`${url}${sep}user_id=${state.userId}`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Ошибка');
        return res.json();
    },
    async post(url, data) {
        const res = await fetch(`${url}?user_id=${state.userId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Ошибка');
        return res.json();
    },
    async put(url, data) {
        const res = await fetch(`${url}?user_id=${state.userId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json().catch(()
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
        tg.onEvent('viewportChanged', () => { if (!tg.isExpanded) tg.expand(); });
    }
    if (!state.userId) {
        const urlParams = new URLSearchParams(window.location.search);
        state.userId = urlParams.get('user_id') || 1;
    }
}

const api = {
    async get(url) {
        const sep = url.includes('?') ? '&' : '?';
        const res = await fetch(`${url}${sep}user_id=${state.userId}`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Ошибка');
        return res.json();
    },
    async post(url, data) {
        const res = await fetch(`${url}?user_id=${state.userId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Ошибка');
        return res.json();
    },
    async put(url, data) {
        const res = await fetch(`${url}?user_id=${state.userId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json().catch(()
