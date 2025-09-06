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
let uploadedImages = {};
let passwordResetInProgress = false;

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
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Vérifier le type de fichier
  if (!file.type.startsWith('image/')) {
    showNotification('Veuillez sélectionner un fichier image', 'error');
    return;
  }

  // Vérifier la taille (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showNotification('L\'image est trop volumineuse (max 5MB)', 'error');
    return;
  }

  try {
    // Afficher un indicateur de chargement
    const imagePreview = document.getElementById('image-preview');
    const uploadButton = document.getElementById('upload-button');
    
    if (imagePreview) imagePreview.innerHTML = '<div class="loading">Chargement...</div>';
    if (uploadButton) uploadButton.disabled = true;

    if (supabaseClient) {
      // VRAIE SOLUTION: Upload vers Supabase Storage
      const fileName = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`;
      
      // Upload vers Supabase Storage
      const { data, error } = await supabaseClient.storage
        .from('product-images')
        .upload(fileName, file);

      if (error) {
        console.error('Erreur upload Supabase:', error);
        throw new Error('Erreur lors de l\'upload: ' + error.message);
      }

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabaseClient.storage
        .from('product-images')
        .getPublicUrl(fileName);

      // Mettre à jour l'aperçu
      if (imagePreview) {
        imagePreview.innerHTML = `
          <img src="${publicUrl}" alt="Aperçu" style="max-width: 200px; max-height: 200px; object-fit: cover; border-radius: 8px;">
        `;
      }
      
      // Stocker l'URL de l'image directement
      document.getElementById('product-image').value = publicUrl;
      document.getElementById('product-image-id').value = '';
      
      showNotification('Image uploadée avec succès!', 'success');
    } else {
      // Mode demo/fallback: utiliser base64 mais l'enregistrer dans image_url aussi
      const base64Image = await fileToBase64(file);
      const imageId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // CORRECTION: Stocker dans les deux endroits
      uploadedImages[imageId] = base64Image;
      
      if (imagePreview) {
        imagePreview.innerHTML = `
          <img src="${base64Image}" alt="Aperçu" style="max-width: 200px; max-height: 200px; object-fit: cover; border-radius: 8px;">
        `;
      }
      
      // CORRECTION: Mettre l'image base64 directement dans image_url ET image_id
      document.getElementById('product-image').value = base64Image;
      document.getElementById('product-image-id').value = imageId;
      
      // Sauvegarder immédiatement
      saveImagesToStorage();
      showNotification('Image uploadée (mode demo)!', 'success');
    }

  } catch (error) {
    console.error('Erreur upload:', error);
    showNotification('Erreur lors de l\'upload de l\'image: ' + error.message, 'error');
  } finally {
    if (uploadButton) uploadButton.disabled = false;
  }
}
function getImageUrl(product) {
  // 1. URL directe (Supabase Storage ou URL complète)
  if (product.image_url && 
      product.image_url !== 'https://via.placeholder.com/600x800?text=Image' &&
      !product.image_url.includes('via.placeholder.com')) {
    return product.image_url;
  }
  
  // 2. Image locale (mode demo/fallback)
  if (product.image_id && typeof uploadedImages !== 'undefined' && uploadedImages[product.image_id]) {
    return uploadedImages[product.image_id];
  }
  
  // 3. Générer une image de placeholder locale
  return generatePlaceholderImage(400, 500, 'Image\nnon disponible');
}
function getImageUrl(product) {
  // 1. Si image_url existe et n'est pas un placeholder, l'utiliser
  if (product.image_url && 
      product.image_url !== 'https://via.placeholder.com/600x800?text=Image' &&
      !product.image_url.includes('via.placeholder.com') &&
      product.image_url.trim() !== '') {
    return product.image_url;
  }
  
  // 2. Si image_id existe et image dans uploadedImages, l'utiliser
  if (product.image_id && uploadedImages && uploadedImages[product.image_id]) {
    return uploadedImages[product.image_id];
  }
  
  // 3. Générer une image de placeholder locale
  return generatePlaceholderImage(400, 500, product.name || 'Image\nnon disponible');
}
function fixPlaceholderUrls() {
  // Corriger toutes les images avec des URLs placeholder problématiques
  document.querySelectorAll('img[src*="via.placeholder.com"]').forEach(img => {
    const width = img.width || 400;
    const height = img.height || 500;
    img.src = generatePlaceholderImage(width, height, 'Image\nnon disponible');
  });
  
  // Corriger dans les données des produits si elles existent
  if (typeof products !== 'undefined' && Array.isArray(products)) {
    products.forEach(product => {
      if (product.image_url && product.image_url.includes('via.placeholder.com')) {
        product.image_url = generatePlaceholderImage(400, 500, 'Image\nnon disponible');
      }
    });
  }
}
function saveImagesToStorage() {
  try {
    localStorage.setItem('elyna_uploaded_images', JSON.stringify(uploadedImages));
  } catch (e) {
    console.warn('Impossible de sauvegarder les images:', e);
  }
}

function loadImagesFromStorage() {
  try {
    // Charger les images uploadées
    const storedImages = localStorage.getItem('elyna_uploaded_images');
    if (storedImages) {
      uploadedImages = JSON.parse(storedImages);
    }
    
    // NOUVEAU: Charger aussi les produits sauvegardés en mode demo
    if (!supabaseClient) {
      const storedProducts = localStorage.getItem('elyna_products');
      if (storedProducts) {
        const savedProducts = JSON.parse(storedProducts);
        // Fusionner avec les produits demo mais préserver les ajouts
        products = [...demoProducts, ...savedProducts.filter(p => p.id > 1000)];
        console.log('Produits chargés depuis le stockage local');
      }
    }
  } catch (e) {
    console.warn('Impossible de charger les images:', e);
    uploadedImages = {};
  }
}
function handleImageError(img) {
  console.warn('Erreur de chargement d\'image:', img.src);
  
  // Éviter les boucles infinies
  if (img.src.startsWith('data:image/png;base64,')) {
    console.warn('Image placeholder déjà générée, pas de remplacement');
    return;
  }
  
  // Vérifier si c'est une image uploadée localement
  const productId = img.closest('[data-id]')?.dataset?.id;
  if (productId) {
    const product = products.find(p => p.id == productId);
    if (product && product.image_id && uploadedImages[product.image_id]) {
      img.src = uploadedImages[product.image_id];
      return;
    }
  }
  
  // Remplacer par une image générée localement
  const placeholderSrc = generatePlaceholderImage(
    img.naturalWidth || 400, 
    img.naturalHeight || 500, 
    'Image\nnon disponible'
  );
  
  // Éviter de remplacer si c'est déjà le même placeholder
  if (img.src !== placeholderSrc) {
    img.src = placeholderSrc;
  }
  
  // Ajouter une classe pour le styling d'erreur
  img.classList.add('image-error');
}
function generatePlaceholderImage(width = 400, height = 500, text = 'Image non disponible') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // Arrière-plan avec dégradé
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#F5F5DC'); // Beige clair
  gradient.addColorStop(1, '#E6E6D2'); // Beige plus foncé
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Bordure
  ctx.strokeStyle = '#D4D4AA';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width-2, height-2);
  
  // Icône d'image
  ctx.fillStyle = '#A67C52';
  ctx.font = '48px FontAwesome';
  ctx.textAlign = 'center';
  ctx.fillText('🖼️', width/2, height/2 - 20);
  
  // Texte
  ctx.fillStyle = '#8B7355';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Diviser le texte en lignes
  const words = text.split(/[\s\n]/);
  const lines = [];
  let currentLine = '';
  
  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > width - 60 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);
  
  // Dessiner les lignes
  const lineHeight = 22;
  const totalHeight = lines.length * lineHeight;
  const startY = (height/2) + 40;
  
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + (index * lineHeight));
  });
  
  return canvas.toDataURL('image/png');
}
function createPasswordResetModals() {
  // Supprimer les modales existantes si elles existent
  const existingReset = document.getElementById('password-reset-modal');
  const existingUpdate = document.getElementById('password-update-modal');
  if (existingReset) existingReset.remove();
  if (existingUpdate) existingUpdate.remove();

  // Modal de demande de réinitialisation - IDs CORRIGÉS
  const resetModal = document.createElement('div');
  resetModal.id = 'password-reset-modal';
  resetModal.className = 'modal';
  resetModal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h2 style="font-size: 1.25rem; font-weight: bold; color: #A67C52; margin: 0;">
          <i class="fas fa-key" style="margin-right: 8px;"></i> Réinitialiser le mot de passe
        </h2>
        <button onclick="closeModal('password-reset-modal')" style="
          background: none; 
          border: none; 
          font-size: 24px; 
          color: #666; 
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">&times;</button>
      </div>
      
      <div style="color: #666; margin-bottom: 24px; font-size: 14px; line-height: 1.5;">
        Saisissez votre adresse email pour recevoir un lien de réinitialisation de votre mot de passe.
      </div>
      
      <!-- ID CORRIGÉ : password-reset-error au lieu de reset-error -->
      <div id="password-reset-error" style="
        background: #fee2e2; 
        border: 1px solid #fca5a5; 
        color: #dc2626; 
        padding: 12px; 
        border-radius: 8px; 
        margin-bottom: 16px; 
        font-size: 14px;
        display: none;
      "></div>
      
      <!-- ID CORRIGÉ : password-reset-success au lieu de reset-success -->
      <div id="password-reset-success" style="
        background: #d1fae5; 
        border: 1px solid #6ee7b7; 
        color: #065f46; 
        padding: 12px; 
        border-radius: 8px; 
        margin-bottom: 16px; 
        font-size: 14px;
        display: none;
      "></div>
      
      <form id="password-reset-form">
        <div style="margin-bottom: 20px;">
          <label style="display: block; color: #374151; margin-bottom: 8px; font-weight: 500; font-size: 14px;">
            Adresse email *
          </label>
          <input 
            type="email" 
            id="reset-email" 
            required 
            placeholder="votre@email.com" 
            style="
              width: 100%; 
              padding: 12px 16px; 
              border: 2px solid #d1d5db; 
              border-radius: 8px; 
              font-size: 14px; 
              outline: none; 
              transition: border-color 0.3s;
              box-sizing: border-box;
            " 
            onfocus="this.style.borderColor='#A67C52'" 
            onblur="this.style.borderColor='#d1d5db'"
          >
        </div>
        
        <button 
          type="submit" 
          id="reset-submit-btn"
          style="
            background: #A67C52; 
            color: white; 
            width: 100%; 
            padding: 14px; 
            border: none; 
            border-radius: 8px; 
            font-weight: 600; 
            cursor: pointer; 
            transition: background-color 0.3s;
            font-size: 15px;
            margin-bottom: 20px;
          " 
          onmouseover="this.style.background='#8B6A42'" 
          onmouseout="this.style.background='#A67C52'"
        >
          <i class="fas fa-paper-plane" style="margin-right: 8px;"></i>
          Envoyer le lien de réinitialisation
        </button>
      </form>
      
      <div style="text-align: center;">
        <button 
          onclick="closeModal('password-reset-modal'); showModal('admin-modal');" 
          style="
            background: none; 
            border: none; 
            color: #A67C52; 
            font-size: 14px; 
            cursor: pointer; 
            text-decoration: underline;
            padding: 8px;
          "
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  `;

  // Modal de mise à jour du mot de passe - CHAMPS BIEN VISIBLES ET FONCTIONNELS
  const updateModal = document.createElement('div');
  updateModal.id = 'password-update-modal';
  updateModal.className = 'modal';
  updateModal.innerHTML = `
    <div class="modal-content" style="max-width: 450px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h2 style="font-size: 1.3rem; font-weight: bold; color: #A67C52; margin: 0;">
          <i class="fas fa-lock" style="margin-right: 8px;"></i> Nouveau mot de passe
        </h2>
        <button onclick="closeModal('password-update-modal')" style="
          background: none; 
          border: none; 
          font-size: 24px; 
          color: #666; 
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">&times;</button>
      </div>
      
      <div style="color: #666; margin-bottom: 24px; font-size: 14px; line-height: 1.5; background: #f8f9fa; padding: 12px; border-radius: 8px; border-left: 4px solid #A67C52;">
        <i class="fas fa-info-circle" style="color: #A67C52; margin-right: 8px;"></i>
        <strong>Choisissez un nouveau mot de passe sécurisé.</strong><br>
        Il remplacera définitivement votre ancien mot de passe.
      </div>
      
      <div id="update-error" style="
        background: #fee2e2; 
        border: 1px solid #fca5a5; 
        color: #dc2626; 
        padding: 12px; 
        border-radius: 8px; 
        margin-bottom: 16px; 
        font-size: 14px;
        display: none;
      "></div>
      
      <div id="update-success" style="
        background: #d1fae5; 
        border: 1px solid #6ee7b7; 
        color: #065f46; 
        padding: 12px; 
        border-radius: 8px; 
        margin-bottom: 16px; 
        font-size: 14px;
        display: none;
      "></div>
      
      <form id="password-update-form" style="display: block;">
        
        <!-- CHAMP 1: NOUVEAU MOT DE PASSE - TRÈS VISIBLE -->
        <div style="margin-bottom: 20px; background: #f8f9fa; padding: 16px; border-radius: 8px; border: 2px solid #e9ecef;">
          <label for="new-password" style="display: block; color: #A67C52; margin-bottom: 8px; font-weight: bold; font-size: 15px;">
            <i class="fas fa-key" style="margin-right: 8px;"></i>
            NOUVEAU MOT DE PASSE *
          </label>
          <div style="position: relative;">
            <input 
              type="password" 
              id="new-password" 
              name="new-password"
              required 
              minlength="6" 
              placeholder="Tapez votre nouveau mot de passe (min. 6 caractères)" 
              autocomplete="new-password"
              style="
                width: 100%; 
                padding: 16px 50px 16px 16px; 
                border: 3px solid #A67C52; 
                border-radius: 8px; 
                font-size: 16px; 
                outline: none; 
                transition: all 0.3s;
                box-sizing: border-box;
                background: white;
                font-weight: 500;
              " 
              onfocus="this.style.borderColor='#8B6A42'; this.style.boxShadow='0 0 10px rgba(166, 124, 82, 0.3)'; this.parentElement.parentElement.style.background='#fff';" 
              onblur="this.style.borderColor='#A67C52'; this.style.boxShadow='none'; this.parentElement.parentElement.style.background='#f8f9fa';"
            >
            <button type="button" onclick="togglePasswordVisibility('new-password')" style="
              position: absolute;
              right: 12px;
              top: 50%;
              transform: translateY(-50%);
              background: none;
              border: none;
              color: #A67C52;
              cursor: pointer;
              font-size: 18px;
              padding: 4px;
            " title="Afficher/Masquer le mot de passe">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <div style="font-size: 12px; color: #666; margin-top: 6px;">
            <i class="fas fa-shield-alt" style="margin-right: 4px; color: #A67C52;"></i>
            Minimum 6 caractères. Utilisez lettres, chiffres et symboles pour plus de sécurité.
          </div>
        </div>
        
        <!-- CHAMP 2: CONFIRMATION MOT DE PASSE - TRÈS VISIBLE -->
        <div style="margin-bottom: 24px; background: #f8f9fa; padding: 16px; border-radius: 8px; border: 2px solid #e9ecef;">
          <label for="confirm-password" style="display: block; color: #A67C52; margin-bottom: 8px; font-weight: bold; font-size: 15px;">
            <i class="fas fa-check-double" style="margin-right: 8px;"></i>
            CONFIRMER LE MOT DE PASSE *
          </label>
          <div style="position: relative;">
            <input 
              type="password" 
              id="confirm-password" 
              name="confirm-password"
              required 
              minlength="6" 
              placeholder="Retapez exactement le même mot de passe" 
              autocomplete="new-password"
              style="
                width: 100%; 
                padding: 16px 50px 16px 16px; 
                border: 3px solid #A67C52; 
                border-radius: 8px; 
                font-size: 16px; 
                outline: none; 
                transition: all 0.3s;
                box-sizing: border-box;
                background: white;
                font-weight: 500;
              " 
              onfocus="this.style.borderColor='#8B6A42'; this.style.boxShadow='0 0 10px rgba(166, 124, 82, 0.3)'; this.parentElement.parentElement.style.background='#fff';" 
              onblur="this.style.borderColor='#A67C52'; this.style.boxShadow='none'; this.parentElement.parentElement.style.background='#f8f9fa';"
              oninput="checkPasswordMatch()"
            >
            <button type="button" onclick="togglePasswordVisibility('confirm-password')" style="
              position: absolute;
              right: 12px;
              top: 50%;
              transform: translateY(-50%);
              background: none;
              border: none;
              color: #A67C52;
              cursor: pointer;
              font-size: 18px;
              padding: 4px;
            " title="Afficher/Masquer le mot de passe">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <div id="password-match-indicator" style="font-size: 13px; margin-top: 6px; display: none; font-weight: 500;">
          </div>
        </div>
        
        <!-- BOUTON DE SOUMISSION - TRÈS VISIBLE -->
        <button 
          type="submit" 
          id="update-submit-btn"
          style="
            background: linear-gradient(135deg, #A67C52, #8B6A42); 
            color: white; 
            width: 100%; 
            padding: 18px; 
            border: none; 
            border-radius: 10px; 
            font-weight: bold; 
            cursor: pointer; 
            transition: all 0.3s;
            font-size: 17px;
            box-shadow: 0 4px 15px rgba(166, 124, 82, 0.4);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          " 
          onmouseover="this.style.background='linear-gradient(135deg, #8B6A42, #6D5235)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(166, 124, 82, 0.6)';" 
          onmouseout="this.style.background='linear-gradient(135deg, #A67C52, #8B6A42)'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(166, 124, 82, 0.4)';"
        >
          <i class="fas fa-save" style="margin-right: 10px;"></i>
          ENREGISTRER LE NOUVEAU MOT DE PASSE
        </button>
        
        <!-- MESSAGE DE SÉCURITÉ -->
        <div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #e0f7fa, #f0f9ff); border: 1px solid #A67C52; border-radius: 8px; font-size: 13px; color: #0369a1; text-align: center;">
          <i class="fas fa-lock" style="margin-right: 6px; color: #A67C52;"></i>
          <strong>Sécurisé :</strong> Votre nouveau mot de passe sera chiffré et remplacera définitivement l'ancien dans la base de données.
        </div>
      </form>
    </div>
  `;

  // Ajouter les modales au DOM
  document.body.appendChild(resetModal);
  document.body.appendChild(updateModal);
  
  console.log('✅ Modales créées avec champs visibles:', {
    resetModal: !!document.getElementById('password-reset-modal'),
    updateModal: !!document.getElementById('password-update-modal'),
    newPasswordField: !!document.getElementById('new-password'),
    confirmPasswordField: !!document.getElementById('confirm-password')
  });
}
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  const button = input.parentElement.querySelector('button i');
  
  if (input.type === 'password') {
    input.type = 'text';
    if (button) button.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    if (button) button.className = 'fas fa-eye';
  }
  console.log(`👁️ Visibilité basculée pour ${inputId}:`, input.type);
}
function showMessage(elementId, message, type = 'error') {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = message;
    element.style.display = 'block';
    element.classList.remove('hidden');
  }
}

function hideMessage(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = 'none';
    element.classList.add('hidden');
  }
}
function showModal(modalId) {
  console.log('🔄 showModal appelée pour:', modalId);
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    console.log('✅ Modal activée:', modalId);
    
    // Fermer en cliquant sur l'arrière-plan
    modal.onclick = function(e) {
      if (e.target === modal) {
        closeModal(modalId);
      }
    };
  } else {
    console.error('❌ Modal non trouvée:', modalId);
  }
}

function closeModal(modalId) {
  console.log('🔄 closeModal appelée pour:', modalId);
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    console.log('✅ Modal fermée:', modalId);
    
    // Réinitialiser les messages d'erreur/succès
    const errorEl = modal.querySelector('[id$="-error"]');
    const successEl = modal.querySelector('[id$="-success"]');
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.classList.add('hidden');
    }
    if (successEl) {
      successEl.style.display = 'none';
      successEl.classList.add('hidden');
    }
  } else {
    console.error('❌ Modal non trouvée:', modalId);
  }
}
// ========== MODIFIER LA MODAL ADMIN EXISTANTE ==========
function addForgotPasswordLink() {
  const adminModal = document.getElementById('admin-modal');
  if (!adminModal) return;
  
  const form = adminModal.querySelector('form');
  if (!form) return;
  
  // Vérifier si le lien n'existe pas déjà
  if (adminModal.querySelector('.forgot-password-link')) return;
  
  const forgotPasswordDiv = document.createElement('div');
  forgotPasswordDiv.className = 'forgot-password-link';
  forgotPasswordDiv.style.cssText = 'text-align: center; margin-top: 16px;';
  forgotPasswordDiv.innerHTML = `
    <button type="button" onclick="closeModal('admin-modal'); showPasswordReset();" style="background: none; border: none; color: var(--accent); font-size: 14px; cursor: pointer; text-decoration: underline;">
      Mot de passe oublié ?
    </button>
  `;
  
  form.appendChild(forgotPasswordDiv);
}

// ========== FONCTIONS DE RÉINITIALISATION ==========
function showPasswordReset() {
  showModal('password-reset-modal');
}

async function handlePasswordReset(e) {
  e.preventDefault();
  console.log('🔄 Début de handlePasswordReset');
  
  const email = document.getElementById('reset-email').value.trim();
  console.log('📧 Email saisi:', email);
  console.log('🔗 Supabase client:', supabaseClient ? 'Connecté' : 'Non connecté');
  
  hideMessage('reset-error');
  hideMessage('reset-success');
  
  if(!email) {
    console.log('❌ Email vide');
    showMessage('reset-error', '<i class="fas fa-exclamation-triangle"></i> Veuillez saisir votre adresse email');
    return;
  }
  
  if(!isValidEmail(email)) {
    console.log('❌ Email invalide:', email);
    showMessage('reset-error', '<i class="fas fa-exclamation-triangle"></i> Veuillez saisir une adresse email valide');
    return;
  }
  
  console.log('✅ Email valide, début du processus');
  
  passwordResetInProgress = true;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Envoi en cours...';
  submitBtn.disabled = true;
  
  try {
    if(supabaseClient) {
      console.log('🚀 Tentative d\'envoi via Supabase...');
      
      // Vérifier d'abord la configuration Supabase
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        console.log('👤 Utilisateur actuel:', user);
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        console.log('🔐 Session actuelle:', session);
      } catch (authError) {
        console.log('⚠️ Erreur auth (non critique):', authError);
      }
      
      // Vérifier si l'email existe dans admin_users
      try {
        console.log('🔍 Vérification de l\'email dans admin_users...');
        const { data: adminCheck, error: adminError } = await supabaseClient
          .from('admin_users')
          .select('email, id')
          .eq('email', email)
          .maybeSingle();
        
        console.log('👥 Résultat vérification admin:', {
          found: !!adminCheck,
          data: adminCheck,
          error: adminError
        });
        
        if (!adminCheck) {
          throw new Error('Aucun compte administrateur trouvé avec cette adresse email.');
        }
        
      } catch (checkError) {
        console.log('❌ Erreur vérification admin:', checkError);
        throw checkError;
      }
      
      // Tentative de reset avec configuration détaillée
      console.log('📤 Appel resetPasswordForEmail...');
      const resetUrl = `${window.location.origin}${window.location.pathname}?type=recovery`;
      console.log('🔗 URL de redirection:', resetUrl);
      
      const resetResult = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl
      });
      
      console.log('📤 Résultat de resetPasswordForEmail:', {
        data: resetResult.data,
        error: resetResult.error
      });
      
      if(resetResult.error) {
        console.error('❌ Erreur Supabase:', resetResult.error);
        throw resetResult.error;
      }
      
      console.log('✅ Email envoyé avec succès via Supabase');
      showMessage('reset-success', '<i class="fas fa-check-circle"></i> Un email de réinitialisation a été envoyé à votre adresse', 'success');
      
    } else {
      console.log('🔄 Mode demo - simulation...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Simulation terminée');
      showMessage('reset-success', '<i class="fas fa-check-circle"></i> [MODE DEMO] Email de réinitialisation simulé envoyé', 'success');
    }
    
    document.getElementById('reset-email').value = '';
    showNotification('Email de réinitialisation envoyé!', 'success');
    console.log('✅ Processus terminé avec succès');
    
  } catch(err) {
    console.error('💥 Erreur dans handlePasswordReset:', {
      message: err.message,
      code: err.code,
      status: err.status,
      details: err
    });
    
    let errorMessage = 'Erreur lors de l\'envoi de l\'email';
    
    // Messages d'erreur spécifiques selon le code d'erreur Supabase
    if (err.message) {
      if (err.message.includes('Email not confirmed')) {
        errorMessage = 'Cette adresse email n\'est pas confirmée.';
      } else if (err.message.includes('User not found')) {
        errorMessage = 'Aucun compte trouvé avec cette adresse email.';
      } else if (err.message.includes('rate limit')) {
        errorMessage = 'Trop de tentatives. Veuillez attendre avant de réessayer.';
      } else if (err.message.includes('admin')) {
        errorMessage = err.message;
      } else {
        errorMessage = err.message;
      }
    }
    
    showMessage('reset-error', `<i class="fas fa-exclamation-triangle"></i> ${errorMessage}`);
  } finally {
    passwordResetInProgress = false;
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    console.log('🏁 Fin de handlePasswordReset');
  }
}
async function testSupabaseConnection() {
  console.log('🧪 Test de connexion Supabase...');
  
  if (!supabaseClient) {
    console.log('❌ Supabase client non initialisé');
    showNotification('Supabase non connecté', 'error');
    return false;
  }
  
  try {
    // Test basique - essayer de lire une table
    console.log('🔍 Test de lecture admin_users...');
    const { data, error, count } = await supabaseClient
      .from('admin_users')
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Erreur test Supabase:', error);
      showNotification('Erreur connexion Supabase: ' + error.message, 'error');
      return false;
    }
    
    console.log('✅ Connexion Supabase OK. Nb admins:', count);
    showNotification('Supabase connecté! ' + count + ' admin(s) trouvé(s)', 'success');
    return true;
    
  } catch (err) {
    console.error('❌ Exception test Supabase:', err);
    showNotification('Exception Supabase: ' + err.message, 'error');
    return false;
  }
}

async function testResetForced() {
  const email = prompt('Email à tester:');
  if (!email) return;
  
  console.log('🧪 Test forcé avec email:', email);
  
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}?type=recovery`
    });
    
    if (error) {
      console.error('❌ Erreur test forcé:', error);
      showNotification('Erreur: ' + error.message, 'error');
    } else {
      console.log('✅ Test forcé réussi');
      showNotification('Email envoyé avec succès!', 'success');
    }
  } catch (err) {
    console.error('💥 Exception test forcé:', err);
    showNotification('Exception: ' + err.message, 'error');
  }
}
async function checkSupabaseConfig() {
  console.log('🔧 Vérification configuration Supabase...');
  console.log('📍 URL:', supabaseUrl);
  console.log('🔑 Key (premiers caractères):', supabaseKey.substring(0, 20) + '...');
  
  if (!supabaseClient) {
    console.log('❌ Client non initialisé');
    return;
  }
  
  // Tester les tables
  console.log('📋 Test des tables:');
  
  const tables = ['admin_users', 'products', 'orders'];
  for (const table of tables) {
    try {
      const { error } = await supabaseClient.from(table).select('*', { count: 'exact', head: true });
      console.log(`  ${table}: ${error ? '❌ ' + error.message : '✅ OK'}`);
    } catch (e) {
      console.log(`  ${table}: ❌ ${e.message}`);
    }
  }
}
async function handlePasswordUpdate(e) {
  e.preventDefault();
  console.log('🔄 Début mise à jour mot de passe...');
  
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const errorEl = document.getElementById('update-error');
  const successEl = document.getElementById('update-success');
  const submitBtn = document.getElementById('update-submit-btn');
  
  console.log('📝 Valeurs récupérées:', {
    newPassword: newPassword ? 'Présent (' + newPassword.length + ' chars)' : 'Vide',
    confirmPassword: confirmPassword ? 'Présent (' + confirmPassword.length + ' chars)' : 'Vide'
  });
  
  // Masquer les messages précédents
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }
  if (successEl) {
    successEl.style.display = 'none';
    successEl.textContent = '';
  }
  
  // Validation des champs
  if (!newPassword || !confirmPassword) {
    console.log('❌ Champs vides détectés');
    if (errorEl) {
      errorEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Veuillez remplir tous les champs';
      errorEl.style.display = 'block';
    }
    return;
  }
  
  if (newPassword.length < 6) {
    console.log('❌ Mot de passe trop court');
    if (errorEl) {
      errorEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Le mot de passe doit contenir au moins 6 caractères';
      errorEl.style.display = 'block';
    }
    return;
  }
  
  if (newPassword !== confirmPassword) {
    console.log('❌ Mots de passe différents');
    if (errorEl) {
      errorEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Les mots de passe ne correspondent pas';
      errorEl.style.display = 'block';
    }
    return;
  }
  
  // Validation réussie
  console.log('✅ Validation des champs réussie');
  
  // Désactiver le bouton et montrer le loading
  if (submitBtn) {
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Mise à jour en cours...';
    submitBtn.disabled = true;
    console.log('🔄 Bouton désactivé, début traitement...');
    
    try {
      if (supabaseClient) {
        console.log('🔑 Utilisation de Supabase pour la mise à jour...');
        
        // ÉTAPE 1: Mettre à jour le mot de passe via Supabase Auth
        const { data: updateData, error: updateError } = await supabaseClient.auth.updateUser({
          password: newPassword
        });
        
        if (updateError) {
          console.error('❌ Erreur Supabase updateUser:', updateError);
          throw updateError;
        }
        
        console.log('✅ Mot de passe mis à jour dans Supabase Auth:', updateData);
        
        // ÉTAPE 2: Vérifier/récupérer les infos utilisateur
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        if (userError) {
          console.error('❌ Erreur récupération utilisateur:', userError);
          throw userError;
        }
        
        console.log('👤 Utilisateur récupéré:', user ? user.email : 'Aucun');
        
        // ÉTAPE 3: Mettre à jour dans la table admin_users si nécessaire
        if (user && user.email) {
          const { data: adminData, error: adminError } = await supabaseClient
            .from('admin_users')
            .select('id, email, role, last_login')
            .eq('email', user.email)
            .maybeSingle();
          
          if (!adminError && adminData) {
            console.log('👑 Admin trouvé:', adminData);
            
            // Mettre à jour la dernière connexion
            const { error: updateAdminError } = await supabaseClient
              .from('admin_users')
              .update({ 
                last_login: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', adminData.id);
              
            if (updateAdminError) {
              console.warn('⚠️ Erreur mise à jour admin_users:', updateAdminError);
            } else {
              console.log('✅ Données admin mises à jour');
            }
            
            // Stocker les infos admin globalement
            currentAdmin = { ...adminData };
            showLogoutButton();
          } else {
            console.log('ℹ️ Utilisateur non admin ou erreur:', adminError);
          }
        }
        
        // ÉTAPE 4: Afficher le succès
        if (successEl) {
          successEl.innerHTML = '<i class="fas fa-check-circle"></i> Mot de passe mis à jour avec succès !';
          successEl.style.display = 'block';
        }
        
        showNotification('🔒 Mot de passe mis à jour avec succès !', 'success');
        console.log('✅ Mise à jour terminée avec succès');
        
        // ÉTAPE 5: Redirection après 2 secondes
        setTimeout(() => {
          closeModal('password-update-modal');
          if (currentAdmin) {
            console.log('🏠 Redirection vers dashboard admin');
            showAdminDashboard();
          } else {
            console.log('🔐 Redirection vers modal connexion');
            showModal('admin-modal');
          }
        }, 2000);
        
      } else {
        // Mode démo/test
        console.log('🧪 Mode démo - simulation mise à jour...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (successEl) {
          successEl.innerHTML = '<i class="fas fa-check-circle"></i> [MODE DEMO] Mot de passe simulé mis à jour';
          successEl.style.display = 'block';
        }
        
        showNotification('🔒 Mot de passe mis à jour (mode demo) !', 'success');
        console.log('✅ Mode démo terminé');
        
        setTimeout(() => {
          closeModal('password-update-modal');
          showModal('admin-modal');
        }, 2000);
      }
      
    } catch (err) {
      console.error('💥 Erreur lors de la mise à jour:', err);
      
      let errorMessage = 'Erreur lors de la mise à jour du mot de passe';
      
      // Messages d'erreur spécifiques
      if (err.message) {
        if (err.message.includes('session_not_found')) {
          errorMessage = 'Session expirée. Veuillez recommencer la procédure de récupération.';
        } else if (err.message.includes('invalid_grant')) {
          errorMessage = 'Token de récupération invalide. Demandez un nouveau lien.';
        } else if (err.message.includes('weak_password')) {
          errorMessage = 'Le mot de passe n\'est pas assez sécurisé. Utilisez au moins 8 caractères avec des chiffres et des lettres.';
        } else {
          errorMessage = err.message;
        }
      }
      
      if (errorEl) {
        errorEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errorMessage}`;
        errorEl.style.display = 'block';
      }
      
      showNotification('❌ ' + errorMessage, 'error');
      
    } finally {
      // Restaurer le bouton
      if (submitBtn) {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        console.log('🔄 Bouton restauré');
      }
    }
  }
}
function testPasswordUpdate() {
  console.log('🧪 Test de mise à jour de mot de passe...');
  
  // Ouvrir le modal
  testPasswordUpdateModal();
  
  // Pré-remplir les champs pour test
  setTimeout(() => {
    const newPasswordField = document.getElementById('new-password');
    const confirmPasswordField = document.getElementById('confirm-password');
    
    if (newPasswordField && confirmPasswordField) {
      newPasswordField.value = 'test123456';
      confirmPasswordField.value = 'test123456';
      console.log('✅ Champs pré-remplis pour test');
      
      // Vérifier la correspondance
      checkPasswordMatch();
    }
  }, 1000);
}
function checkPasswordMatch() {
  const newPassword = document.getElementById('new-password');
  const confirmPassword = document.getElementById('confirm-password');
  const indicator = document.getElementById('password-match-indicator');
  
  if (!newPassword || !confirmPassword || !indicator) return;
  
  const newVal = newPassword.value;
  const confirmVal = confirmPassword.value;
  
  if (confirmVal.length === 0) {
    indicator.style.display = 'none';
    confirmPassword.style.borderColor = '#A67C52';
    return;
  }
  
  indicator.style.display = 'block';
  
  if (newVal === confirmVal) {
    indicator.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981; margin-right: 6px;"></i><span style="color: #10b981;">✅ Les mots de passe correspondent parfaitement</span>';
    confirmPassword.style.borderColor = '#10b981';
    confirmPassword.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
  } else {
    indicator.innerHTML = '<i class="fas fa-times-circle" style="color: #ef4444; margin-right: 6px;"></i><span style="color: #ef4444;">❌ Les mots de passe ne correspondent pas</span>';
    confirmPassword.style.borderColor = '#ef4444';
    confirmPassword.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
  }
}
function testPasswordUpdateModal() {
  console.log('🧪 Test modal mise à jour du mot de passe...');
  
  // Fermer tous les modales ouverts
  const openModals = document.querySelectorAll('.modal');
  openModals.forEach(modal => {
    if (modal.style.display === 'block') {
      modal.style.display = 'none';
    }
  });
  
  // S'assurer que les modales existent
  if (!document.getElementById('password-update-modal')) {
    createPasswordResetModals();
    setupPasswordResetListeners();
  }
  
  // Ouvrir le modal de mise à jour
  setTimeout(() => {
    showModal('password-update-modal');
    console.log('✅ Modal de mise à jour forcé ouvert');
    
    // Focus sur le premier champ
    setTimeout(() => {
      const newPasswordField = document.getElementById('new-password');
      if (newPasswordField) {
        newPasswordField.focus();
        console.log('🎯 Focus placé sur le champ nouveau mot de passe');
        
        // Vérifier que les champs sont bien là
        console.log('📋 Champs détectés:', {
          'new-password': !!document.getElementById('new-password'),
          'confirm-password': !!document.getElementById('confirm-password'),
          'update-submit-btn': !!document.getElementById('update-submit-btn')
        });
      } else {
        console.error('❌ Champ new-password introuvable !');
      }
    }, 300);
  }, 200);
}
function fillTestPassword() {
  console.log('🔧 Pré-remplissage des champs pour test...');
  
  const newPasswordField = document.getElementById('new-password');
  const confirmPasswordField = document.getElementById('confirm-password');
  
  if (newPasswordField && confirmPasswordField) {
    newPasswordField.value = 'monNouveauMdp123';
    confirmPasswordField.value = 'monNouveauMdp123';
    
    // Déclencher la vérification de correspondance
    checkPasswordMatch();
    
    console.log('✅ Champs pré-remplis avec "monNouveauMdp123"');
    
    // Changer le style pour montrer que c'est pré-rempli
    newPasswordField.style.background = '#e8f5e8';
    confirmPasswordField.style.background = '#e8f5e8';
    
  } else {
    console.error('❌ Impossible de trouver les champs !');
    console.log('🔍 Champs disponibles:', {
      'new-password': !!document.getElementById('new-password'),
      'confirm-password': !!document.getElementById('confirm-password')
    });
  }
}
function simulateValidResetLink() {
  console.log('🎭 Simulation d\'un lien de récupération valide...');
  
  // Construire une URL avec des tokens de test
  const testUrl = window.location.origin + window.location.pathname + 
    '?type=recovery&access_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test123&refresh_token=refresh_test_token_456';
  
  console.log('🔗 URL de test:', testUrl);
  
  // Modifier temporairement l'URL
  window.history.pushState({}, '', testUrl);
  
  // Relancer la vérification
  const hasToken = checkForPasswordResetToken();
  console.log('🎯 Résultat simulation:', hasToken ? 'Token valide détecté' : 'Échec simulation');
  
  // Restaurer l'URL après 5 secondes
  setTimeout(() => {
    window.history.pushState({}, '', window.location.origin + window.location.pathname);
    console.log('🔄 URL restaurée');
  }, 5000);
}
function debugModals() {
  console.log('🔍 DEBUG COMPLET DES MODALES:');
  
  // Vérifier existence des modales
  const resetModal = document.getElementById('password-reset-modal');
  const updateModal = document.getElementById('password-update-modal');
  
  console.log('📋 Modales existantes:', {
    'password-reset-modal': !!resetModal,
    'password-update-modal': !!updateModal
  });
  
  if (updateModal) {
    console.log('🔍 Contenu modal mise à jour:');
    
    // Lister tous les éléments dans le modal
    const elements = {
      'new-password': updateModal.querySelector('#new-password'),
      'confirm-password': updateModal.querySelector('#confirm-password'),
      'update-submit-btn': updateModal.querySelector('#update-submit-btn'),
      'update-error': updateModal.querySelector('#update-error'),
      'update-success': updateModal.querySelector('#update-success')
    };
    
    Object.keys(elements).forEach(key => {
      const element = elements[key];
      console.log(`  - ${key}:`, !!element, element ? element.tagName : 'N/A');
    });
    
    // Vérifier le style de visibilité
    console.log('👁️ Visibilité modal:', {
      display: updateModal.style.display,
      visibility: updateModal.style.visibility,
      opacity: updateModal.style.opacity
    });
  }
}
function quickTestPasswordUpdate() {
  console.log('🚀 TEST RAPIDE - Modal + Pré-remplissage...');
  
  // Étape 1: Ouvrir le modal
  testPasswordUpdateModal();
  
  // Étape 2: Pré-remplir après un délai
  setTimeout(() => {
    fillTestPassword();
  }, 1000);
  
  console.log('✅ Test rapide lancé - Modal ouvert et champs pré-remplis dans 1 seconde');
}
function testPasswordSubmission() {
  console.log('📝 Test de soumission du formulaire...');
  
  const form = document.getElementById('password-update-form');
  if (form) {
    // Simuler la soumission
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    console.log('✅ Événement submit déclenché');
  } else {
    console.error('❌ Formulaire password-update-form introuvable');
  }
}
// ========== UTILITAIRES ==========
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function checkForPasswordResetToken() {
  console.log('🔍 Vérification des tokens dans l\'URL...');
  
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  
  console.log('📍 URL complète:', window.location.href);
  console.log('📋 Paramètres URL:', Object.fromEntries(urlParams));
  console.log('🏷️ Hash:', hash);
  
  // Vérifier les paramètres dans l'URL principale
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');
  const type = urlParams.get('type');
  
  // Vérifier aussi dans le hash (Supabase met souvent les tokens là)
  let hashAccessToken = null;
  let hashRefreshToken = null;
  let hashType = null;
  let hashError = null;
  let hashErrorCode = null;
  let hashErrorDescription = null;
  
  if (hash && hash.length > 1) {
    const hashParams = new URLSearchParams(hash.substring(1)); // Enlever le #
    hashAccessToken = hashParams.get('access_token');
    hashRefreshToken = hashParams.get('refresh_token');
    hashType = hashParams.get('type');
    hashError = hashParams.get('error');
    hashErrorCode = hashParams.get('error_code');
    hashErrorDescription = hashParams.get('error_description');
    
    console.log('🏷️ Paramètres du hash:', {
      access_token: hashAccessToken ? 'Présent' : 'Absent',
      refresh_token: hashRefreshToken ? 'Présent' : 'Absent',
      type: hashType,
      error: hashError,
      error_code: hashErrorCode,
      error_description: hashErrorDescription
    });
  }
  
  // Utiliser les tokens soit de l'URL soit du hash
  const finalAccessToken = accessToken || hashAccessToken;
  const finalRefreshToken = refreshToken || hashRefreshToken;
  const finalType = type || hashType;
  const finalError = hashError;
  const finalErrorCode = hashErrorCode;
  const finalErrorDescription = hashErrorDescription;
  
  console.log('✅ Tokens détectés:', {
    access_token: finalAccessToken ? 'Présent (' + finalAccessToken.substring(0, 20) + '...)' : 'Absent',
    refresh_token: finalRefreshToken ? 'Présent' : 'Absent',
    type: finalType,
    error: finalError,
    error_code: finalErrorCode
  });
  
  // CAS SPÉCIAL: Si type=recovery mais pas de token ni d'erreur explicite
  // C'est probablement un lien Supabase malformé ou incomplet
  if (finalType === 'recovery' && !finalAccessToken && !finalError) {
    console.log('⚠️ Lien de récupération détecté mais INCOMPLET !');
    console.log('🔍 Analyse du problème:');
    console.log('  - Type: recovery ✅');
    console.log('  - Access token: ❌ MANQUANT');
    console.log('  - Erreur: ❌ AUCUNE');
    console.log('  - Hash vide: ❌ SUSPECT');
    
    // Attendre que les modales soient créées puis forcer l'ouverture du modal de mise à jour
    setTimeout(() => {
      console.log('🔧 SOLUTION: Forcer l\'ouverture du modal de mise à jour...');
      
      // Essayer de récupérer la session active de Supabase
      if (supabaseClient) {
        supabaseClient.auth.getSession().then(({ data: { session }, error }) => {
          if (session && session.user) {
            console.log('✅ Session Supabase trouvée:', session.user.email);
            
            // Il y a une session active, on peut ouvrir le modal de mise à jour
            showModal('password-update-modal');
            console.log('✅ Modal de mise à jour ouvert avec session existante');
            
            return true;
          } else {
            console.log('❌ Aucune session Supabase active');
            
            // Pas de session, demander un nouveau lien
            showPasswordResetError('Le lien de récupération semble incomplet. Veuillez demander un nouveau lien.');
            return false;
          }
        }).catch(err => {
          console.error('❌ Erreur vérification session:', err);
          showPasswordResetError('Problème avec le lien de récupération. Veuillez demander un nouveau lien.');
          return false;
        });
      } else {
        // Pas de Supabase, forcer l'ouverture en mode demo
        console.log('🧪 Mode demo - Ouverture forcée du modal');
        showModal('password-update-modal');
        return true;
      }
    }, 500);
    
    // Nettoyer l'URL
    const cleanUrl = window.location.origin + window.location.pathname;
    console.log('🧹 Nettoyage URL vers:', cleanUrl);
    window.history.replaceState({}, document.title, cleanUrl);
    
    return true; // On considère qu'on a géré le cas
  }
  
  // Vérifier s'il y a une erreur dans la récupération
  if (finalType === 'recovery' && finalError) {
    console.log('❌ Erreur de récupération détectée:', finalError);
    
    let errorMessage = 'Erreur lors de la récupération du mot de passe.';
    
    switch (finalErrorCode) {
      case 'otp_expired':
        errorMessage = 'Le lien de récupération a expiré. Veuillez demander un nouveau lien.';
        break;
      case 'access_denied':
        errorMessage = 'Accès refusé. Le lien de récupération est invalide.';
        break;
      default:
        if (finalErrorDescription) {
          errorMessage = decodeURIComponent(finalErrorDescription.replace(/\+/g, ' '));
        }
    }
    
    // Attendre que les modales soient créées puis afficher l'erreur
    setTimeout(() => {
      showPasswordResetError(errorMessage);
    }, 500);
    
    // Nettoyer l'URL
    const cleanUrl = window.location.origin + window.location.pathname;
    console.log('🧹 Nettoyage URL vers:', cleanUrl);
    window.history.replaceState({}, document.title, cleanUrl);
    
    return false; // Erreur détectée
  }
  
  // Vérifier si c'est une récupération de mot de passe réussie
  if (finalType === 'recovery' && finalAccessToken) {
    console.log('🔑 Token de récupération détecté ! Ouverture du modal...');
    
    // Attendre que les modales soient créées
    setTimeout(() => {
      showModal('password-update-modal');
      console.log('✅ Modal de mise à jour du mot de passe ouverte');
    }, 500);
    
    if(supabaseClient && finalRefreshToken) {
      console.log('🔄 Configuration de la session Supabase...');
      try {
        // Définir la session avec les tokens
        supabaseClient.auth.setSession({
          access_token: finalAccessToken,
          refresh_token: finalRefreshToken
        }).then(({ data, error }) => {
          if (error) {
            console.error('❌ Erreur configuration session:', error);
          } else {
            console.log('✅ Session configurée:', data.session ? 'OK' : 'VIDE');
          }
        });
      } catch (sessionError) {
        console.error('❌ Erreur session:', sessionError);
      }
    }
    
    // Nettoyer l'URL
    const cleanUrl = window.location.origin + window.location.pathname;
    console.log('🧹 Nettoyage URL vers:', cleanUrl);
    window.history.replaceState({}, document.title, cleanUrl);
    
    return true; // Token trouvé
  } else {
    console.log('ℹ️ Aucun token de récupération trouvé');
    return false;
  }
}
function showPasswordResetError(message) {
  console.log('⚠️ Affichage erreur reset:', message);
  
  // S'assurer que les modales existent
  if (!document.getElementById('password-reset-modal')) {
    console.log('🔧 Création des modales...');
    createPasswordResetModals();
    setupPasswordResetListeners();
  }
  
  // Ouvrir le modal de reset
  setTimeout(() => {
    showModal('password-reset-modal');
    
    // Afficher l'erreur
    const errorDiv = document.getElementById('password-reset-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.style.color = '#e74c3c';
      errorDiv.style.marginTop = '10px';
      errorDiv.style.padding = '10px';
      errorDiv.style.backgroundColor = '#ffeaea';
      errorDiv.style.border = '1px solid #e74c3c';
      errorDiv.style.borderRadius = '5px';
    }
  }, 100);
}
function debugSupabaseLink() {
  console.log('🔍 ANALYSE COMPLÈTE DU LIEN SUPABASE:');
  console.log('=====================================');
  
  const url = new URL(window.location.href);
  console.log('🌐 URL complète:', url.href);
  console.log('📁 Pathname:', url.pathname);
  console.log('🔗 Search:', url.search);
  console.log('🏷️ Hash:', url.hash);
  
  // Analyser les paramètres URL
  console.log('\n📋 PARAMÈTRES URL:');
  url.searchParams.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });
  
  // Analyser le hash
  if (url.hash) {
    console.log('\n🏷️ PARAMÈTRES HASH:');
    const hashParams = new URLSearchParams(url.hash.substring(1));
    hashParams.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
  }
  
  // Vérifier la session Supabase
  if (supabaseClient) {
    console.log('\n🔑 SESSION SUPABASE:');
    supabaseClient.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.log('❌ Erreur session:', error);
      } else if (session) {
        console.log('✅ Session active:', {
          user: session.user.email,
          expires_at: new Date(session.expires_at * 1000).toLocaleString(),
          token_type: session.token_type
        });
      } else {
        console.log('❌ Aucune session active');
      }
    });
  }
}
function testTokenScenarios() {
  console.log('🧪 Test des différents scénarios...');
  
  // Scénario 1 : Token expiré
  console.log('📋 Test 1 : Token expiré');
  const expiredUrl = window.location.origin + window.location.pathname + 
    '?type=recovery#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
  
  window.history.pushState({}, '', expiredUrl);
  checkForPasswordResetToken();
  
  setTimeout(() => {
    // Scénario 2 : Token valide
    console.log('📋 Test 2 : Token valide');
    const validUrl = window.location.origin + window.location.pathname + 
      '?type=recovery&access_token=valid123&refresh_token=refresh456';
    
    window.history.pushState({}, '', validUrl);
    checkForPasswordResetToken();
    
    setTimeout(() => {
      // Restaurer l'URL originale
      window.history.pushState({}, '', window.location.origin + window.location.pathname);
    }, 2000);
  }, 3000);
}
function testTokenDetection() {
  // Simuler une URL avec tokens
  const testUrl = window.location.origin + window.location.pathname + '?type=recovery&access_token=test123&refresh_token=refresh456';
  
  console.log('🧪 Test avec URL simulée:', testUrl);
  
  // Modifier temporairement l'URL pour le test
  window.history.pushState({}, '', testUrl);
  
  // Tester la détection
  const detected = checkForPasswordResetToken();
  
  console.log('📋 Résultat test:', detected ? 'Token détecté' : 'Aucun token');
  
  // Restaurer l'URL originale
  setTimeout(() => {
    window.history.back();
  }, 2000);
}
function forceOpenPasswordUpdate() {
  console.log('🔓 Force l\'ouverture du modal de mise à jour...');
  
  // S'assurer que les modales existent
  if (!document.getElementById('password-update-modal')) {
    console.log('🔧 Création des modales...');
    createPasswordResetModals();
    setupPasswordResetListeners();
  }
  
  // Ouvrir le modal
  setTimeout(() => {
    showModal('password-update-modal');
    console.log('✅ Modal forcé ouvert');
  }, 100);
}
// ========== SETUP ==========
function setupPasswordResetListeners() {
  const passwordResetForm = document.getElementById('password-reset-form');
  const passwordUpdateForm = document.getElementById('password-update-form');
  
  if(passwordResetForm) {
    passwordResetForm.addEventListener('submit', handlePasswordReset);
  }
  
  if(passwordUpdateForm) {
    passwordUpdateForm.addEventListener('submit', handlePasswordUpdate);
  }
}

function initPasswordReset() {
  // Créer les modales
   createPasswordResetModals();
  console.log('✅ Modales créées');
  
  addForgotPasswordLink();
  console.log('✅ Lien "Mot de passe oublié" ajouté');
  
  // Vérifier si l'utilisateur arrive avec un token de reset
  checkForPasswordResetToken();
    const hasToken = checkForPasswordResetToken();
  console.log(hasToken ? '🔑 Token trouvé' : 'ℹ️ Pas de token');
  
  // Configurer les listeners
  setupPasswordResetListeners();
  console.log('✅ Event listeners configurés');
  

 
}
function debugUrl() {
  console.log('🔍 DEBUG URL:');
  console.log('  - href:', window.location.href);
  console.log('  - search:', window.location.search);
  console.log('  - hash:', window.location.hash);
  console.log('  - pathname:', window.location.pathname);
  
  const params = new URLSearchParams(window.location.search);
  console.log('  - params:', Object.fromEntries(params));
  
  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    console.log('  - hash params:', Object.fromEntries(hashParams));
  }
}

// ========== REQUÊTES SUPABASE SUPPLÉMENTAIRES ==========

// Fonction pour vérifier le statut de récupération
async function checkRecoveryStatus() {
  if (!supabaseClient) return;
  
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      // L'utilisateur est connecté via recovery
      const { data: adminData, error } = await supabaseClient
        .from('admin_users')
        .select('id,email,role')
        .eq('email', session.user.email)
        .maybeSingle();
      
      if (!error && adminData) {
        currentAdmin = { ...adminData };
        showLogoutButton();
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Erreur vérification recovery:', error);
    return false;
  }
}

// Fonction pour vérifier si l'email existe dans admin_users (optionnel)
async function checkAdminEmailExists(email) {
  if (!supabaseClient) return true; // En mode demo, accepter tout
  
  try {
    const { data, error } = await supabaseClient
      .from('admin_users')
      .select('email')
      .eq('email', email)
      .maybeSingle();
    
    if (error) throw error;
    return !!data; // Retourne true si l'email existe
  } catch (error) {
    console.error('Erreur vérification email admin:', error);
    return false;
  }
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
        <img class="product-image" src="${getImageUrl(p)}" alt="${escapeHtml(p.name)}
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
  const mainImageUrl = getImageUrl(p);
 if(mainImageUrl) imgs.push(mainImageUrl);
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
        <img src="${getImageUrl(p)}" alt="${escapeHtml(p.name)}"class="w-16 h-16 object-cover rounded">
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

// Fonction pour générer un PDF de commande
function generateOrderPDF(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    showNotification('Commande non trouvée', 'error');
    return;
  }

  // Créer un nouveau document PDF avec jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Configuration des couleurs (équivalent aux couleurs CSS de votre thème)
  const primaryColor = [166, 124, 82]; // #A67C52 (accent)
  const textColor = [51, 51, 51]; // #333
  const grayColor = [119, 119, 119]; // #777

  // En-tête
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ELYNA', 20, 25);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Facture de commande', 130, 25);

  // Informations de la commande
  doc.setTextColor(...textColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Commande #${order.id}`, 20, 60);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date(order.created_at || order.order_date).toLocaleDateString('fr-FR')}`, 20, 70);
  doc.text(`Statut: ${getStatusText(order.status)}`, 20, 80);

  // Informations client
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Informations Client', 20, 100);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const customerData = order.customer_data || {};
  doc.text(`Nom: ${customerData.firstname || ''} ${customerData.lastname || ''}`, 20, 115);
  doc.text(`Email: ${customerData.email || ''}`, 20, 125);
  doc.text(`Téléphone: ${customerData.phone || ''}`, 20, 135);
  doc.text(`Adresse: ${customerData.address || ''}`, 20, 145);
  doc.text(`Gouvernorat: ${customerData.governorate || ''}`, 20, 155);
  if (customerData.payment_method) {
    doc.text(`Mode de paiement: ${customerData.payment_method}`, 20, 165);
  }

  // Tableau des articles
  let yPosition = 185;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Articles commandés', 20, yPosition);
  
  yPosition += 15;
  
  // En-têtes du tableau
  doc.setFillColor(245, 245, 220); // Beige clair
  doc.rect(20, yPosition, 170, 10, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Produit', 25, yPosition + 7);
  doc.text('Qté', 120, yPosition + 7);
  doc.text('Prix unit.', 140, yPosition + 7);
  doc.text('Total', 170, yPosition + 7);
  
  yPosition += 15;

  // Articles
  doc.setFont('helvetica', 'normal');
  const items = order.items || [];
  let subtotal = 0;

  items.forEach((item, index) => {
    if (yPosition > 260) { // Nouvelle page si nécessaire
      doc.addPage();
      yPosition = 40;
    }

    const itemTotal = item.total_price || (item.unit_price * item.quantity) || 0;
    subtotal += itemTotal;

    doc.text(item.product_name || 'Produit', 25, yPosition);
    doc.text(String(item.quantity || 0), 125, yPosition);
    doc.text(`${(item.unit_price || 0).toFixed(2)} DT`, 140, yPosition);
    doc.text(`${itemTotal.toFixed(2)} DT`, 170, yPosition);
    
    yPosition += 10;
  });

  // Ligne de séparation
  yPosition += 5;
  doc.line(20, yPosition, 190, yPosition);
  yPosition += 10;

  // Totaux
  doc.setFont('helvetica', 'normal');
  doc.text('Sous-total:', 130, yPosition);
  doc.text(`${subtotal.toFixed(2)} DT`, 170, yPosition);
  
  yPosition += 10;
  const shippingFee = subtotal >= 300 ? 0 : 15;
  doc.text('Livraison:', 130, yPosition);
  doc.text(shippingFee === 0 ? 'Gratuite' : `${shippingFee.toFixed(2)} DT`, 170, yPosition);
  
  yPosition += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total:', 130, yPosition);
  doc.text(`${(order.total_amount || 0).toFixed(2)} DT`, 170, yPosition);

  // Notes si présentes
  if (customerData.notes) {
    yPosition += 20;
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 40;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes du client:', 20, yPosition);
    yPosition += 10;
    
    doc.setFont('helvetica', 'normal');
    const notes = customerData.notes;
    const splitNotes = doc.splitTextToSize(notes, 170);
    doc.text(splitNotes, 20, yPosition);
  }

  // Pied de page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text('ELYNA - Boutique de mode féminine', 20, 285);
    doc.text(`Page ${i} sur ${pageCount}`, 170, 285);
  }

  // Télécharger le PDF
  const fileName = `Commande_${order.id}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  
  showNotification(`PDF généré: ${fileName}`, 'success');
}

// Fonction pour vérifier si jsPDF est disponible
function checkPDFLibrary() {
  if (typeof window.jspdf === 'undefined') {
    showNotification('Bibliothèque PDF non disponible. Chargement...', 'info');
    
    // Charger jsPDF depuis CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      showNotification('Bibliothèque PDF chargée avec succès!', 'success');
    };
    script.onerror = () => {
      showNotification('Erreur lors du chargement de la bibliothèque PDF', 'error');
    };
    document.head.appendChild(script);
    return false;
  }
  return true;
}

// Version modifiée de renderOrdersTable avec le bouton PDF
function renderOrdersTable(){
  const container = document.getElementById('orders-table');
  if(!container) return;
  if(!orders || orders.length===0){ 
    container.innerHTML = `<div style="text-align:center;color:#777;padding:30px">Aucune commande</div>`; 
    return; 
  }
  
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
                  <button class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm" onclick="viewOrderDetails(${o.id})" title="Voir les détails">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm" onclick="downloadOrderPDF(${o.id})" title="Télécharger PDF">
                    <i class="fas fa-file-pdf"></i>
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

// Fonction wrapper pour gérer le téléchargement PDF avec vérification
function downloadOrderPDF(orderId) {
  if (checkPDFLibrary()) {
    generateOrderPDF(orderId);
  } else {
    // Réessayer après 2 secondes si la bibliothèque se charge
    setTimeout(() => {
      if (checkPDFLibrary()) {
        generateOrderPDF(orderId);
      } else {
        showNotification('Impossible de charger la bibliothèque PDF. Veuillez réessayer.', 'error');
      }
    }, 2000);
  }
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
                <img src="${getImageUrl(p)}" alt="${escapeHtml(p.name)}" class="w-12 h-12 object-cover rounded" onerror="this.src='https://via.placeholder.com/48x48?text=?'">
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
function editProduct(id) { 
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
  document.getElementById('product-promo').value = product.promo || 0;
  
  // CORRECTION: Gérer l'image correctement
  const imagePreview = document.getElementById('image-preview');
  
  // Si le produit a une image_url directe (base64 ou URL)
  if (product.image_url && !product.image_url.includes('via.placeholder.com')) {
    document.getElementById('product-image').value = product.image_url;
    if (imagePreview) {
      imagePreview.innerHTML = `<img src="${product.image_url}" alt="Aperçu" style="max-width: 200px; max-height: 200px; object-fit: cover; border-radius: 8px;">`;
    }
  }
  // Si le produit a un image_id et l'image existe dans uploadedImages
  else if (product.image_id && uploadedImages[product.image_id]) {
    document.getElementById('product-image-id').value = product.image_id;
    document.getElementById('product-image').value = uploadedImages[product.image_id];
    if (imagePreview) {
      imagePreview.innerHTML = `<img src="${uploadedImages[product.image_id]}" alt="Aperçu" style="max-width: 200px; max-height: 200px; object-fit: cover; border-radius: 8px;">`;
    }
  } else {
    // Pas d'image
    document.getElementById('product-image').value = '';
    document.getElementById('product-image-id').value = '';
    if (imagePreview) imagePreview.innerHTML = '';
  }
  
  // Utiliser category_id au lieu de category
  const categorySelect = document.getElementById('product-category');
  if (categorySelect) {
    categorySelect.value = product.category_id || '';
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
  const imageUrl = document.getElementById('product-image').value.trim(); 
  const imageId = document.getElementById('product-image-id').value.trim();
  const promo = parseInt(document.getElementById('product-promo').value,10) || 0;
  
  if(!name || isNaN(price)) { 
    showNotification('Veuillez remplir tous les champs obligatoires','error'); 
    return; 
  }

  if(promo < 0 || promo > 100) {
    showNotification('La promotion doit être entre 0 et 100%','error');
    return;
  }

  // CORRECTION: Gérer l'image correctement
  let finalImageUrl = '';
  let finalImageId = '';
  
  if (imageUrl && imageUrl.startsWith('data:image/')) {
    // Image base64 - la stocker comme image_url directement
    finalImageUrl = imageUrl;
    finalImageId = imageId || '';
  } else if (imageUrl && !imageUrl.includes('via.placeholder.com')) {
    // URL normale (Supabase ou autre)
    finalImageUrl = imageUrl;
    finalImageId = '';
  } else if (imageId && uploadedImages[imageId]) {
    // Image stockée localement
    finalImageUrl = uploadedImages[imageId];
    finalImageId = imageId;
  } else {
    // Pas d'image - générer placeholder
    finalImageUrl = generatePlaceholderImage(400, 500, name || 'Produit');
    finalImageId = '';
  }

  const productData = { 
    name, 
    price, 
    description: desc, 
    category_id: categoryId,
    subcategory_id: subcategoryId,
    stock: isNaN(stock) ? 0 : stock, 
    promo: promo,
    image_id: finalImageId,
    image_url: finalImageUrl,
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
    
    // CORRECTION: Toujours sauvegarder les images après modification
    saveImagesToStorage();
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

// 6. Améliorer les fonctions de stockage
function saveImagesToStorage() {
  try {
    // Sauvegarder les images uploadées
    localStorage.setItem('elyna_uploaded_images', JSON.stringify(uploadedImages));
    
    // NOUVEAU: Sauvegarder aussi les produits avec leurs images
    const productsWithImages = products.map(p => ({
      ...p,
      // S'assurer que l'image_url est préservée
      image_url: p.image_url || (p.image_id && uploadedImages[p.image_id] ? uploadedImages[p.image_id] : generatePlaceholderImage(400, 500, p.name))
    }));
    localStorage.setItem('elyna_products', JSON.stringify(productsWithImages));
    
    console.log('Images et produits sauvegardés');
  } catch (e) {
    console.warn('Impossible de sauvegarder les images:', e);
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
  document.getElementById('product-image-id').value = '';
const imagePreview = document.getElementById('image-preview');
if (imagePreview) imagePreview.innerHTML = '';
  
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
function handleImageError(img) {
  console.warn('Erreur de chargement d\'image:', img.src);
  
  // Éviter les boucles infinies
  if (img.src.startsWith('data:image/png;base64,')) {
    console.warn('Image placeholder déjà générée, pas de remplacement');
    return;
  }
  
  // Vérifier si c'est une image uploadée localement
  const productId = img.closest('[data-id]')?.dataset?.id;
  if (productId) {
    const product = products.find(p => p.id == productId);
    if (product && product.image_id && uploadedImages[product.image_id]) {
      img.src = uploadedImages[product.image_id];
      return;
    }
  }
  
  // Remplacer par une image générée localement
  const placeholderSrc = generatePlaceholderImage(
    img.naturalWidth || 400, 
    img.naturalHeight || 500, 
    'Image\nnon disponible'
  );
  
  // Éviter de remplacer si c'est déjà le même placeholder
  if (img.src !== placeholderSrc) {
    img.src = placeholderSrc;
  }
  
  // Ajouter une classe pour le styling d'erreur
  img.classList.add('image-error');
}

// 8. Modifier l'initialisation pour charger les images en premier
async function init(){
  try {
    console.log('Init...');
    
    // CORRECTION: Charger les images en premier
    loadImagesFromStorage();
    
    if(window.supabase){
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      console.log('Supabase initialisé');
      
      await initCategories();
      await loadProducts();
    } else {
      console.warn('Supabase non disponible, mode demo');
      await initCategories();
      
      // En mode demo, si pas de produits chargés du storage, utiliser les démos
      if (products.length === 0) {
        products = demoProducts.slice();
      }
      
      buildCategoryTree();
      renderProducts();
    }

    setupEventListeners();
    loadCartFromStorage();
    updateCartCount();
    setupPasswordResetListeners();
    initPasswordReset();
    
    // CORRECTION: Corriger les placeholders après le chargement
    setTimeout(fixPlaceholderUrls, 100);
  } catch(err){ 
    console.error('init', err); 
    // Fallback complet
    await initCategories();
    products = demoProducts.slice(); 
    buildCategoryTree(); 
    renderProducts(); 
  }
}
function clearImageCache() {
  try {
    localStorage.removeItem('elyna_uploaded_images');
    localStorage.removeItem('elyna_products');
    uploadedImages = {};
    showNotification('Cache d\'images nettoyé', 'info');
  } catch (e) {
    console.warn('Erreur nettoyage cache:', e);
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