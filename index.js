import { handleStartCommunication } from './handlers/startCommunication.js';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}';
const REASON_QUESTION_TEXT = 'Выберите цели для изучения английского языка';
const REASONS_TO_LEARN = [
  'Для работы',
  'Для деловых переговоров и переписки',
  'Чтобы поступить в зарубежный вуз',
  'Для онлайн-курсов на английском',
  'Чтобы свободно путешествовать',
  'Для общего развития',
  'Смотреть фильмы и сериалы в оригинале',
  'Читать книги в оригинале',
  'Готовлюсь к переезду'
];
const WANT_IMPROVE_QUESTION_TEXT = 'Что планируете улучшить';
const WANTS_TO_IMPROVE_OPTIONS = [
  'Разговорную речь',
  'Аудирование',
  'Грамматику',
  'Чтение',
  'Словарный запас',
  'Подготовиться к экзамену',
  'Научиться вести деловую переписку'
];

export default {
  async fetch(request, env) {
    // Обработка только POST запросов
    if (request.method !== 'POST') {
      return new Response('OK');
    }

    const data = await request.json();
    
    // Обработка callback_query (нажатие на inline кнопку)
    if (data.callback_query) {
      try {
        const callbackQuery = data.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const callbackData = callbackQuery.data; // Формат: "level_X"
        const messageId = callbackQuery.message.message_id;

        // Парсим уровень из callback_data
        if (callbackData.startsWith('level_')) {
          await answerCallbackQuery(callbackQuery.id, '✅ Уровень выбран!', env.TELEGRAM_BOT_TOKEN);

          const levelId = parseInt(callbackData.split('_')[1]);

          // Обновляем пользователя в базе данных с level_id
          await env.DB.prepare(
            'UPDATE users SET level_id = ? WHERE telegram_id = ?'
          ).bind(levelId, userId).run();

          // Удаляем сообщение с кнопками
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
            }),
          });

          // Отправляем подтверждение
          const levelNames = { '1': 'Начальный', '2': 'Средний', '3': 'Продвинутый' };
          await sendMessage(chatId, `✅ Вы выбрали уровень: ${levelNames[levelId]}`, env.TELEGRAM_BOT_TOKEN);

          // Новый вопрос: цели изучения английского
          await sendReasonToLearnQuestion(chatId, userId, env);
        }

        if (callbackData.startsWith('reason_toggle_')) {
          const reasonIndex = parseInt(callbackData.split('_')[2]);
          const selections = await getReasonSelections(userId, env.KV);
          const reasonText = REASONS_TO_LEARN[reasonIndex];

          if (reasonText) {
            const wasSelected = selections.includes(reasonText);
            const nextSelections = wasSelected
              ? selections.filter((item) => item !== reasonText)
              : [...selections, reasonText];

            await setReasonSelections(userId, nextSelections, env.KV);
            await answerCallbackQuery(
              callbackQuery.id,
              wasSelected ? 'Убрано из выбора' : 'Добавлено в выбор',
              env.TELEGRAM_BOT_TOKEN
            );

            await editReasonQuestionMessage(chatId, messageId, nextSelections, env.TELEGRAM_BOT_TOKEN);
          }
        }

        if (callbackData === 'reason_submit') {
          const selections = await getReasonSelections(userId, env.KV);

          if (selections.length === 0) {
            await answerCallbackQuery(callbackQuery.id, 'Выберите минимум один вариант', env.TELEGRAM_BOT_TOKEN);
            return new Response('OK');
          }

          await answerCallbackQuery(callbackQuery.id, '✅ Сохранено!', env.TELEGRAM_BOT_TOKEN);

          await env.DB.prepare(
            'UPDATE users SET reason_to_learn = ? WHERE telegram_id = ?'
          ).bind(JSON.stringify(selections), userId).run();

          await env.KV.delete(getReasonSelectionsKey(userId));

          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
            }),
          });

          await sendMessage(chatId, '✅ Цели сохранены', env.TELEGRAM_BOT_TOKEN);

          // Новый вопрос: что планируете улучшить
          await sendWantsToImproveQuestion(chatId, userId, env);
        }

        if (callbackData.startsWith('improve_toggle_')) {
          const optionIndex = parseInt(callbackData.split('_')[2]);
          const selections = await getImproveSelections(userId, env.KV);
          const optionText = WANTS_TO_IMPROVE_OPTIONS[optionIndex];

          if (optionText) {
            const wasSelected = selections.includes(optionText);
            const nextSelections = wasSelected
              ? selections.filter((item) => item !== optionText)
              : [...selections, optionText];

            await setImproveSelections(userId, nextSelections, env.KV);
            await answerCallbackQuery(
              callbackQuery.id,
              wasSelected ? 'Убрано из выбора' : 'Добавлено в выбор',
              env.TELEGRAM_BOT_TOKEN
            );

            await editWantsToImproveMessage(chatId, messageId, nextSelections, env.TELEGRAM_BOT_TOKEN);
          }
        }

        if (callbackData === 'improve_submit') {
          const selections = await getImproveSelections(userId, env.KV);

          if (selections.length === 0) {
            await answerCallbackQuery(callbackQuery.id, 'Выберите минимум один вариант', env.TELEGRAM_BOT_TOKEN);
            return new Response('OK');
          }

          await answerCallbackQuery(callbackQuery.id, '✅ Сохранено!', env.TELEGRAM_BOT_TOKEN);

          await env.DB.prepare(
            'UPDATE users SET wants_to_improve = ? WHERE telegram_id = ?'
          ).bind(JSON.stringify(selections), userId).run();

          await env.KV.delete(getImproveSelectionsKey(userId));

          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
            }),
          });

          await sendMessage(chatId, '✅ Навыки сохранены', env.TELEGRAM_BOT_TOKEN);
          await sendMainMenu(chatId, env.TELEGRAM_BOT_TOKEN);
        }

        if (callbackData === 'menu_start_communication') {
          await answerCallbackQuery(callbackQuery.id, '✅ Открываю чат с Lexi', env.TELEGRAM_BOT_TOKEN);
          await handleStartCommunication(chatId, userId, env);
        }
      } catch (error) {
        console.error('Callback query error:', error);
      }

      return new Response('OK');
    }
    
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
          'SELECT telegram_id, level_id, reason_to_learn, wants_to_improve FROM users WHERE telegram_id = ?'
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

          // Отправляем приветствие
          await sendMessage(chatId, 'Привет, я Lexi 👋', env.TELEGRAM_BOT_TOKEN);

          // Отправляем вопрос о уровне с кнопками
          await sendLevelQuestion(chatId, env.TELEGRAM_BOT_TOKEN);
        } else {
          const hasLevel = !!existingUser.level_id;
          const hasReasonToLearn = !!existingUser.reason_to_learn && existingUser.reason_to_learn !== '[]';
          const hasWantsToImprove = !!existingUser.wants_to_improve && existingUser.wants_to_improve !== '[]';

          if (hasLevel && hasReasonToLearn && hasWantsToImprove) {
            await sendMainMenu(chatId, env.TELEGRAM_BOT_TOKEN);
            return new Response('OK');
          }

          if (!hasLevel) {
            await sendMessage(chatId, `С возвращением, ${firstName}! 😊`, env.TELEGRAM_BOT_TOKEN);
            await sendLevelQuestion(chatId, env.TELEGRAM_BOT_TOKEN);
            return new Response('OK');
          }

          if (!hasReasonToLearn) {
            await sendReasonToLearnQuestion(chatId, userId, env);
            return new Response('OK');
          }

          await sendWantsToImproveQuestion(chatId, userId, env);
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

async function sendLevelQuestion(chatId, token) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: 'Выберите Ваш уровень владения английским языком:',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🟢 Начальный', callback_data: 'level_1' }],
          [{ text: '🟡 Средний', callback_data: 'level_2' }],
          [{ text: '🔴 Продвинутый', callback_data: 'level_3' }],
        ],
      },
    }),
  });

  return response.json();
}

async function answerCallbackQuery(callbackQueryId, text, token) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
}

function getReasonSelectionsKey(userId) {
  return `reason_select:${userId}`;
}

async function getReasonSelections(userId, kv) {
  const raw = await kv.get(getReasonSelectionsKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function setReasonSelections(userId, selections, kv) {
  await kv.put(getReasonSelectionsKey(userId), JSON.stringify(selections), {
    expirationTtl: 86400
  });
}

function buildReasonKeyboard(selections) {
  const selectedSet = new Set(selections);
  const buttons = REASONS_TO_LEARN.map((reason, index) => [
    {
      text: selectedSet.has(reason) ? `✅ ${reason}` : reason,
      callback_data: `reason_toggle_${index}`
    }
  ]);

  buttons.push([{ text: 'ВЫБРАТЬ', callback_data: 'reason_submit' }]);

  return { inline_keyboard: buttons };
}

async function sendReasonToLearnQuestion(chatId, userId, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const selections = await getReasonSelections(userId, env.KV);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: REASON_QUESTION_TEXT,
      reply_markup: buildReasonKeyboard(selections),
    }),
  });

  return response.json();
}

async function editReasonQuestionMessage(chatId, messageId, selections, token) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: REASON_QUESTION_TEXT,
      reply_markup: buildReasonKeyboard(selections),
    }),
  });

  return response.json();
}

function getImproveSelectionsKey(userId) {
  return `improve_select:${userId}`;
}

async function getImproveSelections(userId, kv) {
  const raw = await kv.get(getImproveSelectionsKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function setImproveSelections(userId, selections, kv) {
  await kv.put(getImproveSelectionsKey(userId), JSON.stringify(selections), {
    expirationTtl: 86400
  });
}

function buildWantsToImproveKeyboard(selections) {
  const selectedSet = new Set(selections);
  const buttons = WANTS_TO_IMPROVE_OPTIONS.map((option, index) => [
    {
      text: selectedSet.has(option) ? `✅ ${option}` : option,
      callback_data: `improve_toggle_${index}`
    }
  ]);

  buttons.push([{ text: 'ВЫБРАТЬ', callback_data: 'improve_submit' }]);

  return { inline_keyboard: buttons };
}

async function sendWantsToImproveQuestion(chatId, userId, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const selections = await getImproveSelections(userId, env.KV);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: WANT_IMPROVE_QUESTION_TEXT,
      reply_markup: buildWantsToImproveKeyboard(selections),
    }),
  });

  return response.json();
}

async function editWantsToImproveMessage(chatId, messageId, selections, token) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: WANT_IMPROVE_QUESTION_TEXT,
      reply_markup: buildWantsToImproveKeyboard(selections),
    }),
  });

  return response.json();
}

async function sendMainMenu(chatId, token) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: 'Привет! Давай продолжать изучение английского языка. выбери пункт меню ниже.',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Начать общение с Lexi', callback_data: 'menu_start_communication' }]
        ],
      },
    }),
  });

  return response.json();
}
