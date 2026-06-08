// ===== TELEGRAM WEBAPP =====
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
    // Для галереи
    currentImageIndex: 0,
    detailImageIndex: 0,
    selectedSize: null,
    selectedColor: null,
    viewHistory: ['categories']
};

// ===== API =====
const API = {
    async getProducts(category, params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = `/api/products/${category}${query ? '?' + query : ''}`;
        const res = await fetch(url);
        return res.json();
    },
    
    async getProduct(id) {
        const res = await fetch(`/api/product/${id}`);
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
        const res = await fetch('/api/currency-rates');
        return res.json();
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

// ===== ФОРМАТИРОВАНИЕ =====
function formatPrice(price) {
    return price.toLocaleString('ru-BY') + ' BYN';
}

function convertPrice(price) {
    const usd = (price / state.currencyRates.USD).toFixed(2);
    const rub = Math.round(price * state.currencyRates.RUB);
    return { usd, rub };
}

function getConditionClass(condition) {
    const c = condition.toLowerCase();
    if (c.includes('новое') || c.includes('10/10') || c.includes('9')) return 'excellent';
    if (c.includes('отличное') || c.includes('8')) return 'good';
    return 'fair';
}

// ===== НАВИГАЦИЯ =====
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const view = document.getElementById('view-' + viewName);
    if (view) view.style.display = 'block';
    
    state.currentView = viewName;
    
    // Кнопка назад
    const backBtn = document.getElementById('backBtn');
    if (viewName === 'categories') {
        backBtn.style.visibility = 'hidden';
        document.getElementById('headerTitle').textContent = '🛍 Магазин';
    } else {
        backBtn.style.visibility = 'visible';
    }
    
    // Обновляем историю
    if (state.viewHistory[state.viewHistory.length - 1] !== viewName) {
        state.viewHistory.push(viewName);
    }
}

function goBack() {
    state.viewHistory.pop();
    const prevView = state.viewHistory[state.viewHistory.length - 1] || 'categories';
    
    switch (prevView) {
        case 'categories':
            showView('categories');
            break;
        case 'products':
            showProducts(state.currentCategory, true);
            break;
        case 'product':
            showProductDetail(state.currentProduct);
            break;
        case 'cart':
            showCart();
            break;
    }
}

// ===== КОРЗИНА =====
function addToCart(product, size, color) {
    const cartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        size: size || null,
        color: color || null,
        image: product.images[0],
        category: state.currentCategory
    };
    
    // Проверяем нет ли уже такого товара
    const exists = state.cart.find(item => 
        item.id === cartItem.id && 
        item.size === cartItem.size && 
        item.color === cartItem.color
    );
    
    if (!exists) {
        state.cart.push(cartItem);
        saveCart();
        updateCartBadge();
        
        // Виброотклик Telegram
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
        
        showToast('✅ Добавлено в корзину');
    } else {
        showToast('⚠️ Уже в корзине');
    }
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    saveCart();
    updateCartBadge();
    showCart();
    
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('warning');
    }
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

// ===== ТОСТ УВЕДОМЛЕНИЯ =====
function showToast(message) {
    // Убираем старый тост если есть
    const old = document.querySelector('.toast');
    if (old) old.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: #2D3436;
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 600;
        z-index: 1000;
        animation: slideUp 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Добавляем стиль для анимации тоста
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(toastStyle);

// ===== ОТОБРАЖЕНИЕ КАТЕГОРИЙ =====
function showCategories() {
    showView('categories');
    state.currentCategory = null;
    state.selectedSize = null;
    state.selectedColor = null;
    state.viewHistory = ['categories'];
    document.getElementById('headerTitle').textContent = '🛍 Магазин';
}

// ===== ОТОБРАЖЕНИЕ ТОВАРОВ =====
async function showProducts(category, keepState = false) {
    showView('products');
    state.currentCategory = category;
    document.getElementById('headerTitle').textContent = category === 'shoes' ? '👟 Обувь' : '🎧 Техника';
    
    // Обновляем фильтр размеров
    const sizeSelect = document.getElementById('sizeSelect');
    if (category === 'shoes') {
        sizeSelect.style.display = 'block';
        const sizes = [38, 39, 40, 41, 42, 43, 44, 45, 46];
        sizeSelect.innerHTML = '<option value="">📏 Все размеры</option>' + 
            sizes.map(s => `<option value="${s}">Размер ${s}</option>`).join('');
    } else {
        sizeSelect.style.display = 'none';
    }
    
    if (!keepState) {
        document.getElementById('sortSelect').value = '';
        sizeSelect.value = '';
    }
    
    await applyFilters();
}

async function applyFilters() {
    const sortSelect = document.getElementById('sortSelect');
    const sizeSelect = document.getElementById('sizeSelect');
    
    const params = {};
    
    // Сортировка
    if (sortSelect.value) {
        const [sort, order] = sortSelect.value.split('_');
        params.sort = sort;
        params.order = order;
    }
    
    // Фильтр размера
    if (sizeSelect && sizeSelect.value) {
        params.size = sizeSelect.value;
    }
    
    const products = await API.getProducts(state.currentCategory, params);
    renderProductsGrid(products);
}

function renderProductsGrid(products) {
    const grid = document.getElementById('productsGrid');
    
    if (products.length === 0) {
        grid.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🔍</div>
                <div class="cart-empty-text">Товары не найдены</div>
                <div class="cart-empty-sub">Попробуйте изменить фильтры</div>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = products.map(product => {
        const converted = convertPrice(product.price);
        const conditionClass = getConditionClass(product.condition || '');
        
        return `
            <div class="product-card" onclick="showProductDetail(${product.id})">
                <div class="product-images">
                    <img class="product-image" src="${product.images[0]}" alt="${product.name}" 
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22300%22><rect fill=%22%23e0e0e0%22 width=%22300%22 height=%22300%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2220%22>Нет фото</text></svg>'">
                    ${product.images.length > 1 ? `<span class="image-counter">1/${product.images.length}</span>` : ''}
                </div>
                <div class="product-info">
                    <div class="product-brand">${product.brand || ''}</div>
                    <div class="product-name">${product.name}</div>
                    <div class="product-condition">
                        <span class="condition-dot ${conditionClass}"></span>
                        ${product.condition || ''}
                    </div>
                    <div class="product-price-row">
                        <span class="product-price">${formatPrice(product.price)}</span>
                        <span class="product-price-other">
                            ≈ $${converted.usd}<br>≈ ${converted.rub} ₽
                        </span>
                    </div>
                    <button class="btn-add-cart" onclick="event.stopPropagation(); quickAddToCart(${product.id})">
                        🛒 В корзину
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function quickAddToCart(productId) {
    const product = await API.getProduct(productId);
    if (product) {
        const defaultSize = product.size ? product.size[0] : null;
        const defaultColor = product.colors ? product.colors[0] : null;
        addToCart(product, defaultSize, defaultColor);
    }
}

// ===== ДЕТАЛИ ТОВАРА =====
async function showProductDetail(productId) {
    const product = await API.getProduct(productId);
    if (!product) return;
    
    state.currentProduct = product;
    state.detailImageIndex = 0;
    state.selectedSize = product.size ? product.size[0] : null;
    state.selectedColor = product.colors ? product.colors[0] : null;
    
    showView('product');
    document.getElementById('headerTitle').textContent = product.brand || 'Товар';
    
    const converted = convertPrice(product.price);
    const conditionClass = getConditionClass(product.condition || '');
    
    // Размеры (для обуви)
    const sizeHTML = product.size ? `
        <div class="size-section">
            <div class="size-label">📏 Размер:</div>
            <div class="size-grid">
                ${product.size.map(s => `
                    <button class="size-btn ${s === state.selectedSize ? 'selected' : ''}" 
                            onclick="selectSize(${s})">
                        ${s}
                    </button>
                `).join('')}
            </div>
            ${product.sizeNote ? `<div style="font-size:12px;color:var(--text-light);margin-top:6px;">📐 ${product.sizeNote}</div>` : ''}
        </div>
    ` : '';
    
    // Цвета (для техники)
    const colorHTML = product.colors ? `
        <div class="color-section">
            <div class="color-label">🎨 Цвет:</div>
            <div class="color-grid">
                ${product.colors.map(c => `
                    <button class="color-btn ${c === state.selectedColor ? 'selected' : ''}" 
                            onclick="selectColor('${c}')">
                        ${c}
                    </button>
                `).join('')}
            </div>
        </div>
    ` : '';
    
    const detailHTML = `
        <div class="product-detail-card">
            <div class="detail-gallery">
                <img class="detail-image" src="${product.images[state.detailImageIndex]}" alt="${product.name}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22><rect fill=%22%23e0e0e0%22 width=%22400%22 height=%22400%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2224%22>Нет фото</text></svg>'">
                ${product.images.length > 1 ? `
                    <button class="gallery-nav gallery-prev" onclick="changeDetailImage(-1)">‹</button>
                    <button class="gallery-nav gallery-next" onclick="changeDetailImage(1)">›</button>
                    <div class="gallery-dots">
                        ${product.images.map((_, i) => `
                            <span class="gallery-dot ${i === state.detailImageIndex ? 'active' : ''}" 
                                  onclick="event.stopPropagation(); setDetailImage(${i})"></span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="detail-body">
                <div class="detail-brand">${product.brand || ''}</div>
                <div class="detail-name">${product.name}</div>
                <div class="detail-condition">
                    <span class="condition-dot ${conditionClass}"></span>
                    Состояние: ${product.condition || 'Не указано'}
                </div>
                <div class="detail-description">${product.description}</div>
                
                ${sizeHTML}
                ${colorHTML}
                
                <div class="price-block">
                    <span class="price-main">${formatPrice(product.price)}</span>
                    <span class="price-converted">
                        ≈ $${converted.usd}<br>≈ ${converted.rub} ₽
                    </span>
                </div>
                
                <button class="btn-detail-add" onclick="addCurrentToCart()">
                    🛒 Добавить в корзину
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('productDetail').innerHTML = detailHTML;
}

function selectSize(size) {
    state.selectedSize = size;
    showProductDetail(state.currentProduct.id);
}

function selectColor(color) {
    state.selectedColor = color;
    showProductDetail(state.currentProduct.id);
}

function changeDetailImage(delta) {
    const product = state.currentProduct;
    state.detailImageIndex = (state.detailImageIndex + delta + product.images.length) % product.images.length;
    showProductDetail(product.id);
}

function setDetailImage(index) {
    state.detailImageIndex = index;
    showProductDetail(state.currentProduct.id);
}

function addCurrentToCart() {
    addToCart(state.currentProduct, state.selectedSize, state.selectedColor);
}

// ===== КОРЗИНА =====
function showCart() {
    showView('cart');
    document.getElementById('headerTitle').textContent = '🛒 Корзина';
    
    const container = document.getElementById('cartContent');
    
    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛒</div>
                <div class="cart-empty-text">Корзина пуста</div>
                <div class="cart-empty-sub">Добавьте товары из каталога</div>
                <button class="btn-checkout" style="margin-top:16px;background:var(--primary);" onclick="showCategories()">
                    🔍 Перейти в каталог
                </button>
            </div>
        `;
        return;
    }
    
    const itemsHTML = state.cart.map((item, index) => `
        <div class="cart-item">
            <img class="cart-item-image" src="${item.image}" alt="${item.name}"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2270%22><rect fill=%22%23e0e0e0%22 width=%2270%22 height=%2270%22/></svg>'">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-meta">
                    ${item.size ? 'Размер: ' + item.size : ''}
                    ${item.color ? ' | Цвет: ' + item.color : ''}
                </div>
                <div class="cart-item-price">${formatPrice(item.price)}</div>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})">✕</button>
        </div>
    `).join('');
    
    const subtotal = state.cart.reduce((sum, item) => sum + item.price, 0);
    const total = getCartTotal();
    const discount = subtotal - total;
    
    container.innerHTML = `
        <div class="cart-items-list">${itemsHTML}</div>
        
        <div class="promo-section">
            <div class="promo-label">🎫 Промокод</div>
            <div class="promo-input-row">
                <input class="promo-input" id="promoInput" type="text" placeholder="Введите код" 
                       value="${state.promocodeCode}" autocomplete="off">
                <button class="btn-promo" onclick="applyPromocode()">Применить</button>
            </div>
            <div class="promo-message" id="promoMessage"></div>
        </div>
        
        <div class="cart-summary">
            <div class="summary-row">
                <span>Товары (${state.cart.length})</span>
                <span>${formatPrice(subtotal)}</span>
            </div>
            ${discount > 0 ? `
                <div class="summary-row summary-discount">
                    <span>Скидка (${state.promocodeDiscount}%)</span>
                    <span>-${formatPrice(discount)}</span>
                </div>
            ` : ''}
            <div class="summary-row total">
                <span>Итого</span>
                <span>${formatPrice(total)}</span>
            </div>
        </div>
        
        <button class="btn-checkout" onclick="startCheckout()">
            📦 Оформить заказ
        </button>
    `;
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
        message.textContent = `✅ Скидка ${result.discount}% применена!`;
        
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
        
        showCart();
    } else {
        state.promocodeDiscount = 0;
        state.promocodeCode = '';
        message.className = 'promo-message error';
        message.textContent = '❌ Недействительный промокод';
        
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }
}

// ===== ОФОРМЛЕНИЕ ЗАКАЗА =====
function startCheckout() {
    if (state.cart.length === 0) {
        showToast('Корзина пуста');
        return;
    }
    
    showView('checkout');
    document.getElementById('headerTitle').textContent = '📋 Оформление';
    state.deliveryType = null;
    
    renderCheckoutForm();
}

function renderCheckoutForm() {
    const container = document.getElementById('checkoutContent');
    const total = getCartTotal();
    
    container.innerHTML = `
        <div class="checkout-form">
            <div class="checkout-title">Оформление заказа</div>
            
            <div style="margin-bottom:20px;font-weight:700;font-size:16px;text-align:center;color:var(--primary);">
                💵 Сумма: ${formatPrice(total)}
            </div>
            
            <div class="delivery-options">
                <div class="delivery-option ${state.deliveryType === 'pickup' ? 'selected' : ''}" 
                     onclick="selectDelivery('pickup')">
                    <div class="delivery-option-icon">🚶</div>
                    <div class="delivery-option-name">Самовывоз</div>
                    <div class="delivery-option-desc">Гомель</div>
                </div>
                <div class="delivery-option ${state.deliveryType === 'delivery' ? 'selected' : ''}" 
                     onclick="selectDelivery('delivery')">
                    <div class="delivery-option-icon">🚚</div>
                    <div class="delivery-option-name">Доставка</div>
                    <div class="delivery-option-desc">Почтой</div>
                </div>
            </div>
            
            ${state.deliveryType ? renderFormFields() : '<p style="text-align:center;color:var(--text-light);">Выберите способ получения</p>'}
        </div>
    `;
}

function selectDelivery(type) {
    state.deliveryType = type;
    renderCheckoutForm();
}

function renderFormFields() {
    const isPickup = state.deliveryType === 'pickup';
    
    if (isPickup) {
        return `
            <div class="form-section">
                <div class="form-group">
                    <label class="form-label">💬 Telegram username</label>
                    <input class="form-input" id="tgUsername" type="text" placeholder="@username" 
                           value="${tg.initDataUnsafe?.user?.username || ''}">
                    <div class="form-hint">Ваш никнейм для связи</div>
                </div>
            </div>
            <button class="btn-submit" onclick="submitOrder()">✅ Подтвердить заказ</button>
        `;
    }
    
    return `
        <div class="form-section">
            <div class="form-group">
                <label class="form-label">👤 Фамилия</label>
                <input class="form-input" id="lastName" type="text" placeholder="Иванов">
            </div>
            <div class="form-group">
                <label class="form-label">👤 Имя</label>
                <input class="form-input" id="firstName" type="text" placeholder="Иван" 
                       value="${tg.initDataUnsafe?.user?.first_name || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">👤 Отчество</label>
                <input class="form-input" id="middleName" type="text" placeholder="Иванович">
            </div>
            <div class="form-group">
                <label class="form-label">📱 Номер телефона</label>
                <input class="form-input" id="phone" type="tel" placeholder="+375 XX XXX-XX-XX">
            </div>
            <div class="form-group">
                <label class="form-label">📍 Адрес Европочты</label>
                <input class="form-input" id="europost" type="text" placeholder="Город, отделение №">
                <div class="form-hint">Укажите город и номер отделения</div>
            </div>
            <div class="form-group">
                <label class="form-label">💬 Telegram username</label>
                <input class="form-input" id="tgUsername" type="text" placeholder="@username"
                       value="${tg.initDataUnsafe?.user?.username || ''}">
                <div class="form-hint">Ваш никнейм для связи</div>
            </div>
        </div>
        <button class="btn-submit" onclick="submitOrder()">✅ Подтвердить заказ</button>
    `;
}

async function submitOrder() {
    const isPickup = state.deliveryType === 'pickup';
    
    // Валидация
    const tgUsername = document.getElementById('tgUsername')?.value.trim();
    if (!tgUsername) {
        showToast('Введите Telegram username');
        return;
    }
    
    if (!isPickup) {
        const firstName = document.getElementById('firstName')?.value.trim();
        const phone = document.getElementById('phone')?.value.trim();
        const europost = document.getElementById('europost')?.value.trim();
        
        if (!firstName) { showToast('Введите имя'); return; }
        if (!phone) { showToast('Введите телефон'); return; }
        if (!europost) { showToast('Введите адрес'); return; }
    }
    
    const order = {
        items: state.cart,
        total: getCartTotal(),
        discount: state.promocodeDiscount,
        promocode: state.promocodeCode,
        delivery: state.deliveryType,
        telegramUsername: tgUsername.replace('@', ''),
        firstName: isPickup ? '' : document.getElementById('firstName')?.value.trim() || '',
        lastName: isPickup ? '' : document.getElementById('lastName')?.value.trim() || '',
        middleName: isPickup ? '' : document.getElementById('middleName')?.value.trim() || '',
        phone: isPickup ? '' : document.getElementById('phone')?.value.trim() || '',
        europostAddress: isPickup ? '' : document.getElementById('europost')?.value.trim() || ''
    };
    
    // Отправляем через Telegram
    if (tg.sendData) {
        tg.sendData(JSON.stringify({ action: 'order', order }));
    }
    
    // Также отправляем на сервер
    try {
        await API.submitOrder(order);
    } catch (e) {
        console.error('Ошибка отправки на сервер:', e);
    }
    
    // Очищаем корзину
    state.cart = [];
    state.promocodeDiscount = 0;
    state.promocodeCode = '';
    saveCart();
    updateCartBadge();
    
    // Показываем сообщение
    const container = document.getElementById('checkoutContent');
    container.innerHTML = `
        <div class="checkout-form" style="text-align:center;">
            <div style="font-size:64px;margin-bottom:16px;">✅</div>
            <div class="checkout-title">Заказ оформлен!</div>
            <p style="color:var(--text-light);margin-bottom:20px;">
                С вами свяжутся в ближайшее время
            </p>
            <button class="btn-checkout" onclick="showCategories()">
                🛍 Вернуться в каталог
            </button>
        </div>
    `;
    
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
    
    // Закрываем Mini App
    setTimeout(() => {
        tg.close();
    }, 2000);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function init() {
    // Загружаем курсы валют
    try {
        state.currencyRates = await API.getCurrencyRates();
    } catch (e) {
        console.log('Используем курсы по умолчанию');
    }
    
    updateCartBadge();
    showCategories();
    
    // Настройка цветов Telegram
    if (tg.themeParams) {
        document.documentElement.style.setProperty('--bg', tg.backgroundColor || tg.themeParams.bg_color || '#F8F9FA');
        document.documentElement.style.setProperty('--text', tg.themeParams.text_color || '#2D3436');
    }
    
    // Обработчики кнопок
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('cartBtn').addEventListener('click', () => {
        state.viewHistory.push(state.currentView);
        showCart();
    });
}

// Запуск
document.addEventListener('DOMContentLoaded', init);