import os
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
import asyncio

BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://your-app.railway.app")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def start(message: types.Message):
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="💰 Открыть Finance Tracker",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )]
    ])
    
    await message.answer(
        "👋 Привет! Я твой персональный финансовый помощник.\n\n"
        "📊 Нажми кнопку ниже, чтобы открыть приложение:",
        reply_markup=keyboard
    )

@dp.message(Command("help"))
async def help_cmd(message: types.Message):
    await message.answer(
        "📱 **Finance Tracker**\n\n"
        "Используй кнопку для открытия приложения, где ты можешь:\n\n"
        "✅ Добавлять доходы и расходы\n"
        "📂 Управлять категориями\n"
        "💳 Управлять счетами\n"
        "📊 Смотреть аналитику\n"
        "📈 Отслеживать лимиты",
        parse_mode="Markdown"
    )

async def main():
    print("Bot started!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())