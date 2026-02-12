# Telegram Bot on Cloudflare Workers

Простой Telegram бот на JavaScript, работающий на Cloudflare Workers.

## Требования

- Node.js 16+
- Аккаунт Cloudflare
- Telegram Bot Token (от @BotFather)

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Настройте Telegram Bot Token как секрет:
```bash
wrangler secret put TELEGRAM_BOT_TOKEN --env production
```
Введите ваш Telegram Bot Token когда будет запрос.

## Разработка

Для локальной разработки используйте:
```bash
npm run dev
```

## Развертывание

Разверните бота на Cloudflare Workers:
```bash
npm run deploy:prod
```

## Настройка Webhook

После развертывания получите URL вашего Worker и установите webhook в Telegram:

```bash
curl -X POST https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook \
  -d "url={YOUR_WORKER_URL}"
```

Где:
- `{YOUR_BOT_TOKEN}` - ваш токен от @BotFather
- `{YOUR_WORKER_URL}` - URL вашего Cloudflare Worker (будет выведен после развертывания)

## Функциональность

Сейчас бот отправляет сообщение "Привет!" в ответ на любое входящее сообщение.

## Структура файлов

- `index.js` - основной код бота
- `wrangler.toml` - конфигурация Cloudflare Workers
- `package.json` - зависимости и скрипты
