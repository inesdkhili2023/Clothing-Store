/* app.js
   Complet : categories + filters + quick view + panier + admin + supabase
*/

/* ========== CONFIG SUPABASE (inchangé) ========== */
const supabaseUrl = 'https://emcffxoyfetkkcnlofpk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY2ZmeG95ZmV0a2tjbmxvZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NTU1MzMsImV4cCI6MjA3MDUzMTUzM30.CDeP5WUIAoTE4K6AEwHFIjtcOwbyx4Nr1AVZ0yBuLXE';

let supabaseClient = null;
let currentAdmin = null;
let products = [];
let cart = [];
let orders = [];

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

/* ========== UTILITAIRES ========== */
function formatPrice(n){ return (Number(n)||0).toFixed(2); }
function escapeHtml(s){ if(!s) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function closeModal(id){ const m = document.getElementById(id); if(m) m.classList.remove('show'); }
function showModal(id){ const m = document.getElementById(id); if(m) m.classList.add('show'); }
function showNotification(msg, type='info'){
  const t = document.createElement('div');
  t.style.position='fixed'; t.style.right='20px'; t.style.bottom='20px';
  t.style.background=(type==='error'?'#ef5350': type==='success'?'#16a34a':'#2563eb');
  t.style.color='white'; t.style.padding='10px 14px'; t.style.borderRadius='10px'; t.style.zIndex=9999;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 2600);
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
  container.innerHTML = arr.map(p=>`
    <article class="product-card" data-id="${p.id}">
      <div class="product-image-container" onclick="showProductDetail(${p.id})">
        <img class="product-image" src="${p.image_url}" alt="${escapeHtml(p.name)}" onerror="this.src='https://via.placeholder.com/600x800?text=Image'"/>
        <div class="product-overlay">
          <button class="quick-view-btn" onclick="(function(e){e.stopPropagation(); showProductDetail(${p.id});})(event)"><i class="fas fa-eye"></i> Aperçu</button>
        </div>
      </div>
      <div class="product-info">
        <div class="product-category">${escapeHtml(getCategoryName(p.category))}</div>
        <div class="product-title">${escapeHtml(p.name)}</div>
        <div class="product-price">${formatPrice(p.price)} DT</div>
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
  `).join('');
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
  document.getElementById('filter-category').value='';
  document.getElementById('filter-subcategory').value='';
  document.getElementById('filter-sort').value='new';
  document.getElementById('search-input').value='';
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

  // create images array (use image_url and variations if necessary)
  const imgs = [];
  if(p.image_url) imgs.push(p.image_url);
  // Add fallback variations to allow thumbnails for demo
  if(!p.image_url.includes('?')) imgs.push(p.image_url + '?auto=format&w=900');
  imgs.push(p.image_url + '&q=60');

  // gallery
  gallery.innerHTML = `
    <div class="detail-main"><img id="detail-main-img" src="${imgs[0]}" alt="${escapeHtml(p.name)}"></div>
    <div class="detail-thumbs" id="detail-thumbs">${imgs.map((u,i)=>`<img src="${u}" data-idx="${i}" class="${i===0?'active':''}" onclick="detailThumbClick(this)"/>`).join('')}</div>
  `;

  // info
  info.innerHTML = `
    <h2>${escapeHtml(p.name)}</h2>
    <div class="price">${formatPrice(p.price)} DT</div>
    <div style="color:var(--muted);margin-top:8px">${escapeHtml(p.description || '')}</div>
    <div style="margin-top:12px"><strong>Catégorie:</strong> ${escapeHtml(getCategoryName(p.category))}${p.subcategory ? ' / ' + escapeHtml(p.subcategory) : ''}</div>
    <div class="qty-row">
      <label>Quantité:</label>
      <button class="qty-btn" onclick="changeDetailQty(-1)">-</button>
      <span id="detail-qty">1</span>
      <button class="qty-btn" onclick="changeDetailQty(1)">+</button>
      <span style="margin-left:12px;color:${p.stock>0?'#0b6':'#c66'};font-weight:700">${p.stock} en stock</span>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px;align-items:center">
      <button class="btn-add-cart" onclick="addToCartFromDetail(${p.id})"><i class="fas fa-shopping-bag"></i> Ajouter au panier</button>
      <button class="btn-wishlist" onclick="toggleWishlist(${p.id})"><i class="fas fa-heart"></i></button>
    </div>
  `;

  modal.dataset.productId = p.id;
  modal.dataset.qty = 1;
  modal.classList.add('show');
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
  if(cart.length === 0){ container.innerHTML = `<div class="empty-cart"><i class="fas fa-shopping-bag"></i><h3>Votre panier est vide</h3><p>Ajoutez des articles</p></div>`; if(totalEl) totalEl.textContent = ''; return; }
  let total = 0;
  container.innerHTML = cart.map(it=>{
    const p = products.find(pp => pp.id === it.productId);
    if(!p) return '';
    const itemTotal = (p.price||0) * it.quantity;
    total += itemTotal;
    return `
      <div class="cart-item">
        <img src="${p.image_url}" alt="${escapeHtml(p.name)}">
        <div style="flex:1">
          <div style="font-weight:700">${escapeHtml(p.name)}</div>
          <div style="color:#777">${formatPrice(p.price)} DT</div>
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
            <button class="quantity-btn" onclick="updateCartQuantity(${p.id}, ${it.quantity-1})">-</button>
            <span style="min-width:28px;text-align:center">${it.quantity}</span>
            <button class="quantity-btn" onclick="updateCartQuantity(${p.id}, ${it.quantity+1})">+</button>
            <button style="margin-left:8px;background:#e55353;color:#fff;border:none;padding:6px;border-radius:8px" onclick="removeFromCart(${p.id})"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div style="font-weight:700;color:var(--accent)">${itemTotal.toFixed(2)} DT</div>
      </div>
    `;
  }).join('');
  if(totalEl) totalEl.textContent = `Total: ${total.toFixed(2)} DT`;
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
      const { data, error } = await supabaseClient.from('orders').insert(orderData).select();
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
    showOrderSuccess(orderData);
    renderProducts();
  } catch(err){
    console.error('Erreur commande', err);
    if(errorEl){ errorEl.textContent = `Erreur lors de la commande: ${err.message || err}`; errorEl.classList.remove('hidden'); }
  }
}

function showOrderSuccess(orderData){
  const orderId = orderData.id || Math.floor(Math.random()*100000);
  const modal = document.createElement('div'); modal.className='modal show';
  modal.innerHTML = `<div class="modal-content" style="max-width:520px;text-align:center"><div style="background:linear-gradient(90deg,#10b981,#059669);padding:30px;border-radius:12px;color:white"><i class="fas fa-check-circle" style="font-size:48px;margin-bottom:10px"></i><h2>Commande confirmée!</h2><p>Votre commande #${orderId} a été enregistrée.</p></div><div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-top:16px;text-align:left"><strong>Client:</strong> ${escapeHtml(orderData.customer_data.firstname||'')} ${escapeHtml(orderData.customer_data.lastname||'')}<br><strong>Total:</strong> ${orderData.total_amount?.toFixed(2)} DT</div><button class="btn-primary" style="width:100%;margin-top:16px" onclick="(function(){document.querySelector('.modal.show').remove(); showHome(); })()">Retour à l'accueil</button></div>`;
  document.body.appendChild(modal);
}

/* ========== AUTH ADMIN & ADMIN DASH (kept logic) ========== */
async function handleAdminLogin(e){
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const errorEl = document.getElementById('admin-error');
  if(errorEl) errorEl.classList.add('hidden');
  try {
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(authError) throw authError;
    const { data: adminData, error: adminError } = await supabaseClient.from('admin_users').select('id,email,role').eq('email', email).maybeSingle();
    if(adminError) throw adminError;
    if(!adminData){ await supabaseClient.auth.signOut(); throw new Error('Accès refusé : vous n’êtes pas administrateur.'); }
    currentAdmin = { ...adminData };
    closeModal('admin-modal');
    document.getElementById('logout-btn') && document.getElementById('logout-btn').classList.remove('hidden');
    showNotification('Connexion admin réussie !','success');
    // Show admin dashboard area (if you have separate page, you can redirect)
    showAdminDashboard();
  } catch(err){
    console.error('Erreur login admin', err);
    if(errorEl){ errorEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${err.message}`; errorEl.classList.remove('hidden'); }
  }
}

async function logout(){
  try {
    if(supabaseClient) await supabaseClient.auth.signOut();
    currentAdmin = null;
    document.getElementById('logout-btn') && document.getElementById('logout-btn').classList.add('hidden');
    showNotification('Déconnexion réussie','success');
    showHome();
  } catch(err){ console.error('logout', err); }
}

async function showAdminDashboard(){
  const adminSection = document.getElementById('admin-section');
  if(!adminSection) { 
    showNotification('Dashboard admin non disponible (page séparée)', 'info'); 
    return; 
  }

  // Cacher les sections client
  document.querySelectorAll('.hero, .filters, #products-section, footer')
    .forEach(el => el.classList.add('hidden'));

  // Afficher la section admin
  adminSection.classList.remove('hidden');

  // Charger données admin
  await loadOrders();
  await loadAdminStats();
  updateAdminProductsTable();
}


/* Admin helpers: loadOrders, renderOrdersTable, updateOrderStatus, loadAdminStats, updateAdminProductsTable */
async function loadOrders(){
  if(!supabaseClient) { orders = []; renderOrdersTable(); return; }
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
  container.innerHTML = `<div style="overflow:auto"><table class="data-table"><thead><tr><th>N°</th><th>Client</th><th>Contact</th><th>Total</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>${orders.map(o=>`<tr><td><strong>#${o.id}</strong></td><td style="font-weight:600">${escapeHtml(o.customer_data?.firstname||'')} ${escapeHtml(o.customer_data?.lastname||'')}</td><td>${escapeHtml(o.customer_data?.email||'')}<br><small style="color:#777">${escapeHtml(o.customer_data?.phone||'')}</small></td><td style="color:var(--accent);font-weight:700">${(o.total_amount||0).toFixed(2)} DT</td><td><span class="status-badge status-${o.status}">${getStatusText(o.status)}</span></td><td>${new Date(o.created_at||o.order_date).toLocaleDateString('fr-FR')}</td><td><select onchange="updateOrderStatus(${o.id}, this.value)"><option value="pending" ${o.status==='pending'?'selected':''}>En attente</option><option value="confirmed" ${o.status==='confirmed'?'selected':''}>Confirmé</option><option value="delivered" ${o.status==='delivered'?'selected':''}>Livré</option></select><button style="margin-left:8px" onclick="viewOrderDetails(${o.id})"><i class="fas fa-eye"></i></button></td></tr>`).join('')}</tbody></table></div>`;
}

function viewOrderDetails(orderId){
  const o = orders.find(x => x.id === orderId);
  if(!o) return;
  const modal = document.createElement('div'); modal.className='modal show';
  modal.innerHTML = `<div class="modal-content" style="max-width:720px"><div class="modal-header"><h2 class="modal-title"><i class="fas fa-receipt"></i> Commande #${o.id}</h2><button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px"><div><h4>Client</h4><p>${escapeHtml(o.customer_data?.firstname||'')} ${escapeHtml(o.customer_data?.lastname||'')}</p><p>${escapeHtml(o.customer_data?.email||'')}</p><p>${escapeHtml(o.customer_data?.phone||'')}</p></div><div><h4>Détails</h4><p>Date: ${new Date(o.created_at||o.order_date).toLocaleString('fr-FR')}</p><p>Statut: <span class="status-badge status-${o.status}">${getStatusText(o.status)}</span></p><p>Total: ${(o.total_amount||0).toFixed(2)} DT</p></div></div><h4>Articles</h4><div style="background:#f5f5f5;padding:12px;border-radius:8px">${(o.items||[]).map(i=>`<div style="display:flex;justify-content:space-between;padding:6px 0"><span>${escapeHtml(i.product_name)} × ${i.quantity}</span><span>${(i.total_price||0).toFixed(2)} DT</span></div>`).join('')}</div></div>`;
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
    renderOrdersTable(); loadAdminStats();
    showNotification('Statut mis à jour!','success');
  } catch(err){ console.error('updateOrderStatus', err); showNotification('Erreur: '+(err.message||err),'error'); }
}

async function loadAdminStats(){
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s,o)=>s+(o.total_amount||0),0);
  const totalProducts = products.length;
  const pendingOrders = orders.filter(o=>o.status==='pending').length;
  document.getElementById('total-orders') && (document.getElementById('total-orders').textContent = totalOrders);
  document.getElementById('total-revenue') && (document.getElementById('total-revenue').textContent = totalRevenue.toFixed(2)+' DT');
  document.getElementById('total-products') && (document.getElementById('total-products').textContent = totalProducts);
  document.getElementById('pending-orders') && (document.getElementById('pending-orders').textContent = pendingOrders);
}

function updateAdminProductsTable(){
  const el = document.getElementById('admin-products-table'); if(!el) return;
  if(!products || products.length===0){ el.innerHTML = '<div style="text-align:center;color:#777;padding:20px">Aucun produit</div>'; return; }
  el.innerHTML = `<table class="data-table"><thead><tr><th>ID</th><th>Produit</th><th>Prix</th><th>Stock</th><th>Catégorie</th><th>Actions</th></tr></thead><tbody>${products.map(p=>`<tr><td>${p.id}</td><td>${escapeHtml(p.name)}</td><td>${formatPrice(p.price)} DT</td><td>${p.stock||0}</td><td>${escapeHtml(getCategoryName(p.category))}</td><td><button onclick="editProduct(${p.id})">Éditer</button></td></tr>`).join('')}</tbody></table>`;
}

function editProduct(id){ showNotification('Édition produit non-implémentée ici','info'); }

/* ========== HELPERS (category names) ========== */
function getCategoryName(category){
  const map = {'robes':'Robes','tops':'Tops & Blouses','pantalons':'Pantalons','jupes':'Jupes','vestes':'Vestes & Blazers','accessoires':'Accessoires'};
  return map[category] || category || 'Autres';
}

function getStatusText(status){
  const map = {'pending':'En attente','confirmed':'Confirmé','delivered':'Livré'};
  return map[status] || status;
}

/* ========== SETUP & INIT ========== */
function showHome(){ document.getElementById('products-section') && (document.getElementById('products-section').classList.add('hidden') ? false : false); window.scrollTo({top:0,behavior:'smooth'}); /* keep behaviour */ }
function showProducts(){ document.getElementById('products-section') && document.getElementById('products-section').classList.remove('hidden'); document.getElementById('products-section') && document.getElementById('products-section').scrollIntoView({behavior:'smooth'}); renderProducts(); }
function showCart(){ renderCart(); showModal('cart-modal'); }
function showAdminLogin(){ showModal('admin-modal'); }
function showAddProduct(){ showModal('product-modal'); }

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
  } catch(err){ console.error('init', err); products = demoProducts.slice(); buildCategoryTree(); renderProducts(); }
}

function setupEventListeners(){
  document.getElementById('admin-login-form') && document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
  document.getElementById('add-product-form') && document.getElementById('add-product-form').addEventListener('submit', handleAddProduct);
  document.getElementById('checkout-form') && document.getElementById('checkout-form').addEventListener('submit', handleCheckout);
  // modals click outside close
  document.querySelectorAll('.modal').forEach(modal=>{
    modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.classList.remove('show'); });
  });
}

/* add product (admin) */
async function handleAddProduct(e){
  e.preventDefault();
  const name = document.getElementById('product-name').value.trim();
  const price = parseFloat(document.getElementById('product-price').value);
  const desc = document.getElementById('product-description').value.trim();
  const category = document.getElementById('product-category').value;
  const stock = parseInt(document.getElementById('product-stock').value,10);
  const image = document.getElementById('product-image').value.trim();
  if(!name||isNaN(price)||!category) { showNotification('Champs incomplets','error'); return; }

  const newProd = { name, price, description: desc, category, stock, image_url: image, created_at: new Date().toISOString() };

  try {
    if(supabaseClient){
      const { data, error } = await supabaseClient.from('products').insert(newProd).select();
      if(error) throw error;
      products.unshift(data[0]);
    } else {
      // simulate id
      newProd.id = (products.length? Math.max(...products.map(p=>p.id))+1 : 1000);
      products.unshift(newProd);
    }
    buildCategoryTree(); renderProducts(); updateAdminProductsTable();
    document.getElementById('product-success') && (document.getElementById('product-success').classList.remove('hidden'), setTimeout(()=>document.getElementById('product-success').classList.add('hidden'),2000));
    closeModal('product-modal');
  } catch(err){ console.error('add product', err); document.getElementById('product-error') && (document.getElementById('product-error').textContent = err.message || err, document.getElementById('product-error').classList.remove('hidden')); }
}

/* ========== ON LOAD ========== */
document.addEventListener('DOMContentLoaded', init);
