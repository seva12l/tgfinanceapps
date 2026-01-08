from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import httpx
import io
import os
import database as db

app = FastAPI()

app.mount("/static", StaticFiles(directory="frontend"), name="static")

# ============ Модели ============

class AccountCreate(BaseModel):
    name: str
    icon: str = '💳'

class AccountUpdate(BaseModel):
    name: str
    icon: str

class CategoryCreate(BaseModel):
    name: str
    type: str
    icon: str = '📦'
    color: str = '#007AFF'
    monthly_limit: Optional[float] = None

class CategoryUpdate(BaseModel):
    name: str
    icon: str
    color: str
    monthly_limit: Optional[float] = None

class TransactionCreate(BaseModel):
    amount: float
    currency: str = 'BYN'
    type: str
    category_id: int
    account_id: int
    description: str = ''
    date: Optional[str] = None

class TransactionUpdate(BaseModel):
    amount: float
    currency: str = 'BYN'
    type: str
    category_id: int
    account_id: int
    description: str = ''
    date: Optional[str] = None

class TransferCreate(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: float
    currency: str = 'BYN'

class GoalCreate(BaseModel):
    name: str
    target_amount: float
    icon: str = '🎯'

class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    icon: Optional[str] = None

class GoalAddMoney(BaseModel):
    amount: float

def get_user_id(request: Request) -> int:
    user_id = request.headers.get('X-User-Id')
    if user_id:
        return int(user_id)
    user_id = request.query_params.get('user_id')
    if user_id:
        return int(user_id)
    return 1

@app.get("/")
async def root():
    return FileResponse("frontend/index.html")

@app.get("/api/init")
async def init_user(request: Request):
    user_id = get_user_id(request)
    db.init_db(user_id)
    return {"status": "ok", "user_id": user_id}

# --- Счета ---
@app.get("/api/accounts")
async def get_accounts(request: Request):
    user_id = get_user_id(request)
    db.init_db(user_id)
    return db.get_accounts(user_id)

@app.post("/api/accounts")
async def create_account(account: AccountCreate, request: Request):
    user_id = get_user_id(request)
    db.init_db(user_id)
    id = db.add_account(user_id, account.name, account.icon)
    return {"id": id, "status": "created"}

@app.put("/api/accounts/{id}")
async def update_account(id: int, account: AccountUpdate, request: Request):
    user_id = get_user_id(request)
    db.update_account(user_id, id, account.name, account.icon)
    return {"status": "updated"}

@app.delete("/api/accounts/{id}")
async def delete_account(id: int, request: Request):
    user_id = get_user_id(request)
    db.delete_account(user_id, id)
    return {"status": "deleted"}

# --- Категории ---
@app.get("/api/categories")
async def get_categories(request: Request, type: Optional[str] = None):
    user_id = get_user_id(request)
    db.init_db(user_id)
    return db.get_categories(user_id, type)

@app.post("/api/categories")
async def create_category(category: CategoryCreate, request: Request):
    user_id = get_user_id(request)
    id = db.add_category(user_id, category.name, category.type, category.icon, category.color, category.monthly_limit)
    return {"id": id, "status": "created"}

@app.put("/api/categories/{id}")
async def update_category(id: int, category: CategoryUpdate, request: Request):
    user_id = get_user_id(request)
    db.update_category(user_id, id, category.name, category.icon, category.color, category.monthly_limit)
    return {"status": "updated"}

@app.delete("/api/categories/{id}")
async def delete_category(id: int, request: Request):
    user_id = get_user_id(request)
    db.delete_category(user_id, id)
    return {"status": "deleted"}

# --- Транзакции ---
@app.get("/api/transactions")
async def get_transactions(request: Request, limit: int = 50, offset: int = 0, month: Optional[str] = None):
    user_id = get_user_id(request)
    db.init_db(user_id)
    return db.get_transactions(user_id, limit, offset, month)

@app.get("/api/transactions/{id}")
async def get_transaction(id: int, request: Request):
    user_id = get_user_id(request)
    t = db.get_transaction(user_id, id)
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    return t

@app.post("/api/transactions")
async def create_transaction(transaction: TransactionCreate, request: Request):
    user_id = get_user_id(request)
    result, status = db.add_transaction(
        user_id, transaction.amount, transaction.currency, transaction.type,
        transaction.category_id, transaction.account_id, transaction.description, transaction.date
    )
    if status == "insufficient_funds":
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    
    month = datetime.now().strftime('%Y-%m')
    notifications = db.check_limits(user_id, month)
    return {"id": result, "status": "created", "limit_notifications": notifications}

@app.put("/api/transactions/{id}")
async def update_transaction(id: int, transaction: TransactionUpdate, request: Request):
    user_id = get_user_id(request)
    result, status = db.update_transaction(
        user_id, id, transaction.amount, transaction.currency, transaction.type,
        transaction.category_id, transaction.account_id, transaction.description, transaction.date
    )
    if status == "not_found":
        raise HTTPException(status_code=404, detail="Not found")
    if status == "insufficient_funds":
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    return {"status": "updated"}

@app.delete("/api/transactions/{id}")
async def delete_transaction(id: int, request: Request):
    user_id = get_user_id(request)
    db.delete_transaction(user_id, id)
    return {"status": "deleted"}

# --- Переводы ---
@app.get("/api/transfers")
async def get_transfers(request: Request, limit: int = 50):
    user_id = get_user_id(request)
    return db.get_transfers(user_id, limit)

@app.post("/api/transfers")
async def create_transfer(transfer: TransferCreate, request: Request):
    user_id = get_user_id(request)
    result, status = db.add_transfer(
        user_id, transfer.from_account_id, transfer.to_account_id,
        transfer.amount, transfer.currency
    )
    if status == "insufficient_funds":
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    return {"id": result, "status": "created"}

# --- Цели ---
@app.get("/api/goals")
async def get_goals(request: Request):
    user_id = get_user_id(request)
    db.init_db(user_id)
    return db.get_goals(user_id)

@app.post("/api/goals")
async def create_goal(goal: GoalCreate, request: Request):
    user_id = get_user_id(request)
    db.init_db(user_id)
    id = db.add_goal(user_id, goal.name, goal.target_amount, goal.icon)
    return {"id": id, "status": "created"}

@app.put("/api/goals/{id}")
async def update_goal(id: int, goal: GoalUpdate, request: Request):
    user_id = get_user_id(request)
    db.update_goal(user_id, id, goal.name, goal.target_amount, goal.icon)
    return {"status": "updated"}

@app.post("/api/goals/{id}/add")
async def add_money_to_goal(id: int, data: GoalAddMoney, request: Request):
    user_id = get_user_id(request)
    db.add_to_goal(user_id, id, data.amount)
    return {"status": "added"}

@app.delete("/api/goals/{id}")
async def delete_goal(id: int, request: Request):
    user_id = get_user_id(request)
    db.delete_goal(user_id, id)
    return {"status": "deleted"}

# --- Статистика ---
@app.get("/api/stats/{month}")
async def get_stats(month: str, request: Request):
    user_id = get_user_id(request)
    db.init_db(user_id)
    return db.get_monthly_stats(user_id, month)

@app.get("/api/check-limits")
async def check_limits(request: Request):
    user_id = get_user_id(request)
    month = datetime.now().strftime('%Y-%m')
    return {"notifications": db.check_limits(user_id, month)}

# --- Экспорт ---
@app.get("/api/export")
async def export_data(request: Request, month: Optional[str] = None):
    user_id = get_user_id(request)
    transactions = db.get_all_transactions_for_export(user_id, month)
    
    output = io.StringIO()
    output.write('\ufeff')
    output.write('Дата;Тип;Сумма;Валюта;Категория;Счёт;Описание\n')
    
    for t in transactions:
        type_name = 'Расход' if t['type'] == 'expense' else 'Доход'
        date = t['date'][:10] if t['date'] else ''
        output.write(f"{date};{type_name};{t['amount']};{t['currency']};{t['category_name']};{t['account_name']};{t['description'] or ''}\n")
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=transactions_{month or 'all'}.csv"}
    )

# --- Курсы ---
@app.get("/api/exchange-rates")
async def get_exchange_rates():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get("https://api.nbrb.by/exrates/rates?periodicity=0")
            data = response.json()
        
        rates = {"BYN": 1.0}
        for rate in data:
            if rate['Cur_Abbreviation'] == 'USD':
                rates['USD'] = rate['Cur_OfficialRate'] / rate['Cur_Scale']
            elif rate['Cur_Abbreviation'] == 'EUR':
                rates['EUR'] = rate['Cur_OfficialRate'] / rate['Cur_Scale']
        rates['USDT'] = rates.get('USD', 3.25)
        return rates
    except:
        return {"BYN": 1.0, "USD": 3.25, "EUR": 3.55, "USDT": 3.25}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
