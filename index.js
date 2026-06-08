require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const productsPath = path.join(__dirname, 'data', 'products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://tg-shop-bot-r1xh.onrender.com';
const PORT = process.env.PORT || 3000;

// Webhook URL
const WEBHOOK_URL = WEBAPP_URL + '/webhook';

console.log('🔑 Токен:', token ? 'ЕСТЬ' : 'НЕТ');
console.log('📩 Admin Chat ID:', adminChatId || 'НЕ УКАЗАН');
console.log('🌐 URL:', WEBAPP_URL);
console.log('🪝 Webhook:', WEBHOOK_URL);

// Создаём бота с webhook
const bot = new TelegramBot(token);

// Устанавливаем webhook
bot.setWebHook(WEBHOOK_URL)
  .then(() => console.log('✅ Webhook установлен'))
  .catch(e => console.error('❌ Ошибка webhook:', e.message));

// Принимаем обновления от Telegram
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

function escapeHTML(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// API
app.get('/api/products/:category', (req, res) => {
  const { category } = req.params;
  const { sort, order, size } = req.query;
  let items = products[category] ? [...products[category]] : [];
  if (size && category === 'shoes') {
    items = items.filter(item => item.size && item.size.includes(size));
  }
  if (sort === 'price') {
    items.sort((a, b) => order === 'desc' ? b.price - a.price : a.price - b.price);
  } else if (sort === 'name') {
    items.sort((a, b) => order === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
  }
  res.json(items);
});

app.get('/api/product/:id', (req, res) => {
  const { id } = req.params;
  let product = null;
  for (let cat in products) {
    if (cat !== 'promocodes' && cat !== 'currency_rates') {
      product = products[cat].find(item => item.id === parseInt(id));
      if (product) break;
    }
  }
  if (product) res.json(product);
  else res.status(404).json({ error: 'not found' });
});

app.post('/api/validate-promocode', (req, res) => {
  const { code } = req.body;
  const discount = products.promocodes[code.toUpperCase()];
  res.json(discount ? { valid: true, discount } : { valid: false });
});

app.get('/api/currency-rates', (req, res) => {
  res.json(products.currency_rates);
});

// Оформление заказа через API
app.post('/api/checkout', async (req, res) => {
  const order = req.body;
  console.log('🆕 ЗАКАЗ через API:', order.telegramUsername);

  const ordersFile = path.join(__dirname, 'data', 'orders.json');
  let orders = [];
  try { orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8')); } catch (e) {}
  orders.push({ ...order, date: new Date().toISOString(), orderId: Date.now() });
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));

  if (adminChatId) {
    try {
      await bot.sendMessage(adminChatId, formatAdminMessage(order), { parse_mode: 'HTML' });
      console.log('✅ Уведомление админу отправлено');
    } catch (e) {
      console.error('❌ Ошибка отправки админу:', e.message);
    }
  }

  res.json({ success: true });
});

function formatAdminMessage(order) {
  const items = order.items.map((item, i) =>
    (i + 1) + '. ' + escapeHTML(item.name) + ' | Размер: ' + (item.size || '—') + ' | Цена: ' + item.price + ' BYN'
  ).join('\n');
  const disc = order.discount > 0 ? '\n💰 Скидка: -' + order.discount + '%' : '';
  const del = order.delivery === 'pickup' ? '\n🚶 Самовывоз (Гомель)' : '\n🚚 Доставка';
  let info = '\n💬 @' + escapeHTML(order.telegramUsername || '—');
  if (order.delivery === 'delivery') {
    info = '\n👤 ' + escapeHTML(order.lastName) + ' ' + escapeHTML(order.firstName) + ' ' + escapeHTML(order.middleName) +
      '\n📱 ' + escapeHTML(order.phone) + '\n📍 ' + escapeHTML(order.europostAddress) + info;
  }
  return '🆕 <b>НОВЫЙ ЗАКАЗ #' + Date.now().toString().slice(-6) + '</b>\n\n📦 <b>Товары:</b>\n' + items + '\n' + disc + del + info + '\n\n💵 <b>Итого: ' + order.total + ' BYN</b>';
}

function formatUserMessage(order) {
  const items = order.items.map((item, i) => (i + 1) + '. ' + escapeHTML(item.name) + ' — ' + item.price + ' BYN').join('\n');
  const disc = order.discount > 0 ? '\n💰 Скидка: -' + order.discount + '%' : '';
  const del = order.delivery === 'pickup' ? '\n🚶 Самовывоз (Гомель)' : '\n🚚 Доставка почтой';
  return '✅ <b>ЗАКАЗ ОФОРМЛЕН!</b>\n\n📦 <b>Товары:</b>\n' + items + '\n' + disc + del + '\n\n💵 <b>Итого: ' + order.total + ' BYN</b>\n\nСкоро с вами свяжутся!\nКонтакты: @bananchick666 / @glbklch';
}

// Команды бота
bot.setMyCommands([{ command: '/start', description: 'Главное меню' }]);

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    '👋 Привет, ' + escapeHTML(msg.from.first_name) + '!\n\nДобро пожаловать в наш магазин!\n\n🛍 У нас вы найдёте:\n👟 Обувь и одежда\n📱 Техника и аксессуары\n\n📍 Самовывоз: Гомель\n🚚 Доставка по Беларуси\n\nНажмите на кнопку ниже чтобы открыть каталог 👇',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍 ОТКРЫТЬ МАГАЗИН', web_app: { url: WEBAPP_URL } }],
          [{ text: '📞 Контакты', callback_data: 'contacts' }, { text: '📝 Как заказать', callback_data: 'howto' }]
        ]
      }
    }
  );
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  if (query.data === 'contacts') {
    await bot.sendMessage(chatId, '📞 <b>КОНТАКТЫ</b>\n\nПо всем вопросам пишите:\n\n💬 @bananchick666\n💬 @glbklch\n\nВсегда на связи!', { parse_mode: 'HTML' });
  } else if (query.data === 'howto') {
    await bot.sendMessage(chatId, '📝 <b>КАК ЗАКАЗАТЬ</b>\n\n1️⃣ Откройте магазин\n2️⃣ Выберите товары\n3️⃣ Добавьте в корзину\n4️⃣ Введите промокод\n5️⃣ Выберите способ получения\n6️⃣ Заполните данные\n7️⃣ Ожидайте подтверждения\n\nПосле оформления с вами свяжутся!', { parse_mode: 'HTML' });
  }
  await bot.answerCallbackQuery(query.id);
});

// Получение данных из Mini App
bot.on('message', async (msg) => {
  if (msg.web_app_data) {
    const chatId = msg.chat.id;
    console.log('📱 WebApp данные от:', chatId);
    
    try {
      const data = JSON.parse(msg.web_app_data.data);
      if (data.action === 'order') {
        const order = data.order;
        console.log('📱 Заказ:', order.telegramUsername, '| Сумма:', order.total);

        // Подтверждение пользователю
        await bot.sendMessage(chatId, formatUserMessage(order), {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🛍 Продолжить покупки', web_app: { url: WEBAPP_URL } }]] }
        });

        // Сохраняем
        const ordersFile = path.join(__dirname, 'data', 'orders.json');
        let orders = [];
        try { orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8')); } catch (e) {}
        orders.push({ ...order, date: new Date().toISOString(), orderId: Date.now() });
        fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));

        // Отправляем админу
        if (adminChatId) {
          try {
            await bot.sendMessage(adminChatId, formatAdminMessage(order), { parse_mode: 'HTML' });
            console.log('✅ Уведомление админу отправлено');
          } catch (e) {
            console.error('❌ Ошибка отправки админу:', e.message);
          }
        }
      }
    } catch (e) {
      console.error('❌ WebApp error:', e.message);
    }
  }
});

app.listen(PORT, () => {
  console.log('✅ Сервер запущен на порту ' + PORT);
});