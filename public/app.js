// Telegram WebApp
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
    selectedColor: null,
    viewHistory: ['categories'],
    detailImageIndex: 0,
    allProducts: [],
    allFilters: {}
};

const API = {
    async getProducts(cat, params = {}) {
        const q = new URLSearchParams(params).toString();
        const r = await fetch(`/api/products/${cat}${q ? '?' + q : ''}`);
        return r.json();
    },
    async getProduct(id) { const r = await fetch(`/api/product/${id}`); return r.json(); },
    async validatePromo(code) {
        const r = await fetch('/api/validate-promocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        return r.json();
    },
    async getRates() { try { const r = await fetch('/api/currency-rates'); return r.json(); } catch (e) { return { USD: 3.25, RUB: 28.5 }; } },
    async submitOrder(order) {
        const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
        return r.json();
    }
};

const formatPrice = p => p.toLocaleString('ru-BY') + ' BYN';
const convertPrice = p => ({ usd: (p / state.currencyRates.USD).toFixed(2), rub: Math.round(p * state.currencyRates.RUB) });

function toast(msg) {
    const old = document.querySelector('.toast'); if (old) old.remove();
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 2000);
}

function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const view = document.getElementById('view-' + name); if (view) view.style.display = 'block';
    state.currentView = name;
    document.getElementById('backBtn').style.visibility = name === 'categories' ? 'hidden' : 'visible';
    switch (name) {
        case 'categories': document.getElementById('headerTitle').textContent = 'Shop'; break;
        case 'products': document.getElementById('headerTitle').textContent = state.currentCategory === 'shoes' ? 'Обувь и одежда' : 'Техника и аксессуары'; break;
        case 'product': document.getElementById('headerTitle').textContent = state.currentProduct ? (state.currentProduct.brand || 'Товар') : 'Товар'; break;
        case 'cart': document.getElementById('headerTitle').textContent = 'Корзина'; break;
        case 'checkout': document.getElementById('headerTitle').textContent = 'Оформление'; break;
        case 'wheel': document.getElementById('headerTitle').textContent = 'Колесо фортуны'; break;
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
        case 'wheel': showCategories(); break;
    }
}

// Категории
function showCategories() {
    showView('categories');
    state.currentCategory = null; state.viewHistory = ['categories'];
    document.getElementById('view-categories').innerHTML = `
        <div class="categories-grid">
            <div class="category-card" onclick="showWheel()">
                <div class="category-icon">🎡</div>
                <div class="category-info"><div class="category-name">Колесо фортуны</div><div class="category-desc">Крутите раз в день</div></div>
                <div class="category-arrow">›</div>
            </div>
            <div class="category-card" onclick="showProducts('shoes')">
                <div class="category-icon">👟</div>
                <div class="category-info"><div class="category-name">Обувь и одежда</div><div class="category-desc">Кроссовки, кеды, бутсы</div></div>
                <div class="category-arrow">›</div>
            </div>
            <div class="category-card" onclick="showProducts('tech')">
                <div class="category-icon">🎧</div>
                <div class="category-info"><div class="category-name">Техника и аксессуары</div><div class="category-desc">Наушники, геймпады</div></div>
                <div class="category-arrow">›</div>
            </div>
        </div>`;
}

// Товары
async function showProducts(cat) {
    state.currentCategory = cat;
    state.allFilters = {};
    showView('products');
    await loadProducts();
}

async function loadProducts() {
    try {
        const products = await API.getProducts(state.currentCategory, {});
        state.allProducts = products;
        renderGrid(products);
    } catch (e) {
        document.getElementById('view-products').innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
}

function applyFiltersAndRender() {
    let products = [...state.allProducts];
    const f = state.allFilters;

    // Сортировка
    if (f.sort === 'price_asc') products.sort((a, b) => a.price - b.price);
    if (f.sort === 'price_desc') products.sort((a, b) => b.price - a.price);
    if (f.sort === 'name_asc') products.sort((a, b) => a.name.localeCompare(b.name));
    if (f.sort === 'name_desc') products.sort((a, b) => b.name.localeCompare(a.name));

    // Бренд
    if (f.brand) products = products.filter(p => p.brand === f.brand);

    // Размер (только обувь)
    if (f.size) products = products.filter(p => p.size && p.size.includes(f.size));

    // Состояние (только обувь)
    if (f.condition) {
        products = products.filter(p => {
            const c = (p.condition || '').toLowerCase();
            if (f.condition === 'new') return c.includes('новое') || c.includes('10/10');
            if (f.condition === 'excellent') return c.includes('отличное') || c.includes('9');
            if (f.condition === 'good') return c.includes('хорошее') || c.includes('8');
            if (f.condition === 'fair') return c.includes('7') || c.includes('6');
            return true;
        });
    }

    // Цена
    if (f.priceMin) products = products.filter(p => p.price >= parseInt(f.priceMin));
    if (f.priceMax && f.priceMax !== '999') products = products.filter(p => p.price <= parseInt(f.priceMax));

    renderGrid(products);
}

function renderGrid(products) {
    const isShoes = state.currentCategory === 'shoes';
    const brands = [...new Set(state.allProducts.map(p => p.brand).filter(Boolean))];
    const f = state.allFilters;

    document.getElementById('view-products').innerHTML = `
        <div class="filters-bar">
            <select class="filter-select" id="filterSort" onchange="setFilter('sort', this.value)">
                <option value="">Сортировка</option>
                <option value="price_asc" ${f.sort==='price_asc'?'selected':''}>Цена: возр.</option>
                <option value="price_desc" ${f.sort==='price_desc'?'selected':''}>Цена: убыв.</option>
            </select>
            <select class="filter-select" id="filterBrand" onchange="setFilter('brand', this.value)">
                <option value="">Бренд</option>
                ${brands.map(b => `<option value="${b}" ${f.brand===b?'selected':''}>${b}</option>`).join('')}
            </select>
            ${isShoes ? `
            <select class="filter-select" id="filterSize" onchange="setFilter('size', this.value)">
                <option value="">Размер</option>
                ${['38','39','40','41','42','43','44','45','46'].map(s => `<option value="${s}" ${f.size===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <select class="filter-select" id="filterCondition" onchange="setFilter('condition', this.value)">
                <option value="">Состояние</option>
                <option value="new" ${f.condition==='new'?'selected':''}>Новое</option>
                <option value="excellent" ${f.condition==='excellent'?'selected':''}>Отличное</option>
                <option value="good" ${f.condition==='good'?'selected':''}>Хорошее</option>
            </select>` : ''}
            <select class="filter-select" id="filterPrice" onchange="handlePriceFilter(this.value)">
                <option value="">Цена</option>
                <option value="0-50" ${f.priceMin==='0'&&f.priceMax==='50'?'selected':''}>До 50 BYN</option>
                <option value="50-100" ${f.priceMin==='50'&&f.priceMax==='100'?'selected':''}>50-100 BYN</option>
                <option value="100-150" ${f.priceMin==='100'&&f.priceMax==='150'?'selected':''}>100-150 BYN</option>
                <option value="150-200" ${f.priceMin==='150'&&f.priceMax==='200'?'selected':''}>150-200 BYN</option>
                <option value="200-999" ${f.priceMin==='200'&&f.priceMax==='999'?'selected':''}>200+ BYN</option>
            </select>
            ${Object.keys(f).length > 0 ? '<button onclick="resetAllFilters()" style="flex-shrink:0;padding:7px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);font-size:11px;cursor:pointer;white-space:nowrap;">Сбросить</button>' : ''}
        </div>
        <div class="products-grid">
            ${products.length ? products.map(p => {
                const c = convertPrice(p.price);
                return `
                <div class="product-card">
                    <div class="product-image-container">
                        <img class="product-image" src="${p.images[0]}" data-pid="${p.id}" data-idx="0" onerror="this.style.background='#f0f0f0'">
                        ${p.images.length > 1 ? `
                        <div class="gallery-touch-left" data-a="prev" data-pid="${p.id}"></div>
                        <div class="gallery-touch-right" data-a="next" data-pid="${p.id}"></div>
                        <button class="gallery-arrow prev" data-a="prev" data-pid="${p.id}">‹</button>
                        <button class="gallery-arrow next" data-a="next" data-pid="${p.id}">›</button>
                        <div class="image-dots">${p.images.map((_, i) => `<span class="image-dot${i===0?' active':''}" data-pid="${p.id}" data-d="${i}"></span>`).join('')}</div>
                        ` : ''}
                    </div>
                    <div class="product-info" onclick="showProductDetail(${p.id})">
                        <div class="product-brand">${p.brand||''}</div>
                        <div class="product-name">${p.name}</div>
                        <div class="product-condition">${p.condition||''}</div>
                        <div class="product-price">${formatPrice(p.price)}</div>
                        <div class="product-price-other">≈ $${c.usd} / ${c.rub} ₽</div>
                    </div>
                </div>`;
            }).join('') : '<div class="empty-state">Товары не найдены</div>'}
        </div>`;

    // Галерея
    document.querySelectorAll('[data-a]').forEach(el => {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            const pid = parseInt(this.dataset.pid);
            const product = state.allProducts.find(p => p.id === pid);
            if (!product || !product.images || product.images.length < 2) return;
            const img = document.querySelector(`img[data-pid="${pid}"]`);
            const dots = document.querySelectorAll(`.image-dot[data-pid="${pid}"]`);
            let idx = parseInt(img.dataset.idx);
            idx = this.dataset.a === 'next' ? (idx + 1) % product.images.length : (idx - 1 + product.images.length) % product.images.length;
            img.src = product.images[idx];
            img.dataset.idx = idx;
            dots.forEach((d, i) => d.classList.toggle('active', i === idx));
        });
    });
}

function setFilter(key, value) {
    if (!value) {
        delete state.allFilters[key];
    } else {
        state.allFilters[key] = value;
    }
    applyFiltersAndRender();
}

function handlePriceFilter(value) {
    if (!value) {
        delete state.allFilters.priceMin;
        delete state.allFilters.priceMax;
    } else {
        const [min, max] = value.split('-');
        state.allFilters.priceMin = min;
        state.allFilters.priceMax = max;
    }
    applyFiltersAndRender();
}

function resetAllFilters() {
    state.allFilters = {};
    applyFiltersAndRender();
}

// Детали
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
            <div class="detail-image-wrapper"><img class="detail-image" src="${p.images[state.detailImageIndex]}" id="dimg"></div>
            ${p.images.length > 1 ? `
            <button class="detail-nav-btn detail-nav-prev" onclick="dPrev()">‹</button>
            <button class="detail-nav-btn detail-nav-next" onclick="dNext()">›</button>
            <div class="detail-dots-container">${p.images.map((_, i) => `<span class="detail-dot${i===state.detailImageIndex?' active':''}" onclick="dSet(${i})"></span>`).join('')}</div>` : ''}
        </div>
        <div class="detail-body">
            <div class="detail-brand">${p.brand||''}</div>
            <div class="detail-name">${p.name}</div>
            <div class="detail-condition">${p.condition||''}</div>
            <div class="detail-description">${p.description}</div>`;

    if (isShoes && p.size) html += `<div class="detail-section-title">Размер</div><div style="font-size:16px;font-weight:600;margin-bottom:16px;">${p.size}</div>`;
    if (p.colors?.length) html += `<div class="detail-section-title">Цвет</div><div class="color-grid">${p.colors.map(cl => `<button class="color-btn${cl===state.selectedColor?' selected':''}" onclick="selColor('${cl}')">${cl}</button>`).join('')}</div>`;

    html += `<div class="detail-price-block"><span class="detail-price-main">${formatPrice(p.price)}</span><span class="detail-price-converted">≈ $${c.usd}<br>≈ ${c.rub} ₽</span></div>
        <button class="btn-primary" onclick="addFromDetail()">Добавить в корзину</button></div>`;
    document.getElementById('view-product').innerHTML = html;
}

function dPrev() { const p = state.currentProduct; state.detailImageIndex = (state.detailImageIndex - 1 + p.images.length) % p.images.length; updateDImg(); }
function dNext() { const p = state.currentProduct; state.detailImageIndex = (state.detailImageIndex + 1) % p.images.length; updateDImg(); }
function dSet(i) { state.detailImageIndex = i; updateDImg(); }
function updateDImg() { const img = document.getElementById('dimg'); if (img) img.src = state.currentProduct.images[state.detailImageIndex]; document.querySelectorAll('.detail-dot').forEach((d, i) => d.classList.toggle('active', i === state.detailImageIndex)); }
function selColor(c) { state.selectedColor = c; document.querySelectorAll('.color-btn').forEach(b => b.classList.toggle('selected', b.textContent === c)); }

// Корзина
function addFromDetail() { const p = state.currentProduct; addToCart(p, state.currentCategory === 'shoes' ? p.size : null, state.selectedColor); }
function addToCart(p, size, color) {
    const item = { id: p.id, name: p.name, price: p.price, size: size || null, color: color || null, image: p.images?.[0] || '' };
    if (!state.cart.find(i => i.id === item.id && i.size === item.size && i.color === item.color)) { state.cart.push(item); saveCart(); updateBadge(); toast('Добавлено в корзину'); }
    else toast('Уже в корзине');
}
function removeFromCart(i) { state.cart.splice(i, 1); saveCart(); updateBadge(); showCart(); }
function saveCart() { localStorage.setItem('cart', JSON.stringify(state.cart)); }
function updateBadge() { const b = document.getElementById('cartBadge'); const n = state.cart.length; b.style.display = n ? 'flex' : 'none'; if (n) b.textContent = n; }
function getTotal() { const sub = state.cart.reduce((a, i) => a + i.price, 0); return state.promocodeDiscount ? Math.round(sub * (1 - state.promocodeDiscount / 100)) : sub; }

function showCart() { showView('cart'); renderCart(); }
function renderCart() {
    const ct = document.getElementById('view-cart');
    if (!state.cart.length) { ct.innerHTML = '<div class="cart-empty"><div class="cart-empty-icon">🛒</div><div class="cart-empty-text">Корзина пуста</div></div>'; return; }
    const sub = state.cart.reduce((a, i) => a + i.price, 0), total = getTotal(), disc = sub - total;
    ct.innerHTML = `<div class="cart-items">${state.cart.map((it, i) => `<div class="cart-item"><img class="cart-item-image" src="${it.image}"><div class="cart-item-info"><div class="cart-item-name">${it.name}</div><div class="cart-item-meta">${it.size?'Размер '+it.size:''}${it.color?(it.size?' | ':'')+it.color:''}</div><div class="cart-item-price">${formatPrice(it.price)}</div></div><button class="cart-item-remove" onclick="removeFromCart(${i})">✕</button></div>`).join('')}</div>
    <div class="promo-section"><div class="promo-label">Промокод</div><div class="promo-input-row"><input class="promo-input" id="pi" type="text" value="${state.promocodeCode}"><button class="btn-promo" onclick="applyPromo()">Применить</button></div><div class="promo-message" id="pm"></div></div>
    <div class="cart-summary"><div class="summary-row"><span>Товары</span><span>${formatPrice(sub)}</span></div>${disc>0?`<div class="summary-row summary-discount"><span>Скидка ${state.promocodeDiscount}%</span><span>−${formatPrice(disc)}</span></div>`:''}<div class="summary-row total"><span>Итого</span><span>${formatPrice(total)}</span></div></div>
    <button class="btn-checkout" onclick="startCheckout()">Оформить заказ</button>`;
}
async function applyPromo() { const input = document.getElementById('pi'), msg = document.getElementById('pm'), code = input.value.trim().toUpperCase(); if (!code) { msg.className = 'promo-message error'; msg.textContent = 'Введите промокод'; return; } const r = await API.validatePromo(code); if (r.valid) { state.promocodeDiscount = r.discount; state.promocodeCode = code; msg.className = 'promo-message success'; msg.textContent = 'Скидка ' + r.discount + '%'; renderCart(); } else { state.promocodeDiscount = 0; state.promocodeCode = ''; msg.className = 'promo-message error'; msg.textContent = 'Недействителен'; } }

// Оформление
function startCheckout() { if (!state.cart.length) { toast('Корзина пуста'); return; } showView('checkout'); state.deliveryType = null; renderCheckout(); }
function renderCheckout() {
    document.getElementById('view-checkout').innerHTML = `<div class="checkout-form"><div class="checkout-title">Оформление</div><div class="checkout-subtitle">Сумма: <strong>${formatPrice(getTotal())}</strong></div>
    <div class="delivery-options"><div class="delivery-option${state.deliveryType==='pickup'?' selected':''}" onclick="selDel('pickup')"><div class="delivery-option-icon">🚶</div><div class="delivery-option-name">Самовывоз</div></div>
    <div class="delivery-option${state.deliveryType==='delivery'?' selected':''}" onclick="selDel('delivery')"><div class="delivery-option-icon">📦</div><div class="delivery-option-name">Доставка</div></div></div>
    ${state.deliveryType ? formFields() : '<p style="text-align:center;color:var(--text-secondary);">Выберите способ</p>'}</div>`;
}
function selDel(t) { state.deliveryType = t; renderCheckout(); }
function formFields() {
    const u = tg.initDataUnsafe?.user?.username || '';
    if (state.deliveryType === 'pickup') return `<div class="form-group"><label class="form-label">Telegram</label><input class="form-input" id="tu" value="${u}"></div><button class="btn-submit" onclick="submitOrder()">Подтвердить</button>`;
    return `<div class="form-group"><label class="form-label">Фамилия</label><input class="form-input" id="ln"></div>
    <div class="form-group"><label class="form-label">Имя</label><input class="form-input" id="fn" value="${tg.initDataUnsafe?.user?.first_name||''}"></div>
    <div class="form-group"><label class="form-label">Отчество</label><input class="form-input" id="mn"></div>
    <div class="form-group"><label class="form-label">Телефон</label><input class="form-input" id="ph"></div>
    <div class="form-group"><label class="form-label">Адрес Европочты</label><input class="form-input" id="ep"></div>
    <div class="form-group"><label class="form-label">Telegram</label><input class="form-input" id="tu" value="${u}"></div>
    <button class="btn-submit" onclick="submitOrder()">Подтвердить</button>`;
}
async function submitOrder() {
    const isP = state.deliveryType === 'pickup';
    const tgU = (document.getElementById('tu')?.value || '').trim().replace('@', '');
    if (!tgU) { toast('Введите Telegram'); return; }
    if (!isP) { if (!document.getElementById('fn')?.value.trim() || !document.getElementById('ph')?.value.trim() || !document.getElementById('ep')?.value.trim()) { toast('Заполните все поля'); return; } }
    const order = { items: state.cart.map(i => ({ name: i.name, price: i.price, size: i.size, color: i.color })), total: getTotal(), discount: state.promocodeDiscount, promocode: state.promocodeCode, delivery: state.deliveryType, telegramUsername: tgU, firstName: isP ? '' : document.getElementById('fn')?.value.trim()||'', lastName: isP ? '' : document.getElementById('ln')?.value.trim()||'', middleName: isP ? '' : document.getElementById('mn')?.value.trim()||'', phone: isP ? '' : document.getElementById('ph')?.value.trim()||'', europostAddress: isP ? '' : document.getElementById('ep')?.value.trim()||'' };
    if (tg.sendData) tg.sendData(JSON.stringify({ action: 'order', order }));
    try { await API.submitOrder(order); } catch (e) {}
    state.cart = []; state.promocodeDiscount = 0; state.promocodeCode = ''; saveCart(); updateBadge();
    document.getElementById('view-checkout').innerHTML = '<div class="checkout-form" style="text-align:center;"><div style="font-size:48px;">✅</div><div class="checkout-title">Заказ оформлен!</div><button class="btn-primary" onclick="showCategories()" style="margin-top:16px;">В каталог</button></div>';
    setTimeout(() => tg.close(), 2500);
}

// Колесо
function showWheel() { showView('wheel'); renderWheel(); }
function getWheelSpinDate() { return localStorage.getItem('wheel_spin_date'); }
function setWheelSpinDate() { localStorage.setItem('wheel_spin_date', new Date().toDateString()); }
function canSpinWheel() { return getWheelSpinDate() !== new Date().toDateString(); }
function getNextSpinTime() { const n = new Date(); n.setDate(n.getDate()+1); n.setHours(0,0,0,0); const d = n - new Date(); return Math.floor(d/3600000)+' ч '+Math.floor((d%3600000)/60000)+' мин'; }
function renderWheel() {
    const c = document.getElementById('view-wheel');
    if (!canSpinWheel()) { c.innerHTML = `<div class="wheel-container"><div class="wheel-title">🎡 Колесо фортуны</div><div class="wheel-subtitle">Вы уже крутили сегодня</div><div class="wheel-timer">Через ${getNextSpinTime()}</div><button class="wheel-btn" onclick="showCategories()">В каталог</button></div>`; return; }
    c.innerHTML = `<div class="wheel-container"><div class="wheel-title">🎡 Колесо фортуны</div><div class="wheel-subtitle">Крутите раз в день!</div><div class="wheel-wrapper"><div class="wheel-pointer"></div><canvas class="wheel-canvas" id="wheelCanvas" width="300" height="300"></canvas></div><button class="wheel-btn" id="spinBtn" onclick="spinWheel()">🎰 Крутить</button><div class="wheel-result" id="wheelResult"></div></div>`;
    drawWheel();
}
function drawWheel() { const cv = document.getElementById('wheelCanvas'); if (!cv) return; const ctx = cv.getContext('2d'), cx=150, cy=150, r=140; const sec = [{l:'10%',c:'#e8f5e9',t:'#2e7d32'},{l:'😔',c:'#f5f5f5',t:'#999'},{l:'20%',c:'#c8e6c9',t:'#1b5e20'},{l:'😔',c:'#f5f5f5',t:'#999'},{l:'10%',c:'#e8f5e9',t:'#2e7d32'},{l:'😔',c:'#f5f5f5',t:'#999'},{l:'20%',c:'#c8e6c9',t:'#1b5e20'},{l:'😔',c:'#f5f5f5',t:'#999'}]; const a = 2*Math.PI/sec.length; sec.forEach((s,i)=>{const sa=i*a-Math.PI/2,ea=(i+1)*a-Math.PI/2; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,sa,ea); ctx.closePath(); ctx.fillStyle=s.c; ctx.fill(); ctx.strokeStyle='#e0e0e0'; ctx.lineWidth=2; ctx.stroke(); ctx.save(); ctx.translate(cx,cy); ctx.rotate(sa+a/2); ctx.textAlign='right'; ctx.fillStyle=s.t; ctx.font='bold 16px sans-serif'; ctx.fillText(s.l,r-20,6); ctx.restore(); }); }
function spinWheel() { const btn=document.getElementById('spinBtn'),rd=document.getElementById('wheelResult'); if(!canSpinWheel()){rd.style.display='block';rd.className='wheel-result lose';rd.textContent='Уже крутили';return;} btn.disabled=true;rd.style.display='none';setWheelSpinDate(); const res=[{d:10,l:'10%',p:'WHEEL10'},{d:0,l:'Пусто',p:null},{d:20,l:'20%',p:'WHEEL20'},{d:0,l:'Пусто',p:null},{d:10,l:'10%',p:'WHEEL10'},{d:0,l:'Пусто',p:null},{d:20,l:'20%',p:'WHEEL20'},{d:0,l:'Пусто',p:null}]; const idx=Math.floor(Math.random()*8),re=res[idx],sa=360/8,ta=360*5+(360-idx*sa-sa/2); const cv=document.getElementById('wheelCanvas'); cv.style.transition='transform 4s cubic-bezier(0.17,0.67,0.12,0.99)'; cv.style.transform=`rotate(${ta}deg)`; setTimeout(()=>{rd.style.display='block'; if(re.d>0){rd.className='wheel-result win';rd.innerHTML=`🎉 Скидка <b>${re.d}%</b>!<br>Промокод: <b>${re.p}</b><br><small>Применён к корзине</small>`; state.promocodeDiscount=re.d; state.promocodeCode=re.p; saveCart(); toast('🎉 Промокод '+re.p+' на '+re.d+'%');} else {rd.className='wheel-result lose';rd.textContent='😔 Не повезло. Завтра!';} btn.textContent='Готово';},4200); }

// Старт
async function init() { try { state.currencyRates = await API.getRates(); } catch (e) {} updateBadge(); showCategories(); document.getElementById('backBtn').addEventListener('click', goBack); document.getElementById('cartBtn').addEventListener('click', () => { state.viewHistory.push(state.currentView); showCart(); }); }
document.addEventListener('DOMContentLoaded', init);