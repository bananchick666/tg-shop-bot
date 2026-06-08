require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;

const bot = new TelegramBot(token, { polling: true });

// URL вашего Mini App
const WEBAPP_URL = 'https://your-domain.com';

// Команды бота
bot.setMyCommands([
  { command: '/start', description: '🏠 Главное меню' }
]);

// Экранирование HTML
function escapeHTML(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Команда /start — сразу предлагаем открыть магазин
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name;
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🛍 ОТКРЫТЬ МАГАЗИН',
            web_app: { url: WEBAPP_URL }
          }
        ],
        [
          { text: '📞 Контакты', callback_data: 'contacts' },
          { text: '📝 Как заказать', callback_data: 'howto' }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, 
    '👋 Привет, ' + escapeHTML(firstName) + '!\n\n' +
    'Добро пожаловать в наш магазин!\n\n' +
    '🛍 У нас вы найдёте:\n' +
    '👟 Одежда и обувь\n' +
    '📱 Техника и аксессуары\n\n' +
    '📍 Самовывоз: Гомель\n' +
    '🚚 Доставка по Беларуси\n\n' +
    'Нажмите на кнопку ниже чтобы открыть каталог 👇',
    keyboard
  );
});

// Обработка колбэков
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  
  try {
    if (query.data === 'contacts') {
      await bot.sendMessage(chatId, 
        '📞 <b>КОНТАКТЫ</b>\n\n' +
        'По всем вопросам пишите:\n\n' +
        '💬 @bananchick666\n' +
        '💬 @glbklch\n\n' +
        '🕐 Всегда на связи!',
        { parse_mode: 'HTML' }
      );
    }
    else if (query.data === 'howto') {
      await bot.sendMessage(chatId, 
        '📝 <b>КАК ЗАКАЗАТЬ</b>\n\n' +
        '1️⃣ Нажмите «ОТКРЫТЬ МАГАЗИН»\n' +
        '2️⃣ Выберите категорию\n' +
        '3️⃣ Добавьте товары в корзину\n' +
        '4️⃣ Введите промокод (если есть)\n' +
        '5️⃣ Выберите способ получения:\n' +
        '    • Самовывоз (Гомель)\n' +
        '    • Доставка почтой\n' +
        '6️⃣ Заполните данные\n' +
        '7️⃣ Ожидайте подтверждения\n\n' +
        '💡 После оформления с вами свяжутся!',
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    console.error('Ошибка в callback_query:', error.message);
  }
  
  await bot.answerCallbackQuery(query.id);
});

// Обработка данных из WebApp
bot.on('message', async (msg) => {
  if (msg.web_app_data) {
    const chatId = msg.chat.id;
    
    try {
      const data = JSON.parse(msg.web_app_data.data);
      
      if (data.action === 'order') {
        const order = data.order;
        
        // Формируем сообщение для пользователя
        const userSummary = formatOrderForUser(order);
        
        await bot.sendMessage(chatId, userSummary, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛍 Продолжить покупки', web_app: { url: WEBAPP_URL } }],
              [{ text: '💬 Связаться', url: 'https://t.me/bananchick666' }]
            ]
          }
        });
        
        // Отправляем уведомление админу
        if (adminChatId) {
          const adminSummary = formatOrderForAdmin(order);
          
          await bot.sendMessage(adminChatId, adminSummary, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✏️ Написать покупателю', url: 'https://t.me/' + escapeHTML(order.telegramUsername) }]
              ]
            }
          });
        }
      }
    } catch (error) {
      console.error('Ошибка обработки заказа:', error.message);
      await bot.sendMessage(chatId, '❌ Произошла ошибка при оформлении заказа. Попробуйте ещё раз.');
    }
  }
});

// Форматирование заказа для пользователя
function formatOrderForUser(order) {
  const items = order.items.map((item, index) => 
    (index + 1) + '. ' + escapeHTML(item.name) + ' — ' + item.price + ' BYN'
  ).join('\n');
  
  const discountText = order.discount > 0 ? '\n💰 Скидка по промокоду: -' + order.discount + '%' : '';
  const deliveryText = order.delivery === 'pickup' 
    ? '\n🚶 <b>Самовывоз (Гомель)</b>' 
    : '\n🚚 <b>Доставка почтой</b>';
  
  const customerInfo = order.delivery === 'delivery'
    ? '\n\n👤 <b>Ваши данные:</b>\n' +
      '📛 ' + escapeHTML(order.lastName) + ' ' + escapeHTML(order.firstName) + ' ' + escapeHTML(order.middleName) + '\n' +
      '📱 ' + escapeHTML(order.phone) + '\n' +
      '📍 ' + escapeHTML(order.europostAddress) + '\n' +
      '💬 @' + escapeHTML(order.telegramUsername)
    : '\n\n👤 <b>Ваши данные:</b>\n💬 @' + escapeHTML(order.telegramUsername);
  
  return '✅ <b>ЗАКАЗ ОФОРМЛЕН!</b>\n\n' +
    '📦 <b>Товары:</b>\n' + items + '\n' +
    discountText +
    deliveryText +
    customerInfo + '\n\n' +
    '💵 <b>Итого к оплате: ' + order.total + ' BYN</b>\n\n' +
    'Скоро с вами свяжутся!\n' +
    'Контакты: @bananchick666 / @glbklch';
}

// Форматирование заказа для админа
function formatOrderForAdmin(order) {
  const items = order.items.map((item, index) => 
    (index + 1) + '. ' + escapeHTML(item.name) + '\n   Размер: ' + (item.size || '—') + ' | Цена: ' + item.price + ' BYN'
  ).join('\n');
  
  const discountText = order.discount > 0 ? '\n💰 Скидка: -' + order.discount + '%' : '';
  const deliveryText = order.delivery === 'pickup' 
    ? '\n🚶 Самовывоз (Гомель)' 
    : '\n🚚 Доставка';
  
  const customerInfo = order.delivery === 'delivery'
    ? '\n👤 ФИО: ' + escapeHTML(order.lastName) + ' ' + escapeHTML(order.firstName) + ' ' + escapeHTML(order.middleName) +
      '\n📱 Телефон: ' + escapeHTML(order.phone) +
      '\n📍 Адрес: ' + escapeHTML(order.europostAddress)
    : '';
  
  return '🆕 <b>НОВЫЙ ЗАКАЗ #' + Date.now().toString().slice(-6) + '</b>\n\n' +
    '📦 <b>Товары:</b>\n' + items + '\n' +
    discountText +
    deliveryText +
    customerInfo +
    '\n💬 Telegram: @' + escapeHTML(order.telegramUsername) +
    '\n\n💵 <b>Итого: ' + order.total + ' BYN</b>';
}

console.log('🤖 Бот запущен...');