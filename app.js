const supabaseUrl = 'https://emcffxoyfetkkcnlofpk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY2ZmeG95ZmV0a2tjbmxvZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NTU1MzMsImV4cCI6MjA3MDUzMTUzM30.CDeP5WUIAoTE4K6AEwHFIjtcOwbyx4Nr1AVZ0yBuLXE';

let supabaseClient = null;
let currentAdmin = null;
let products = [];
let cart = [];
let orders = [];
let editingProduct = null;

// ========== NOUVELLES VARIABLES POUR CATÉGORIES DYNAMIQUES ==========
let genres = [];
let categories = [];
let subcategories = [];
let editingCategory = null;

/* Demo products (used if Supabase absent) */
const demoProducts = [
  { id: 1, name: "Robe Satin Élégante", description: "Magnifique robe en satin premium...", price: 249.00, category_id: 1, subcategory_id: null, stock: 15, image_url: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&h=1000&fit=crop" },
  { id: 2, name: "Blouse Soie Moderne", description: "Blouse en soie naturelle...", price: 189.00, category_id: 3, subcategory_id: null, stock: 22, image_url: "https://images.unsplash.com/photo-1564257577154-75b6b8842501?w=800&h=1000&fit=crop" },
  { id: 3, name: "Pantalon Tailleur Premium", description: "Pantalon de tailleur en laine stretch...", price: 159.00, category_id: 4, subcategory_id: null, stock: 18, image_url: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&h=1000&fit=crop" },
  { id: 4, name: "Jupe Midi Plissée Luxe", description: "Jupe midi en tissu fluide premium...", price: 129.00, category_id: 4, subcategory_id: null, stock: 12, image_url: "https://images.unsplash.com/photo-1583496661160-fb5886a13d27?w=800&h=1000&fit=crop" },
  { id: 5, name: "Co-ord Set Aqua", description: "Ensemble coordonné tendance...", price: 279.00, category_id: 5, subcategory_id: 1, stock: 8, image_url: "https://images.unsplash.com/photo-1544957992-20514f595d6f?w=800&h=1000&fit=crop" },
  { id: 6, name: "Mini Dress Sparkle", description: "Robe courte avec détails brillants...", price: 329.00, category_id: 5, subcategory_id: 2, stock: 6, image_url: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=1000&fit=crop" },
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

// ========== CHARGEMENT DES CATÉGORIES DYNAMIQUES ==========

async function loadGenres() {
  try {
    if (!supabaseClient) {
      // Mode demo
      genres = [
        { id: 1, name: 'Femme', icon: 'fas fa-venus', display_order: 1 },
        { id: 2, name: 'Homme', icon: 'fas fa-mars', display_order: 2 },
        { id: 3, name: 'Enfant', icon: 'fas fa-child', display_order: 3 }
      ];
      return;
    }
    
    const { data, error } = await supabaseClient
      .from('genres')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    
    if (error) throw error;
    genres = data || [];
  } catch (err) {
    console.error('Erreur chargement genres:', err);
    // Fallback sur demo
    genres = [
      { id: 1, name: 'Femme', icon: 'fas fa-venus', display_order: 1 },
      { id: 2, name: 'Homme', icon: 'fas fa-mars', display_order: 2 },
      { id: 3, name: 'Enfant', icon: 'fas fa-child', display_order: 3 }
    ];
  }
}

async function loadCategories() {
  try {
    if (!supabaseClient) {
      // Mode demo
      categories = [
        // Femme
        { id: 1, name: 'Summer Vibes', slug: 'summer-vibes', genre_id: 1 },
        { id: 2, name: 'Winter Vibes', slug: 'winter-vibes', genre_id: 1 },
        { id: 3, name: 'Tops', slug: 'tops', genre_id: 1 },
        { id: 4, name: 'Bottoms', slug: 'bottoms', genre_id: 1 },
        { id: 5, name: 'Co-ords', slug: 'co-ords', genre_id: 1 },
        { id: 6, name: 'Shoes', slug: 'shoes', genre_id: 1 },
        
        // Homme - NOUVEAU
        { id: 7, name: 'Shirts', slug: 'shirts', genre_id: 2 },
        { id: 8, name: 'Pants', slug: 'pants', genre_id: 2 },
        { id: 9, name: 'Jackets', slug: 'jackets', genre_id: 2 },
        { id: 10, name: 'Shoes', slug: 'shoes-homme', genre_id: 2 },
        
        // Enfant - NOUVEAU  
        { id: 11, name: 'Vêtements Garçon', slug: 'garcon', genre_id: 3 },
        { id: 12, name: 'Vêtements Fille', slug: 'fille', genre_id: 3 },
        { id: 13, name: 'Chaussures Enfant', slug: 'chaussures-enfant', genre_id: 3 }
      ];

      return;
    }
    
    const { data, error } = await supabaseClient
      .from('categories')
      .select(`
        *,
        genres(name)
      `)
      .eq('is_active', true)
      .order('genre_id')
      .order('display_order');
    
    if (error) throw error;
    categories = data || [];
  } catch (err) {
    console.error('Erreur chargement catégories:', err);
    // Fallback sur demo
    categories = [
      { id: 1, name: 'Summer Vibes', slug: 'summer-vibes', genre_id: 1 },
      { id: 2, name: 'Winter Vibes', slug: 'winter-vibes', genre_id: 1 },
      { id: 3, name: 'Tops', slug: 'tops', genre_id: 1 },
      { id: 4, name: 'Bottoms', slug: 'bottoms', genre_id: 1 },
      { id: 5, name: 'Co-ords', slug: 'co-ords', genre_id: 1 },
      { id: 6, name: 'Shoes', slug: 'shoes', genre_id: 1 }
    ];
  }
}

async function loadSubcategories() {
  try {
    if (!supabaseClient) {
      // Mode demo
      subcategories = [
        { id: 1, name: 'Aqua', slug: 'aqua', category_id: 5 },
        { id: 2, name: 'Mini Dresses', slug: 'mini-dresses', category_id: 5 }
      ];
      return;
    }
    
    const { data, error } = await supabaseClient
      .from('subcategories')
      .select(`
        *,
        categories(name, genres(name))
      `)
      .eq('is_active', true)
      .order('category_id')
      .order('display_order');
    
    if (error) throw error;
    subcategories = data || [];
  } catch (err) {
    console.error('Erreur chargement sous-catégories:', err);
    // Fallback sur demo
    subcategories = [
      { id: 1, name: 'Aqua', slug: 'aqua', category_id: 5 },
      { id: 2, name: 'Mini Dresses', slug: 'mini-dresses', category_id: 5 }
    ];
  }
}

// ========== RENDU DYNAMIQUE HEADER ==========

function renderDynamicHeader() {
  const navContainer = document.querySelector('nav .flex.space-x-6');
  if (!navContainer) return;
  
  // Vider le contenu existant mais garder les liens fixes
  const staticLinks = navContainer.querySelectorAll('a[onclick*="showHome"], a[onclick*="showProducts"]');
  navContainer.innerHTML = '';
  
  // Remettre les liens statiques
  staticLinks.forEach(link => navContainer.appendChild(link.cloneNode(true)));
  
  // Ajouter les genres dynamiques
  genres.forEach(genre => {
    const genreCategories = categories.filter(cat => cat.genre_id === genre.id);
    
    // MODIFICATION : Afficher le genre même s'il n'a pas de catégories
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown relative';
    
    if (genreCategories.length === 0) {
      // Genre sans catégories - afficher comme lien simple
      dropdown.innerHTML = `
        <button class="hover:text-accent transition flex items-center" onclick="filterByGenre(${genre.id})">
          <i class="${genre.icon} mr-2"></i> ${genre.name}
        </button>
      `;
    } else {
      // Genre avec catégories - afficher le dropdown complet
      dropdown.innerHTML = `
        <button class="hover:text-accent transition flex items-center" id="dropdown-${genre.id}">
          <i class="${genre.icon} mr-2"></i> ${genre.name}
          <i class="fas fa-chevron-down ml-1 text-xs"></i>
        </button>
        <div class="categories-panel hidden absolute bg-white shadow rounded mt-2 w-40 z-50" id="panel-${genre.id}">
          <ul class="flex flex-col">
            ${genreCategories.map(category => {
              const categorySubcategories = subcategories.filter(sub => sub.category_id === category.id);
              
              if (categorySubcategories.length > 0) {
                return `
                  <li class="relative group">
                    <div class="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center" onclick="filterByCategory(${category.id})">
                      ${category.name} <i class="fas fa-chevron-right text-xs"></i>
                    </div>
                    <ul class="hidden group-hover:block absolute top-0 left-full bg-white shadow rounded w-40 z-50">
                      ${categorySubcategories.map(sub => `
                        <li class="px-4 py-2 hover:bg-gray-100 cursor-pointer" onclick="filterBySubcategory(${sub.id})">${sub.name}</li>
                      `).join('')}
                    </ul>
                  </li>
                `;
              } else {
                return `
                  <li class="px-4 py-2 hover:bg-gray-100 cursor-pointer" onclick="filterByCategory(${category.id})">
                    ${category.name}
                  </li>
                `;
              }
            }).join('')}
          </ul>
        </div>
      `;
    }
    
    navContainer.appendChild(dropdown);
  });
  
  // Réactiver les événements dropdown
  setupDropdownEvents();
}

function filterByGenre(genreId) {
  const genre = genres.find(g => g.id === genreId);
  if (!genre) return;
  
  // Obtenir toutes les catégories de ce genre
  const genreCategories = categories.filter(c => c.genre_id === genreId);
  const categoryIds = genreCategories.map(c => c.id);
  
  // Obtenir toutes les sous-catégories de ces catégories
  const genreSubcategories = subcategories.filter(s => 
    categoryIds.includes(s.category_id)
  );
  const subcategoryIds = genreSubcategories.map(s => s.id);
  
  // Filtrer les produits : soit par category_id, soit par subcategory_id
  let filteredProducts = products.filter(p => {
    // Produit appartient directement à une catégorie du genre
    if (p.category_id && categoryIds.includes(p.category_id)) {
      return true;
    }
    // Ou produit appartient à une sous-catégorie du genre
    if (p.subcategory_id && subcategoryIds.includes(p.subcategory_id)) {
      return true;
    }
    return false;
  });
  
  renderProducts(filteredProducts);
  closeAllDropdowns();
  
  showNotification(`Filtré par genre: ${genre.name} (${filteredProducts.length} produit(s))`, 'info');
}

// ========== FILTRAGE PAR CATÉGORIES DYNAMIQUES ==========

function filterByCategory(categoryId) {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;
  
  // Obtenir toutes les sous-catégories de cette catégorie
  const categorySubcategories = subcategories.filter(s => s.category_id === categoryId);
  const subcategoryIds = categorySubcategories.map(s => s.id);
  
  // Filtrer les produits : soit directement par category_id, soit par subcategory_id
  let filteredProducts = products.filter(p => {
    // Produit appartient directement à cette catégorie
    if (p.category_id === categoryId) {
      return true;
    }
    // Ou produit appartient à une sous-catégorie de cette catégorie
    if (p.subcategory_id && subcategoryIds.includes(p.subcategory_id)) {
      return true;
    }
    return false;
  });
  
  renderProducts(filteredProducts);
  closeAllDropdowns();
  
  showNotification(`Filtré par catégorie: ${category.name} (${filteredProducts.length} produit(s))`, 'info');
}


function filterBySubcategory(subcategoryId) {
  const subcategory = subcategories.find(s => s.id === subcategoryId);
  if (!subcategory) return;
  
  let filteredProducts = products.filter(p => p.subcategory_id === subcategoryId);
  renderProducts(filteredProducts);
  closeAllDropdowns();
  
  showNotification(`Filtré par sous-catégorie: ${subcategory.name} (${filteredProducts.length} produit(s))`, 'info');
}

function closeAllDropdowns() {
  document.querySelectorAll('.categories-panel').forEach(panel => {
    panel.classList.add('hidden');
  });
}

// ========== ÉVÉNEMENTS DROPDOWN ==========

function setupDropdownEvents() {
  // Supprimer les anciens listeners pour éviter les doublons
  document.removeEventListener('click', handleDropdownClick);
  document.addEventListener('click', handleDropdownClick);
}

function handleDropdownClick(e) {
  const dropdown = e.target.closest('.dropdown');
  if (dropdown) {
    const button = dropdown.querySelector('button');
    const panel = dropdown.querySelector('.categories-panel');
    if (button && button.contains(e.target)) {
      closeAllDropdowns();
      panel.classList.toggle('hidden');
      e.stopPropagation();
      return;
    }
  }
  
  if (!e.target.closest('.categories-panel')) {
    closeAllDropdowns();
  }
}

/* ========== CATEGORIES (tree) - VERSION COMPATIBLE ========== */
let categoryTree = {}; // Garder pour compatibilité avec les anciens filtres

function buildCategoryTree(){
  categoryTree = {};
  // Construire l'arbre basé sur les nouvelles catégories
  categories.forEach(cat => {
    const catSubs = subcategories.filter(sub => sub.category_id === cat.id);
    categoryTree[cat.name] = new Set(catSubs.map(sub => sub.name));
  });
  
  // Ajouter les produits sans catégorie moderne dans "Autres"
  (products || []).forEach(p=>{
    if (!p.category_id && p.category) {
      const c = p.category || 'Autres';
      const s = p.subcategory || '';
      if(!categoryTree[c]) categoryTree[c] = new Set();
      if(s) categoryTree[c].add(s);
    }
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
    div.innerHTML = `<strong>${cat}</strong>`;
    if(categoryTree[cat].size){
      const ul = document.createElement('div'); ul.style.fontSize='13px'; ul.style.marginTop='6px';
      Array.from(categoryTree[cat]).slice(0,20).forEach(sub=>{
        const subbtn = document.createElement('div');
        subbtn.className='sub';
        subbtn.textContent = sub;
        subbtn.onclick = (e) => {
          e.stopPropagation();
          // Trouver la sous-catégorie correspondante
          const subcategory = subcategories.find(s => s.name === sub);
          if (subcategory) {
            filterBySubcategory(subcategory.id);
          }
          panel.classList.add('hidden');
        };
        ul.appendChild(subbtn);
      });
      div.appendChild(ul);
    }
    div.onclick = ()=> {
      // Trouver la catégorie correspondante
      const category = categories.find(c => c.name === cat);
      if (category) {
        filterByCategory(category.id);
      }
      panel.classList.add('hidden');
    };
    panel.appendChild(div);
  });
}

function populateFilterSelects(){
  const selCat = document.getElementById('filter-category');
  const selSub = document.getElementById('filter-subcategory');
  if(!selCat || !selSub) return;
  
  // Utiliser les nouvelles catégories
  selCat.innerHTML = '<option value="">Toutes</option>' + 
    categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  selSub.innerHTML = '<option value="">Toutes</option>';
}

function onCategoryChange(){
  const catId = document.getElementById('filter-category').value;
  const selSub = document.getElementById('filter-subcategory');
  selSub.innerHTML = '<option value="">Toutes</option>';
  
  if(catId) {
    const catSubcategories = subcategories.filter(s => s.category_id == catId);
    catSubcategories.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      selSub.appendChild(opt);
    });
  }
  applyFilters();
}
function getProductsByGenre(genreId) {
  const genreCategories = categories.filter(c => c.genre_id === genreId);
  const categoryIds = genreCategories.map(c => c.id);
  const genreSubcategories = subcategories.filter(s => categoryIds.includes(s.category_id));
  const subcategoryIds = genreSubcategories.map(s => s.id);
  
  return products.filter(p => {
    if (p.category_id && categoryIds.includes(p.category_id)) return true;
    if (p.subcategory_id && subcategoryIds.includes(p.subcategory_id)) return true;
    return false;
  });
}
function getProductsByCategory(categoryId) {
  const categorySubcategories = subcategories.filter(s => s.category_id === categoryId);
  const subcategoryIds = categorySubcategories.map(s => s.id);
  
  return products.filter(p => {
    if (p.category_id === categoryId) return true;
    if (p.subcategory_id && subcategoryIds.includes(p.subcategory_id)) return true;
    return false;
  });
}

/* ========== LOAD / RENDER PRODUITS (MODIFIÉ POUR NOUVELLES CATÉGORIES) ========== */
async function loadProducts(){
  try {
    if(!supabaseClient){ 
      products = demoProducts.slice(); 
      buildCategoryTree(); 
      renderProducts(); 
      return; 
    }
    
    // Charger avec les nouvelles relations
    const { data, error } = await supabaseClient
      .from('products')
      .select(`
        *,
        categories(name),
        subcategories(name)
      `)
      .order('created_at',{ascending:false});
      
    if(error){ 
      console.error('Erreur chargement produits', error); 
      products = demoProducts.slice(); 
    } else {
      products = (data && data.length>0) ? data : demoProducts.slice();
    }
  } catch(err){ 
    console.error('loadProducts', err); 
    products = demoProducts.slice(); 
  }
  buildCategoryTree();
  renderProducts();
  updateAdminProductsTable();
}

function renderProducts(list){
  const container = document.getElementById('products-grid');
  if(!container) return;
  const arr = list || products;
  if(arr.length===0){ 
    container.innerHTML = '<p style="padding:30px;text-align:center;color:#777">Aucun produit trouvé</p>'; 
    document.getElementById('results-info').textContent='0 produit(s)'; 
    return; 
  }
  
  container.innerHTML = arr.map(p=>{
    const hasPromo = p.promo && p.promo > 0;
    const originalPrice = p.price || 0;
    const promoPrice = hasPromo ? calculatePromoPrice(originalPrice, p.promo) : originalPrice;
    
    // Obtenir le nom de la catégorie
    let categoryName = 'Autres';
    if (p.categories && p.categories.name) {
      categoryName = p.categories.name;
    } else if (p.category_id) {
      const category = categories.find(c => c.id === p.category_id);
      categoryName = category ? category.name : 'Autres';
    } else if (p.category) {
      categoryName = getCategoryName(p.category);
    }
    
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
        <div class="product-category">${escapeHtml(categoryName)}</div>
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

/* ========== FILTRAGE / RECHERCHE / TRI (MODIFIÉ) ========== */
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

  // Filtrage par catégorie avec hiérarchie
  if(cat) {
    const categoryId = parseInt(cat);
    const categorySubcategories = subcategories.filter(s => s.category_id === categoryId);
    const subcategoryIds = categorySubcategories.map(s => s.id);
    
    list = list.filter(p => {
      // Produit appartient directement à cette catégorie
      if (p.category_id === categoryId) return true;
      // Ou produit appartient à une sous-catégorie de cette catégorie
      if (p.subcategory_id && subcategoryIds.includes(p.subcategory_id)) return true;
      return false;
    });
  }
  
  // Filtrage par sous-catégorie (plus spécifique)
  if(sub) {
    list = list.filter(p => p.subcategory_id == sub);
  }
  
  // Filtrage par recherche
  if(search){
    list = list.filter(p => 
      (p.name||'').toLowerCase().includes(search) || 
      (p.description||'').toLowerCase().includes(search)
    );
  }
  
  // Tri
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

  // Obtenir le nom de la catégorie pour l'affichage
  let categoryDisplay = 'Autres';
  if (p.categories && p.categories.name) {
    categoryDisplay = p.categories.name;
  } else if (p.category_id) {
    const category = categories.find(c => c.id === p.category_id);
    categoryDisplay = category ? category.name : 'Autres';
  } else if (p.category) {
    categoryDisplay = getCategoryName(p.category);
  }

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
    <div style="margin-top:12px"><strong>Catégorie:</strong> ${escapeHtml(categoryDisplay)}${p.subcategories && p.subcategories.name ? ' / ' + escapeHtml(p.subcategories.name) : ''}</div>
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
      if(!adminData){ await supabaseClient.auth.signOut(); throw new Error('Accès refusé : vous n\'êtes pas administrateur.'); }
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

  hideHeader();
  adminSection.classList.remove('hidden');

  await loadOrders();
  await loadAdminStats();
  updateAdminProductsTable();
  
  // NOUVEAU: Afficher la gestion des catégories
  renderAdminCategorySection();
}

/* ========== ADMIN HELPERS ========== */
async function loadOrders(){
  if(!supabaseClient) { 
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

function getStatusText(status){
  const map = {
    'pending':'En attente',
    'confirmed':'Confirmé',
    'delivered':'Livré'
  };
  return map[status] || status;
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
            
            // Obtenir le nom de la catégorie
            let categoryName = 'Autres';
            if (p.categories && p.categories.name) {
              categoryName = p.categories.name;
            } else if (p.category_id) {
              const category = categories.find(c => c.id === p.category_id);
              categoryName = category ? category.name : 'Autres';
            } else if (p.category) {
              categoryName = getCategoryName(p.category);
            }
            
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
              <td class="px-4 py-3">${escapeHtml(categoryName)}</td>
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

// ========== GESTION ADMIN DES CATÉGORIES ==========

function renderAdminCategorySection() {
  const adminSection = document.getElementById('admin-section');
  if (!adminSection) return;
  
  // Vérifier si la section existe déjà
  if (document.getElementById('category-management-section')) return;
  
  // Ajouter la section gestion des catégories après les stats
  const statsSection = adminSection.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4');
  if (!statsSection) return;
  
  const categorySection = document.createElement('div');
  categorySection.id = 'category-management-section';
  categorySection.className = 'bg-white rounded-lg shadow p-6 mb-6';
  categorySection.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-xl font-serif font-bold text-accent">
        <i class="fas fa-tags mr-2"></i> Gestion des Catégories
      </h3>
      <div class="flex gap-2">
        <button class="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded font-medium transition" onclick="showAddGenre()">
          <i class="fas fa-plus mr-2"></i> Genre
        </button>
        <button class="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded font-medium transition" onclick="showAddCategory()">
          <i class="fas fa-plus mr-2"></i> Catégorie
        </button>
        <button class="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded font-medium transition" onclick="showAddSubcategory()">
          <i class="fas fa-plus mr-2"></i> Sous-catégorie
        </button>
      </div>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div>
        <h4 class="font-semibold mb-3">Genres</h4>
        <div id="genres-list" class="space-y-2"></div>
      </div>
      <div>
        <h4 class="font-semibold mb-3">Catégories</h4>
        <div id="categories-list" class="space-y-2"></div>
      </div>
      <div>
        <h4 class="font-semibold mb-3">Sous-catégories</h4>
        <div id="subcategories-list" class="space-y-2"></div>
      </div>
    </div>
  `;
  
  statsSection.parentNode.insertBefore(categorySection, statsSection.nextSibling);
  
  renderCategoriesLists();
}

function renderCategoriesLists() {
  // Genres
  const genresList = document.getElementById('genres-list');
  if (genresList) {
    genresList.innerHTML = genres.map(genre => `
      <div class="flex items-center justify-between p-3 bg-beige-light rounded">
        <div class="flex items-center">
          <i class="${genre.icon || 'fas fa-tag'} mr-2"></i>
          <span class="font-medium">${genre.name}</span>
        </div>
        <div class="flex gap-2">
          <button class="text-blue-600 hover:text-blue-800" onclick="editGenre(${genre.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="text-red-600 hover:text-red-800" onclick="deleteGenre(${genre.id})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }
  
  // Catégories
  const categoriesList = document.getElementById('categories-list');
  if (categoriesList) {
    categoriesList.innerHTML = categories.map(category => {
      const genre = genres.find(g => g.id === category.genre_id);
      return `
        <div class="flex items-center justify-between p-3 bg-beige-light rounded">
          <div>
            <div class="font-medium">${category.name}</div>
            <div class="text-sm text-gray-600">${genre ? genre.name : 'N/A'}</div>
          </div>
          <div class="flex gap-2">
            <button class="text-blue-600 hover:text-blue-800" onclick="editCategory(${category.id})">
              <i class="fas fa-edit"></i>
            </button>
            <button class="text-red-600 hover:text-red-800" onclick="deleteCategory(${category.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // Sous-catégories
  const subcategoriesList = document.getElementById('subcategories-list');
  if (subcategoriesList) {
    subcategoriesList.innerHTML = subcategories.map(subcategory => {
      const category = categories.find(c => c.id === subcategory.category_id);
      return `
        <div class="flex items-center justify-between p-3 bg-beige-light rounded">
          <div>
            <div class="font-medium">${subcategory.name}</div>
            <div class="text-sm text-gray-600">${category ? category.name : 'N/A'}</div>
          </div>
          <div class="flex gap-2">
            <button class="text-blue-600 hover:text-blue-800" onclick="editSubcategory(${subcategory.id})">
              <i class="fas fa-edit"></i>
            </button>
            <button class="text-red-600 hover:text-red-800" onclick="deleteSubcategory(${subcategory.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ========== MODAL FUNCTIONS POUR CATÉGORIES ==========

function showAddGenre() {
  editingCategory = null;
  const modal = createCategoryModal('genre');
  document.body.appendChild(modal);
}

function showAddCategory() {
  editingCategory = null;
  const modal = createCategoryModal('category');
  document.body.appendChild(modal);
}

function showAddSubcategory() {
  editingCategory = null;
  const modal = createCategoryModal('subcategory');
  document.body.appendChild(modal);
}

function editGenre(id) {
  const genre = genres.find(g => g.id === id);
  if (!genre) return;
  editingCategory = { type: 'genre', data: genre };
  const modal = createCategoryModal('genre', genre);
  document.body.appendChild(modal);
}

function editCategory(id) {
  const category = categories.find(c => c.id === id);
  if (!category) return;
  editingCategory = { type: 'category', data: category };
  const modal = createCategoryModal('category', category);
  document.body.appendChild(modal);
}

function editSubcategory(id) {
  const subcategory = subcategories.find(s => s.id === id);
  if (!subcategory) return;
  editingCategory = { type: 'subcategory', data: subcategory };
  const modal = createCategoryModal('subcategory', subcategory);
  document.body.appendChild(modal);
}

async function deleteGenre(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce genre ?')) return;
  
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('genres').delete().eq('id', id);
      if (error) throw error;
    }
    
    genres = genres.filter(g => g.id !== id);
    renderDynamicHeader();
    renderCategoriesLists();
    showNotification('Genre supprimé avec succès!', 'success');
  } catch (err) {
    console.error('deleteGenre', err);
    showNotification('Erreur: ' + (err.message || err), 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;
  
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('categories').delete().eq('id', id);
      if (error) throw error;
    }
    
    categories = categories.filter(c => c.id !== id);
    renderDynamicHeader();
    renderCategoriesLists();
    updateProductFormCategories();
    showNotification('Catégorie supprimée avec succès!', 'success');
  } catch (err) {
    console.error('deleteCategory', err);
    showNotification('Erreur: ' + (err.message || err), 'error');
  }
}

async function deleteSubcategory(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette sous-catégorie ?')) return;
  
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('subcategories').delete().eq('id', id);
      if (error) throw error;
    }
    
    subcategories = subcategories.filter(s => s.id !== id);
    renderCategoriesLists();
    showNotification('Sous-catégorie supprimée avec succès!', 'success');
  } catch (err) {
    console.error('deleteSubcategory', err);
    showNotification('Erreur: ' + (err.message || err), 'error');
  }
}

function createCategoryModal(type, existingData = null) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  
  let title, fields, submitText;
  const isEditing = !!existingData;
  
  switch (type) {
    case 'genre':
      title = isEditing ? 'Modifier le Genre' : 'Ajouter un Genre';
      fields = `
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Nom *</label>
          <input type="text" id="modal-name" required class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent" value="${existingData ? existingData.name : ''}">
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Icône FontAwesome</label>
          <input type="text" id="modal-icon" placeholder="fas fa-venus" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent" value="${existingData ? existingData.icon || '' : ''}">
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Ordre d'affichage</label>
          <input type="number" id="modal-order" min="0" value="${existingData ? existingData.display_order || 0 : 0}" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent">
        </div>
      `;
      submitText = isEditing ? 'Modifier le genre' : 'Ajouter le genre';
      break;
      
    case 'category':
      title = isEditing ? 'Modifier la Catégorie' : 'Ajouter une Catégorie';
      fields = `
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Nom *</label>
          <input type="text" id="modal-name" required class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent" value="${existingData ? existingData.name : ''}">
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Slug</label>
          <input type="text" id="modal-slug" placeholder="Ex: summer-vibes" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent" value="${existingData ? existingData.slug || '' : ''}">
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Genre *</label>
          <select id="modal-genre" required class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="">Choisir un genre</option>
            ${genres.map(g => `<option value="${g.id}" ${existingData && existingData.genre_id === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
          </select>
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Ordre d'affichage</label>
          <input type="number" id="modal-order" min="0" value="${existingData ? existingData.display_order || 0 : 0}" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent">
        </div>
      `;
      submitText = isEditing ? 'Modifier la catégorie' : 'Ajouter la catégorie';
      break;
      
    case 'subcategory':
      title = isEditing ? 'Modifier la Sous-catégorie' : 'Ajouter une Sous-catégorie';
      fields = `
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Nom *</label>
          <input type="text" id="modal-name" required class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent" value="${existingData ? existingData.name : ''}">
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Slug</label>
          <input type="text" id="modal-slug" placeholder="Ex: mini-dresses" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent" value="${existingData ? existingData.slug || '' : ''}">
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Catégorie parente *</label>
          <select id="modal-category" required class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="">Choisir une catégorie</option>
            ${categories.map(c => `<option value="${c.id}" ${existingData && existingData.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Ordre d'affichage</label>
          <input type="number" id="modal-order" min="0" value="${existingData ? existingData.display_order || 0 : 0}" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent">
        </div>
      `;
      submitText = isEditing ? 'Modifier la sous-catégorie' : 'Ajouter la sous-catégorie';
      break;
  }
  
  modal.innerHTML = `
    <div class="modal-content max-w-md">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-serif font-bold text-accent">${title}</h2>
        <button class="text-gray-500 hover:text-gray-700 text-2xl" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <form onsubmit="handleCategorySubmit(event, '${type}')">
        ${fields}
        <button type="submit" class="bg-accent hover:bg-accent-dark text-white w-full py-3 rounded font-medium transition">
          ${submitText}
        </button>
      </form>
    </div>
  `;
  
  // Auto-generate slug from name si ce n'est pas une édition
  if (!isEditing) {
    const nameInput = modal.querySelector('#modal-name');
    const slugInput = modal.querySelector('#modal-slug');
    if (nameInput && slugInput) {
      nameInput.addEventListener('input', (e) => {
        const slug = e.target.value.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        slugInput.value = slug;
      });
    }
  }
  
  return modal;
}

async function handleCategorySubmit(event, type) {
  event.preventDefault();
  
  const name = document.getElementById('modal-name').value.trim();
  const order = parseInt(document.getElementById('modal-order').value) || 0;
  
  if (!name) {
    showNotification('Le nom est requis', 'error');
    return;
  }
  
  try {
    let data;
    const isEditing = editingCategory && editingCategory.data;
    
    switch (type) {
      case 'genre':
        const icon = document.getElementById('modal-icon').value.trim();
        data = { name, icon, display_order: order, is_active: true };
        
        if (isEditing) {
          if (supabaseClient) {
            const { error } = await supabaseClient
              .from('genres')
              .update(data)
              .eq('id', editingCategory.data.id);
            if (error) throw error;
          }
          const index = genres.findIndex(g => g.id === editingCategory.data.id);
          if (index !== -1) genres[index] = { ...editingCategory.data, ...data };
        } else {
          if (supabaseClient) {
            const { data: result, error } = await supabaseClient
              .from('genres')
              .insert(data)
              .select();
            if (error) throw error;
            genres.push(result[0]);
          } else {
            data.id = Date.now();
            genres.push(data);
          }
        }
        break;
        
      case 'category':
        const slug = document.getElementById('modal-slug').value.trim();
        const genreId = parseInt(document.getElementById('modal-genre').value);
        
        if (!genreId) {
          showNotification('Veuillez sélectionner un genre', 'error');
          return;
        }
        
        data = { name, slug, genre_id: genreId, display_order: order, is_active: true };
        
        if (isEditing) {
          if (supabaseClient) {
            const { error } = await supabaseClient
              .from('categories')
              .update(data)
              .eq('id', editingCategory.data.id);
            if (error) throw error;
          }
          const index = categories.findIndex(c => c.id === editingCategory.data.id);
          if (index !== -1) categories[index] = { ...editingCategory.data, ...data };
        } else {
          if (supabaseClient) {
            const { data: result, error } = await supabaseClient
              .from('categories')
              .insert(data)
              .select('*, genres(name)');
            if (error) throw error;
            categories.push(result[0]);
          } else {
            data.id = Date.now();
            categories.push(data);
          }
        }
        break;
        
      case 'subcategory':
        const subSlug = document.getElementById('modal-slug').value.trim();
        const categoryId = parseInt(document.getElementById('modal-category').value);
        
        if (!categoryId) {
          showNotification('Veuillez sélectionner une catégorie parente', 'error');
          return;
        }
        
        data = { name, slug: subSlug, category_id: categoryId, display_order: order, is_active: true };
        
        if (isEditing) {
          if (supabaseClient) {
            const { error } = await supabaseClient
              .from('subcategories')
              .update(data)
              .eq('id', editingCategory.data.id);
            if (error) throw error;
          }
          const index = subcategories.findIndex(s => s.id === editingCategory.data.id);
          if (index !== -1) subcategories[index] = { ...editingCategory.data, ...data };
        } else {
          if (supabaseClient) {
            const { data: result, error } = await supabaseClient
              .from('subcategories')
              .insert(data)
              .select('*, categories(name, genres(name))');
            if (error) throw error;
            subcategories.push(result[0]);
          } else {
            data.id = Date.now();
            subcategories.push(data);
          }
        }
        break;
    }
    
    // Fermer le modal
    event.target.closest('.modal').remove();
    
    // Rafraîchir l'affichage
    renderDynamicHeader();
    renderCategoriesLists();
    updateProductFormCategories();
    
    const action = isEditing ? 'modifié' : 'ajouté';
    showNotification(`${type} ${action} avec succès!`, 'success');
  } catch (err) {
    console.error('Erreur catégorie:', err);
    showNotification('Erreur: ' + (err.message || err), 'error');
  }
}

// ========== MISE À JOUR DES FORMULAIRES PRODUITS ==========

function updateProductFormCategories() {
  const categorySelect = document.getElementById('product-category');
  if (categorySelect) {
    const currentValue = categorySelect.value;
    categorySelect.innerHTML = '<option value="">Choisir une catégorie</option>' +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (currentValue) categorySelect.value = currentValue;
  }
  
  const subcategorySelect = document.getElementById('product-subcategory');
  if (subcategorySelect) {
    subcategorySelect.innerHTML = '<option value="">Choisir une sous-catégorie</option>';
  }
}

/* ========== PRODUCT MANAGEMENT (MODIFIÉ POUR NOUVELLES CATÉGORIES) ========== */
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
  document.getElementById('product-stock').value = product.stock || 0;
  document.getElementById('product-image').value = product.image_url || '';
  document.getElementById('product-promo').value = product.promo || 0;
  
  // Utiliser category_id au lieu de category
  const categorySelect = document.getElementById('product-category');
  if (categorySelect) {
    categorySelect.value = product.category_id || '';
    // Déclencher le changement pour charger les sous-catégories
    onProductCategoryChange();
  }
  
  // Définir la sous-catégorie
  const subcategorySelect = document.getElementById('product-subcategory');
  if (subcategorySelect && product.subcategory_id) {
    subcategorySelect.value = product.subcategory_id;
  }
  
  // Changer le titre du modal
  const modalTitle = document.querySelector('#product-modal .text-xl');
  if(modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit mr-2"></i> Modifier le Produit';
  
  // Changer le texte du bouton
  const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
  if(submitBtn) submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Enregistrer les modifications';
  
  showModal('product-modal');
}

function onProductCategoryChange() {
  const categoryId = document.getElementById('product-category').value;
  const subcategorySelect = document.getElementById('product-subcategory');
  
  if (!subcategorySelect) return;
  
  subcategorySelect.innerHTML = '<option value="">Choisir une sous-catégorie</option>';
  
  if (categoryId) {
    const categorySubcategories = subcategories.filter(s => s.category_id == categoryId);
    categorySubcategories.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      subcategorySelect.appendChild(opt);
    });
  }
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

/* add/edit product (modifié pour nouvelles catégories) */
async function handleAddProduct(e){
  e.preventDefault();
  const name = document.getElementById('product-name').value.trim();
  const price = parseFloat(document.getElementById('product-price').value);
  const desc = document.getElementById('product-description').value.trim();
  const categoryId = parseInt(document.getElementById('product-category').value) || null;
  const subcategoryId = parseInt(document.getElementById('product-subcategory').value) || null;
  const stock = parseInt(document.getElementById('product-stock').value,10);
  const image = document.getElementById('product-image').value.trim();
  const promo = parseInt(document.getElementById('product-promo').value,10) || 0;
  
  if(!name || isNaN(price)) { 
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
    category_id: categoryId,
    subcategory_id: subcategoryId,
    stock: isNaN(stock) ? 0 : stock, 
    promo: promo,
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
  
  // Reset des selects de catégories
  updateProductFormCategories();
}

/* ========== HELPERS (category names) - MODIFIÉ ========== */
function getCategoryName(category){
  // Compatibility avec l'ancien système
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

/* ========== NAVIGATION FUNCTIONS ========== */
function showHome(){ 
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

/* ========== INITIALISATION DES CATÉGORIES ========== */
async function initCategories() {
  await loadGenres();
  await loadCategories();
  await loadSubcategories();
  renderDynamicHeader();
  updateProductFormCategories();
}

/* ========== SETUP & INIT (MODIFIÉ) ========== */
async function init(){
  try {
    console.log('Init...');
    if(window.supabase){
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      console.log('Supabase initialisé');
      
      // Charger les catégories en premier
      await initCategories();
      await loadProducts();
    } else {
      console.warn('Supabase non disponible, mode demo');
      // Initialiser les catégories demo
      await initCategories();
      products = demoProducts.slice();
      buildCategoryTree();
      renderProducts();
    }

    setupEventListeners();
    loadCartFromStorage();
    updateCartCount();
  } catch(err){ 
    console.error('init', err); 
    // Fallback complet
    await initCategories();
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
  
  // Event listener pour le changement de catégorie dans le formulaire produit
  const productCategorySelect = document.getElementById('product-category');
  if(productCategorySelect) {
    productCategorySelect.addEventListener('change', onProductCategoryChange);
  }
  
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