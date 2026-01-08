import os
import asyncio
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
import httpx

BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://your-app.railway.app")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Хранилище user_id для уведомлений (в продакшене лучше использовать Redis/БД)
active_users = set()

@dp.message(Command("start"))
async def start(message: types.Message):
    user_id = message.from_user.id
    active_users.add(user_id)
    
    # Инициализируем базу для пользователя
    try:
        async with httpx.AsyncClient() as client:
            await client.get(f"{WEBAPP_URL}/api/init?user_id={user_id}")
    except:
        pass
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="💰 Открыть Finance Tracker",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}?user_id={user_id}")
        )]
    ])
    
    await message.answer(
        f"👋 Привет, {message.from_user.first_name}!\n\n"
        "Я твой персональный финансовый помощник.\n\n"
        "📊 Веди учёт доходов и расходов\n"
        "💳 Управляй счетами в разных валютах\n"
        "🎯 Ставь финансовые цели\n"
        "📈 Следи за лимитами\n\n"
        "Нажми кнопку ниже, чтобы открыть приложение:",
        reply_markup=keyboard
    )

@dp.message(Command("help"))
async def help_cmd(message: types.Message):
    await message.answer(
        "📱 *Finance Tracker*\n\n"
        "Используй кнопку для открытия приложения, где ты можешь:\n\n"
        "✅ Добавлять доходы и расходы\n"
        "📂 Управлять категориями\n"
        "💳 Управлять счетами\n"
        "💱 Работать с разными валютами\n"
        "🔄 Делать переводы между счетами\n"
        "🎯 Ставить цели накоплений\n"
        "📊 Смотреть аналитику\n"
        "📈 Отслеживать лимиты\n"
        "📤 Экспортировать данные в Excel\n\n"
        "*Команды:*\n"
        "/start — Открыть приложение\n"
        "/stats — Быстрая статистика\n"
        "/goals — Мои цели\n"
        "/help — Помощь",
        parse_mode="Markdown"
    )

@dp.message(Command("stats"))
async def stats_cmd(message: types.Message):
    user_id = message.from_user.id
    
    try:
        from datetime import datetime
        month = datetime.now().strftime('%Y-%m')
        
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WEBAPP_URL}/api/stats/{month}?user_id={user_id}")
            stats = response.json()
        
        income = stats.get('total_income', 0) or 0
        expense = stats.get('total_expense', 0) or 0
        balance = income - expense
        
        month_name = datetime.now().strftime('%B %Y')
        
        await message.answer(
            f"📊 *Статистика за {month_name}*\n\n"
            f"💰 Доходы: *{income:,.2f} BYN*\n"
            f"💸 Расходы: *{expense:,.2f} BYN*\n"
            f"━━━━━━━━━━━━━━━\n"
            f"📈 Баланс: *{balance:+,.2f} BYN*",
            parse_mode="Markdown"
        )
    except Exception as e:
        await message.answer("❌ Не удалось загрузить статистику. Попробуй позже.")

@dp.message(Command("goals"))
async def goals_cmd(message: types.Message):
    user_id = message.from_user.id
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WEBAPP_URL}/api/goals?user_id={user_id}")
            goals = response.json()
        
        if not goals:
            await message.answer(
                "🎯 У тебя пока нет целей.\n\n"
                "Открой приложение и создай свою первую цель!"
            )
            return
        
        text = "🎯 *Мои цели:*\n\n"
        
        for goal in goals:
            target = goal['target_amount']
            current = goal['current_amount']
            percent = min((current / target) * 100, 100) if target > 0 else 0
            
            # Прогресс-бар
            filled = int(percent / 10)
            bar = "▓" * filled + "░" * (10 - filled)
            
            text += f"{goal['icon']} *{goal['name']}*\n"
            text += f"   {bar} {percent:.0f}%\n"
            text += f"   {current:,.2f} / {target:,.2f} BYN\n\n"
        
        await message.answer(text, parse_mode="Markdown")
    except Exception as e:
        await message.answer("❌ Не удалось загрузить цели. Попробуй позже.")

# ============ Функция отправки уведомлений о лимитах ============

async def send_limit_notification(user_id: int, category_name: str, icon: str, spent: float, limit: float, percent: int):
    """Отправляет уведомление о превышении лимита"""
    try:
        if percent >= 100:
            emoji = "🚨"
            title = "Лимит превышен!"
        else:
            emoji = "⚠️"
            title = "Внимание! 80% лимита"
        
        text = (
            f"{emoji} *{title}*\n\n"
            f"{icon} Категория: *{category_name}*\n"
            f"💸 Потрачено: *{spent:,.2f} BYN*\n"
            f"📊 Лимит: *{limit:,.2f} BYN*\n\n"
        )
        
        if percent >= 100:
            over = spent - limit
            text += f"❗ Превышение: *{over:,.2f} BYN*"
        else:
            remaining = limit - spent
            text += f"💡 Осталось: *{remaining:,.2f} BYN*"
        
        await bot.send_message(user_id, text, parse_mode="Markdown")
    except Exception as e:
        print(f"Error sending notification to {user_id}: {e}")

# ============ Фоновая задача проверки лимитов ============

async def check_limits_background():
    """Периодически проверяет лимиты всех активных пользователей"""
    while True:
        await asyncio.sleep(300)  # Каждые 5 минут
        
        for user_id in list(active_users):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(f"{WEBAPP_URL}/api/check-limits?user_id={user_id}")
                    data = response.json()
                    
                    for notification in data.get('notifications', []):
                        await send_limit_notification(
                            user_id,
                            notification['category_name'],
                            notification['icon'],
                            notification['spent'],
                            notification['limit'],
                            notification['percent']
                        )
            except Exception as e:
                print(f"Error checking limits for {user_id}: {e}")

# ============ Обработка данных из WebApp ============

@dp.message(F.web_app_data)
async def handle_webapp_data(message: types.Message):
    """Обработка данных, отправленных из WebApp"""
    try:
        import json
        data = json.loads(message.web_app_data.data)
        
        # Если WebApp отправил уведомление о лимите
        if data.get('type') == 'limit_notification':
            await send_limit_notification(
                message.from_user.id,
                data['category_name'],
                data['icon'],
                data['spent'],
                data['limit'],
                data['percent']
            )
    except Exception as e:
        print(f"Error handling webapp data: {e}")

async def main():
    print("🤖 Bot started!")
    print(f"📱 WebApp URL: {WEBAPP_URL}")
    
    # Запускаем фоновую проверку лимитов
    asyncio.create_task(check_limits_background())
    
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
