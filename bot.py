import os
import asyncio
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
import httpx

BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://your-app.railway.app")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def start(message: types.Message):
    user_id = message.from_user.id
    
    try:
        async with httpx.AsyncClient() as client:
            await client.get(f"{WEBAPP_URL}/api/init?user_id={user_id}")
    except:
        pass
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="💰 Открыть Finance Tracker",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}?user_id={user_id}")
        )
    ]])
    
    await message.answer(
        f"👋 Привет, {message.from_user.first_name}!\n\n"
        "📊 Веди учёт доходов и расходов\n"
        "💳 Управляй счетами\n"
        "🎯 Ставь цели\n\n"
        "Нажми кнопку ниже:",
        reply_markup=keyboard
    )

@dp.message(Command("help"))
async def help_cmd(message: types.Message):
    await message.answer(
        "📱 *Finance Tracker*\n\n"
        "/start — Открыть приложение\n"
        "/help — Помощь",
        parse_mode="Markdown"
    )

async def main():
    print("🤖 Bot started!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
