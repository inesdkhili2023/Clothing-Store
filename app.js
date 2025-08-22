
const supabaseUrl = 'https://emcffxoyfetkkcnlofpk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY2ZmeG95ZmV0a2tjbmxvZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NTU1MzMsImV4cCI6MjA3MDUzMTUzM30.CDeP5WUIAoTE4K6AEwHFIjtcOwbyx4Nr1AVZ0yBuLXE';

let supabaseClient = null;
let currentAdmin = null;
let products = [];
let cart = [];
let orders = [];
let editingProduct = null; // Pour l'édition

/* Demo products (used if Supabase absent) */
const demoProducts = [
  { id: 1, name: "Robe Satin Élégante", description: "Magnifique robe en satin premium...", price: 249.00, category: "robes", subcategory:"soirée", stock: 15, image_url: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&h=1000&fit=crop" },
  { id: 2, name: "Blouse Soie Moderne", description: "Blouse en soie naturelle...", price: 189.00, category: "tops", subcategory:"soie", stock: 22, image_url: "https://images.unsplash.com/photo-1564257577154-75b6b8842501?w=800&h=1000&fit=crop" },
  { id: 3, name: "Pantalon Tailleur Premium", description: "Pantalon de tailleur en laine stretch...", price: 159.00, category: "pantalons", subcategory:"tailleur", stock: 18, image_url: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&h=1000&fit=crop" },
  { id: 4, name: "Jupe Midi Plissée Luxe", description: "Jupe midi en tissu fluide premium...", price: 129.00, category: "jupes", subcategory:"plissée", stock: 12, image_url: "https://images.unsplash.com/photo-1583496661160-fb5886a13d27?w=800&h=1000&fit=crop" },
  { id: 5, name: "Blazer Couture Moderne", description: "Blazer structuré avec détails couture...", price: 279.00, category: "vestes", subcategory:"coton", stock: 8, image_url: "https://images.unsplash.com/photo-1544957992-20514f595d6f?w=800&h=1000&fit=crop" },
  { id: 6, name: "Sac Cuir Premium", description: "Sac à main en cuir italien véritable...", price: 329.00, category: "accessoires", subcategory:"sacs", stock: 6, image_url: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=1000&fit=crop" },
  { id: 7, name: "Robe Cocktail Glamour", description: "Robe de cocktail avec sequins délicats...", price: 369.00, category: "robes", subcategory:"cocktail", stock: 5, image_url: "https://images.unsplash.com/photo-1566479179817-c06fce2a9a5b?w=800&h=1000&fit=crop" },
  { id: 8, name: "Chemisier Créateur", description: "Chemisier design avec imprimé exclusif...", price: 149.00, category: "tops", subcategory:"chemise", stock: 14, image_url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=1000&fit=crop" }
];
function calculatePromoPrice(originalPrice, promoPercent) {
  if (!promoPercent || promoPercent <= 0) return originalPrice;
  return originalPrice * (1 - promoPercent / 100);
}

/* ========== UTILITAIRES ========== */
function formatPrice(n){ return (Number(n)||0).toFixed(2); }
function escapeHtml(s){ if(!s) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function closeModal(id){ const m = document.getElementById(id); if(m) m.classList.remove('active'); }
function showModal(id){ const m = document.getElementById(id); if(m) m.classList.add('active'); }
function showNotification(msg, type='info'){
  const t = document.createElement('div');
  t.style.position='fixed'; t.style.right='20px'; t.style.bottom='20px';
  t.style.background=(type==='error'?'#ef5350': type==='success'?'#16a34a':'#2563eb');
  t.style.color='white'; t.style.padding='10px 14px'; t.style.borderRadius='10px'; t.style.zIndex=9999;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 2600);
}

/* ========== NAVIGATION HELPERS ========== */
function hideHeader(){
  const header = document.querySelector('header');
  const hero = document.querySelector('.hero-section');
  const filters = document.querySelector('.bg-white.border-b');
  const footer = document.querySelector('footer');
  const productsSection = document.getElementById('products-section');
  
  if(header) header.classList.add('hidden');
  if(hero) hero.classList.add('hidden');
  if(filters) filters.classList.add('hidden');
  if(footer) footer.classList.add('hidden');
  if(productsSection) productsSection.classList.add('hidden');
}

function showHeader(){
  const header = document.querySelector('header');
  const hero = document.querySelector('.hero-section');
  const filters = document.querySelector('.bg-white.border-b');
  const footer = document.querySelector('footer');
  const productsSection = document.getElementById('products-section');
  
  if(header) header.classList.remove('hidden');
  if(hero) hero.classList.remove('hidden');
  if(filters) filters.classList.remove('hidden');
  if(footer) footer.classList.remove('hidden');
  if(productsSection) productsSection.classList.remove('hidden');
}

/* ========== CATEGORIES (tree) ========== */
let categoryTree = {}; // {cat: Set(subs)}

function buildCategoryTree(){
  categoryTree = {};
  (products || []).forEach(p=>{
    const c = p.category || 'Autres';
    const s = p.subcategory || '';
    if(!categoryTree[c]) categoryTree[c] = new Set();
    if(s) categoryTree[c].add(s);
  });
  renderCategoryPanel();
  populateFilterSelects();
}

function renderCategoryPanel(){
  const panel = document.getElementById('categories-panel');
  if(!panel) return;
  panel.innerHTML = '';
  Object.keys(categoryTree).forEach(cat=>{
    const div = document.createElement('div');
    div.className = 'cat';
    div.innerHTML = `<strong>${getCategoryName(cat)}</strong>`;
    if(categoryTree[cat].size){
      const ul = document.createElement('div'); ul.style.fontSize='13px'; ul.style.marginTop='6px';
      Array.from(categoryTree[cat]).slice(0,20).forEach(sub=>{
        const subbtn = document.createElement('div');
        subbtn.className='sub';
        subbtn.textContent = sub;
        subbtn.onclick = (e) => {
          e.stopPropagation();
          document.getElementById('filter-category').value = cat;
          onCategoryChange();
          document.getElementById('filter-subcategory').value = sub;
          applyFilters();
          panel.classList.add('hidden');
        };
        ul.appendChild(subbtn);
      });
      div.appendChild(ul);
    }
    div.onclick = ()=> {
      document.getElementById('filter-category').value = cat;
      onCategoryChange();
      applyFilters();
      panel.classList.add('hidden');
    };
    panel.appendChild(div);
  });
}

function populateFilterSelects(){
  const selCat = document.getElementById('filter-category');
  const selSub = document.getElementById('filter-subcategory');
  if(!selCat || !selSub) return;
  const cats = Object.keys(categoryTree);
  selCat.innerHTML = '<option value="">Toutes</option>' + cats.map(c=>`<option value="${c}">${getCategoryName(c)}</option>`).join('');
  selSub.innerHTML = '<option value="">Toutes</option>';
}

function onCategoryChange(){
  const cat = document.getElementById('filter-category').value;
  const selSub = document.getElementById('filter-subcategory');
  selSub.innerHTML = '<option value="">Toutes</option>';
  if(cat && categoryTree[cat]) Array.from(categoryTree[cat]).forEach(s=>{
    const opt = document.createElement('option'); opt.value = s; opt.textContent = s; selSub.appendChild(opt);
  });
  applyFilters();
}

/* ========== LOAD / RENDER PRODUITS ========== */
async function loadProducts(){
  try {
    if(!supabaseClient){ products = demoProducts.slice(); buildCategoryTree(); renderProducts(); return; }
    const { data, error } = await supabaseClient.from('products').select('*').order('created_at',{ascending:false});
    if(error){ console.error('Erreur chargement produits', error); products = demoProducts.slice(); }
    else products = (data && data.length>0) ? data : demoProducts.slice();
  } catch(err){ console.error('loadProducts', err); products = demoProducts.slice(); }
  buildCategoryTree();
  renderProducts();
  updateAdminProductsTable();
}

function renderProducts(list){
  const container = document.getElementById('products-grid');
  if(!container) return;
  const arr = list || products;
  if(arr.length===0){ container.innerHTML = '<p style="padding:30px;text-align:center;color:#777">Aucun produit trouvé</p>'; document.getElementById('results-info').textContent='0 produit(s)'; return; }
  container.innerHTML = arr.map(p=>{
    const hasPromo = p.promo && p.promo > 0;
    const originalPrice = p.price || 0;
    const promoPrice = hasPromo ? calculatePromoPrice(originalPrice, p.promo) : originalPrice;
    
    return `
    <article class="product-card" data-id="${p.id}">
      <div class="product-image-container" onclick="showProductDetail(${p.id})">
        ${hasPromo ? `<div class="promo-badge">-${p.promo}%</div>` : ''}
        <img class="product-image" src="${p.image_url}" alt="${escapeHtml(p.name)}" onerror="this.src='https://via.placeholder.com/600x800?text=Image'"/>
        <div class="product-overlay">
          <button class="quick-view-btn" onclick="(function(e){e.stopPropagation(); showProductDetail(${p.id});})(event)"><i class="fas fa-eye"></i> Aperçu</button>
        </div>
      </div>
      <div class="product-info">
        <div class="product-category">${escapeHtml(getCategoryName(p.category))}</div>
        <div class="product-title">${escapeHtml(p.name)}</div>
        <div class="product-price">
          ${hasPromo ? 
            `<span class="original-price">${formatPrice(originalPrice)} DT</span>
             <span class="promo-price">${formatPrice(promoPrice)} DT</span>` :
            `${formatPrice(originalPrice)} DT`
          }
        </div>
        <p style="color:var(--muted);font-size:0.9rem;line-height:1.4">${escapeHtml(String(p.description||'')).slice(0,130)}</p>
        <div class="product-actions" style="margin-top:12px">
          <button class="btn-add-cart" onclick="(function(e){ e.stopPropagation(); addToCart(${p.id}); })(event)" ${p.stock<=0? 'disabled':''}>
            <i class="fas fa-shopping-bag"></i> ${p.stock<=0? 'Épuisé':'Ajouter au panier'}
          </button>
          <button class="btn-wishlist" onclick="(function(e){ e.stopPropagation(); toggleWishlist(${p.id}); })(event)"><i class="fas fa-heart"></i></button>
        </div>
        ${p.stock <= 5 && p.stock > 0 ? `<div style="color:var(--accent-2);font-size:0.85rem;margin-top:8px;font-weight:600"><i class="fas fa-exclamation-triangle"></i> Plus que ${p.stock} en stock</div>` : ''}
      </div>
    </article>
  `;
  }).join('');
  document.getElementById('results-info').textContent = `${arr.length} produit(s)`;
}

/* ========== FILTRAGE / RECHERCHE / TRI ========== */
function applySearch(){
  const q = document.getElementById('search-input').value || '';
  applyFilters({search:q});
}

function applyFilters(extra){
  let list = (products||[]).slice();
  const cat = document.getElementById('filter-category') ? document.getElementById('filter-category').value : '';
  const sub = document.getElementById('filter-subcategory') ? document.getElementById('filter-subcategory').value : '';
  const sort = document.getElementById('filter-sort') ? document.getElementById('filter-sort').value : 'new';
  const search = (extra && extra.search) || (document.getElementById('search-input') ? document.getElementById('search-input').value.trim().toLowerCase() : '');

  if(cat) list = list.filter(p => (p.category||'').toString() === cat);
  if(sub) list = list.filter(p => (p.subcategory||'').toString() === sub);
  if(search){
    list = list.filter(p => (p.name||'').toLowerCase().includes(search) || (p.description||'').toLowerCase().includes(search));
  }
  if(sort === 'price_asc') list.sort((a,b)=> (a.price||0)-(b.price||0));
  else if(sort === 'price_desc') list.sort((a,b)=> (b.price||0)-(a.price||0));
  else list.sort((a,b)=> (b.id||0)-(a.id||0));

  renderProducts(list);
}

function resetFilters(){
  const filterCategory = document.getElementById('filter-category');
  const filterSubcategory = document.getElementById('filter-subcategory');
  const filterSort = document.getElementById('filter-sort');
  const searchInput = document.getElementById('search-input');
  
  if(filterCategory) filterCategory.value='';
  if(filterSubcategory) filterSubcategory.value='';
  if(filterSort) filterSort.value='new';
  if(searchInput) searchInput.value='';
  renderProducts(products);
}

/* ========== PRODUCT DETAIL (QUICK VIEW) ========== */
function showProductDetail(productId){
  const p = (products||[]).find(x=>x.id === productId);
  if(!p) return;
  const modal = document.getElementById('product-detail-modal');
  const gallery = document.getElementById('detail-gallery');
  const info = document.getElementById('detail-info');
  if(!modal || !gallery || !info) return;

  // create images array
  const imgs = [];
  if(p.image_url) imgs.push(p.image_url);
  if(!p.image_url.includes('?')) imgs.push(p.image_url + '?auto=format&w=900');
  imgs.push(p.image_url + '&q=60');

  // gallery
  gallery.innerHTML = `
    <div class="detail-main"><img id="detail-main-img" src="${imgs[0]}" alt="${escapeHtml(p.name)}"></div>
    <div class="detail-thumbs" id="detail-thumbs">${imgs.map((u,i)=>`<img src="${u}" data-idx="${i}" class="${i===0?'active':''}" onclick="detailThumbClick(this)"/>`).join('')}</div>
  `;

  // Calculer les prix
  const hasPromo = p.promo && p.promo > 0;
  const originalPrice = p.price || 0;
  const promoPrice = hasPromo ? calculatePromoPrice(originalPrice, p.promo) : originalPrice;

  // info
  info.innerHTML = `
    <h2>${escapeHtml(p.name)}</h2>
    ${hasPromo ? `<div class="promo-info"><span class="promo-percent">-${p.promo}% DE RÉDUCTION</span></div>` : ''}
    <div class="price">
      ${hasPromo ? 
        `<span class="original-price-large">${formatPrice(originalPrice)} DT</span>
         <span class="promo-price-large">${formatPrice(promoPrice)} DT</span>` :
        `${formatPrice(originalPrice)} DT`
      }
    </div>
    <div style="color:var(--muted);margin-top:8px">${escapeHtml(p.description || '')}</div>
    <div style="margin-top:12px"><strong>Catégorie:</strong> ${escapeHtml(getCategoryName(p.category))}${p.subcategory ? ' / ' + escapeHtml(p.subcategory) : ''}</div>
    <div class="qty-row" style="margin-top:16px;">
      <label>Quantité:</label>
      <button class="qty-btn" onclick="changeDetailQty(-1)">-</button>
      <span id="detail-qty">1</span>
      <button class="qty-btn" onclick="changeDetailQty(1)">+</button>
      <span style="margin-left:12px;color:${p.stock>0?'#0b6':'#c66'};font-weight:700">${p.stock} en stock</span>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px;align-items:center">
      <button class="btn-add-cart" onclick="addToCartFromDetail(${p.id})" style="flex:1;padding:12px;"><i class="fas fa-shopping-bag"></i> Ajouter au panier</button>
      <button class="btn-wishlist" onclick="toggleWishlist(${p.id})" style="padding:12px;"><i class="fas fa-heart"></i></button>
    </div>
  `;

  modal.dataset.productId = p.id;
  modal.dataset.qty = 1;
  showModal('product-detail-modal');
}


function detailThumbClick(imgEl){
  document.getElementById('detail-main-img').src = imgEl.src;
  document.querySelectorAll('#detail-thumbs img').forEach(i => i.classList.remove('active'));
  imgEl.classList.add('active');
}

function changeDetailQty(delta){
  const modal = document.getElementById('product-detail-modal');
  if(!modal) return;
  let qty = parseInt(modal.dataset.qty || "1",10) + delta;
  if(qty < 1) qty = 1;
  modal.dataset.qty = qty;
  document.getElementById('detail-qty').textContent = qty;
}

function addToCartFromDetail(productId){
  const modal = document.getElementById('product-detail-modal');
  const qty = parseInt(modal.dataset.qty || "1",10);
  const product = (products||[]).find(p=>p.id===productId);
  if(!product) return;
  const existing = cart.find(i=>i.productId===productId);
  if(existing){
    if(existing.quantity + qty > product.stock){ showNotification('Stock insuffisant','error'); return; }
    existing.quantity += qty;
  } else {
    if(qty > product.stock){ showNotification('Stock insuffisant','error'); return; }
    cart.push({ productId, quantity: qty });
  }
  saveCartToStorage(); updateCartCount(); showNotification('Produit ajouté au panier!','success');
  closeModal('product-detail-modal');
}

/* ========== WISHLIST (placeholder) ========== */
function toggleWishlist(id){ showNotification('Produit ajouté à la liste de souhaits','success'); }

/* ========== CART ========== */
function addToCart(productId){
  const product = products.find(p => p.id === productId);
  if(!product || product.stock <= 0){ showNotification('Produit indisponible','error'); return; }
  const existing = cart.find(i=>i.productId === productId);
  if(existing){
    if(existing.quantity >= product.stock){ showNotification('Stock insuffisant','error'); return; }
    existing.quantity++;
  } else cart.push({ productId, quantity: 1 });
  updateCartCount(); saveCartToStorage(); showNotification('Produit ajouté au panier!','success');
}

function removeFromCart(productId){
  cart = cart.filter(i => i.productId !== productId);
  saveCartToStorage(); updateCartCount(); renderCart();
}

function updateCartQuantity(productId, newQty){
  if(newQty <= 0){ removeFromCart(productId); return; }
  const product = products.find(p=>p.id === productId);
  if(product && newQty > product.stock){ showNotification('Stock insuffisant','error'); return; }
  const it = cart.find(i => i.productId === productId);
  if(it){ it.quantity = newQty; saveCartToStorage(); updateCartCount(); renderCart(); }
}

function updateCartCount(){
  const count = cart.reduce((s,i)=>s+i.quantity,0);
  const el = document.getElementById('cart-count'); if(el) el.textContent = count;
}

function saveCartToStorage(){ localStorage.setItem('elyna_cart', JSON.stringify(cart)); }
function loadCartFromStorage(){ try{ const s = localStorage.getItem('elyna_cart'); if(s){ cart = JSON.parse(s); updateCartCount(); } } catch(e){ cart = []; } }

function renderCart(){
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  if(!container) return;
  if(cart.length === 0){ 
    container.innerHTML = `<div class="empty-cart text-center py-8"><i class="fas fa-shopping-bag text-4xl text-gray-300 mb-4"></i><h3 class="text-lg font-medium mb-2">Votre panier est vide</h3><p class="text-gray-500">Ajoutez des articles pour commencer</p></div>`; 
    if(totalEl) totalEl.textContent = ''; 
    return; 
  }
  let total = 0;
  container.innerHTML = cart.map(it=>{
    const p = products.find(pp => pp.id === it.productId);
    if(!p) return '';
    const itemTotal = (p.price||0) * it.quantity;
    total += itemTotal;
    return `
      <div class="cart-item flex items-center gap-4 p-4 border-b">
        <img src="${p.image_url}" alt="${escapeHtml(p.name)}" class="w-16 h-16 object-cover rounded">
        <div style="flex:1">
          <div class="font-semibold">${escapeHtml(p.name)}</div>
          <div class="text-gray-600">${formatPrice(p.price)} DT</div>
          <div class="flex items-center gap-2 mt-2">
            <button class="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded flex items-center justify-center" onclick="updateCartQuantity(${p.id}, ${it.quantity-1})">-</button>
            <span class="w-8 text-center">${it.quantity}</span>
            <button class="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded flex items-center justify-center" onclick="updateCartQuantity(${p.id}, ${it.quantity+1})">+</button>
            <button class="ml-2 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm" onclick="removeFromCart(${p.id})"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="font-semibold text-accent">${itemTotal.toFixed(2)} DT</div>
      </div>
    `;
  }).join('');
  if(totalEl) totalEl.innerHTML = `<div class="text-lg font-semibold text-accent">Total: ${total.toFixed(2)} DT</div>`;
}

/* ========== CHECKOUT ========== */
function proceedToCheckout(){
  if(cart.length === 0){ showNotification('Votre panier est vide','error'); return; }
  renderCheckoutSummary();
  closeModal('cart-modal');
  showModal('checkout-modal');
}

function renderCheckoutSummary(){
  const container = document.getElementById('checkout-summary');
  let total = 0;
  const summaryHTML = cart.map(item=>{
    const product = products.find(p => p.id === item.productId);
    if(!product) return '';
    const itemTotal = product.price * item.quantity;
    total += itemTotal;
    return `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>${escapeHtml(product.name)} × ${item.quantity}</span><span style="font-weight:600">${itemTotal.toFixed(2)} DT</span></div>`;
  }).join('');
  const shippingFee = total >= 300 ? 0 : 15;
  const finalTotal = total + shippingFee;
  container.innerHTML = `${summaryHTML}<hr style="margin:12px 0;border:none;border-top:1px solid #eee"><div style="display:flex;justify-content:space-between"><span>Sous-total:</span><span style="font-weight:600">${total.toFixed(2)} DT</span></div><div style="display:flex;justify-content:space-between"><span>Livraison:</span><span style="font-weight:600">${shippingFee===0?'Gratuite':shippingFee.toFixed(2)+' DT'}</span></div><hr style="margin:12px 0;border:none;border-top:2px solid var(--accent)"><div style="display:flex;justify-content:space-between;font-size:1.1rem;font-weight:700;color:var(--accent)"><span>Total:</span><span>${finalTotal.toFixed(2)} DT</span></div>`;
}

async function handleCheckout(e){
  e.preventDefault();
  const customerData = {
    firstname: document.getElementById('customer-firstname').value.trim(),
    lastname: document.getElementById('customer-lastname').value.trim(),
    email: document.getElementById('customer-email').value.trim(),
    phone: document.getElementById('customer-phone').value.trim(),
    address: document.getElementById('customer-address').value.trim(),
    governorate: document.getElementById('customer-governorate').value,
    payment_method: document.getElementById('payment-method').value,
    notes: document.getElementById('order-notes').value.trim()
  };
  const errorEl = document.getElementById('checkout-error'); if(errorEl) errorEl.classList.add('hidden');

  try {
    let subtotal = 0;
    const orderItems = cart.map(item=>{
      const product = products.find(p=>p.id === item.productId);
      if(!product) return null;
      const itotal = product.price * item.quantity; subtotal += itotal;
      return { product_id: item.productId, product_name: product.name, quantity: item.quantity, unit_price: product.price, total_price: itotal };
    }).filter(i=>i!==null);
    const shippingFee = subtotal >= 300 ? 0 : 15;
    const totalAmount = subtotal + shippingFee;
    const orderData = { customer_data: customerData, items: orderItems, subtotal, shipping_fee: shippingFee, total_amount: totalAmount, status: 'pending', order_date: new Date().toISOString() };

    if(supabaseClient){
const { error } = await supabaseClient.from('orders').insert(orderData);
      if(error) throw error;
      // update stocks
      for(const it of cart){
        const p = products.find(pp => pp.id === it.productId);
        if(p){
          const newStock = Math.max(0, p.stock - it.quantity);
          await supabaseClient.from('products').update({ stock: newStock }).eq('id', it.productId);
          p.stock = newStock;
        }
      }
    }

    cart = [];
    saveCartToStorage(); updateCartCount();
    closeModal('checkout-modal');
    // Générer un ID pour l'affichage de confirmation
orderData.id = Date.now() + Math.floor(Math.random()*1000);
showOrderSuccess(orderData);
    renderProducts();
  } catch(err){
    console.error('Erreur commande', err);
    if(errorEl){ errorEl.textContent = `Erreur lors de la commande: ${err.message || err}`; errorEl.classList.remove('hidden'); }
  }
}

function showOrderSuccess(orderData){
  const orderId = orderData.id || Math.floor(Math.random()*100000);
  const modal = document.createElement('div'); modal.className='modal active';
  modal.innerHTML = `<div class="modal-content" style="max-width:520px;text-align:center"><div style="background:linear-gradient(90deg,#10b981,#059669);padding:30px;border-radius:12px;color:white"><i class="fas fa-check-circle" style="font-size:48px;margin-bottom:10px"></i><h2>Commande confirmée!</h2><p>Votre commande #${orderId} a été enregistrée.</p></div><div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-top:16px;text-align:left"><strong>Client:</strong> ${escapeHtml(orderData.customer_data.firstname||'')} ${escapeHtml(orderData.customer_data.lastname||'')}<br><strong>Total:</strong> ${orderData.total_amount?.toFixed(2)} DT</div><button class="bg-accent hover:bg-accent-dark text-white px-6 py-3 rounded-full font-medium transition" style="width:100%;margin-top:16px" onclick="(function(){document.querySelector('.modal.active').remove(); showHome(); })()">Retour à l'accueil</button></div>`;
  document.body.appendChild(modal);
}

/* ========== AUTH ADMIN & ADMIN DASH ========== */
async function handleAdminLogin(e){
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const errorEl = document.getElementById('admin-error');
  if(errorEl) errorEl.classList.add('hidden');
  try {
    if(supabaseClient){
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
      if(authError) throw authError;
      const { data: adminData, error: adminError } = await supabaseClient.from('admin_users').select('id,email,role').eq('email', email).maybeSingle();
      if(adminError) throw adminError;
      if(!adminData){ await supabaseClient.auth.signOut(); throw new Error('Accès refusé : vous nêtes pas administrateur.'); }
      currentAdmin = { ...adminData };
    } else {
      // Mode demo - accepter n'importe quel email/password
      currentAdmin = { id: 1, email: email, role: 'admin' };
    }
    closeModal('admin-modal');
    showLogoutButton();
    showNotification('Connexion admin réussie !','success');
    showAdminDashboard();
  } catch(err){
    console.error('Erreur login admin', err);
    if(errorEl){ errorEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${err.message}`; errorEl.classList.remove('hidden'); }
  }
}

function showLogoutButton(){
  // Créer un bouton de déconnexion dans le header si pas déjà présent
  const header = document.querySelector('header .flex.items-center.space-x-4');
  if(header && !document.getElementById('logout-btn')){
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn';
    logoutBtn.className = 'bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full text-sm font-medium transition';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt mr-2"></i>Déconnexion';
    logoutBtn.onclick = logout;
    header.appendChild(logoutBtn);
  }
  const existingBtn = document.getElementById('logout-btn');
  if(existingBtn) existingBtn.classList.remove('hidden');
}

function hideLogoutButton(){
  const existingBtn = document.getElementById('logout-btn');
  if(existingBtn) existingBtn.classList.add('hidden');
}

async function logout(){
  try {
    if(supabaseClient) await supabaseClient.auth.signOut();
    currentAdmin = null;
    hideLogoutButton();
    showNotification('Déconnexion réussie','success');
    showHome();
  } catch(err){ console.error('logout', err); }
}

async function showAdminDashboard(){
  const adminSection = document.getElementById('admin-section');
  if(!adminSection) { 
    showNotification('Dashboard admin non disponible', 'info'); 
    return; 
  }

  // Masquer le header et les sections client
  hideHeader();

  // Afficher la section admin
  adminSection.classList.remove('hidden');

  // Charger données admin
  await loadOrders();
  await loadAdminStats();
  updateAdminProductsTable();
}

/* ========== ADMIN HELPERS ========== */
async function loadOrders(){
  if(!supabaseClient) { 
    // Mode demo avec quelques commandes fictives
    orders = [
      {
        id: 1,
        customer_data: { firstname: 'Ahmed', lastname: 'Ben Ali', email: 'ahmed@email.com', phone: '20123456' },
        total_amount: 349.00,
        status: 'pending',
        created_at: new Date().toISOString(),
        items: [{ product_name: 'Robe Satin Élégante', quantity: 1, total_price: 249.00 }]
      },
      {
        id: 2,
        customer_data: { firstname: 'Fatma', lastname: 'Trabelsi', email: 'fatma@email.com', phone: '25987654' },
        total_amount: 189.00,
        status: 'confirmed',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        items: [{ product_name: 'Blouse Soie Moderne', quantity: 1, total_price: 189.00 }]
      }
    ];
    renderOrdersTable(); 
    return; 
  }
  try {
    const { data, error } = await supabaseClient.from('orders').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    orders = data || [];
    renderOrdersTable();
  } catch(err){ console.error('loadOrders', err); }
}

function renderOrdersTable(){
  const container = document.getElementById('orders-table');
  if(!container) return;
  if(!orders || orders.length===0){ container.innerHTML = `<div style="text-align:center;color:#777;padding:30px">Aucune commande</div>`; return; }
  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white rounded-lg overflow-hidden shadow">
        <thead class="bg-beige">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-semibold">N°</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Client</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Contact</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Total</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Statut</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Date</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o=>`
            <tr class="border-b hover:bg-gray-50">
              <td class="px-4 py-3"><strong>#${o.id}</strong></td>
              <td class="px-4 py-3 font-medium">${escapeHtml(o.customer_data?.firstname||'')} ${escapeHtml(o.customer_data?.lastname||'')}</td>
              <td class="px-4 py-3">
                ${escapeHtml(o.customer_data?.email||'')}<br>
                <small class="text-gray-500">${escapeHtml(o.customer_data?.phone||'')}</small>
              </td>
              <td class="px-4 py-3 text-accent font-semibold">${(o.total_amount||0).toFixed(2)} DT</td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(o.status)}">${getStatusText(o.status)}</span>
              </td>
              <td class="px-4 py-3 text-sm">${new Date(o.created_at||o.order_date).toLocaleDateString('fr-FR')}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <select class="text-sm border rounded px-2 py-1" onchange="updateOrderStatus(${o.id}, this.value)">
                    <option value="pending" ${o.status==='pending'?'selected':''}>En attente</option>
                    <option value="confirmed" ${o.status==='confirmed'?'selected':''}>Confirmé</option>
                    <option value="delivered" ${o.status==='delivered'?'selected':''}>Livré</option>
                  </select>
                  <button class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm" onclick="viewOrderDetails(${o.id})">
                    <i class="fas fa-eye"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getStatusClass(status){
  const classes = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'confirmed': 'bg-blue-100 text-blue-800',
    'delivered': 'bg-green-100 text-green-800'
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
}

function viewOrderDetails(orderId){
  const o = orders.find(x => x.id === orderId);
  if(!o) return;
  const modal = document.createElement('div'); 
  modal.className='modal active';
  modal.innerHTML = `
    <div class="modal-content max-w-4xl">
      <div class="flex justify-between items-center mb-6 pb-4 border-b">
        <h2 class="text-2xl font-serif font-bold text-accent">
          <i class="fas fa-receipt mr-2"></i> Commande #${o.id}
        </h2>
        <button class="text-gray-500 hover:text-gray-700 text-2xl" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-beige-light p-4 rounded-lg">
          <h4 class="font-semibold mb-3 text-accent">Informations Client</h4>
          <p><strong>Nom:</strong> ${escapeHtml(o.customer_data?.firstname||'')} ${escapeHtml(o.customer_data?.lastname||'')}</p>
          <p><strong>Email:</strong> ${escapeHtml(o.customer_data?.email||'')}</p>
          <p><strong>Téléphone:</strong> ${escapeHtml(o.customer_data?.phone||'')}</p>
          <p><strong>Adresse:</strong> ${escapeHtml(o.customer_data?.address||'')}</p>
          <p><strong>Gouvernorat:</strong> ${escapeHtml(o.customer_data?.governorate||'')}</p>
        </div>
        
        <div class="bg-beige-light p-4 rounded-lg">
          <h4 class="font-semibold mb-3 text-accent">Détails de la commande</h4>
          <p><strong>Date:</strong> ${new Date(o.created_at||o.order_date).toLocaleString('fr-FR')}</p>
          <p><strong>Statut:</strong> <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(o.status)}">${getStatusText(o.status)}</span></p>
          <p><strong>Mode de paiement:</strong> ${escapeHtml(o.customer_data?.payment_method||'Non spécifié')}</p>
          <p><strong>Total:</strong> <span class="text-accent font-bold">${(o.total_amount||0).toFixed(2)} DT</span></p>
        </div>
      </div>
      
      <div class="mb-6">
        <h4 class="font-semibold mb-3 text-accent">Articles commandés</h4>
        <div class="bg-white rounded-lg border overflow-hidden">
          <table class="w-full">
            <thead class="bg-beige">
              <tr>
                <th class="px-4 py-2 text-left">Produit</th>
                <th class="px-4 py-2 text-center">Quantité</th>
                <th class="px-4 py-2 text-right">Prix unitaire</th>
                <th class="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(o.items||[]).map(i=>`
                <tr class="border-b">
                  <td class="px-4 py-2">${escapeHtml(i.product_name)}</td>
                  <td class="px-4 py-2 text-center">${i.quantity}</td>
                  <td class="px-4 py-2 text-right">${(i.unit_price||0).toFixed(2)} DT</td>
                  <td class="px-4 py-2 text-right font-medium">${(i.total_price||0).toFixed(2)} DT</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      ${o.customer_data?.notes ? `
        <div class="bg-yellow-50 p-4 rounded-lg">
          <h4 class="font-semibold mb-2">Notes du client:</h4>
          <p class="text-sm">${escapeHtml(o.customer_data.notes)}</p>
        </div>
      ` : ''}
    </div>
  `;
  document.body.appendChild(modal);
}

async function updateOrderStatus(orderId, newStatus){
  try {
    if(supabaseClient){
      const { error } = await supabaseClient.from('orders').update({ status: newStatus }).eq('id', orderId);
      if(error) throw error;
    }
    const o = orders.find(x=>x.id===orderId);
    if(o) o.status = newStatus;
    renderOrdersTable(); 
    loadAdminStats();
    showNotification('Statut mis à jour!','success');
  } catch(err){ 
    console.error('updateOrderStatus', err); 
    showNotification('Erreur: '+(err.message||err),'error'); 
  }
}

async function loadAdminStats(){
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s,o)=>s+(o.total_amount||0),0);
  const totalProducts = products.length;
  const pendingOrders = orders.filter(o=>o.status==='pending').length;
  
  const totalOrdersEl = document.getElementById('total-orders');
  const totalRevenueEl = document.getElementById('total-revenue');
  const totalProductsEl = document.getElementById('total-products');
  const pendingOrdersEl = document.getElementById('pending-orders');
  
  if(totalOrdersEl) totalOrdersEl.textContent = totalOrders;
  if(totalRevenueEl) totalRevenueEl.textContent = totalRevenue.toFixed(2)+' DT';
  if(totalProductsEl) totalProductsEl.textContent = totalProducts;
  if(pendingOrdersEl) pendingOrdersEl.textContent = pendingOrders;
}

function updateAdminProductsTable(){
  const el = document.getElementById('admin-products-table'); 
  if(!el) return;
  if(!products || products.length===0){ 
    el.innerHTML = '<div style="text-align:center;color:#777;padding:20px">Aucun produit</div>'; 
    return; 
  }
  el.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white rounded-lg overflow-hidden shadow">
        <thead class="bg-beige">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-semibold">ID</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Image</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Produit</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Prix</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Promo</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Stock</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Catégorie</th>
            <th class="px-4 py-3 text-left text-sm font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p=>{
            const hasPromo = p.promo && p.promo > 0;
            const originalPrice = p.price || 0;
            const promoPrice = hasPromo ? calculatePromoPrice(originalPrice, p.promo) : originalPrice;
            
            return `
            <tr class="border-b hover:bg-gray-50">
              <td class="px-4 py-3 font-medium">${p.id}</td>
              <td class="px-4 py-3">
                <img src="${p.image_url}" alt="${escapeHtml(p.name)}" class="w-12 h-12 object-cover rounded" onerror="this.src='https://via.placeholder.com/48x48?text=?'">
              </td>
              <td class="px-4 py-3">
                <div class="font-medium">${escapeHtml(p.name)}</div>
                <div class="text-sm text-gray-500">${escapeHtml(String(p.description||'')).slice(0,50)}...</div>
              </td>
              <td class="px-4 py-3 text-accent font-medium">
                ${hasPromo ? 
                  `<div class="line-through text-gray-400 text-sm">${formatPrice(originalPrice)} DT</div>
                   <div class="text-accent font-bold">${formatPrice(promoPrice)} DT</div>` :
                  `${formatPrice(originalPrice)} DT`
                }
              </td>
              <td class="px-4 py-3">
                ${hasPromo ? 
                  `<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">-${p.promo}%</span>` :
                  `<span class="text-gray-400">-</span>`
                }
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${p.stock > 5 ? 'bg-green-100 text-green-800' : p.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">
                  ${p.stock||0}
                </span>
              </td>
              <td class="px-4 py-3">${escapeHtml(getCategoryName(p.category))}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm" onclick="editProduct(${p.id})">
                    <i class="fas fa-edit mr-1"></i>Éditer
                  </button>
                  <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm" onclick="deleteProduct(${p.id})">
                    <i class="fas fa-trash mr-1"></i>Supprimer
                  </button>
                </div>
              </td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ========== PRODUCT MANAGEMENT ========== */
function editProduct(id){ 
  const product = products.find(p => p.id === id);
  if(!product) {
    showNotification('Produit non trouvé','error');
    return;
  }
  
  editingProduct = product;
  
  // Remplir le formulaire avec les données existantes
  document.getElementById('product-name').value = product.name || '';
  document.getElementById('product-price').value = product.price || '';
  document.getElementById('product-description').value = product.description || '';
  document.getElementById('product-category').value = product.category || '';
  document.getElementById('product-stock').value = product.stock || 0;
  document.getElementById('product-image').value = product.image_url || '';
  document.getElementById('product-promo').value = product.promo || 0; // NOUVEAU
  
  // Ajouter une sous-catégorie si elle existe
  const subcategoryField = document.getElementById('product-subcategory');
  if(subcategoryField) subcategoryField.value = product.subcategory || '';
  
  // Changer le titre du modal
  const modalTitle = document.querySelector('#product-modal .text-xl');
  if(modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit mr-2"></i> Modifier le Produit';
  
  // Changer le texte du bouton
  const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
  if(submitBtn) submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Enregistrer les modifications';
  
  showModal('product-modal');
}

async function deleteProduct(id){
  if(!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;
  
  try {
    if(supabaseClient){
      const { error } = await supabaseClient.from('products').delete().eq('id', id);
      if(error) throw error;
    }
    
    // Supprimer du tableau local
    products = products.filter(p => p.id !== id);
    
    buildCategoryTree();
    renderProducts();
    updateAdminProductsTable();
    showNotification('Produit supprimé avec succès!','success');
  } catch(err){
    console.error('deleteProduct', err);
    showNotification('Erreur lors de la suppression: '+(err.message||err),'error');
  }
}

/* add/edit product (admin) */
async function handleAddProduct(e){
  e.preventDefault();
  const name = document.getElementById('product-name').value.trim();
  const price = parseFloat(document.getElementById('product-price').value);
  const desc = document.getElementById('product-description').value.trim();
  const category = document.getElementById('product-category').value;
  const stock = parseInt(document.getElementById('product-stock').value,10);
  const image = document.getElementById('product-image').value.trim();
  const promo = parseInt(document.getElementById('product-promo').value,10) || 0; // NOUVEAU
  
  if(!name||isNaN(price)||!category) { 
    showNotification('Veuillez remplir tous les champs obligatoires','error'); 
    return; 
  }

  if(promo < 0 || promo > 100) {
    showNotification('La promotion doit être entre 0 et 100%','error');
    return;
  }

  const productData = { 
    name, 
    price, 
    description: desc, 
    category, 
    stock: isNaN(stock) ? 0 : stock, 
    promo: promo, // NOUVEAU
    image_url: image || 'https://via.placeholder.com/600x800?text=Image', 
    created_at: new Date().toISOString() 
  };

  try {
    if(editingProduct) {
      // Mode édition
      if(supabaseClient){
        const { data, error } = await supabaseClient.from('products').update(productData).eq('id', editingProduct.id).select();
        if(error) throw error;
        
        // Mettre à jour dans le tableau local
        const index = products.findIndex(p => p.id === editingProduct.id);
        if(index !== -1) {
          products[index] = { ...editingProduct, ...productData };
        }
      } else {
        // Mode demo
        const index = products.findIndex(p => p.id === editingProduct.id);
        if(index !== -1) {
          products[index] = { ...editingProduct, ...productData };
        }
      }
      showNotification('Produit modifié avec succès!','success');
    } else {
      // Mode ajout
      if(supabaseClient){
        const { data, error } = await supabaseClient.from('products').insert(productData).select();
        if(error) throw error;
        products.unshift(data[0]);
      } else {
        // simulate id
        productData.id = (products.length? Math.max(...products.map(p=>p.id))+1 : 1000);
        products.unshift(productData);
      }
      showNotification('Produit ajouté avec succès!','success');
    }
    
    buildCategoryTree(); 
    renderProducts(); 
    updateAdminProductsTable();
    resetProductForm();
    closeModal('product-modal');
  } catch(err){ 
    console.error('handleAddProduct', err); 
    const errorEl = document.getElementById('product-error');
    if(errorEl) {
      errorEl.textContent = err.message || err;
      errorEl.classList.remove('hidden');
    }
  }
}

function resetProductForm(){
  editingProduct = null;
  document.getElementById('add-product-form').reset();
  
  // Remettre le titre original
  const modalTitle = document.querySelector('#product-modal .text-xl');
  if(modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus mr-2"></i> Ajouter un Produit';
  
  // Remettre le texte du bouton original
  const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
  if(submitBtn) submitBtn.innerHTML = '<i class="fas fa-plus mr-2"></i> Ajouter le produit';
  
  // Masquer les erreurs
  const errorEl = document.getElementById('product-error');
  const successEl = document.getElementById('product-success');
  if(errorEl) errorEl.classList.add('hidden');
  if(successEl) successEl.classList.add('hidden');
}

/* ========== HELPERS (category names) ========== */
function getCategoryName(category){
  const map = {
    'robes':'Robes',
    'tops':'Tops & Blouses',
    'pantalons':'Pantalons',
    'jupes':'Jupes',
    'vestes':'Vestes & Blazers',
    'accessoires':'Accessoires'
  };
  return map[category] || category || 'Autres';
}

function getStatusText(status){
  const map = {
    'pending':'En attente',
    'confirmed':'Confirmé',
    'delivered':'Livré'
  };
  return map[status] || status;
}

/* ========== NAVIGATION FUNCTIONS ========== */
function showHome(){ 
  // Masquer la section admin et afficher les sections normales
  const adminSection = document.getElementById('admin-section');
  if(adminSection) adminSection.classList.add('hidden');
  
  showHeader();
  window.scrollTo({top:0,behavior:'smooth'}); 
}

function showProducts(){ 
  const productsSection = document.getElementById('products-section');
  if(productsSection) {
    productsSection.classList.remove('hidden');
    productsSection.scrollIntoView({behavior:'smooth'});
  }
  renderProducts(); 
}

function showCart(){ 
  renderCart(); 
  showModal('cart-modal'); 
}

function showAdminLogin(){ 
  if(currentAdmin) {
    showAdminDashboard();
    return;
  }
  showModal('admin-modal'); 
}

function showAddProduct(){ 
  resetProductForm();
  showModal('product-modal'); 
}

/* ========== SETUP & INIT ========== */
async function init(){
  try {
    console.log('Init...');
    if(window.supabase){
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      console.log('Supabase initialisé');
      await loadProducts();
    } else {
      console.warn('Supabase non disponible, mode demo');
      products = demoProducts.slice();
      buildCategoryTree();
      renderProducts();
    }

    setupEventListeners();
    loadCartFromStorage();
    updateCartCount();
  } catch(err){ 
    console.error('init', err); 
    products = demoProducts.slice(); 
    buildCategoryTree(); 
    renderProducts(); 
  }
}

function setupEventListeners(){
  const adminLoginForm = document.getElementById('admin-login-form');
  const addProductForm = document.getElementById('add-product-form');
  const checkoutForm = document.getElementById('checkout-form');
  
  if(adminLoginForm) adminLoginForm.addEventListener('submit', handleAdminLogin);
  if(addProductForm) addProductForm.addEventListener('submit', handleAddProduct);
  if(checkoutForm) checkoutForm.addEventListener('submit', handleCheckout);
  
  // modals click outside close
  document.querySelectorAll('.modal').forEach(modal=>{
    modal.addEventListener('click', (e)=>{ 
      if(e.target===modal) modal.classList.remove('active'); 
    });
  });
  
  // Reset product form when modal closes
  const productModal = document.getElementById('product-modal');
  if(productModal) {
    productModal.addEventListener('click', (e) => {
      if(e.target === productModal) {
        resetProductForm();
        closeModal('product-modal');
      }
    });
  }
}

/* ========== ON LOAD ========== */
document.addEventListener('DOMContentLoaded', init);