import sqlite3
from datetime import datetime
from typing import Optional
import os

DB_PATH = "finance.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Таблица счетов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            currency TEXT NOT NULL,
            balance REAL DEFAULT 0,
            icon TEXT DEFAULT '💳',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Таблица категорий
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
    
    # Таблица транзакций
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            type TEXT NOT NULL,
            category_id INTEGER,
            account_id INTEGER,
            description TEXT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id),
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    ''')
    
    # Таблица переводов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_account_id INTEGER NOT NULL,
            to_account_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            converted_amount REAL NOT NULL,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_account_id) REFERENCES accounts(id),
            FOREIGN KEY (to_account_id) REFERENCES accounts(id)
        )
    ''')
    
    # Таблица курсов валют
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS exchange_rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_currency TEXT NOT NULL,
            to_currency TEXT NOT NULL,
            rate REAL NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    
    # Проверяем, есть ли начальные данные
    cursor.execute("SELECT COUNT(*) FROM categories")
    if cursor.fetchone()[0] == 0:
        init_default_data(conn)
    
    conn.close()

def init_default_data(conn):
    cursor = conn.cursor()
    
    # Стандартные категории расходов
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
    
    # Стандартные категории доходов
    income_categories = [
        ('Зарплата', 'income', '💰', '#34C759'),
        ('Стипендия', 'income', '🎓', '#007AFF'),
        ('Подарок', 'income', '🎁', '#FF9500'),
        ('Другое', 'income', '📥', '#8E8E93'),
    ]
    
    for name, type_, icon, color in expense_categories + income_categories:
        cursor.execute(
            "INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?)",
            (name, type_, icon, color)
        )
    
    # Стандартные счета
    default_accounts = [
        ('Основная карта', 'BYN', '💳'),
        ('Вторая карта', 'BYN', '💳'),
        ('Наличные', 'BYN', '💵'),
        ('Крипто USDT', 'USDT', '🪙'),
    ]
    
    for name, currency, icon in default_accounts:
        cursor.execute(
            "INSERT INTO accounts (name, currency, icon) VALUES (?, ?, ?)",
            (name, currency, icon)
        )
    
    conn.commit()

# ============ CRUD операции ============

# --- Счета ---
def get_accounts():
    conn = get_connection()
    accounts = conn.execute("SELECT * FROM accounts ORDER BY created_at").fetchall()
    conn.close()
    return [dict(a) for a in accounts]

def get_account(id: int):
    conn = get_connection()
    account = conn.execute("SELECT * FROM accounts WHERE id=?", (id,)).fetchone()
    conn.close()
    return dict(account) if account else None

def add_account(name: str, currency: str, icon: str = '💳'):
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO accounts (name, currency, icon) VALUES (?, ?, ?)",
        (name, currency, icon)
    )
    conn.commit()
    account_id = cursor.lastrowid
    conn.close()
    return account_id

def update_account(id: int, name: str, currency: str, icon: str):
    conn = get_connection()
    conn.execute(
        "UPDATE accounts SET name=?, currency=?, icon=? WHERE id=?",
        (name, currency, icon, id)
    )
    conn.commit()
    conn.close()

def delete_account(id: int):
    conn = get_connection()
    conn.execute("DELETE FROM transactions WHERE account_id=?", (id,))
    conn.execute("DELETE FROM transfers WHERE from_account_id=? OR to_account_id=?", (id, id))
    conn.execute("DELETE FROM accounts WHERE id=?", (id,))
    conn.commit()
    conn.close()

# --- Категории ---
def get_categories(type_filter: Optional[str] = None):
    conn = get_connection()
    if type_filter:
        categories = conn.execute(
            "SELECT * FROM categories WHERE type=? ORDER BY created_at",
            (type_filter,)
        ).fetchall()
    else:
        categories = conn.execute("SELECT * FROM categories ORDER BY type, created_at").fetchall()
    conn.close()
    return [dict(c) for c in categories]

def get_category(id: int):
    conn = get_connection()
    category = conn.execute("SELECT * FROM categories WHERE id=?", (id,)).fetchone()
    conn.close()
    return dict(category) if category else None

def add_category(name: str, type_: str, icon: str = '📦', color: str = '#007AFF', monthly_limit: float = None):
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO categories (name, type, icon, color, monthly_limit) VALUES (?, ?, ?, ?, ?)",
        (name, type_, icon, color, monthly_limit)
    )
    conn.commit()
    category_id = cursor.lastrowid
    conn.close()
    return category_id

def update_category(id: int, name: str, icon: str, color: str, monthly_limit: float = None):
    conn = get_connection()
    conn.execute(
        "UPDATE categories SET name=?, icon=?, color=?, monthly_limit=? WHERE id=?",
        (name, icon, color, monthly_limit, id)
    )
    conn.commit()
    conn.close()

def delete_category(id: int):
    conn = get_connection()
    conn.execute("DELETE FROM transactions WHERE category_id=?", (id,))
    conn.execute("DELETE FROM categories WHERE id=?", (id,))
    conn.commit()
    conn.close()

# --- Транзакции ---
def get_transactions(limit: int = 50, offset: int = 0, month: str = None):
    conn = get_connection()
    query = '''
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
               a.name as account_name, a.icon as account_icon, a.currency as account_currency
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

def get_transaction(id: int):
    conn = get_connection()
    t = conn.execute('''
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
               a.name as account_name, a.icon as account_icon, a.currency as account_currency
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.id = ?
    ''', (id,)).fetchone()
    conn.close()
    return dict(t) if t else None

def add_transaction(amount: float, type_: str, category_id: int, account_id: int, description: str = '', date: str = None):
    conn = get_connection()
    
    # Проверка баланса для расходов
    if type_ == 'expense':
        account = conn.execute("SELECT balance FROM accounts WHERE id=?", (account_id,)).fetchone()
        if account and account['balance'] < amount:
            conn.close()
            return None, "insufficient_funds"
    
    if date is None:
        date = datetime.now().isoformat()
    
    cursor = conn.execute(
        "INSERT INTO transactions (amount, type, category_id, account_id, description, date) VALUES (?, ?, ?, ?, ?, ?)",
        (amount, type_, category_id, account_id, description, date)
    )
    
    # Обновляем баланс счёта
    if type_ == 'expense':
        conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, account_id))
    else:
        conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (amount, account_id))
    
    conn.commit()
    transaction_id = cursor.lastrowid
    conn.close()
    return transaction_id, "success"

def update_transaction(id: int, amount: float, type_: str, category_id: int, account_id: int, description: str = '', date: str = None):
    conn = get_connection()
    
    # Получаем старую транзакцию для восстановления баланса
    old_t = conn.execute("SELECT * FROM transactions WHERE id=?", (id,)).fetchone()
    if not old_t:
        conn.close()
        return None, "not_found"
    
    # Восстанавливаем старый баланс
    if old_t['type'] == 'expense':
        conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (old_t['amount'], old_t['account_id']))
    else:
        conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (old_t['amount'], old_t['account_id']))
    
    # Проверяем новый баланс для расходов
    if type_ == 'expense':
        account = conn.execute("SELECT balance FROM accounts WHERE id=?", (account_id,)).fetchone()
        if account and account['balance'] < amount:
            # Откатываем восстановление баланса
            if old_t['type'] == 'expense':
                conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (old_t['amount'], old_t['account_id']))
            else:
                conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (old_t['amount'], old_t['account_id']))
            conn.commit()
            conn.close()
            return None, "insufficient_funds"
    
    # Обновляем транзакцию
    conn.execute(
        "UPDATE transactions SET amount=?, type=?, category_id=?, account_id=?, description=?, date=? WHERE id=?",
        (amount, type_, category_id, account_id, description, date, id)
    )
    
    # Применяем новый баланс
    if type_ == 'expense':
        conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, account_id))
    else:
        conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (amount, account_id))
    
    conn.commit()
    conn.close()
    return id, "success"

def delete_transaction(id: int):
    conn = get_connection()
    # Сначала получаем транзакцию для восстановления баланса
    t = conn.execute("SELECT * FROM transactions WHERE id=?", (id,)).fetchone()
    if t:
        if t['type'] == 'expense':
            conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (t['amount'], t['account_id']))
        else:
            conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (t['amount'], t['account_id']))
        conn.execute("DELETE FROM transactions WHERE id=?", (id,))
        conn.commit()
    conn.close()

# --- Переводы ---
def get_transfers(limit: int = 50):
    conn = get_connection()
    transfers = conn.execute('''
        SELECT tr.*, 
               fa.name as from_account_name, fa.icon as from_account_icon, fa.currency as from_currency,
               ta.name as to_account_name, ta.icon as to_account_icon, ta.currency as to_currency
        FROM transfers tr
        LEFT JOIN accounts fa ON tr.from_account_id = fa.id
        LEFT JOIN accounts ta ON tr.to_account_id = ta.id
        ORDER BY tr.date DESC
        LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return [dict(t) for t in transfers]

def add_transfer(from_account_id: int, to_account_id: int, amount: float, converted_amount: float):
    conn = get_connection()
    
    # Проверяем баланс отправителя
    from_account = conn.execute("SELECT balance FROM accounts WHERE id=?", (from_account_id,)).fetchone()
    if from_account and from_account['balance'] < amount:
        conn.close()
        return None, "insufficient_funds"
    
    # Создаём перевод
    cursor = conn.execute(
        "INSERT INTO transfers (from_account_id, to_account_id, amount, converted_amount) VALUES (?, ?, ?, ?)",
        (from_account_id, to_account_id, amount, converted_amount)
    )
    
    # Обновляем балансы
    conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, from_account_id))
    conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (converted_amount, to_account_id))
    
    conn.commit()
    transfer_id = cursor.lastrowid
    conn.close()
    return transfer_id, "success"

def delete_transfer(id: int):
    conn = get_connection()
    t = conn.execute("SELECT * FROM transfers WHERE id=?", (id,)).fetchone()
    if t:
        conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (t['amount'], t['from_account_id']))
        conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (t['converted_amount'], t['to_account_id']))
        conn.execute("DELETE FROM transfers WHERE id=?", (id,))
        conn.commit()
    conn.close()

# --- Аналитика ---
def get_monthly_stats(month: str):
    conn = get_connection()
    
    # Расходы по категориям
    expenses_by_category = conn.execute('''
        SELECT c.name, c.icon, c.color, c.monthly_limit, SUM(t.amount) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type = 'expense' AND strftime('%Y-%m', t.date) = ?
        GROUP BY c.id
        ORDER BY total DESC
    ''', (month,)).fetchall()
    
    # Общие суммы
    totals = conn.execute('''
        SELECT type, SUM(amount) as total
        FROM transactions
        WHERE strftime('%Y-%m', date) = ?
        GROUP BY type
    ''', (month,)).fetchall()
    
    # Расходы по дням
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

# --- Экспорт ---
def get_all_transactions_for_export(month: str = None):
    conn = get_connection()
    query = '''
        SELECT t.date, t.type, t.amount, t.description,
               c.name as category_name,
               a.name as account_name, a.currency
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

if __name__ == "__main__":
    init_db()
    print("Database initialized!")