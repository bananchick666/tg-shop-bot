require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ===== СЕРВЕР =====
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Загружаем товары
const productsPath = path.join(__dirname, 'data', 'products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

// API: товары по категории
app.get('/api/products/:category', (req, res) => {
  const { category } = req.params;
  const { sort, order, size } = req.query;
  
  let items = products[category] ? [...products[category]] : [];
  
  if (size && category === 'shoes') {
    items = items.filter(item => item.size.includes(parseInt(size)));
  }
  
  if (sort === 'price') {
    items.sort((a, b) => order === 'desc' ? b.price - a.price : a.price - b.price);
  } else if (sort === 'name') {
    items.sort((a, b) => order === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
  }
  
  res.json(items);
});

// API: один товар
app.get('/api/product/:id', (req, res) => {
  const { id } = req.params;
  let product = null;
  
  for (let category in products) {
    if (category !== 'promocodes' && category !== 'currency_rates') {
      product = products[category].find(item => item.id === parseInt(id));
      if (product) break;
    }
  }
  
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ error: 'Товар не найден' });
  }
});

// API: промокод
app.post('/api/validate-promocode', (req, res) => {
  const { code } = req.body;
  const discount = products.promocodes[code.toUpperCase()];
  
  if (discount) {
    res.json({ valid: true, discount });
  } else {
    res.json({ valid: false, message: 'Промокод недействителен' });
  }
});

// API: курсы валют
app.get('/api/currency-rates', (req, res) => {
  res.json(products.currency_rates);
});

// API: оформить заказ
app.post('/api/checkout', (req, res) => {
  const order = req.body;
  
  const ordersFile = path.join(__dirname, 'data', 'orders.json');
  let orders = [];
  try {
    orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
  } catch (e) {
    orders = [];
  }
  
  orders.push({
    ...order,
    date: new Date().toISOString(),
    orderId: Date.now()
  });
  
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
  
  res.json({ success: true, orderId: Date.now() });
});

// ===== БОТ =====
const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://tg-shop-bot-aw6u.onrender.com';

const bot = new TelegramBot(token, { polling: true });

bot.setMyCommands([
  { command: '/start', description: '🏠 Главное меню' }
]);

function escapeHTML(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

bot.on('message', async (msg) => {
  if (msg.web_app_data) {
    const chatId = msg.chat.id;
    console.log('📱 Получены данные из WebApp от:', chatId);
    
    try {
      const data = JSON.parse(msg.web_app_data.data);
      if (data.action === 'order') {
        const order = data.order;
        console.log('📱 Заказ из WebApp:', JSON.stringify(order, null, 2));
        
        // Отправляем подтверждение пользователю
        const userMsg = formatUserMessage(order);
        await bot.sendMessage(chatId, userMsg, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛍 Продолжить покупки', web_app: { url: WEBAPP_URL } }],
              [{ text: '💬 Связаться', url: 'https://t.me/bananchick666' }]
            ]
          }
        });
        console.log('✅ Подтверждение отправлено пользователю');

        // Сохраняем заказ
        const ordersFile = path.join(__dirname, 'data', 'orders.json');
        let orders = [];
        try { orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8')); } catch (e) {}
        orders.push({ ...order, date: new Date().toISOString(), orderId: Date.now() });
        fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
        console.log('💾 Заказ сохранён');

        // Отправляем админу
        if (adminChatId) {
          try {
            const adminMsg = formatAdminMessage(order);
            console.log('📤 Отправляю админу на ID:', adminChatId);
            const result = await bot.sendMessage(adminChatId, adminMsg, { parse_mode: 'HTML' });
            console.log('✅ Уведомление админу отправлено! Message ID:', result.message_id);
          } catch (e) {
            console.error('❌ Ошибка отправки админу:', e.message);
          }
        } else {
          console.log('⚠️ ADMIN_CHAT_ID не указан');
        }
      }
    } catch (e) {
      console.error('❌ WebApp error:', e.message);
    }
  }
});

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

// Запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ Сервер и бот запущены на порту ' + PORT);
});