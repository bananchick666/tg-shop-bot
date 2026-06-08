const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Загружаем товары
const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8'));

// API: получить товары по категории
app.get('/api/products/:category', (req, res) => {
  const { category } = req.params;
  const { sort, order, size, brand, minPrice, maxPrice } = req.query;
  
  let items = products[category] ? [...products[category]] : [];
  
  // Фильтр по размеру (для обуви)
  if (size && category === 'shoes') {
    items = items.filter(item => item.size.includes(parseInt(size)));
  }
  
  // Фильтр по бренду
  if (brand) {
    items = items.filter(item => item.brand.toLowerCase().includes(brand.toLowerCase()));
  }
  
  // Фильтр по цене
  if (minPrice) {
    items = items.filter(item => item.price >= parseInt(minPrice));
  }
  if (maxPrice) {
    items = items.filter(item => item.price <= parseInt(maxPrice));
  }
  
  // Сортировка
  if (sort === 'price') {
    items.sort((a, b) => order === 'desc' ? b.price - a.price : a.price - b.price);
  } else if (sort === 'name') {
    items.sort((a, b) => order === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
  }
  
  res.json(items);
});

// API: получить один товар по ID
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

// API: проверить промокод
app.post('/api/validate-promocode', (req, res) => {
  const { code } = req.body;
  const discount = products.promocodes[code.toUpperCase()];
  
  if (discount) {
    res.json({ valid: true, discount });
  } else {
    res.json({ valid: false, message: 'Промокод недействителен' });
  }
});

// API: получить курсы валют
app.get('/api/currency-rates', (req, res) => {
  res.json(products.currency_rates);
});

// API: оформить заказ
app.post('/api/checkout', (req, res) => {
  const order = req.body;
  
  // Логируем заказ в консоль
  console.log('=== НОВЫЙ ЗАКАЗ ===');
  console.log(JSON.stringify(order, null, 2));
  
  // Сохраняем в файл
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});