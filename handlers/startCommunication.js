export async function handleStartCommunication(chatId, userId, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: 'Скоро здесь появится общение с Lexi.',
    }),
  });

  return response.json();
}
