import sqlite3
from datetime import datetime
from typing import Optional
import os

DB_FOLDER = "databases"

def get_db_path(user_id: int) -> str:
    if not os.path.exists(DB_FOLDER):
        os.makedirs(DB_FOLDER)
    return os.path.join(DB_FOLDER, f"user_{user_id}.db")

def get_connection(user_id: int):
    conn = sqlite3.connect(get_db_path(user_id))
    conn.row_factory = sqlite3.Row
    return conn

def init_db(user_id: int):
    conn = get_connection(user_id)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT DEFAULT '💳',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS account_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            currency TEXT NOT NULL,
            balance REAL DEFAULT 0,
            FOREIGN KEY (account_id) REFERENCES accounts(id),
            UNIQUE(account_id, currency)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            icon TEXT DEFAULT '📦',
            color TEXT DEFAULT '#007AFF',
            monthly_limit REAL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'BYN',
            type TEXT NOT NULL,
            category_id INTEGER,
            account_id INTEGER,
            description TEXT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id),
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_account_id INTEGER NOT NULL,
            to_account_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'BYN',
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_account_id) REFERENCES accounts(id),
            FOREIGN KEY (to_account_id) REFERENCES accounts(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            target_amount REAL NOT NULL,
            current_amount REAL DEFAULT 0,
            icon TEXT DEFAULT '🎯',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS limit_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            month TEXT NOT NULL,
            notified_80 INTEGER DEFAULT 0,
            notified_100 INTEGER DEFAULT 0,
            FOREIGN KEY (category_id) REFERENCES categories(id),
            UNIQUE(category_id, month)
        )
    ''')
    
    conn.commit()
    
    cursor.execute("SELECT COUNT(*) FROM categories")
    if cursor.fetchone()[0] == 0:
        init_default_data(conn)
    
    conn.close()

def init_default_data(conn):
    cursor = conn.cursor()
    
    expense_categories = [
        ('Еда', 'expense', '🍔', '#FF9500'),
        ('Транспорт', 'expense', '🚗', '#FF3B30'),
        ('Развлечения', 'expense', '🎮', '#AF52DE'),
        ('Покупки', 'expense', '🛒', '#007AFF'),
        ('Здоровье', 'expense', '💊', '#34C759'),
        ('Связь', 'expense', '📱', '#5856D6'),
        ('Жильё', 'expense', '🏠', '#FF2D55'),
        ('Образование', 'expense', '📚', '#00C7BE'),
        ('Другое', 'expense', '📦', '#8E8E93'),
    ]
    
    income_categories = [
        ('Зарплата', 'income', '💰', '#34C759'),
        ('Подработка', 'income', '💵', '#007AFF'),
        ('Подарок', 'income', '🎁', '#FF9500'),
        ('Другое', 'income', '📥', '#8E8E93'),
    ]
    
    for name, type_, icon, color in expense_categories + income_categories:
        cursor.execute(
            "INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?)",
            (name, type_, icon, color)
        )
    
    default_accounts = [
        ('Основная карта', '💳'),
        ('Наличные', '💵'),
    ]
    
    for name, icon in default_accounts:
        cursor.execute("INSERT INTO accounts (name, icon) VALUES (?, ?)", (name, icon))
        account_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO account_balances (account_id, currency, balance) VALUES (?, 'BYN', 0)",
            (account_id,)
        )
    
    conn.commit()

# ============ Счета ============

def get_accounts(user_id: int):
    conn = get_connection(user_id)
    accounts = conn.execute("SELECT * FROM accounts ORDER BY created_at").fetchall()
    result = []
    for acc in accounts:
        acc_dict = dict(acc)
        balances = conn.execute(
            "SELECT currency, balance FROM account_balances WHERE account_id = ?",
            (acc['id'],)
        ).fetchall()
        acc_dict['balances'] = {b['currency']: b['balance'] for b in balances}
        result.append(acc_dict)
    conn.close()
    return result

def get_account(user_id: int, id: int):
    conn = get_connection(user_id)
    account = conn.execute("SELECT * FROM accounts WHERE id=?", (id,)).fetchone()
    if account:
        acc_dict = dict(account)
        balances = conn.execute(
            "SELECT currency, balance FROM account_balances WHERE account_id = ?",
            (id,)
        ).fetchall()
        acc_dict['balances'] = {b['currency']: b['balance'] for b in balances}
        conn.close()
        return acc_dict
    conn.close()
    return None

def add_account(user_id: int, name: str, icon: str = '💳'):
    conn = get_connection(user_id)
    cursor = conn.execute("INSERT INTO accounts (name, icon) VALUES (?, ?)", (name, icon))
    account_id = cursor.lastrowid
    conn.execute(
        "INSERT INTO account_balances (account_id, currency, balance) VALUES (?, 'BYN', 0)",
        (account_id,)
    )
    conn.commit()
    conn.close()
    return account_id

def update_account(user_id: int, id: int, name: str, icon: str):
    conn = get_connection(user_id)
    conn.execute("UPDATE accounts SET name=?, icon=? WHERE id=?", (name, icon, id))
    conn.commit()
    conn.close()

def delete_account(user_id: int, id: int):
    conn = get_connection(user_id)
    conn.execute("DELETE FROM transactions WHERE account_id=?", (id,))
    conn.execute("DELETE FROM transfers WHERE from_account_id=? OR to_account_id=?", (id, id))
    conn.execute("DELETE FROM account_balances WHERE account_id=?", (id,))
    conn.execute("DELETE FROM accounts WHERE id=?", (id,))
    conn.commit()
    conn.close()

def update_account_balance(user_id: int, account_id: int, currency: str, amount: float, operation: str = 'add'):
    conn = get_connection(user_id)
    existing = conn.execute(
        "SELECT balance FROM account_balances WHERE account_id = ? AND currency = ?",
        (account_id, currency)
    ).fetchone()
    
    if existing:
        if operation == 'add':
            conn.execute(
                "UPDATE account_balances SET balance = balance + ? WHERE account_id = ? AND currency = ?",
                (amount, account_id, currency)
            )
        else:
            conn.execute(
                "UPDATE account_balances SET balance = balance - ? WHERE account_id = ? AND currency = ?",
                (amount, account_id, currency)
            )
    else:
        balance = amount if operation == 'add' else -amount
        conn.execute(
            "INSERT INTO account_balances (account_id, currency, balance) VALUES (?, ?, ?)",
            (account_id, currency, balance)
        )
    
    conn.commit()
    conn.close()

def get_account_balance(user_id: int, account_id: int, currency: str) -> float:
    conn = get_connection(user_id)
    result = conn.execute(
        "SELECT balance FROM account_balances WHERE account_id = ? AND currency = ?",
        (account_id, currency)
    ).fetchone()
    conn.close()
    return result['balance'] if result else 0

# ============ Категории ============

def get_categories(user_id: int, type_filter: Optional[str] = None):
    conn = get_connection(user_id)
    if type_filter:
        categories = conn.execute(
            "SELECT * FROM categories WHERE type=? ORDER BY created_at",
            (type_filter,)
        ).fetchall()
    else:
        categories = conn.execute("SELECT * FROM categories ORDER BY type, created_at").fetchall()
    conn.close()
    return [dict(c) for c in categories]

def get_category(user_id: int, id: int):
    conn = get_connection(user_id)
    category = conn.execute("SELECT * FROM categories WHERE id=?", (id,)).fetchone()
    conn.close()
    return dict(category) if category else None

def add_category(user_id: int, name: str, type_: str, icon: str = '📦', color: str = '#007AFF', monthly_limit: float = None):
    conn = get_connection(user_id)
    cursor = conn.execute(
        "INSERT INTO categories (name, type, icon, color, monthly_limit) VALUES (?, ?, ?, ?, ?)",
        (name, type_, icon, color, monthly_limit)
    )
    conn.commit()
    category_id = cursor.lastrowid
    conn.close()
    return category_id

def update_category(user_id: int, id: int, name: str, icon: str, color: str, monthly_limit: float = None):
    conn = get_connection(user_id)
    conn.execute(
        "UPDATE categories SET name=?, icon=?, color=?, monthly_limit=? WHERE id=?",
        (name, icon, color, monthly_limit, id)
    )
    conn.commit()
    conn.close()

def delete_category(user_id: int, id: int):
    conn = get_connection(user_id)
    conn.execute("DELETE FROM transactions WHERE category_id=?", (id,))
    conn.execute("DELETE FROM categories WHERE id=?", (id,))
    conn.commit()
    conn.close()

# ============ Транзакции ============

def get_transactions(user_id: int, limit: int = 50, offset: int = 0, month: str = None):
    conn = get_connection(user_id)
    query = '''
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
               a.name as account_name, a.icon as account_icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN accounts a ON t.account_id = a.id
    '''
    params = []
    
    if month:
        query += " WHERE strftime('%Y-%m', t.date) = ?"
        params.append(month)
    
    query += " ORDER BY t.date DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    transactions = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(t) for t in transactions]

def get_transaction(user_id: int, id: int):
    conn = get_connection(user_id)
    t = conn.execute('''
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
               a.name as account_name, a.icon as account_icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.id = ?
    ''', (id,)).fetchone()
    conn.close()
    return dict(t) if t else None

def add_transaction(user_id: int, amount: float, currency: str, type_: str, category_id: int, account_id: int, description: str = '', date: str = None):
    if type_ == 'expense':
        balance = get_account_balance(user_id, account_id, currency)
        if balance < amount:
            return None, "insufficient_funds"
    
    conn = get_connection(user_id)
    if date is None:
        date = datetime.now().isoformat()
    
    cursor = conn.execute(
        "INSERT INTO transactions (amount, currency, type, category_id, account_id, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (amount, currency, type_, category_id, account_id, description, date)
    )
    conn.commit()
    transaction_id = cursor.lastrowid
    conn.close()
    
    if type_ == 'expense':
        update_account_balance(user_id, account_id, currency, amount, 'subtract')
    else:
        update_account_balance(user_id, account_id, currency, amount, 'add')
    
    return transaction_id, "success"

def update_transaction(user_id: int, id: int, amount: float, currency: str, type_: str, category_id: int, account_id: int, description: str = '', date: str = None):
    conn = get_connection(user_id)
    old_t = conn.execute("SELECT * FROM transactions WHERE id=?", (id,)).fetchone()
    if not old_t:
        conn.close()
        return None, "not_found"
    
    if old_t['type'] == 'expense':
        update_account_balance(user_id, old_t['account_id'], old_t['currency'], old_t['amount'], 'add')
    else:
        update_account_balance(user_id, old_t['account_id'], old_t['currency'], old_t['amount'], 'subtract')
    
    if type_ == 'expense':
        balance = get_account_balance(user_id, account_id, currency)
        if balance < amount:
            if old_t['type'] == 'expense':
                update_account_balance(user_id, old_t['account_id'], old_t['currency'], old_t['amount'], 'subtract')
            else:
                update_account_balance(user_id, old_t['account_id'], old_t['currency'], old_t['amount'], 'add')
            conn.close()
            return None, "insufficient_funds"
    
    conn.execute(
        "UPDATE transactions SET amount=?, currency=?, type=?, category_id=?, account_id=?, description=?, date=? WHERE id=?",
        (amount, currency, type_, category_id, account_id, description, date, id)
    )
    conn.commit()
    conn.close()
    
    if type_ == 'expense':
        update_account_balance(user_id, account_id, currency, amount, 'subtract')
    else:
        update_account_balance(user_id, account_id, currency, amount, 'add')
    
    return id, "success"

def delete_transaction(user_id: int, id: int):
    conn = get_connection(user_id)
    t = conn.execute("SELECT * FROM transactions WHERE id=?", (id,)).fetchone()
    if t:
        if t['type'] == 'expense':
            update_account_balance(user_id, t['account_id'], t['currency'], t['amount'], 'add')
        else:
            update_account_balance(user_id, t['account_id'], t['currency'], t['amount'], 'subtract')
        conn.execute("DELETE FROM transactions WHERE id=?", (id,))
        conn.commit()
    conn.close()

# ============ Переводы ============

def get_transfers(user_id: int, limit: int = 50):
    conn = get_connection(user_id)
    transfers = conn.execute('''
        SELECT tr.*, 
               fa.name as from_account_name, fa.icon as from_account_icon,
               ta.name as to_account_name, ta.icon as to_account_icon
        FROM transfers tr
        LEFT JOIN accounts fa ON tr.from_account_id = fa.id
        LEFT JOIN accounts ta ON tr.to_account_id = ta.id
        ORDER BY tr.date DESC
        LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return [dict(t) for t in transfers]

def add_transfer(user_id: int, from_account_id: int, to_account_id: int, amount: float, currency: str):
    balance = get_account_balance(user_id, from_account_id, currency)
    if balance < amount:
        return None, "insufficient_funds"
    
    conn = get_connection(user_id)
    cursor = conn.execute(
        "INSERT INTO transfers (from_account_id, to_account_id, amount, currency) VALUES (?, ?, ?, ?)",
        (from_account_id, to_account_id, amount, currency)
    )
    conn.commit()
    transfer_id = cursor.lastrowid
    conn.close()
    
    update_account_balance(user_id, from_account_id, currency, amount, 'subtract')
    update_account_balance(user_id, to_account_id, currency, amount, 'add')
    
    return transfer_id, "success"

def delete_transfer(user_id: int, id: int):
    conn = get_connection(user_id)
    t = conn.execute("SELECT * FROM transfers WHERE id=?", (id,)).fetchone()
    if t:
        update_account_balance(user_id, t['from_account_id'], t['currency'], t['amount'], 'add')
        update_account_balance(user_id, t['to_account_id'], t['currency'], t['amount'], 'subtract')
        conn.execute("DELETE FROM transfers WHERE id=?", (id,))
        conn.commit()
    conn.close()

# ============ Цели ============

def get_goals(user_id: int):
    conn = get_connection(user_id)
    goals = conn.execute("SELECT * FROM goals ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(g) for g in goals]

def get_goal(user_id: int, id: int):
    conn = get_connection(user_id)
    goal = conn.execute("SELECT * FROM goals WHERE id=?", (id,)).fetchone()
    conn.close()
    return dict(goal) if goal else None

def add_goal(user_id: int, name: str, target_amount: float, icon: str = '🎯'):
    conn = get_connection(user_id)
    cursor = conn.execute(
        "INSERT INTO goals (name, target_amount, icon, current_amount) VALUES (?, ?, ?, 0)",
        (name, target_amount, icon)
    )
    conn.commit()
    goal_id = cursor.lastrowid
    conn.close()
    return goal_id

def update_goal(user_id: int, id: int, name: str = None, target_amount: float = None, icon: str = None):
    conn = get_connection(user_id)
    goal = conn.execute("SELECT * FROM goals WHERE id=?", (id,)).fetchone()
    if goal:
        new_name = name if name else goal['name']
        new_target = target_amount if target_amount else goal['target_amount']
        new_icon = icon if icon else goal['icon']
        conn.execute(
            "UPDATE goals SET name=?, target_amount=?, icon=? WHERE id=?",
            (new_name, new_target, new_icon, id)
        )
        conn.commit()
    conn.close()

def add_to_goal(user_id: int, id: int, amount: float):
    conn = get_connection(user_id)
    conn.execute("UPDATE goals SET current_amount = current_amount + ? WHERE id = ?", (amount, id))
    conn.commit()
    conn.close()

def delete_goal(user_id: int, id: int):
    conn = get_connection(user_id)
    conn.execute("DELETE FROM goals WHERE id=?", (id,))
    conn.commit()
    conn.close()

# ============ Аналитика ============

def get_monthly_stats(user_id: int, month: str):
    conn = get_connection(user_id)
    
    expenses_by_category = conn.execute('''
        SELECT c.id, c.name, c.icon, c.color, c.monthly_limit, SUM(t.amount) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type = 'expense' AND strftime('%Y-%m', t.date) = ?
        GROUP BY c.id
        ORDER BY total DESC
    ''', (month,)).fetchall()
    
    totals = conn.execute('''
        SELECT type, SUM(amount) as total
        FROM transactions
        WHERE strftime('%Y-%m', date) = ?
        GROUP BY type
    ''', (month,)).fetchall()
    
    daily_expenses = conn.execute('''
        SELECT strftime('%d', date) as day, SUM(amount) as total
        FROM transactions
        WHERE type = 'expense' AND strftime('%Y-%m', date) = ?
        GROUP BY day
        ORDER BY day
    ''', (month,)).fetchall()
    
    conn.close()
    
    totals_dict = {t['type']: t['total'] for t in totals}
    
    return {
        'expenses_by_category': [dict(e) for e in expenses_by_category],
        'total_expense': totals_dict.get('expense', 0),
        'total_income': totals_dict.get('income', 0),
        'daily_expenses': [dict(d) for d in daily_expenses]
    }

def check_limits(user_id: int, month: str):
    conn = get_connection(user_id)
    
    results = conn.execute('''
        SELECT c.id, c.name, c.icon, c.monthly_limit, 
               COALESCE(SUM(t.amount), 0) as spent,
               ln.notified_80, ln.notified_100
        FROM categories c
        LEFT JOIN transactions t ON c.id = t.category_id 
            AND t.type = 'expense' 
            AND strftime('%Y-%m', t.date) = ?
        LEFT JOIN limit_notifications ln ON c.id = ln.category_id AND ln.month = ?
        WHERE c.monthly_limit IS NOT NULL AND c.monthly_limit > 0
        GROUP BY c.id
    ''', (month, month)).fetchall()
    
    notifications = []
    
    for r in results:
        if r['monthly_limit'] and r['monthly_limit'] > 0:
            percent = (r['spent'] / r['monthly_limit']) * 100
            
            if percent >= 80 and percent < 100 and not r['notified_80']:
                notifications.append({
                    'category_id': r['id'],
                    'category_name': r['name'],
                    'icon': r['icon'],
                    'spent': r['spent'],
                    'limit': r['monthly_limit'],
                    'percent': 80
                })
                conn.execute('''
                    INSERT OR REPLACE INTO limit_notifications (category_id, month, notified_80, notified_100)
                    VALUES (?, ?, 1, 0)
                ''', (r['id'], month))
            
            if percent >= 100 and not r['notified_100']:
                notifications.append({
                    'category_id': r['id'],
                    'category_name': r['name'],
                    'icon': r['icon'],
                    'spent': r['spent'],
                    'limit': r['monthly_limit'],
                    'percent': 100
                })
                conn.execute('''
                    INSERT OR REPLACE INTO limit_notifications (category_id, month, notified_80, notified_100)
                    VALUES (?, ?, 1, 1)
                ''', (r['id'], month))
    
    conn.commit()
    conn.close()
    return notifications

def get_all_transactions_for_export(user_id: int, month: str = None):
    conn = get_connection(user_id)
    query = '''
        SELECT t.date, t.type, t.amount, t.currency, t.description,
               c.name as category_name, a.name as account_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN accounts a ON t.account_id = a.id
    '''
    params = []
    
    if month:
        query += " WHERE strftime('%Y-%m', t.date) = ?"
        params.append(month)
    
    query += " ORDER BY t.date DESC"
    
    transactions = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(t) for t in transactions]
