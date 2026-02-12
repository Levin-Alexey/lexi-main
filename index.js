const TELEGRAM_API_URL = 'https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}';

export default {
  async fetch(request, env) {
    // Обработка только POST запросов
    if (request.method !== 'POST') {
      return new Response('OK');
    }

    const data = await request.json();
    
    // Проверяем наличие сообщения
    if (!data.message) {
      return new Response('OK');
    }

    const chatId = data.message.chat.id;
    const text = data.message.text;

    // Отправляем приветствие
    await sendMessage(chatId, 'Привет!', env.TELEGRAM_BOT_TOKEN);

    return new Response('OK');
  }
};

async function sendMessage(chatId, message, token) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  });

  return response.json();
}
