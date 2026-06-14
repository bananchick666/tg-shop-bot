// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Состояние
const state = {
    currentView: 'categories',
    currentCategory: null,
    currentProduct: null,
    cart: JSON.parse(localStorage.getItem('cart') || '[]'),
    promocodeDiscount: 0,
    promocodeCode: '',
    currencyRates: { USD: 3.25, RUB: 28.5 },
    deliveryType: null,
    selectedColor: null,
    viewHistory: ['categories'],
    detailImageIndex: 0,
    allProducts: []
};

// API
const API = {
    async getProducts(cat, params = {}) {
        const q = new URLSearchParams(params).toString();
        const r = await fetch(`/api/products/${cat}${q ? '?' + q : ''}`);
        return r.json();
    },
    async getProduct(id) {
        const r = await fetch(`/api/product/${id}`);
        return r.json();
    },
    async validatePromo(code) {
        const r = await fetch('/api/validate-promocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        return r.json();
    },
    async getRates() {
        try { const r = await fetch('/api/currency-rates'); return r.json(); }
        catch (e) { return { USD: 3.25, RUB: 28.5 }; }
    },
    async submitOrder(order) {
        const r = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        return r.json();
    }
};

// Утилиты
const formatPrice = p => p.toLocaleString('ru-BY') + ' BYN';
const convertPrice = p => ({
    usd: (p / state.currencyRates.USD).toFixed(2),
    rub: Math.round(p * state.currencyRates.RUB)
});

function toast(msg) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.3s';
        setTimeout(() => t.remove(), 300);
    }, 2000);
}

// Навигация
function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const view = document.getElementById('view-' + name);
    if (view) view.style.display = 'block';
    state.currentView = name;

    const backBtn = document.getElementById('backBtn');
    const title = document.getElementById('headerTitle');

    backBtn.style.visibility = name === 'categories' ? 'hidden' : 'visible';

    switch (name) {
        case 'categories':
            title.textContent = 'Shop';
            break;
        case 'products':
            title.textContent = state.currentCategory === 'shoes' ? 'Обувь и одежда' : 'Техника и аксессуары';
            break;
        case 'product':
            title.textContent = state.currentProduct ? (state.currentProduct.brand || 'Товар') : 'Товар';
            break;
        case 'cart':
            title.textContent = 'Корзина';
            break;
        case 'checkout':
            title.textContent = 'Оформление';
            break;
    }

    if (state.viewHistory[state.viewHistory.length - 1] !== name) {
        state.viewHistory.push(name);
    }
    window.scrollTo(0, 0);
}

function goBack() {
    state.viewHistory.pop();
    const prev = state.viewHistory[state.viewHistory.length - 1] || 'categories';
    switch (prev) {
        case 'categories': showCategories(); break;
        case 'products': showProducts(state.currentCategory); break;
        case 'product': if (state.currentProduct) showProductDetail(state.currentProduct.id); break;
        case 'cart': showCart(); break;
    }
}

// Категории
function showCategories() {
    showView('categories');
    state.currentCategory = null;
    state.viewHistory = ['categories'];
    document.getElementById('view-categories').innerHTML = `
        <div class="categories-grid">
            <div class="category-card" onclick="showWheel()">
                <div class="category-icon">🎡</div>
                <div class="category-info">
                    <div class="category-name">Колесо фортуны</div>
                    <div class="category-desc">Крутите раз в день и получайте скидки</div>
                </div>
                <div class="category-arrow">›</div>
            </div>
            <div class="category-card" onclick="showProducts('shoes')">
                <div class="category-icon">👟</div>
                <div class="category-info">
                    <div class="category-name">Обувь и одежда</div>
                    <div class="category-desc">Кроссовки, кеды, бутсы и другое</div>
                </div>
                <div class="category-arrow">›</div>
            </div>
            <div class="category-card" onclick="showProducts('tech')">
                <div class="category-icon">🎧</div>
                <div class="category-info">
                    <div class="category-name">Техника и аксессуары</div>
                    <div class="category-desc">Наушники, геймпады и другое</div>
                </div>
                <div class="category-arrow">›</div>
            </div>
        </div>`;
}

// Список товаров
async function showProducts(cat) {
    state.currentCategory = cat;
    showView('products');
    await loadProducts();
}

async function loadProducts() {
    const sortS = document.getElementById('sortSelect')?.value;
    const params = {};
    if (sortS) { const [s, o] = sortS.split('_'); params.sort = s; params.order = o; }

    try {
        const products = await API.getProducts(state.currentCategory, params);
        state.allProducts = products;
        renderGrid(products);
    } catch (e) {
        document.getElementById('view-products').innerHTML =
            '<div class="empty-state">Ошибка загрузки</div>';
    }
}

function renderGrid(products) {
    document.getElementById('view-products').innerHTML = `
        <div class="filters-bar">
            <select class="filter-select" id="sortSelect" onchange="loadProducts()">
                <option value="">Сортировка</option>
                <option value="price_asc">Цена: по возрастанию</option>
                <option value="price_desc">Цена: по убыванию</option>
            </select>
        </div>
        <div class="products-grid">
            ${products.length ? products.map(p => {
                const c = convertPrice(p.price);
                return `
                <div class="product-card">
                    <div class="product-image-container">
                        <img class="product-image" src="${p.images[0]}" alt="${p.name}" data-pid="${p.id}" data-idx="0"
                             onerror="this.style.background='#f0f0f0'">
                        ${p.images.length > 1 ? `
                        <div class="gallery-touch-left" data-a="prev" data-pid="${p.id}"></div>
                        <div class="gallery-touch-right" data-a="next" data-pid="${p.id}"></div>
                        <button class="gallery-arrow prev" data-a="prev" data-pid="${p.id}">‹</button>
                        <button class="gallery-arrow next" data-a="next" data-pid="${p.id}">›</button>
                        <div class="image-dots">${p.images.map((_, i) => `<span class="image-dot${i === 0 ? ' active' : ''}" data-pid="${p.id}" data-d="${i}"></span>`).join('')}</div>
                        ` : ''}
                    </div>
                    <div class="product-info" onclick="showProductDetail(${p.id})">
                        <div class="product-brand">${p.brand || ''}</div>
                        <div class="product-name">${p.name}</div>
                        <div class="product-condition">${p.condition || ''}</div>
                        <div class="product-price">${formatPrice(p.price)}</div>
                        <div class="product-price-other">≈ $${c.usd} / ${c.rub} ₽</div>
                    </div>
                </div>`;
            }).join('') : '<div class="empty-state">Товары не найдены</div>'}
        </div>`;

    // Галерея
    document.querySelectorAll('[data-a]').forEach(el => {
        el.addEventListener('click', function (e) {
            e.stopPropagation();
            const pid = parseInt(this.dataset.pid);
            const product = state.allProducts.find(p => p.id === pid);
            if (!product || !product.images || product.images.length < 2) return;
            const img = document.querySelector(`img[data-pid="${pid}"]`);
            const dots = document.querySelectorAll(`.image-dot[data-pid="${pid}"]`);
            let idx = parseInt(img.dataset.idx);
            idx = this.dataset.a === 'next'
                ? (idx + 1) % product.images.length
                : (idx - 1 + product.images.length) % product.images.length;
            img.src = product.images[idx];
            img.dataset.idx = idx;
            dots.forEach((d, i) => d.classList.toggle('active', i === idx));
        });
    });
}

// Детали товара
async function showProductDetail(id) {
    try {
        const p = await API.getProduct(id);
        if (!p) return;
        state.currentProduct = p;
        state.detailImageIndex = 0;
        state.selectedColor = p.colors ? p.colors[0] : null;
        showView('product');
        renderDetail();
    } catch (e) { toast('Ошибка загрузки'); }
}

function renderDetail() {
    const p = state.currentProduct;
    const c = convertPrice(p.price);
    const isShoes = state.currentCategory === 'shoes';

    let html = `
        <div class="detail-gallery">
            <div class="detail-image-wrapper">
                <img class="detail-image" src="${p.images[state.detailImageIndex]}" id="dimg" alt="${p.name}">
            </div>
            ${p.images.length > 1 ? `
            <button class="detail-nav-btn detail-nav-prev" onclick="dPrev()">‹</button>
            <button class="detail-nav-btn detail-nav-next" onclick="dNext()">›</button>
            <div class="detail-dots-container">
                ${p.images.map((_, i) => `<span class="detail-dot${i === state.detailImageIndex ? ' active' : ''}" onclick="dSet(${i})"></span>`).join('')}
            </div>` : ''}
        </div>
        <div class="detail-body">
            <div class="detail-brand">${p.brand || ''}</div>
            <div class="detail-name">${p.name}</div>
            <div class="detail-condition">${p.condition || ''}</div>
            <div class="detail-description">${p.description}</div>`;

    // Размер показываем только для обуви
    if (isShoes && p.size) {
        html += `<div class="detail-section-title">Размер</div>
            <div style="font-size:16px;font-weight:600;margin-bottom:16px;">${p.size}</div>`;
    }

    // Цвета (для техники)
    if (p.colors && p.colors.length) {
        html += `<div class="detail-section-title">Цвет</div>
            <div class="color-grid">${p.colors.map(cl => `<button class="color-btn${cl === state.selectedColor ? ' selected' : ''}" onclick="selColor('${cl}')">${cl}</button>`).join('')}</div>`;
    }

    // Характеристики для техники
    if (!isShoes && p.specs) {
        html += `<div class="detail-section-title">Характеристики</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.6;">`;
        for (let key in p.specs) {
            html += `${key}: ${p.specs[key]}<br>`;
        }
        html += `</div>`;
    }

    html += `
            <div class="detail-price-block">
                <span class="detail-price-main">${formatPrice(p.price)}</span>
                <span class="detail-price-converted">≈ $${c.usd}<br>≈ ${c.rub} ₽</span>
            </div>
            <button class="btn-primary" onclick="addFromDetail()">Добавить в корзину</button>
        </div>`;

    document.getElementById('view-product').innerHTML = html;
}

function dPrev() {
    const p = state.currentProduct;
    state.detailImageIndex = (state.detailImageIndex - 1 + p.images.length) % p.images.length;
    updateDImg();
}
function dNext() {
    const p = state.currentProduct;
    state.detailImageIndex = (state.detailImageIndex + 1) % p.images.length;
    updateDImg();
}
function dSet(i) { state.detailImageIndex = i; updateDImg(); }
function updateDImg() {
    const img = document.getElementById('dimg');
    if (img) img.src = state.currentProduct.images[state.detailImageIndex];
    document.querySelectorAll('.detail-dot').forEach((d, i) => d.classList.toggle('active', i === state.detailImageIndex));
}
function selColor(c) {
    state.selectedColor = c;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.toggle('selected', b.textContent === c));
}

// Корзина
function addFromDetail() {
    const p = state.currentProduct;
    const isShoes = state.currentCategory === 'shoes';
    addToCart(p, isShoes ? p.size : null, state.selectedColor);
}

function addToCart(p, size, color) {
    const item = {
        id: p.id,
        name: p.name,
        price: p.price,
        size: size || null,
        color: color || null,
        image: p.images?.[0] || '',
        category: state.currentCategory
    };
    if (!state.cart.find(i => i.id === item.id && i.size === item.size && i.color === item.color)) {
        state.cart.push(item);
        saveCart();
        updateBadge();
        toast('Добавлено в корзину');
    } else {
        toast('Уже в корзине');
    }
}

function removeFromCart(i) { state.cart.splice(i, 1); saveCart(); updateBadge(); showCart(); }
function saveCart() { localStorage.setItem('cart', JSON.stringify(state.cart)); }
function updateBadge() {
    const b = document.getElementById('cartBadge');
    const n = state.cart.length;
    b.style.display = n ? 'flex' : 'none';
    if (n) b.textContent = n;
}
function getTotal() {
    const sub = state.cart.reduce((a, i) => a + i.price, 0);
    return state.promocodeDiscount ? Math.round(sub * (1 - state.promocodeDiscount / 100)) : sub;
}

function showCart() { showView('cart'); renderCart(); }

function renderCart() {
    const ct = document.getElementById('view-cart');
    if (!state.cart.length) {
        ct.innerHTML = '<div class="cart-empty"><div class="cart-empty-icon">🛒</div><div class="cart-empty-text">Корзина пуста</div><div class="cart-empty-sub">Добавьте товары из каталога</div></div>';
        return;
    }
    const sub = state.cart.reduce((a, i) => a + i.price, 0);
    const total = getTotal();
    const disc = sub - total;

    ct.innerHTML = `
        <div class="cart-items">${state.cart.map((it, i) => `
            <div class="cart-item">
                <img class="cart-item-image" src="${it.image}" alt="${it.name}">
                <div class="cart-item-info">
                    <div class="cart-item-name">${it.name}</div>
                    <div class="cart-item-meta">${it.size ? 'Размер ' + it.size : ''}${it.color ? (it.size ? ' | ' : '') + it.color : ''}</div>
                    <div class="cart-item-price">${formatPrice(it.price)}</div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${i})">✕</button>
            </div>`).join('')}</div>
        <div class="promo-section">
            <div class="promo-label">Промокод</div>
            <div class="promo-input-row">
                <input class="promo-input" id="pi" type="text" placeholder="Введите код" value="${state.promocodeCode}">
                <button class="btn-promo" onclick="applyPromo()">Применить</button>
            </div>
            <div class="promo-message" id="pm"></div>
        </div>
        <div class="cart-summary">
            <div class="summary-row"><span>Товары (${state.cart.length})</span><span>${formatPrice(sub)}</span></div>
            ${disc > 0 ? `<div class="summary-row summary-discount"><span>Скидка (${state.promocodeDiscount}%)</span><span>−${formatPrice(disc)}</span></div>` : ''}
            <div class="summary-row total"><span>Итого</span><span>${formatPrice(total)}</span></div>
        </div>
        <button class="btn-checkout" onclick="startCheckout()">Оформить заказ</button>`;
}

async function applyPromo() {
    const input = document.getElementById('pi');
    const msg = document.getElementById('pm');
    const code = input.value.trim().toUpperCase();
    if (!code) { msg.className = 'promo-message error'; msg.textContent = 'Введите промокод'; return; }
    const r = await API.validatePromo(code);
    if (r.valid) {
        state.promocodeDiscount = r.discount;
        state.promocodeCode = code;
        msg.className = 'promo-message success';
        msg.textContent = 'Скидка ' + r.discount + '% применена';
        renderCart();
    } else {
        state.promocodeDiscount = 0; state.promocodeCode = '';
        msg.className = 'promo-message error'; msg.textContent = 'Недействительный промокод';
    }
}

// Оформление
function startCheckout() {
    if (!state.cart.length) { toast('Корзина пуста'); return; }
    showView('checkout');
    state.deliveryType = null;
    renderCheckout();
}

function renderCheckout() {
    const total = getTotal();
    document.getElementById('view-checkout').innerHTML = `
        <div class="checkout-form">
            <div class="checkout-title">Оформление заказа</div>
            <div class="checkout-subtitle">Сумма: <strong>${formatPrice(total)}</strong></div>
            <div class="delivery-options">
                <div class="delivery-option${state.deliveryType === 'pickup' ? ' selected' : ''}" onclick="selDel('pickup')">
                    <div class="delivery-option-icon">🚶</div>
                    <div class="delivery-option-name">Самовывоз</div>
                    <div class="delivery-option-desc">Гомель</div>
                </div>
                <div class="delivery-option${state.deliveryType === 'delivery' ? ' selected' : ''}" onclick="selDel('delivery')">
                    <div class="delivery-option-icon">📦</div>
                    <div class="delivery-option-name">Доставка</div>
                    <div class="delivery-option-desc">Почтой</div>
                </div>
            </div>
            ${state.deliveryType ? formFields() : '<p style="text-align:center;color:var(--text-secondary);">Выберите способ получения</p>'}
        </div>`;
}

function selDel(t) { state.deliveryType = t; renderCheckout(); }

function formFields() {
    const u = tg.initDataUnsafe?.user?.username || '';
    const fn = tg.initDataUnsafe?.user?.first_name || '';

    if (state.deliveryType === 'pickup') {
        return `
            <div class="form-section">
                <div class="form-group">
                    <label class="form-label">Telegram username</label>
                    <input class="form-input" id="tu" type="text" placeholder="@username" value="${u}">
                </div>
            </div>
            <button class="btn-submit" onclick="submitOrder()">Подтвердить заказ</button>`;
    }

    return `
        <div class="form-section">
            <div class="form-group"><label class="form-label">Фамилия</label><input class="form-input" id="ln" type="text" placeholder="Иванов"></div>
            <div class="form-group"><label class="form-label">Имя</label><input class="form-input" id="fn" type="text" placeholder="Иван" value="${fn}"></div>
            <div class="form-group"><label class="form-label">Отчество</label><input class="form-input" id="mn" type="text" placeholder="Иванович"></div>
            <div class="form-group"><label class="form-label">Телефон</label><input class="form-input" id="ph" type="tel" placeholder="+375 XX XXX-XX-XX"></div>
            <div class="form-group"><label class="form-label">Адрес Европочты</label><input class="form-input" id="ep" type="text" placeholder="Город, отделение"></div>
            <div class="form-group"><label class="form-label">Telegram username</label><input class="form-input" id="tu" type="text" placeholder="@username" value="${u}"></div>
        </div>
        <button class="btn-submit" onclick="submitOrder()">Подтвердить заказ</button>`;
}

async function submitOrder() {
    const isP = state.deliveryType === 'pickup';
    const tgU = (document.getElementById('tu')?.value || '').trim().replace('@', '');
    if (!tgU) { toast('Введите Telegram username'); return; }
    if (!isP) {
        if (!document.getElementById('fn')?.value.trim()) { toast('Введите имя'); return; }
        if (!document.getElementById('ph')?.value.trim()) { toast('Введите телефон'); return; }
        if (!document.getElementById('ep')?.value.trim()) { toast('Введите адрес'); return; }
    }

    const order = {
        items: state.cart.map(i => ({ name: i.name, price: i.price, size: i.size, color: i.color })),
        total: getTotal(), discount: state.promocodeDiscount, promocode: state.promocodeCode,
        delivery: state.deliveryType, telegramUsername: tgU,
        firstName: isP ? '' : (document.getElementById('fn')?.value || '').trim(),
        lastName: isP ? '' : (document.getElementById('ln')?.value || '').trim(),
        middleName: isP ? '' : (document.getElementById('mn')?.value || '').trim(),
        phone: isP ? '' : (document.getElementById('ph')?.value || '').trim(),
        europostAddress: isP ? '' : (document.getElementById('ep')?.value || '').trim()
    };

    if (tg.sendData) tg.sendData(JSON.stringify({ action: 'order', order }));
    try { await API.submitOrder(order); } catch (e) {}

    state.cart = []; state.promocodeDiscount = 0; state.promocodeCode = '';
    saveCart(); updateBadge();

    document.getElementById('view-checkout').innerHTML = `
        <div class="checkout-form" style="text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">✅</div>
            <div class="checkout-title">Заказ оформлен!</div>
            <div class="checkout-subtitle">Скоро с вами свяжутся</div>
            <button class="btn-primary" onclick="showCategories()" style="margin-top:16px;">В каталог</button>
        </div>`;
    setTimeout(() => tg.close(), 2500);
}
// Колесо фортуны
function showWheel() {
    showView('wheel');
    document.getElementById('headerTitle').textContent = 'Колесо фортуны';
    renderWheel();
}

function renderWheel() {
    const userId = tg.initDataUnsafe?.user?.id || 'guest';

    fetch(`/api/wheel/check?userId=${userId}`)
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('view-wheel');

            if (!data.canSpin) {
                const next = new Date(data.nextSpin);
                const hours = Math.floor((next - new Date()) / 1000 / 60 / 60);
                container.innerHTML = `
                    <div class="wheel-container">
                        <div class="wheel-title">🎡 Колесо фортуны</div>
                        <div class="wheel-subtitle">Вы уже крутили сегодня</div>
                        <div class="wheel-timer">Следующая попытка через ~${hours} ч.</div>
                        <button class="wheel-btn" onclick="showCategories()">В каталог</button>
                    </div>`;
                return;
            }

            container.innerHTML = `
                <div class="wheel-container">
                    <div class="wheel-title">🎡 Колесо фортуны</div>
                    <div class="wheel-subtitle">Крутите раз в день и получайте скидки!</div>
                    <div class="wheel-wrapper">
                        <div class="wheel-pointer"></div>
                        <canvas class="wheel-canvas" id="wheelCanvas" width="300" height="300"></canvas>
                    </div>
                    <button class="wheel-btn" id="spinBtn" onclick="spinWheel()">Крутить</button>
                    <div class="wheel-result" id="wheelResult"></div>
                </div>`;

            drawWheel();
        });
}

function drawWheel() {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = 150, centerY = 150, radius = 140;
    const sectors = ['10%', '😔', '20%', '😔', '10%', '😔', '20%', '😔'];
    const colors = ['#e8f5e9', '#fff', '#c8e6c9', '#fff', '#e8f5e9', '#fff', '#c8e6c9', '#fff'];
    const angle = (2 * Math.PI) / sectors.length;

    sectors.forEach((label, i) => {
        const startAngle = i * angle - Math.PI / 2;
        const endAngle = (i + 1) * angle - Math.PI / 2;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Текст
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + angle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#111';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(label, radius - 20, 6);
        ctx.restore();
    });
}

function spinWheel() {
    const userId = tg.initDataUnsafe?.user?.id || 'guest';
    const btn = document.getElementById('spinBtn');
    const resultDiv = document.getElementById('wheelResult');
    btn.disabled = true;
    resultDiv.style.display = 'none';

    fetch('/api/wheel/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) {
            btn.disabled = false;
            return;
        }

        const canvas = document.getElementById('wheelCanvas');
        // Сектор data.sectorIndex
        const sectorAngle = 360 / 8;
        const targetAngle = 360 * 5 + (360 - data.sectorIndex * sectorAngle - sectorAngle / 2);
        canvas.style.transform = `rotate(${targetAngle}deg)`;

        setTimeout(() => {
            if (data.discount > 0) {
                resultDiv.className = 'wheel-result win';
                resultDiv.innerHTML = `🎉 Вы выиграли скидку <b>${data.discount}%</b>!<br>Промокод: <b>${data.promocode}</b>`;
            } else {
                resultDiv.className = 'wheel-result lose';
                resultDiv.textContent = '😔 Повезёт в следующий раз!';
            }
            btn.disabled = true;
            btn.textContent = 'Готово';
            canvas.style.transition = 'none';
        }, 4200);
    });
}
// Инициализация
async function init() {
    try { state.currencyRates = await API.getRates(); } catch (e) {}
    updateBadge();
    showCategories();
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('cartBtn').addEventListener('click', () => {
        state.viewHistory.push(state.currentView);
        showCart();
    });
}
document.addEventListener('DOMContentLoaded', init);