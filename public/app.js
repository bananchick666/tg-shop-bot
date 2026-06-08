const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const state = {
    currentView: 'categories',
    currentCategory: null,
    currentProduct: null,
    cart: JSON.parse(localStorage.getItem('cart') || '[]'),
    promocodeDiscount: 0,
    promocodeCode: '',
    currencyRates: { USD: 3.25, RUB: 28.5 },
    deliveryType: null,
    selectedSize: null,
    selectedColor: null,
    viewHistory: ['categories'],
    detailImageIndex: 0
};

const API = {
    async getProducts(category, params = {}) {
        const q = new URLSearchParams(params).toString();
        const r = await fetch(`/api/products/${category}${q ? '?' + q : ''}`);
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
    async getCurrencyRates() {
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

function formatPrice(p) { return p.toLocaleString('ru-BY') + ' BYN'; }
function convertPrice(p) {
    return {
        usd: (p / state.currencyRates.USD).toFixed(2),
        rub: Math.round(p * state.currencyRates.RUB)
    };
}

function showToast(msg) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 2000);
}

function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const v = document.getElementById('view-' + name);
    if (v) v.style.display = 'block';
    state.currentView = name;
    const back = document.getElementById('backBtn');
    const title = document.getElementById('headerTitle');
    if (name === 'categories') {
        back.style.visibility = 'hidden';
        title.textContent = 'Магазин';
    } else {
        back.style.visibility = 'visible';
    }
    if (state.viewHistory[state.viewHistory.length - 1] !== name) state.viewHistory.push(name);
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

// Categories
function showCategories() {
    showView('categories');
    state.currentCategory = null;
    state.viewHistory = ['categories'];
}

// Products
async function showProducts(category) {
    showView('products');
    state.currentCategory = category;
    document.getElementById('headerTitle').textContent = category === 'shoes' ? 'Обувь' : 'Техника';
    await loadProducts();
}

async function loadProducts() {
    const sortS = document.getElementById('sortSelect');
    const sizeS = document.getElementById('sizeSelect');
    const params = {};
    if (sortS.value) { const [s, o] = sortS.value.split('_'); params.sort = s; params.order = o; }
    if (sizeS && sizeS.value) params.size = sizeS.value;
    try {
        const products = await API.getProducts(state.currentCategory, params);
        renderProductsGrid(products);
    } catch (e) {
        document.getElementById('productsGrid').innerHTML = '<div class="cart-empty" style="grid-column:1/-1;"><div class="cart-empty-text">Ошибка загрузки</div></div>';
    }
}

function renderProductsGrid(products) {
    const grid = document.getElementById('productsGrid');
    if (!products.length) {
        grid.innerHTML = '<div class="cart-empty" style="grid-column:1/-1;"><div class="cart-empty-text">Товары не найдены</div></div>';
        return;
    }
    grid.innerHTML = products.map(p => {
        const conv = convertPrice(p.price);
        return `
        <div class="product-card">
            <div class="product-image-container" id="card-gallery-${p.id}">
                <img class="product-image" src="${p.images[0]}" alt="${p.name}" data-pid="${p.id}" data-idx="0"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect fill=%22%23f5f5f5%22 width=%22200%22 height=%22200%22/></svg>'">
                ${p.images.length > 1 ? `
                <div class="gallery-touch-left" data-action="prev" data-pid="${p.id}"></div>
                <div class="gallery-touch-right" data-action="next" data-pid="${p.id}"></div>
                <button class="gallery-arrow prev" data-action="prev" data-pid="${p.id}">&lsaquo;</button>
                <button class="gallery-arrow next" data-action="next" data-pid="${p.id}">&rsaquo;</button>
                <div class="image-dots">${p.images.map((_, i) => `<span class="image-dot${i===0?' active':''}" data-pid="${p.id}" data-dot="${i}"></span>`).join('')}</div>
                ` : ''}
            </div>
            <div class="product-info" onclick="showProductDetail(${p.id})">
                <div class="product-brand">${p.brand||''}</div>
                <div class="product-name">${p.name}</div>
                <div class="product-condition">${p.condition||''}</div>
                <div class="product-price">${formatPrice(p.price)}</div>
                <div class="product-price-other">~ $${conv.usd} / ${conv.rub} RUB</div>
            </div>
        </div>`;
    }).join('');

    // Навешиваем обработчики на стрелки и тач-зоны
    grid.querySelectorAll('[data-action]').forEach(el => {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            const pid = parseInt(this.dataset.pid);
            const action = this.dataset.action;
            const product = state.allProducts?.find(p => p.id === pid);
            if (!product || !product.images || product.images.length < 2) return;
            const img = grid.querySelector(`img[data-pid="${pid}"]`);
            const dots = grid.querySelectorAll(`.image-dot[data-pid="${pid}"]`);
            let idx = parseInt(img.dataset.idx);
            idx = action === 'next' ? (idx + 1) % product.images.length : (idx - 1 + product.images.length) % product.images.length;
            img.src = product.images[idx];
            img.dataset.idx = idx;
            dots.forEach((d, i) => d.classList.toggle('active', i === idx));
        });
    });
}

// Сохраняем продукты для доступа из галереи
const origGetProducts = API.getProducts;
API.getProducts = async function(category, params) {
    const products = await origGetProducts(category, params);
    state.allProducts = products;
    return products;
};

// Detail
async function showProductDetail(productId) {
    try {
        const product = await API.getProduct(productId);
        if (!product) return;
        state.currentProduct = product;
        state.detailImageIndex = 0;
        state.selectedSize = product.size ? product.size[0] : null;
        state.selectedColor = product.colors ? product.colors[0] : null;
        showView('product');
        document.getElementById('headerTitle').textContent = product.brand || 'Товар';
        renderProductDetail();
    } catch (e) { showToast('Ошибка загрузки'); }
}

function renderProductDetail() {
    const p = state.currentProduct;
    const conv = convertPrice(p.price);
    let html = `
    <div class="detail-gallery">
        <div class="detail-image-wrapper">
            <img class="detail-image" src="${p.images[state.detailImageIndex]}" alt="${p.name}" id="detailMainImage"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22><rect fill=%22%23f5f5f5%22 width=%22400%22 height=%22400%22/></svg>'">
        </div>
        ${p.images.length > 1 ? `
        <button class="detail-nav-btn detail-nav-prev" onclick="detailPrevImage()">&lsaquo;</button>
        <button class="detail-nav-btn detail-nav-next" onclick="detailNextImage()">&rsaquo;</button>
        <div class="detail-dots-container">${p.images.map((_, i) => `<span class="detail-dot${i===state.detailImageIndex?' active':''}" onclick="detailSetImage(${i})"></span>`).join('')}</div>
        ` : ''}
    </div>
    <div class="detail-body">
        <div class="detail-brand">${p.brand||''}</div>
        <div class="detail-name">${p.name}</div>
        <div class="detail-condition">${p.condition||''}</div>
        <div class="detail-description">${p.description}</div>`;

    if (p.size && p.size.length) {
        html += `<div class="detail-section-title">Размер</div><div class="size-grid">${p.size.map(s => `<button class="size-btn${s===state.selectedSize?' selected':''}" onclick="selectSize(${s})">${s}</button>`).join('')}</div>`;
        if (p.sizeNote) html += `<div style="font-size:11px;color:var(--text-tertiary);margin-top:-14px;margin-bottom:18px;">${p.sizeNote}</div>`;
    }
    if (p.colors && p.colors.length) {
        html += `<div class="detail-section-title">Цвет</div><div class="color-grid">${p.colors.map(c => `<button class="color-btn${c===state.selectedColor?' selected':''}" onclick="selectColor('${c}')">${c}</button>`).join('')}</div>`;
    }

    html += `
        <div class="detail-price-block">
            <span class="detail-price-main">${formatPrice(p.price)}</span>
            <span class="detail-price-converted">~ $${conv.usd}<br>~ ${conv.rub} RUB</span>
        </div>
        <button class="btn-primary" onclick="addToCartFromDetail()">Добавить в корзину</button>
    </div>`;
    document.getElementById('productDetail').innerHTML = html;
}

function detailPrevImage() {
    const p = state.currentProduct;
    state.detailImageIndex = (state.detailImageIndex - 1 + p.images.length) % p.images.length;
    updateDetailImage();
}
function detailNextImage() {
    const p = state.currentProduct;
    state.detailImageIndex = (state.detailImageIndex + 1) % p.images.length;
    updateDetailImage();
}
function detailSetImage(i) { state.detailImageIndex = i; updateDetailImage(); }
function updateDetailImage() {
    const img = document.getElementById('detailMainImage');
    if (img) img.src = state.currentProduct.images[state.detailImageIndex];
    document.querySelectorAll('.detail-dot').forEach((d, i) => d.classList.toggle('active', i === state.detailImageIndex));
}
function selectSize(s) { state.selectedSize = s; document.querySelectorAll('.size-btn').forEach(b => b.classList.toggle('selected', parseInt(b.textContent) === s)); }
function selectColor(c) { state.selectedColor = c; document.querySelectorAll('.color-btn').forEach(b => b.classList.toggle('selected', b.textContent === c)); }

// Cart
function addToCartFromDetail() { addToCart(state.currentProduct, state.selectedSize, state.selectedColor); }
function addToCart(product, size, color) {
    const item = { id: product.id, name: product.name, price: product.price, size: size || null, color: color || null, image: product.images?.[0] || '', category: state.currentCategory };
    const exists = state.cart.find(i => i.id === item.id && i.size === item.size && i.color === item.color);
    if (!exists) { state.cart.push(item); saveCart(); updateCartBadge(); showToast('Добавлено в корзину'); }
    else showToast('Уже в корзине');
}
function removeFromCart(i) { state.cart.splice(i, 1); saveCart(); updateCartBadge(); showCart(); }
function saveCart() { localStorage.setItem('cart', JSON.stringify(state.cart)); }
function updateCartBadge() {
    const b = document.getElementById('cartBadge');
    const n = state.cart.length;
    b.style.display = n > 0 ? 'flex' : 'none';
    if (n > 0) b.textContent = n;
}
function getCartTotal() {
    const sub = state.cart.reduce((s, i) => s + i.price, 0);
    return state.promocodeDiscount > 0 ? Math.round(sub * (1 - state.promocodeDiscount / 100)) : sub;
}

function showCart() { showView('cart'); document.getElementById('headerTitle').textContent = 'Корзина'; renderCart(); }
function renderCart() {
    const c = document.getElementById('cartContent');
    if (!state.cart.length) {
        c.innerHTML = '<div class="cart-empty"><div class="cart-empty-icon">—</div><div class="cart-empty-text">Корзина пуста</div><div class="cart-empty-sub">Добавьте товары из каталога</div></div>';
        return;
    }
    const sub = state.cart.reduce((s, i) => s + i.price, 0);
    const total = getCartTotal();
    const discount = sub - total;
    c.innerHTML = `
    <div class="cart-items">${state.cart.map((item, i) => `
        <div class="cart-item">
            <img class="cart-item-image" src="${item.image}" alt="${item.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2268%22 height=%2268%22><rect fill=%22%23f5f5f5%22 width=%2268%22 height=%2268%22/></svg>'">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-meta">${item.size?'Размер '+item.size:''}${item.color?' | '+item.color:''}</div>
                <div class="cart-item-price">${formatPrice(item.price)}</div>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${i})">&times;</button>
        </div>`).join('')}</div>
    <div class="promo-section">
        <div class="promo-label">Промокод</div>
        <div class="promo-input-row">
            <input class="promo-input" id="promoInput" type="text" placeholder="Введите код" value="${state.promocodeCode}">
            <button class="btn-promo" onclick="applyPromocode()">Применить</button>
        </div>
        <div class="promo-message" id="promoMessage"></div>
    </div>
    <div class="cart-summary">
        <div class="summary-row"><span>Товары (${state.cart.length})</span><span>${formatPrice(sub)}</span></div>
        ${discount>0?`<div class="summary-row summary-discount"><span>Скидка (${state.promocodeDiscount}%)</span><span>-${formatPrice(discount)}</span></div>`:''}
        <div class="summary-row total"><span>Итого</span><span>${formatPrice(total)}</span></div>
    </div>
    <button class="btn-checkout" onclick="startCheckout()">Оформить заказ</button>`;
}

async function applyPromocode() {
    const input = document.getElementById('promoInput');
    const msg = document.getElementById('promoMessage');
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

// Checkout
function startCheckout() {
    if (!state.cart.length) { showToast('Корзина пуста'); return; }
    showView('checkout');
    document.getElementById('headerTitle').textContent = 'Оформление';
    state.deliveryType = null;
    renderCheckout();
}
function renderCheckout() {
    const total = getCartTotal();
    let html = `
    <div class="checkout-form">
        <div class="checkout-title">Оформление заказа</div>
        <div class="checkout-subtitle">Сумма: ${formatPrice(total)}</div>
        <div class="delivery-options">
            <div class="delivery-option${state.deliveryType==='pickup'?' selected':''}" onclick="selectDelivery('pickup')">
                <div class="delivery-option-icon">&#9700;</div>
                <div class="delivery-option-name">Самовывоз</div>
                <div class="delivery-option-desc">Гомель</div>
            </div>
            <div class="delivery-option${state.deliveryType==='delivery'?' selected':''}" onclick="selectDelivery('delivery')">
                <div class="delivery-option-icon">&#9993;</div>
                <div class="delivery-option-name">Доставка</div>
                <div class="delivery-option-desc">Почтой</div>
            </div>
        </div>`;
    if (state.deliveryType) html += renderFormFields();
    html += '</div>';
    document.getElementById('checkoutContent').innerHTML = html;
}
function selectDelivery(type) { state.deliveryType = type; renderCheckout(); }
function renderFormFields() {
    const uname = tg.initDataUnsafe?.user?.username || '';
    const fname = tg.initDataUnsafe?.user?.first_name || '';
    if (state.deliveryType === 'pickup') {
        return `<div class="form-section"><div class="form-group">
            <label class="form-label">Telegram</label>
            <input class="form-input" id="tgUsername" type="text" placeholder="@username" value="${uname}">
        </div></div><button class="btn-submit" onclick="submitOrder()">Подтвердить заказ</button>`;
    }
    return `<div class="form-section">
        <div class="form-group"><label class="form-label">Фамилия</label><input class="form-input" id="lastName" type="text" placeholder="Иванов"></div>
        <div class="form-group"><label class="form-label">Имя</label><input class="form-input" id="firstName" type="text" placeholder="Иван" value="${fname}"></div>
        <div class="form-group"><label class="form-label">Отчество</label><input class="form-input" id="middleName" type="text" placeholder="Иванович"></div>
        <div class="form-group"><label class="form-label">Телефон</label><input class="form-input" id="phone" type="tel" placeholder="+375 XX XXX-XX-XX"></div>
        <div class="form-group"><label class="form-label">Адрес Европочты</label><input class="form-input" id="europost" type="text" placeholder="Город, отделение"></div>
        <div class="form-group"><label class="form-label">Telegram</label><input class="form-input" id="tgUsername" type="text" placeholder="@username" value="${uname}"></div>
    </div><button class="btn-submit" onclick="submitOrder()">Подтвердить заказ</button>`;
}

async function submitOrder() {
    const isPickup = state.deliveryType === 'pickup';
    const tgU = (document.getElementById('tgUsername')?.value || '').trim().replace('@', '');
    if (!tgU) { showToast('Введите Telegram username'); return; }
    if (!isPickup) {
        if (!document.getElementById('firstName')?.value.trim()) { showToast('Введите имя'); return; }
        if (!document.getElementById('phone')?.value.trim()) { showToast('Введите телефон'); return; }
        if (!document.getElementById('europost')?.value.trim()) { showToast('Введите адрес'); return; }
    }
    const order = {
        items: state.cart.map(i => ({ name: i.name, price: i.price, size: i.size, color: i.color })),
        total: getCartTotal(),
        discount: state.promocodeDiscount,
        promocode: state.promocodeCode,
        delivery: state.deliveryType,
        telegramUsername: tgU,
        firstName: isPickup ? '' : (document.getElementById('firstName')?.value || '').trim(),
        lastName: isPickup ? '' : (document.getElementById('lastName')?.value || '').trim(),
        middleName: isPickup ? '' : (document.getElementById('middleName')?.value || '').trim(),
        phone: isPickup ? '' : (document.getElementById('phone')?.value || '').trim(),
        europostAddress: isPickup ? '' : (document.getElementById('europost')?.value || '').trim()
    };

    // Отправляем через Telegram
    if (tg.sendData) {
        tg.sendData(JSON.stringify({ action: 'order', order }));
    }

    // Отправляем на сервер (дублирует уведомление админу)
    try { await API.submitOrder(order); } catch (e) {}

    state.cart = [];
    state.promocodeDiscount = 0;
    state.promocodeCode = '';
    saveCart();
    updateCartBadge();

    document.getElementById('checkoutContent').innerHTML = `
    <div class="checkout-form" style="text-align:center;">
        <span class="success-icon">&#10003;</span>
        <div class="checkout-title">Заказ оформлен</div>
        <div class="checkout-subtitle">Скоро с вами свяжутся</div>
        <button class="btn-primary" onclick="showCategories()" style="margin-top:16px;">В каталог</button>
    </div>`;
    setTimeout(() => tg.close(), 2500);
}

// Init
async function init() {
    try { state.currencyRates = await API.getCurrencyRates(); } catch (e) {}
    updateCartBadge();
    showCategories();
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('cartBtn').addEventListener('click', () => { state.viewHistory.push(state.currentView); showCart(); });
}
document.addEventListener('DOMContentLoaded', init);