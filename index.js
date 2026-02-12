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
    const userId = data.message.from.id;
    const userName = data.message.from.username || '';
    const firstName = data.message.from.first_name || '';
    const text = data.message.text;

    try {
      // Обработка команды /start
      if (text === '/start') {
        // Проверяем есть ли пользователь в базе
        const existingUser = await env.DB.prepare(
          'SELECT telegram_id FROM users WHERE telegram_id = ?'
        ).bind(userId).first();

        if (!existingUser) {
          // Пользователь не существует - добавляем его
          await env.DB.prepare(
            `INSERT INTO users (
              telegram_id, 
              username, 
              first_name, 
              date_joined,
              lexi_style
            ) VALUES (?, ?, ?, ?, ?)`
          ).bind(
            userId,
            userName,
            firstName,
            new Date().toISOString(),
            'futurist'
          ).run();

          await sendMessage(chatId, `Добро пожаловать, ${firstName}! 👋\n\nЭто бот для улучшения английского языка.`, env.TELEGRAM_BOT_TOKEN);
        } else {
          // Пользователь уже в базе
          await sendMessage(chatId, `С возвращением, ${firstName}! 😊`, env.TELEGRAM_BOT_TOKEN);
        }
      } else {
        // Обычное сообщение - отправляем в очередь
        await env.MY_QUEUE.send({
          chatId,
          userId,
          userName,
          firstName,
          text,
          timestamp: new Date().toISOString(),
        });

        await sendMessage(chatId, 'Привет!', env.TELEGRAM_BOT_TOKEN);
      }
    } catch (error) {
      console.error('Error:', error);
      await sendMessage(chatId, 'Произошла ошибка', env.TELEGRAM_BOT_TOKEN);
    }

    return new Response('OK');
  },

  // Обработчик для очереди
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const data = message.body;

        // Сохраняем информацию о пользователе в KV
        const userKey = `user:${data.userId}`;
        await env.KV.put(
          userKey,
          JSON.stringify({
            userId: data.userId,
            userName: data.userName,
            firstName: data.firstName,
            lastMessage: data.text,
            lastMessageAt: data.timestamp,
          }),
          { expirationTtl: 86400 * 30 } // 30 дней
        );

        // Сохраняем сообщение в базу данных
        await env.DB.prepare(
          `INSERT INTO messages (user_id, user_name, chat_id, message_text, created_at) 
           VALUES (?, ?, ?, ?, ?)`
        ).bind(
          data.userId,
          data.userName,
          data.chatId,
          data.text,
          data.timestamp
        ).run();

        // Подтверждаем обработку сообщения
        message.ack();
      } catch (error) {
        console.error('Queue processing error:', error);
        // Сообщение будет повторно обработано (retry)
      }
    }
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
