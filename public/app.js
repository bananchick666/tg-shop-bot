const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const state = {
    currentView: 'categories', currentCategory: null, currentProduct: null,
    cart: JSON.parse(localStorage.getItem('cart') || '[]'),
    promocodeDiscount: 0, promocodeCode: '',
    currencyRates: { USD: 3.25, RUB: 28.5 },
    deliveryType: null, selectedSize: null, selectedColor: null,
    viewHistory: ['categories'], detailImageIndex: 0, allProducts: []
};

const API = {
    async getProducts(cat, params = {}) {
        const q = new URLSearchParams(params).toString();
        const r = await fetch(`/api/products/${cat}${q?'?'+q:''}`);
        return r.json();
    },
    async getProduct(id) { const r = await fetch(`/api/product/${id}`); return r.json(); },
    async validatePromo(code) {
        const r = await fetch('/api/validate-promocode', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code}) });
        return r.json();
    },
    async getRates() { try { const r = await fetch('/api/currency-rates'); return r.json(); } catch(e) { return {USD:3.25,RUB:28.5}; } },
    async submitOrder(order) {
        const r = await fetch('/api/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(order) });
        return r.json();
    }
};

const fPrice = p => p.toLocaleString('ru-BY') + ' BYN';
const conv = p => ({ usd: (p/state.currencyRates.USD).toFixed(2), rub: Math.round(p*state.currencyRates.RUB) });

function toast(m) {
    const o = document.querySelector('.toast'); if(o) o.remove();
    const t = document.createElement('div'); t.className='toast'; t.textContent=m;
    document.body.appendChild(t);
    setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300)},2000);
}

function showView(name) {
    document.querySelectorAll('.view').forEach(v=>v.style.display='none');
    const v = document.getElementById('view-'+name); if(v) v.style.display='block';
    state.currentView=name;
    document.getElementById('backBtn').style.visibility=name==='categories'?'hidden':'visible';
    document.getElementById('headerTitle').textContent=name==='categories'?'FLASHMARKET':name==='products'?(state.currentCategory==='shoes'?'Обувь':'Техника'):name==='cart'?'Корзина':name==='checkout'?'Оформление':'Товар';
    if(state.viewHistory[state.viewHistory.length-1]!==name) state.viewHistory.push(name);
    window.scrollTo(0,0);
}

function goBack() {
    state.viewHistory.pop();
    const p = state.viewHistory[state.viewHistory.length-1]||'categories';
    switch(p){
        case 'categories': showCategories(); break;
        case 'products': showProducts(state.currentCategory); break;
        case 'product': if(state.currentProduct) showProductDetail(state.currentProduct.id); break;
        case 'cart': showCart(); break;
    }
}

// Categories
function showCategories() {
    showView('categories');
    state.currentCategory=null;
    state.viewHistory=['categories'];
    document.getElementById('view-categories').innerHTML = `
    <div class="categories-grid">
        <div class="category-card" onclick="showProducts('shoes')">
            <div class="category-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 16c.5-2 2-4 4-5 2 2 3 3 6 3s4-1 6-3c2 1 3.5 3 4 5"/><path d="M20 16c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2"/></svg>
            </div>
            <div class="category-info"><div class="category-name">Обувь</div><div class="category-desc">Кроссовки, кеды, бутсы</div></div>
            <div class="category-arrow">&rsaquo;</div>
        </div>
        <div class="category-card" onclick="showProducts('tech')">
            <div class="category-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="18" x2="16" y2="18"/></svg>
            </div>
            <div class="category-info"><div class="category-name">Техника</div><div class="category-desc">Наушники, геймпады</div></div>
            <div class="category-arrow">&rsaquo;</div>
        </div>
    </div>`;
}

// Products
async function showProducts(cat) {
    showView('products'); state.currentCategory=cat; await loadProducts();
}

async function loadProducts() {
    const sortS = document.getElementById('sortSelect')?.value;
    const sizeS = document.getElementById('sizeSelect')?.value;
    const params = {};
    if(sortS){const [s,o]=sortS.split('_');params.sort=s;params.order=o;}
    if(sizeS) params.size=sizeS;
    try {
        const products = await API.getProducts(state.currentCategory, params);
        state.allProducts = products;
        renderGrid(products);
    } catch(e) {
        document.getElementById('view-products').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">Ошибка загрузки</div>';
    }
}

function renderGrid(products) {
    const sizeOpts = state.currentCategory==='shoes'?[38,39,40,41,42,43,44,45,46]:[];
    document.getElementById('view-products').innerHTML = `
        <div class="filters-bar">
            <select class="filter-select" id="sortSelect" onchange="loadProducts()">
                <option value="">Сортировка</option>
                <option value="price_asc">Цена: по возрастанию</option>
                <option value="price_desc">Цена: по убыванию</option>
                <option value="name_asc">Название: А-Я</option>
                <option value="name_desc">Название: Я-А</option>
            </select>
            ${sizeOpts.length?`<select class="filter-select" id="sizeSelect" onchange="loadProducts()"><option value="">Размер</option>${sizeOpts.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>`:''}
        </div>
        <div class="products-grid">${products.length?products.map(p=>{
            const c=conv(p.price);
            return `<div class="product-card">
                <div class="product-image-container" id="cg-${p.id}">
                    <img class="product-image" src="${p.images[0]}" alt="${p.name}" data-pid="${p.id}" data-idx="0" onerror="this.style.background='#eee'">
                    ${p.images.length>1?`
                    <div class="gallery-touch-left" data-a="prev" data-pid="${p.id}"></div>
                    <div class="gallery-touch-right" data-a="next" data-pid="${p.id}"></div>
                    <button class="gallery-arrow prev" data-a="prev" data-pid="${p.id}">&#8249;</button>
                    <button class="gallery-arrow next" data-a="next" data-pid="${p.id}">&#8250;</button>
                    <div class="image-dots">${p.images.map((_,i)=>`<span class="image-dot${i===0?' active':''}" data-pid="${p.id}" data-d="${i}"></span>`).join('')}</div>`:''}
                </div>
                <div class="product-info" onclick="showProductDetail(${p.id})">
                    <div class="product-brand">${p.brand||''}</div>
                    <div class="product-name">${p.name}</div>
                    <div class="product-condition">${p.condition||''}</div>
                    <div class="product-price">${fPrice(p.price)}</div>
                    <div class="product-price-other">~ $${c.usd} / ${c.rub} RUB</div>
                </div>
            </div>`;
        }).join(''):'<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-secondary);">Товары не найдены</div>'}</div>`;

    // Навешиваем обработчики галереи
    document.querySelectorAll('[data-a]').forEach(el=>{
        el.addEventListener('click', function(e){
            e.stopPropagation();
            const pid = parseInt(this.dataset.pid);
            const product = state.allProducts.find(p=>p.id===pid);
            if(!product||!product.images||product.images.length<2) return;
            const img = document.querySelector(`img[data-pid="${pid}"]`);
            const dots = document.querySelectorAll(`.image-dot[data-pid="${pid}"]`);
            let idx = parseInt(img.dataset.idx);
            idx = this.dataset.a==='next' ? (idx+1)%product.images.length : (idx-1+product.images.length)%product.images.length;
            img.src = product.images[idx];
            img.dataset.idx = idx;
            dots.forEach((d,i)=>d.classList.toggle('active',i===idx));
        });
    });
}

// Detail
async function showProductDetail(id) {
    try {
        const p = await API.getProduct(id);
        if(!p) return;
        state.currentProduct=p; state.detailImageIndex=0;
        state.selectedSize=p.size?p.size[0]:null;
        state.selectedColor=p.colors?p.colors[0]:null;
        showView('product');
        document.getElementById('headerTitle').textContent=p.brand||'Товар';
        renderDetail();
    } catch(e) { toast('Ошибка загрузки'); }
}

function renderDetail() {
    const p = state.currentProduct;
    const c = conv(p.price);
    let h = `<div class="detail-gallery">
        <div class="detail-image-wrapper"><img class="detail-image" src="${p.images[state.detailImageIndex]}" id="dimg" alt="${p.name}"></div>
        ${p.images.length>1?`<button class="detail-nav-btn detail-nav-prev" onclick="dPrev()">&#8249;</button><button class="detail-nav-btn detail-nav-next" onclick="dNext()">&#8250;</button><div class="detail-dots-container">${p.images.map((_,i)=>`<span class="detail-dot${i===state.detailImageIndex?' active':''}" onclick="dSet(${i})"></span>`).join('')}</div>`:''}
    </div>
    <div class="detail-body">
        <div class="detail-brand">${p.brand||''}</div>
        <div class="detail-name">${p.name}</div>
        <div class="detail-condition">${p.condition||''}</div>
        <div class="detail-description">${p.description}</div>`;
    if(p.size&&p.size.length) {
        h+=`<div class="detail-section-title">Размер</div><div class="size-grid">${p.size.map(s=>`<button class="size-btn${s===state.selectedSize?' selected':''}" onclick="selSize(${s})">${s}</button>`).join('')}</div>`;
        if(p.sizeNote) h+=`<div style="font-size:11px;color:var(--text-muted);margin:-12px 0 14px;">${p.sizeNote}</div>`;
    }
    if(p.colors&&p.colors.length) h+=`<div class="detail-section-title">Цвет</div><div class="color-grid">${p.colors.map(cl=>`<button class="color-btn${cl===state.selectedColor?' selected':''}" onclick="selColor('${cl}')">${cl}</button>`).join('')}</div>`;
    h+=`<div class="detail-price-block"><span class="detail-price-main">${fPrice(p.price)}</span><span class="detail-price-converted">~ $${c.usd}<br>~ ${c.rub} RUB</span></div>
        <button class="btn-primary" onclick="addFromDetail()">Добавить в корзину</button></div>`;
    document.getElementById('view-product').innerHTML=h;
}

function dPrev(){const p=state.currentProduct;state.detailImageIndex=(state.detailImageIndex-1+p.images.length)%p.images.length;updateDImg();}
function dNext(){const p=state.currentProduct;state.detailImageIndex=(state.detailImageIndex+1)%p.images.length;updateDImg();}
function dSet(i){state.detailImageIndex=i;updateDImg();}
function updateDImg(){
    const img=document.getElementById('dimg');if(img)img.src=state.currentProduct.images[state.detailImageIndex];
    document.querySelectorAll('.detail-dot').forEach((d,i)=>d.classList.toggle('active',i===state.detailImageIndex));
}
function selSize(s){state.selectedSize=s;document.querySelectorAll('.size-btn').forEach(b=>b.classList.toggle('selected',parseInt(b.textContent)===s));}
function selColor(c){state.selectedColor=c;document.querySelectorAll('.color-btn').forEach(b=>b.classList.toggle('selected',b.textContent===c));}

// Cart
function addFromDetail(){addToCart(state.currentProduct,state.selectedSize,state.selectedColor);}
function addToCart(p,size,color){
    const item={id:p.id,name:p.name,price:p.price,size:size||null,color:color||null,image:p.images?.[0]||'',category:state.currentCategory};
    if(!state.cart.find(i=>i.id===item.id&&i.size===item.size&&i.color===item.color)){
        state.cart.push(item);saveCart();updateBadge();toast('Добавлено в корзину');
    } else toast('Уже в корзине');
}
function removeFromCart(i){state.cart.splice(i,1);saveCart();updateBadge();showCart();}
function saveCart(){localStorage.setItem('cart',JSON.stringify(state.cart));}
function updateBadge(){
    const b=document.getElementById('cartBadge');const n=state.cart.length;
    b.style.display=n?'flex':'none';if(n)b.textContent=n;
}
function getTotal(){const s=state.cart.reduce((a,i)=>a+i.price,0);return state.promocodeDiscount?Math.round(s*(1-state.promocodeDiscount/100)):s;}

function showCart(){showView('cart');renderCart();}
function renderCart(){
    const c=document.getElementById('view-cart');
    if(!state.cart.length){c.innerHTML='<div class="cart-empty"><div class="cart-empty-text">Корзина пуста</div><div class="cart-empty-sub">Добавьте товары из каталога</div></div>';return;}
    const sub=state.cart.reduce((a,i)=>a+i.price,0),total=getTotal(),disc=sub-total;
    c.innerHTML=`<div class="cart-items">${state.cart.map((it,i)=>`<div class="cart-item">
        <img class="cart-item-image" src="${it.image}" alt="${it.name}">
        <div class="cart-item-info"><div class="cart-item-name">${it.name}</div><div class="cart-item-meta">${it.size?'Размер '+it.size:''}${it.color?' | '+it.color:''}</div><div class="cart-item-price">${fPrice(it.price)}</div></div>
        <button class="cart-item-remove" onclick="removeFromCart(${i})">&times;</button></div>`).join('')}</div>
    <div class="promo-section"><div class="promo-label">Промокод</div><div class="promo-input-row"><input class="promo-input" id="pi" type="text" placeholder="Введите код" value="${state.promocodeCode}"><button class="btn-promo" onclick="applyPromo()">Применить</button></div><div class="promo-message" id="pm"></div></div>
    <div class="cart-summary"><div class="summary-row"><span>Товары (${state.cart.length})</span><span>${fPrice(sub)}</span></div>${disc>0?`<div class="summary-row summary-discount"><span>Скидка (${state.promocodeDiscount}%)</span><span>-${fPrice(disc)}</span></div>`:''}<div class="summary-row total"><span>Итого</span><span>${fPrice(total)}</span></div></div>
    <button class="btn-checkout" onclick="startCheckout()">Оформить заказ</button>`;
}

async function applyPromo(){
    const input=document.getElementById('pi'),msg=document.getElementById('pm'),code=input.value.trim().toUpperCase();
    if(!code){msg.className='promo-message error';msg.textContent='Введите промокод';return;}
    const r=await API.validatePromo(code);
    if(r.valid){state.promocodeDiscount=r.discount;state.promocodeCode=code;msg.className='promo-message success';msg.textContent='Скидка '+r.discount+'% применена';renderCart();}
    else{state.promocodeDiscount=0;state.promocodeCode='';msg.className='promo-message error';msg.textContent='Недействительный промокод';}
}

// Checkout
function startCheckout(){if(!state.cart.length){toast('Корзина пуста');return;}showView('checkout');state.deliveryType=null;renderCheckout();}
function renderCheckout(){
    const total=getTotal();
    document.getElementById('view-checkout').innerHTML=`<div class="checkout-form">
        <div class="checkout-title">Оформление заказа</div><div class="checkout-subtitle">Сумма: ${fPrice(total)}</div>
        <div class="delivery-options">
            <div class="delivery-option${state.deliveryType==='pickup'?' selected':''}" onclick="selDel('pickup')"><div class="delivery-option-name">Самовывоз</div><div class="delivery-option-desc">Гомель</div></div>
            <div class="delivery-option${state.deliveryType==='delivery'?' selected':''}" onclick="selDel('delivery')"><div class="delivery-option-name">Доставка</div><div class="delivery-option-desc">Почтой</div></div>
        </div>${state.deliveryType?formFields():''}</div>`;
}
function selDel(t){state.deliveryType=t;renderCheckout();}
function formFields(){
    const u=tg.initDataUnsafe?.user?.username||'',fn=tg.initDataUnsafe?.user?.first_name||'';
    if(state.deliveryType==='pickup') return `<div class="form-section"><div class="form-group"><label class="form-label">Telegram</label><input class="form-input" id="tu" type="text" placeholder="@username" value="${u}"></div></div><button class="btn-submit" onclick="submitOrder()">Подтвердить заказ</button>`;
    return `<div class="form-section">
        <div class="form-group"><label class="form-label">Фамилия</label><input class="form-input" id="ln" type="text" placeholder="Иванов"></div>
        <div class="form-group"><label class="form-label">Имя</label><input class="form-input" id="fn" type="text" placeholder="Иван" value="${fn}"></div>
        <div class="form-group"><label class="form-label">Отчество</label><input class="form-input" id="mn" type="text" placeholder="Иванович"></div>
        <div class="form-group"><label class="form-label">Телефон</label><input class="form-input" id="ph" type="tel" placeholder="+375 XX XXX-XX-XX"></div>
        <div class="form-group"><label class="form-label">Адрес Европочты</label><input class="form-input" id="ep" type="text" placeholder="Город, отделение"></div>
        <div class="form-group"><label class="form-label">Telegram</label><input class="form-input" id="tu" type="text" placeholder="@username" value="${u}"></div>
    </div><button class="btn-submit" onclick="submitOrder()">Подтвердить заказ</button>`;
}

async function submitOrder(){
    const isP=state.deliveryType==='pickup';
    const tgU=(document.getElementById('tu')?.value||'').trim().replace('@','');
    if(!tgU){toast('Введите Telegram username');return;}
    if(!isP){
        if(!document.getElementById('fn')?.value.trim()){toast('Введите имя');return;}
        if(!document.getElementById('ph')?.value.trim()){toast('Введите телефон');return;}
        if(!document.getElementById('ep')?.value.trim()){toast('Введите адрес');return;}
    }
    const order={
        items:state.cart.map(i=>({name:i.name,price:i.price,size:i.size,color:i.color})),
        total:getTotal(),discount:state.promocodeDiscount,promocode:state.promocodeCode,
        delivery:state.deliveryType,telegramUsername:tgU,
        firstName:isP?'':(document.getElementById('fn')?.value||'').trim(),
        lastName:isP?'':(document.getElementById('ln')?.value||'').trim(),
        middleName:isP?'':(document.getElementById('mn')?.value||'').trim(),
        phone:isP?'':(document.getElementById('ph')?.value||'').trim(),
        europostAddress:isP?'':(document.getElementById('ep')?.value||'').trim()
    };
    if(tg.sendData) tg.sendData(JSON.stringify({action:'order',order}));
    try{await API.submitOrder(order);}catch(e){}
    state.cart=[];state.promocodeDiscount=0;state.promocodeCode='';saveCart();updateBadge();
    document.getElementById('view-checkout').innerHTML=`<div class="checkout-form" style="text-align:center;">
        <div class="success-text">&#10003; Заказ оформлен</div><div class="checkout-subtitle">Скоро с вами свяжутся</div>
        <button class="btn-primary" onclick="showCategories()" style="margin-top:12px;">В каталог</button></div>`;
    setTimeout(()=>tg.close(),2500);
}

// Init
async function init(){
    try{state.currencyRates=await API.getRates();}catch(e){}
    updateBadge();
    showCategories();
    document.getElementById('backBtn').addEventListener('click',goBack);
    document.getElementById('cartBtn').addEventListener('click',()=>{state.viewHistory.push(state.currentView);showCart();});
}
document.addEventListener('DOMContentLoaded',init);