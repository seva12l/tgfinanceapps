from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import httpx
import io
import database as db

app = FastAPI()

# Инициализация базы при старте
db.init_db()

# Статические файлы
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# ============ Pydantic модели ============

class AccountCreate(BaseModel):
    name: str
    currency: str
    icon: str = '💳'

class AccountUpdate(BaseModel):
    name: str
    currency: str
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
    type: str
    category_id: int
    account_id: int
    description: str = ''
    date: Optional[str] = None

class TransactionUpdate(BaseModel):
    amount: float
    type: str
    category_id: int
    account_id: int
    description: str = ''
    date: Optional[str] = None

class TransferCreate(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: float
    converted_amount: float

# ============ Маршруты ============

@app.get("/")
async def root():
    return FileResponse("frontend/index.html")

# --- Счета ---
@app.get("/api/accounts")
async def get_accounts():
    return db.get_accounts()

@app.get("/api/accounts/{id}")
async def get_account(id: int):
    account = db.get_account(id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account

@app.post("/api/accounts")
async def create_account(account: AccountCreate):
    id = db.add_account(account.name, account.currency, account.icon)
    return {"id": id, "status": "created"}

@app.put("/api/accounts/{id}")
async def update_account(id: int, account: AccountUpdate):
    db.update_account(id, account.name, account.currency, account.icon)
    return {"status": "updated"}

@app.delete("/api/accounts/{id}")
async def delete_account(id: int):
    db.delete_account(id)
    return {"status": "deleted"}

# --- Категории ---
@app.get("/api/categories")
async def get_categories(type: Optional[str] = None):
    return db.get_categories(type)

@app.get("/api/categories/{id}")
async def get_category(id: int):
    category = db.get_category(id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@app.post("/api/categories")
async def create_category(category: CategoryCreate):
    id = db.add_category(category.name, category.type, category.icon, category.color, category.monthly_limit)
    return {"id": id, "status": "created"}

@app.put("/api/categories/{id}")
async def update_category(id: int, category: CategoryUpdate):
    db.update_category(id, category.name, category.icon, category.color, category.monthly_limit)
    return {"status": "updated"}

@app.delete("/api/categories/{id}")
async def delete_category(id: int):
    db.delete_category(id)
    return {"status": "deleted"}

# --- Транзакции ---
@app.get("/api/transactions")
async def get_transactions(limit: int = 50, offset: int = 0, month: Optional[str] = None):
    return db.get_transactions(limit, offset, month)

@app.get("/api/transactions/{id}")
async def get_transaction(id: int):
    transaction = db.get_transaction(id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@app.post("/api/transactions")
async def create_transaction(transaction: TransactionCreate):
    result, status = db.add_transaction(
        transaction.amount,
        transaction.type,
        transaction.category_id,
        transaction.account_id,
        transaction.description,
        transaction.date
    )
    
    if status == "insufficient_funds":
        raise HTTPException(status_code=400, detail="Недостаточно средств на счёте")
    
    return {"id": result, "status": "created"}

@app.put("/api/transactions/{id}")
async def update_transaction(id: int, transaction: TransactionUpdate):
    result, status = db.update_transaction(
        id,
        transaction.amount,
        transaction.type,
        transaction.category_id,
        transaction.account_id,
        transaction.description,
        transaction.date
    )
    
    if status == "not_found":
        raise HTTPException(status_code=404, detail="Transaction not found")
    if status == "insufficient_funds":
        raise HTTPException(status_code=400, detail="Недостаточно средств на счёте")
    
    return {"id": result, "status": "updated"}

@app.delete("/api/transactions/{id}")
async def delete_transaction(id: int):
    db.delete_transaction(id)
    return {"status": "deleted"}

# --- Переводы ---
@app.get("/api/transfers")
async def get_transfers(limit: int = 50):
    return db.get_transfers(limit)

@app.post("/api/transfers")
async def create_transfer(transfer: TransferCreate):
    result, status = db.add_transfer(
        transfer.from_account_id,
        transfer.to_account_id,
        transfer.amount,
        transfer.converted_amount
    )
    
    if status == "insufficient_funds":
        raise HTTPException(status_code=400, detail="Недостаточно средств на счёте")
    
    return {"id": result, "status": "created"}

@app.delete("/api/transfers/{id}")
async def delete_transfer(id: int):
    db.delete_transfer(id)
    return {"status": "deleted"}

# --- Аналитика ---
@app.get("/api/stats/{month}")
async def get_stats(month: str):
    return db.get_monthly_stats(month)

# --- Экспорт ---
@app.get("/api/export")
async def export_data(month: Optional[str] = None):
    transactions = db.get_all_transactions_for_export(month)
    
    # Создаём CSV (Excel-совместимый)
    output = io.StringIO()
    output.write('\ufeff')  # BOM для корректного отображения в Excel
    output.write('Дата;Тип;Сумма;Валюта;Категория;Счёт;Описание\n')
    
    for t in transactions:
        type_name = 'Расход' if t['type'] == 'expense' else 'Доход'
        date = t['date'][:10] if t['date'] else ''
        output.write(f"{date};{type_name};{t['amount']};{t['currency']};{t['category_name']};{t['account_name']};{t['description'] or ''}\n")
    
    output.seek(0)
    
    filename = f"transactions_{month or 'all'}.csv"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# --- Курсы валют ---
@app.get("/api/exchange-rates")
async def get_exchange_rates():
    try:
        async with httpx.AsyncClient() as client:
            # NBRB API для белорусских рублей
            response = await client.get("https://api.nbrb.by/exrates/rates?periodicity=0")
            nbrb_rates = response.json()
            
        rates = {"BYN": 1.0}
        
        for rate in nbrb_rates:
            if rate['Cur_Abbreviation'] == 'USD':
                rates['USD'] = rate['Cur_OfficialRate'] / rate['Cur_Scale']
            elif rate['Cur_Abbreviation'] == 'EUR':
                rates['EUR'] = rate['Cur_OfficialRate'] / rate['Cur_Scale']
        
        # USDT примерно равен USD
        rates['USDT'] = rates.get('USD', 3.2)
        
        return rates
    except Exception as e:
        # Fallback курсы
        return {
            "BYN": 1.0,
            "USD": 3.25,
            "EUR": 3.55,
            "USDT": 3.25
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)