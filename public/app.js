// ===== TELEGRAM =====
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// ===== СОСТОЯНИЕ =====
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
    productCardImages: {},
    detailImageIndex: 0
};

// ===== API =====
const API = {
    async getProducts(category, params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = `/api/products/${category}${query ? '?' + query : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Network error');
        return res.json();
    },
    async getProduct(id) {
        const res = await fetch(`/api/product/${id}`);
        if (!res.ok) throw new Error('Network error');
        return res.json();
    },
    async validatePromo(code) {
        const res = await fetch('/api/validate-promocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        return res.json();
    },
    async getCurrencyRates() {
        try {
            const res = await fetch('/api/currency-rates');
            return res.json();
        } catch (e) {
            return { USD: 3.25, RUB: 28.5 };
        }
    },
    async submitOrder(order) {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        return res.json();
    }
};

// ===== УТИЛИТЫ =====
function formatPrice(price) {
    return price.toLocaleString('ru-BY') + ' BYN';
}

function convertPrice(price) {
    const usd = (price / state.currencyRates.USD).toFixed(2);
    const rub = Math.round(price * state.currencyRates.RUB);
    return { usd, rub };
}

function showToast(message) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ===== НАВИГАЦИЯ =====
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const view = document.getElementById('view-' + viewName);
    if (view) view.style.display = 'block';
    state.currentView = viewName;

    const backBtn = document.getElementById('backBtn');
    const title = document.getElementById('headerTitle');

    if (viewName === 'categories') {
        backBtn.style.visibility = 'hidden';
        title.textContent = 'МАГАЗИН';
    } else {
        backBtn.style.visibility = 'visible';
    }

    if (state.viewHistory[state.viewHistory.length - 1] !== viewName) {
        state.viewHistory.push(viewName);
    }

    window.scrollTo(0, 0);
}

function goBack() {
    state.viewHistory.pop();
    const prevView = state.viewHistory[state.viewHistory.length - 1] || 'categories';

    switch (prevView) {
        case 'categories': showCategories(); break;
        case 'products': showProducts(state.currentCategory); break;
        case 'product': showProductDetail(state.currentProduct.id); break;
        case 'cart': showCart(); break;
    }
}

// ===== КАТЕГОРИИ =====
function showCategories() {
    showView('categories');
    state.currentCategory = null;
    state.viewHistory = ['categories'];
    document.getElementById('headerTitle').textContent = 'МАГАЗИН';
}

// ===== ТОВАРЫ =====
async function showProducts(category) {
    showView('products');
    state.currentCategory = category;
    document.getElementById('headerTitle').textContent = category === 'shoes' ? 'ОДЕЖДА И ОБУВЬ' : 'ТЕХНИКА';
    state.productCardImages = {};
    await loadProducts();
}

async function loadProducts() {
    const sortSelect = document.getElementById('sortSelect');
    const sizeSelect = document.getElementById('sizeSelect');

    const params = {};
    if (sortSelect.value) {
        const [sort, order] = sortSelect.value.split('_');
        params.sort = sort;
        params.order = order;
    }
    if (sizeSelect && sizeSelect.value) {
        params.size = sizeSelect.value;
    }

    try {
        const products = await API.getProducts(state.currentCategory, params);
        renderProductsGrid(products);
    } catch (e) {
        document.getElementById('productsGrid').innerHTML =
            '<div class="cart-empty"><div class="cart-empty-text">Ошибка загрузки</div></div>';
    }
}

function renderProductsGrid(products) {
    const grid = document.getElementById('productsGrid');

    if (!products.length) {
        grid.innerHTML = `
            <div class="cart-empty" style="grid-column: 1/-1;">
                <div class="cart-empty-text">Товары не найдены</div>
            </div>`;
        return;
    }

    grid.innerHTML = products.map(product => {
        state.productCardImages[product.id] = 0;
        const converted = convertPrice(product.price);
        const imgSrc = product.images && product.images.length > 0 ? product.images[0] : '';

        return `
            <div class="product-card">
                <div class="product-image-container" onclick="event.stopPropagation(); showProductDetail(${product.id})">
                    <img class="product-image" src="${imgSrc}" alt="${product.name}" data-product-id="${product.id}" data-img-index="0"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect fill=%22%23f0f0f0%22 width=%22200%22 height=%22200%22/></svg>'">
                    ${product.images && product.images.length > 1 ? `
                        <button class="image-nav-arrow prev" onclick="event.stopPropagation(); cardPrevImage(${product.id})">‹</button>
                        <button class="image-nav-arrow next" onclick="event.stopPropagation(); cardNextImage(${product.id})">›</button>
                        <div class="image-dots">
                            ${product.images.map((_, i) => `<span class="image-dot ${i === 0 ? 'active' : ''}" data-product="${product.id}" data-index="${i}"></span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="product-info" onclick="showProductDetail(${product.id})">
                    <div class="product-brand">${product.brand || ''}</div>
                    <div class="product-name">${product.name}</div>
                    <div class="product-condition">${product.condition || ''}</div>
                    <div class="product-price">${formatPrice(product.price)}</div>
                    <div class="product-price-other">≈ $${converted.usd} / ${converted.rub} ₽</div>
                </div>
            </div>`;
    }).join('');
}

function cardPrevImage(productId) {
    const product = findProductById(productId);
    if (!product || !product.images) return;
    state.productCardImages[productId] = (state.productCardImages[productId] - 1 + product.images.length) % product.images.length;
    updateCardImage(productId);
}

function cardNextImage(productId) {
    const product = findProductById(productId);
    if (!product || !product.images) return;
    state.productCardImages[productId] = (state.productCardImages[productId] + 1) % product.images.length;
    updateCardImage(productId);
}

function updateCardImage(productId) {
    const product = findProductById(productId);
    if (!product) return;
    const index = state.productCardImages[productId];
    const img = document.querySelector(`img[data-product-id="${productId}"]`);
    if (img) {
        img.src = product.images[index];
        img.setAttribute('data-img-index', index);
    }
    const dots = document.querySelectorAll(`.image-dot[data-product="${productId}"]`);
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function findProductById(id) {
    return state.currentProduct?.id === id ? state.currentProduct : null;
}

// ===== ДЕТАЛИ ТОВАРА =====
async function showProductDetail(productId) {
    try {
        const product = await API.getProduct(productId);
        if (!product) return;

        state.currentProduct = product;
        state.detailImageIndex = 0;
        state.selectedSize = product.size ? product.size[0] : null;
        state.selectedColor = product.colors ? product.colors[0] : null;

        showView('product');
        document.getElementById('headerTitle').textContent = product.brand || 'ТОВАР';
        renderProductDetail();
    } catch (e) {
        showToast('Ошибка загрузки товара');
    }
}

function renderProductDetail() {
    const product = state.currentProduct;
    const converted = convertPrice(product.price);
    const imgSrc = product.images && product.images.length > 0 ? product.images[state.detailImageIndex] : '';

    let html = `
        <div class="detail-gallery">
            <div class="detail-image-wrapper">
                <img class="detail-image" src="${imgSrc}" alt="${product.name}" id="detailMainImage"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22><rect fill=%22%23f0f0f0%22 width=%22400%22 height=%22400%22/></svg>'">
            </div>
            ${product.images && product.images.length > 1 ? `
                <button class="detail-nav-btn detail-nav-prev" onclick="detailPrevImage()">‹</button>
                <button class="detail-nav-btn detail-nav-next" onclick="detailNextImage()">›</button>
                <div class="detail-dots-container">
                    ${product.images.map((_, i) => `
                        <span class="detail-dot ${i === state.detailImageIndex ? 'active' : ''}" onclick="detailSetImage(${i})"></span>
                    `).join('')}
                </div>
            ` : ''}
        </div>
        <div class="detail-body">
            <div class="detail-brand">${product.brand || ''}</div>
            <div class="detail-name">${product.name}</div>
            <div class="detail-condition">Состояние: ${product.condition || 'Не указано'}</div>
            <div class="detail-description">${product.description}</div>`;

    if (product.size && product.size.length > 0) {
        html += `
            <div class="detail-section-title">Размер</div>
            <div class="size-grid">
                ${product.size.map(s => `
                    <button class="size-btn ${s === state.selectedSize ? 'selected' : ''}" onclick="selectSize(${s})">${s}</button>
                `).join('')}
            </div>`;
        if (product.sizeNote) {
            html += `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:20px;">${product.sizeNote}</div>`;
        }
    }

    if (product.colors && product.colors.length > 0) {
        html += `
            <div class="detail-section-title">Цвет</div>
            <div class="color-grid">
                ${product.colors.map(c => `
                    <button class="color-btn ${c === state.selectedColor ? 'selected' : ''}" onclick="selectColor('${c}')">${c}</button>
                `).join('')}
            </div>`;
    }

    html += `
            <div class="detail-price-block">
                <span class="detail-price-main">${formatPrice(product.price)}</span>
                <span class="detail-price-converted">≈ $${converted.usd}<br>≈ ${converted.rub} ₽</span>
            </div>
            <button class="btn-primary" onclick="addToCartFromDetail()">Добавить в корзину</button>
        </div>`;

    document.getElementById('productDetail').innerHTML = html;
}

function detailPrevImage() {
    const product = state.currentProduct;
    if (!product.images) return;
    state.detailImageIndex = (state.detailImageIndex - 1 + product.images.length) % product.images.length;
    updateDetailImage();
}

function detailNextImage() {
    const product = state.currentProduct;
    if (!product.images) return;
    state.detailImageIndex = (state.detailImageIndex + 1) % product.images.length;
    updateDetailImage();
}

function detailSetImage(index) {
    state.detailImageIndex = index;
    updateDetailImage();
}

function updateDetailImage() {
    const product = state.currentProduct;
    const img = document.getElementById('detailMainImage');
    if (img && product.images) {
        img.src = product.images[state.detailImageIndex];
    }
    document.querySelectorAll('.detail-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === state.detailImageIndex);
    });
}

function selectSize(size) {
    state.selectedSize = size;
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.textContent) === size);
    });
}

function selectColor(color) {
    state.selectedColor = color;
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.textContent === color);
    });
}

// ===== КОРЗИНА =====
function addToCartFromDetail() {
    const product = state.currentProduct;
    addToCart(product, state.selectedSize, state.selectedColor);
}

function addToCart(product, size, color) {
    const cartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        size: size || null,
        color: color || null,
        image: product.images?.[0] || '',
        category: state.currentCategory
    };

    const exists = state.cart.find(item =>
        item.id === cartItem.id && item.size === cartItem.size && item.color === cartItem.color
    );

    if (!exists) {
        state.cart.push(cartItem);
        saveCart();
        updateCartBadge();
        showToast('Добавлено в корзину');
    } else {
        showToast('Уже в корзине');
    }
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    saveCart();
    updateCartBadge();
    showCart();
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(state.cart));
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const count = state.cart.length;
    if (count > 0) {
        badge.style.display = 'flex';
        badge.textContent = count;
    } else {
        badge.style.display = 'none';
    }
}

function getCartTotal() {
    const subtotal = state.cart.reduce((sum, item) => sum + item.price, 0);
    if (state.promocodeDiscount > 0) {
        return Math.round(subtotal * (1 - state.promocodeDiscount / 100));
    }
    return subtotal;
}

function showCart() {
    showView('cart');
    document.getElementById('headerTitle').textContent = 'КОРЗИНА';
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cartContent');

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛒</div>
                <div class="cart-empty-text">Корзина пуста</div>
                <div class="cart-empty-sub">Добавьте товары из каталога</div>
            </div>`;
        return;
    }

    const subtotal = state.cart.reduce((sum, item) => sum + item.price, 0);
    const total = getCartTotal();
    const discount = subtotal - total;

    const itemsHTML = state.cart.map((item, index) => `
        <div class="cart-item">
            <img class="cart-item-image" src="${item.image}" alt="${item.name}"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2272%22 height=%2272%22><rect fill=%22%23f0f0f0%22 width=%2272%22 height=%2272%22/></svg>'">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-meta">${item.size ? 'Размер: ' + item.size : ''}${item.color ? ' | ' + item.color : ''}</div>
                <div class="cart-item-price">${formatPrice(item.price)}</div>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})">✕</button>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="cart-items">${itemsHTML}</div>
        <div class="promo-section">
            <div class="promo-label">Промокод</div>
            <div class="promo-input-row">
                <input class="promo-input" id="promoInput" type="text" placeholder="Введите код" value="${state.promocodeCode}">
                <button class="btn-promo" onclick="applyPromocode()">Применить</button>
            </div>
            <div class="promo-message" id="promoMessage"></div>
        </div>
        <div class="cart-summary">
            <div class="summary-row"><span>Товары (${state.cart.length})</span><span>${formatPrice(subtotal)}</span></div>
            ${discount > 0 ? `<div class="summary-row summary-discount"><span>Скидка (${state.promocodeDiscount}%)</span><span>-${formatPrice(discount)}</span></div>` : ''}
            <div class="summary-row total"><span>Итого</span><span>${formatPrice(total)}</span></div>
        </div>
        <button class="btn-checkout" onclick="startCheckout()">Оформить заказ</button>`;
}

async function applyPromocode() {
    const input = document.getElementById('promoInput');
    const message = document.getElementById('promoMessage');
    const code = input.value.trim().toUpperCase();

    if (!code) {
        message.className = 'promo-message error';
        message.textContent = 'Введите промокод';
        return;
    }

    const result = await API.validatePromo(code);

    if (result.valid) {
        state.promocodeDiscount = result.discount;
        state.promocodeCode = code;
        message.className = 'promo-message success';
        message.textContent = 'Скидка ' + result.discount + '% применена';
        renderCart();
    } else {
        state.promocodeDiscount = 0;
        state.promocodeCode = '';
        message.className = 'promo-message error';
        message.textContent = 'Недействительный промокод';
    }
}

// ===== ОФОРМЛЕНИЕ =====
function startCheckout() {
    if (state.cart.length === 0) {
        showToast('Корзина пуста');
        return;
    }
    showView('checkout');
    document.getElementById('headerTitle').textContent = 'ОФОРМЛЕНИЕ';
    state.deliveryType = null;
    renderCheckout();
}

function renderCheckout() {
    const container = document.getElementById('checkoutContent');
    const total = getCartTotal();

    let html = `
        <div class="checkout-form">
            <div class="checkout-title">Оформление заказа</div>
            <div class="checkout-subtitle">Сумма: ${formatPrice(total)}</div>
            <div class="delivery-options">
                <div class="delivery-option ${state.deliveryType === 'pickup' ? 'selected' : ''}" onclick="selectDelivery('pickup')">
                    <div class="delivery-option-icon">🚶</div>
                    <div class="delivery-option-name">Самовывоз</div>
                    <div class="delivery-option-desc">Гомель</div>
                </div>
                <div class="delivery-option ${state.deliveryType === 'delivery' ? 'selected' : ''}" onclick="selectDelivery('delivery')">
                    <div class="delivery-option-icon">📦</div>
                    <div class="delivery-option-name">Доставка</div>
                    <div class="delivery-option-desc">Почтой</div>
                </div>
            </div>`;

    if (state.deliveryType) {
        html += renderFormFields();
    }

    html += '</div>';
    container.innerHTML = html;
}

function selectDelivery(type) {
    state.deliveryType = type;
    renderCheckout();
}

function renderFormFields() {
    const username = tg.initDataUnsafe?.user?.username || '';
    const firstName = tg.initDataUnsafe?.user?.first_name || '';

    if (state.deliveryType === 'pickup') {
        return `
            <div class="form-section">
                <div class="form-group">
                    <label class="form-label">Telegram username</label>
                    <input class="form-input" id="tgUsername" type="text" placeholder="@username" value="${username}">
                    <div class="form-hint">Ваш никнейм для связи</div>
                </div>
            </div>
            <button class="btn-submit" onclick="submitOrder()">Подтвердить заказ</button>`;
    }

    return `
        <div class="form-section">
            <div class="form-group">
                <label class="form-label">Фамилия</label>
                <input class="form-input" id="lastName" type="text" placeholder="Иванов">
            </div>
            <div class="form-group">
                <label class="form-label">Имя</label>
                <input class="form-input" id="firstName" type="text" placeholder="Иван" value="${firstName}">
            </div>
            <div class="form-group">
                <label class="form-label">Отчество</label>
                <input class="form-input" id="middleName" type="text" placeholder="Иванович">
            </div>
            <div class="form-group">
                <label class="form-label">Номер телефона</label>
                <input class="form-input" id="phone" type="tel" placeholder="+375 XX XXX-XX-XX">
            </div>
            <div class="form-group">
                <label class="form-label">Адрес Европочты</label>
                <input class="form-input" id="europost" type="text" placeholder="Город, отделение №">
            </div>
            <div class="form-group">
                <label class="form-label">Telegram username</label>
                <input class="form-input" id="tgUsername" type="text" placeholder="@username" value="${username}">
            </div>
        </div>
        <button class="btn-submit" onclick="submitOrder()">Подтвердить заказ</button>`;
}

async function submitOrder() {
    const isPickup = state.deliveryType === 'pickup';
    const tgUsername = (document.getElementById('tgUsername')?.value || '').trim().replace('@', '');

    if (!tgUsername) { showToast('Введите Telegram username'); return; }

    if (!isPickup) {
        const firstN = (document.getElementById('firstName')?.value || '').trim();
        const ph = (document.getElementById('phone')?.value || '').trim();
        const addr = (document.getElementById('europost')?.value || '').trim();
        if (!firstN) { showToast('Введите имя'); return; }
        if (!ph) { showToast('Введите телефон'); return; }
        if (!addr) { showToast('Введите адрес'); return; }
    }

    const order = {
        items: state.cart.map(item => ({
            name: item.name,
            price: item.price,
            size: item.size,
            color: item.color
        })),
        total: getCartTotal(),
        discount: state.promocodeDiscount,
        promocode: state.promocodeCode,
        delivery: state.deliveryType,
        telegramUsername: tgUsername,
        firstName: isPickup ? '' : (document.getElementById('firstName')?.value || '').trim(),
        lastName: isPickup ? '' : (document.getElementById('lastName')?.value || '').trim(),
        middleName: isPickup ? '' : (document.getElementById('middleName')?.value || '').trim(),
        phone: isPickup ? '' : (document.getElementById('phone')?.value || '').trim(),
        europostAddress: isPickup ? '' : (document.getElementById('europost')?.value || '').trim()
    };

    // Отправляем данные боту
    if (tg.sendData) {
        tg.sendData(JSON.stringify({ action: 'order', order }));
    }

    // Отправляем на сервер
    try {
        await API.submitOrder(order);
    } catch (e) {
        console.error('Ошибка отправки заказа:', e);
    }

    // Очистка
    state.cart = [];
    state.promocodeDiscount = 0;
    state.promocodeCode = '';
    saveCart();
    updateCartBadge();

    document.getElementById('checkoutContent').innerHTML = `
        <div class="checkout-form" style="text-align:center;">
            <div style="font-size:48px;margin-bottom:16px;">✓</div>
            <div class="checkout-title">Заказ оформлен</div>
            <div class="checkout-subtitle">С вами свяжутся в ближайшее время</div>
            <button class="btn-primary" onclick="showCategories()" style="margin-top:20px;">Вернуться в каталог</button>
        </div>`;

    setTimeout(() => tg.close(), 2500);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function init() {
    try {
        state.currencyRates = await API.getCurrencyRates();
    } catch (e) {}

    updateCartBadge();
    showCategories();

    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('cartBtn').addEventListener('click', () => {
        state.viewHistory.push(state.currentView);
        showCart();
    });
}

document.addEventListener('DOMContentLoaded', init);