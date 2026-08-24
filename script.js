/* VK Nutrition storefront and Supabase email-OTP authentication. */
const SUPABASE_URL = "https://owpgbkrnimhwvgqntggq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yVu_tEIx690wZny03SmjBg_yNQX8toM";
const $ = selector => document.querySelector(selector);
const cart = [];
const viewedProducts = new Set();
const viewUpdatesInFlight = new Set();
let currentUser = null;
let wishlist = 0;
const wishlistItems = new Set();
let supabaseClient = null;

/* ---------- Appearance preference ---------- */
function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("vk-theme", nextTheme);
  const icon = $("#appearanceIcon"), label = $("#appearanceLabel");
  if (icon && label) {
    icon.textContent = nextTheme === "dark" ? "☀" : "🌙";
    label.textContent = nextTheme === "dark" ? "Light Mode" : "Dark Mode";
  }
  const headerThemeBtn = $("#headerThemeBtn");
  if (headerThemeBtn) {
    headerThemeBtn.textContent = nextTheme === "dark" ? "☀" : "🌙";
    headerThemeBtn.setAttribute("aria-label", nextTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
}
function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}
applyTheme(document.documentElement.dataset.theme || "light");

try {
  if (!window.supabase?.createClient) throw new Error("Supabase library did not load.");
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    // This storefront uses a code entered in the form, not a magic-link session in the URL.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
} catch (error) {
  console.error("[VK] Supabase initialization failed:", error);
}

const money = value => `₹${Number(value).toLocaleString("en-IN")}`;
const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[character]));
function cleanCatalogueText(value) {
  return String(value).replace(/\s{2,}/g, " ").trim();
}
const catalogueProducts = Array.isArray(window.VK_CATALOGUE) ? window.VK_CATALOGUE : [];
let catalogueQuery = "";
let catalogueCategory = "";
const catalogueGrid = $("#productGrid");
function filteredCatalogue() {
  const query = catalogueQuery.trim().toLowerCase();
  return catalogueProducts.filter(product => {
    const matchesCategory = !catalogueCategory || product.category === catalogueCategory;
    const haystack = `${product.name} ${product.category} ${product.pack}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });
}
function renderCatalogue() {
  if (!catalogueGrid) return;
  const products = filteredCatalogue();
  catalogueGrid.innerHTML = products.map(product => `<article class="product catalogue-product" data-id="${escapeHtml(product.id)}" data-name="${escapeHtml(product.name)}" data-price="${product.price}" data-category="${escapeHtml(product.category)}">
    <div class="product-image"><button class="wish${wishlistItems.has(product.id) ? " active" : ""}" type="button" aria-label="Add ${escapeHtml(product.name)} to wishlist">${wishlistItems.has(product.id) ? "♥" : "♡"}</button><img class="product-photo" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy"></div>
    <div class="product-info"><div class="brand">VK Nutrition Catalogue</div><h3>${escapeHtml(product.name)}</h3><div class="catalogue-category">${escapeHtml(product.category)}</div><div class="variant">${escapeHtml(product.pack)}</div><ul class="catalogue-highlights">${product.highlights.slice(0, 3).map(item => `<li>${escapeHtml(cleanCatalogueText(item))}</li>`).join("")}</ul><div class="prices"><span class="price">${money(product.price)}</span></div><div class="card-actions"><button class="view-details" type="button" data-product-id="${escapeHtml(product.id)}">VIEW DETAILS</button><button class="add" type="button">ADD TO CART</button><button class="buy" type="button">BUY NOW</button></div></div>
  </article>`).join("");
  const resultCount = $("#catalogueResultCount");
  if (resultCount) resultCount.textContent = `${products.length} product${products.length === 1 ? "" : "s"}${catalogueCategory ? ` in ${catalogueCategory}` : ""}`;
  const clearButton = $("#clearCatalogueFilter");
  if (clearButton) clearButton.hidden = !catalogueCategory && !catalogueQuery;
  bindCatalogueCards();
}
function bindCatalogueCards() {
  if (!catalogueGrid) return;
  catalogueGrid.querySelectorAll(".add").forEach(button => button.addEventListener("click", event => addProduct(event.currentTarget.closest(".product"))));
  catalogueGrid.querySelectorAll(".buy").forEach(button => button.addEventListener("click", event => addProduct(event.currentTarget.closest(".product"), true)));
  catalogueGrid.querySelectorAll(".wish").forEach(button => button.addEventListener("click", event => {
    const card = event.currentTarget.closest(".product");
    const product = catalogueProducts.find(item => item.id === card.dataset.id);
    if (product) toggleWishlist(product, event.currentTarget);
  }));
  catalogueGrid.querySelectorAll(".view-details").forEach(button => button.addEventListener("click", event => openProductDetails(event.currentTarget.dataset.productId)));
}
function openProductDetails(productId) {
  const product = catalogueProducts.find(item => item.id === productId);
  if (!product) return;
  $("#productDetailImage").src = product.image;
  $("#productDetailImage").alt = product.name;
  $("#productDetailCategory").textContent = product.category;
  $("#productDetailTitle").textContent = product.name;
  $("#productDetailPack").textContent = `Pack / weight: ${product.pack}`;
  $("#productDetailPrice").textContent = money(product.price);
  $("#productDetailHighlights").innerHTML = product.highlights.map(item => `<li>${escapeHtml(cleanCatalogueText(item))}</li>`).join("");
  $("#productDetailSpec").textContent = cleanCatalogueText(product.spec);
  $("#productDetailAdd").onclick = () => addProduct({ dataset: { name: product.name, price: String(product.price) } });
  trackProductView(product);
  $("#productDetailOverlay").classList.add("show");
  $("#productDetailModal").classList.add("open");
}
function closeProductDetails() {
  $("#productDetailOverlay").classList.remove("show");
  $("#productDetailModal").classList.remove("open");
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function normalizeMobile(value) { return `+91${value.replace(/\D/g, "").slice(-10)}`; }
function validMobile(value) { return value.replace(/\D/g, "").length === 10; }
function requireClient() {
  if (supabaseClient) return true;
  showToast("Account service is unavailable. Please reload and try again.");
  return false;
}

/* ---------- Storefront ---------- */
const slides = [...document.querySelectorAll(".slide")];
const dots = [...document.querySelectorAll(".slideshow-dot")];
let activeSlide = 0;
function showSlide(index) {
  if (!slides.length) return;
  activeSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => slide.classList.toggle("active", i === activeSlide));
  dots.forEach((dot, i) => dot.classList.toggle("active", i === activeSlide));
}
 dots.forEach((dot, index) => dot.addEventListener("click", () => showSlide(index)));
const heroSlideshow = $(".hero-slideshow");
let swipeStartX = 0;
if (heroSlideshow) {
  heroSlideshow.addEventListener("touchstart", event => { swipeStartX = event.changedTouches[0].clientX; }, { passive: true });
  heroSlideshow.addEventListener("touchend", event => {
    const distance = event.changedTouches[0].clientX - swipeStartX;
    if (Math.abs(distance) > 45) showSlide(activeSlide + (distance < 0 ? 1 : -1));
  }, { passive: true });
}
if (slides.length > 1) { showSlide(0); setInterval(() => showSlide(activeSlide + 1), 4000); }

function renderCart() {
  const quantity = cart.reduce((total, item) => total + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  $("#accountCartCount").textContent = `(${quantity})`;
  const mobileCartCount = $("#mobileCartCount");
  if (mobileCartCount) mobileCartCount.textContent = String(quantity);
  $("#drawerCount").textContent = `(${quantity})`;
  $("#cartTotal").textContent = money(total);
  $("#cartItems").innerHTML = cart.length
    ? cart.map((item, index) => `<div class="cart-item"><div class="cart-thumb">⚡</div><div style="flex:1"><h4>${escapeHtml(item.name)}</h4><p>VK Nutrition · Qty ${item.qty}</p><strong>${money(item.price * item.qty)}</strong></div><button class="close remove" data-index="${index}" aria-label="Remove ${escapeHtml(item.name)}">×</button></div>`).join("")
    : '<p style="color:var(--muted);font-size:14px;padding-top:25px">Your cart is empty. Add products to get started.</p>';
  document.querySelectorAll(".remove").forEach(button => button.addEventListener("click", () => {
    cart.splice(Number(button.dataset.index), 1);
    renderCart();
  }));
}
function addProduct(card, openDrawer = false) {
  const item = { name: card.dataset.name, price: Number(card.dataset.price), qty: 1 };
  const existing = cart.find(entry => entry.name === item.name);
  if (existing) existing.qty += 1; else cart.push(item);
  renderCart(); showToast(`${item.name} added to cart.`);
  if (openDrawer) { $("#drawer").classList.add("open"); $("#overlay").classList.add("show"); }
}
function closeCart() { $("#drawer").classList.remove("open"); $("#overlay").classList.remove("show"); }
document.getElementById("newArrivalsSection")?.remove();
renderCatalogue();
document.querySelectorAll(".category[data-category], .mobile-category-link[data-category]").forEach(button => button.addEventListener("click", event => {
  event.preventDefault();
  catalogueCategory = button.dataset.category;
  renderCatalogue();
  $("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
}));
$("#clearCatalogueFilter")?.addEventListener("click", () => {
  catalogueCategory = "";
  catalogueQuery = "";
  $("#searchInput").value = "";
  renderCatalogue();
});
function openCart() {
  closeAccountMenu();
  $("#drawer").classList.add("open");
  $("#overlay").classList.add("show");
}
$("#openCartBtn").addEventListener("click", openCart);
$("#mobileCartBtn")?.addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#overlay").addEventListener("click", closeCart);
$("#productDetailClose").addEventListener("click", closeProductDetails);
$("#productDetailOverlay").addEventListener("click", closeProductDetails);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeProductDetails(); });
function openWishlist() {
  if (!currentUser) return openAuth();
  closeAccountMenu();
  renderWishlist();
  $("#wishlistOverlay").classList.add("show");
  $("#wishlistModal").classList.add("open");
}
$("#searchInput").addEventListener("input", event => {
  catalogueQuery = event.target.value;
  renderCatalogue();
});
document.querySelector(".newsletter button").addEventListener("click", () => showToast("Thanks — you're on the VK Nutrition list."));

/* ---------- Account UI ---------- */
const authOverlay = $("#authOverlay"), authModal = $("#authModal");
function setAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
  $("#signinPanel").hidden = tab !== "signin";
  $("#signupPanel").hidden = tab !== "signup";
  $("#authTitle").textContent = tab === "signin" ? "Welcome Back" : "Create an Account";
}
function openAuth(tab = "signin") { setAuthTab(tab); authOverlay.classList.add("show"); authModal.classList.add("open"); }
function closeAuth() { authOverlay.classList.remove("show"); authModal.classList.remove("open"); }
$("#authClose").addEventListener("click", closeAuth);
authOverlay.addEventListener("click", closeAuth);
document.querySelectorAll(".auth-tab").forEach(button => button.addEventListener("click", () => setAuthTab(button.dataset.tab)));

function setLoggedOut() {
  currentUser = null;
  wishlistItems.clear();
  wishlist = 0;
  viewedProducts.clear();
  updateWishlistCount();
  renderCatalogue();
  const desktop = $("#accountBtn");
  desktop.className = "account-btn";
  desktop.innerHTML = "♙";
  desktop.setAttribute("aria-label", "Login or create account");
  $("#accountBottomLabel").textContent = "Login";
  closeAccountMenu();
}
function setLoggedIn(user) {
  currentUser = user;
  const label = user.first_name || user.email || "Account";
  const initial = label.charAt(0).toUpperCase();
  const desktop = $("#accountBtn");
  desktop.className = "account-btn";
  desktop.innerHTML = `<span class="account-avatar">${initial}</span>`;
  desktop.setAttribute("aria-label", `Open account for ${label}`);
  $("#accountBottomLabel").textContent = "Account";
  $("#accountMenuName").textContent = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Signed in";
  $("#accountMenuSub").textContent = user.email || "";
}
async function hydrateUser(authUser) {
  if (!authUser) return setLoggedOut();
  const { data: profile, error } = await supabaseClient.from("profiles")
    .select("first_name,last_name,email,mobile")
    .eq("id", authUser.id).maybeSingle();
  if (error) console.error("[VK] profile load error", error);
  setLoggedIn({
    id: authUser.id,
    email: authUser.email || profile?.email || "",
    phone: profile?.mobile || "",
    first_name: profile?.first_name || authUser.user_metadata?.first_name || "",
    last_name: profile?.last_name || authUser.user_metadata?.last_name || "",
    metadata: authUser.user_metadata || {}
  });
  await loadWishlist();
}
function closeAccountMenu() {
  $("#accountMenu").classList.remove("open");
  $("#accountBtn").setAttribute("aria-expanded", "false");
}
function toggleAccountMenu() {
  const menu = $("#accountMenu");
  const isOpen = menu.classList.toggle("open");
  $("#accountBtn").setAttribute("aria-expanded", String(isOpen));
}
function handleAccountButton(event) {
  event.stopPropagation();
  if (!currentUser) return openAuth();
  toggleAccountMenu();
}
$("#accountBtn").addEventListener("click", handleAccountButton);
document.addEventListener("click", event => {
  const menu = $("#accountMenu");
  const desktopButton = $("#accountBtn");
  if (!menu.contains(event.target) && !desktopButton.contains(event.target)) closeAccountMenu();
  if (mobileNavPanel && !mobileNavPanel.contains(event.target) && !mobileNavToggle.contains(event.target)) closeMobileNavigation();
  if (!document.querySelector(".search")?.contains(event.target) && !mobileSearchBtn?.contains(event.target)) document.querySelector(".search")?.classList.remove("mobile-open");
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeAccountMenu();
    closeMobileNavigation();
  }
});

/* ---------- Responsive navigation ---------- */
var mobileNavPanel = $("#mobileNavPanel"), mobileNavToggle = $("#mobileNavToggle"), mobileSearchBtn = $("#mobileSearchBtn");
const accountWrap = $(".account-wrap"), navActions = $(".nav-actions"), bottomAccountSlot = $("#bottomAccountSlot");
function placeAccountControl() {
  if (!accountWrap) return;
  const target = window.matchMedia("(max-width: 767px)").matches ? bottomAccountSlot : navActions;
  if (target && accountWrap.parentElement !== target) target.append(accountWrap);
}
placeAccountControl();
window.addEventListener("resize", placeAccountControl);
function closeMobileNavigation() {
  if (!mobileNavPanel) return;
  mobileNavPanel.hidden = true;
  mobileNavToggle?.setAttribute("aria-expanded", "false");
}
function toggleMobileNavigation() {
  const isOpen = mobileNavPanel.hidden;
  mobileNavPanel.hidden = !isOpen;
  mobileNavToggle.setAttribute("aria-expanded", String(isOpen));
}
mobileNavToggle?.addEventListener("click", event => { event.stopPropagation(); toggleMobileNavigation(); });
mobileNavPanel?.addEventListener("click", () => closeMobileNavigation());
mobileSearchBtn?.addEventListener("click", event => {
  event.stopPropagation();
  closeMobileNavigation();
  const search = document.querySelector(".search");
  search.classList.toggle("mobile-open");
  if (search.classList.contains("mobile-open")) $("#searchInput").focus();
});
$("#headerThemeBtn")?.addEventListener("click", toggleTheme);
$("#bottomCategoryBtn").addEventListener("click", () => { closeMobileNavigation(); $("#categories").scrollIntoView({ behavior: "smooth" }); });
$("#bottomTrackBtn").addEventListener("click", () => openHistory("orders"));
$("#mobileTrackBtn").addEventListener("click", () => openHistory("orders"));
$("#logoutBtn").addEventListener("click", async () => {
  if (!requireClient()) return;
  await supabaseClient.auth.signOut();
  setLoggedOut(); showToast("You've been logged out.");
});

/* ---------- Email OTP authentication ---------- */
function setOtpVisible(prefix, visible) {
  $(`#${prefix}OtpField`).hidden = !visible;
  if (prefix === "si") $("#siVerifyOtp").hidden = !visible;
  else $("#signUpBtn").hidden = !visible;
}
function otpHint(prefix, email) { $(`#${prefix}OtpHint`).textContent = `sent to ${email}`; }
async function requestOtp(mode) {
  if (!requireClient()) return;
  const isSignUp = mode === "su";
  const email = $(`#${mode}Email`).value.trim().toLowerCase();
  const mobile = $(`#${mode}Mobile`).value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return showToast("Enter a valid email address.");
  if (!validMobile(mobile)) return showToast("Enter a valid 10-digit mobile number.");
  const phone = normalizeMobile(mobile);
  const button = $(`#${mode}SendOtp`);
  button.disabled = true;
  button.textContent = "Sending…";

  try {
    let error;

    if (isSignUp) {
      const first_name = $("#suName").value.trim();
      const last_name = $("#suSurname").value.trim();
      if (!first_name || !last_name) {
        showToast("Enter your name and surname.");
        return;
      }

      // SIGN UP: create a new Supabase user, then email a numeric OTP.
      ({ error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { first_name, last_name, mobile: phone }
        }
      }));
    } else {
      // SIGN IN: never create an account; email an OTP only to an existing user.
      ({ error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      }));
    }

    if (error) {
      console.error("[VK] email OTP error", error);
      const message = /error sending confirmation email/i.test(error.message || "")
       ? "Supabase could not send the email. Check the Resend API key, SMTP settings, and verified sender domain."
        : error.message || "Could not send the OTP. Please try again.";
      showToast(message);
      return;
    }

    setOtpVisible(mode, true);
    otpHint(mode, email);
    showToast("Email OTP sent. Check your inbox and spam folder.");
  } catch (error) {
    console.error("[VK] unexpected OTP error", error);
    showToast("Connection problem. Please reload and try again.");
  } finally {
    button.disabled = false;
    button.textContent = "Resend Email OTP";
  }
}
$("#siSendOtp").addEventListener("click", () => requestOtp("si"));
$("#suSendOtp").addEventListener("click", () => requestOtp("su"));
async function verifyOtp(mode) {
  if (!requireClient()) return;
  const email = $(`#${mode}Email`).value.trim().toLowerCase();
  const token = $(`#${mode}Otp`).value.trim();
  if (!token) return showToast("Enter the OTP from your email.");
  const { data, error } = await supabaseClient.auth.verifyOtp({ email, token, type: "email" });
  if (error) { console.error("[VK] verify OTP error", error); return showToast("That OTP is invalid or has expired. Request a new code."); }
  await hydrateUser(data.user);
  await supabaseClient.from("login_events").insert({ user_id: data.user.id });
  closeAuth(); showToast(mode === "su" ? "Your account is ready." : "Signed in successfully.");
}
$("#signinPanel").addEventListener("submit", event => { event.preventDefault(); verifyOtp("si"); });
$("#signupPanel").addEventListener("submit", event => { event.preventDefault(); verifyOtp("su"); });
$("#siMobile").addEventListener("input", event => event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10));
$("#suMobile").addEventListener("input", event => event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10));

/* ---------- Customer data: profile, saved orders, views, login dates ---------- */
function updateWishlistCount() {
  wishlist = wishlistItems.size;
  const count = $("#accountWishlistCount");
  if (count) count.textContent = `(${wishlist})`;
}

function userStorageKey(field) {
  return currentUser ? `vk-user-${currentUser.id}-${field}` : "";
}
function readUserArray(field) {
  if (!currentUser) return [];
  const metadataValue = currentUser.metadata?.[field];
  if (Array.isArray(metadataValue)) return metadataValue;
  try {
    const saved = JSON.parse(localStorage.getItem(userStorageKey(field)) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.warn(`[VK] could not read ${field} fallback`, error);
    return [];
  }
}
async function persistUserArray(field, value) {
  if (!currentUser) return false;
  const cleanValue = Array.isArray(value) ? value : [];
  localStorage.setItem(userStorageKey(field), JSON.stringify(cleanValue));
  currentUser.metadata = { ...(currentUser.metadata || {}), [field]: cleanValue };
  const { data, error } = await supabaseClient.auth.updateUser({ data: { [field]: cleanValue } });
  if (error) {
    console.warn(`[VK] ${field} saved locally because Auth metadata update failed`, error);
    return false;
  }
  currentUser.metadata = data.user?.user_metadata || currentUser.metadata;
  return true;
}

async function loadWishlist() {
  if (!currentUser || !supabaseClient) return;
  const { data, error } = await supabaseClient.from("wishlist_items")
    .select("product_id").eq("user_id", currentUser.id);
  const metadataIds = readUserArray("vk_wishlist").filter(id => typeof id === "string");
  if (error) {
    console.warn("[VK] wishlist table unavailable; using Supabase Auth metadata", error);
    wishlistItems.clear();
    metadataIds.forEach(id => wishlistItems.add(id));
  } else {
    wishlistItems.clear();
    const ids = data?.length ? data.map(row => row.product_id) : metadataIds;
    ids.forEach(id => wishlistItems.add(id));
  }
  updateWishlistCount();
  renderCatalogue();
  renderWishlist();
}

async function toggleWishlist(product, button) {
  if (!currentUser) {
    openAuth();
    return showToast("Sign in to save products to your wishlist.");
  }
  const id = product.id;
  const saved = wishlistItems.has(id);
  if (saved) wishlistItems.delete(id); else wishlistItems.add(id);
  updateWishlistCount();
  if (button) {
    button.classList.toggle("active", !saved);
    button.textContent = saved ? "♡" : "♥";
  }
  renderWishlist();
  const result = saved
    ? await supabaseClient.from("wishlist_items").delete().eq("user_id", currentUser.id).eq("product_id", id)
    : await supabaseClient.from("wishlist_items").insert({ user_id: currentUser.id, product_id: id });
  await persistUserArray("vk_wishlist", [...wishlistItems]);
  if (result.error) {
    console.warn("[VK] wishlist table unavailable; saved through Supabase Auth metadata", result.error);
  }
  renderCatalogue();
  showToast(saved ? "Removed from wishlist." : "Saved to wishlist.");
}

async function removeWishlistProduct(productId) {
  const product = catalogueProducts.find(item => item.id === productId);
  if (!product || !currentUser) return;
  const wasSaved = wishlistItems.delete(productId);
  if (!wasSaved) return;
  updateWishlistCount();
  renderWishlist();
  const { error } = await supabaseClient.from("wishlist_items").delete().eq("user_id", currentUser.id).eq("product_id", productId);
  await persistUserArray("vk_wishlist", [...wishlistItems]);
  if (error) {
    console.warn("[VK] wishlist table unavailable; removal saved through Supabase Auth metadata", error);
  }
  renderCatalogue();
  showToast("Removed from wishlist.");
}

function renderWishlist() {
  const list = $("#wishlistList");
  if (!list) return;
  const products = [...wishlistItems].map(id => catalogueProducts.find(product => product.id === id)).filter(Boolean);
  if (!products.length) {
    list.innerHTML = '<p class="wishlist-empty-state">Your Wishlist is empty.</p>';
    return;
  }
  list.innerHTML = products.map(product => `<article class="wishlist-card" data-product-id="${escapeHtml(product.id)}">
    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
    <div class="wishlist-card-copy"><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.pack)}</span><b>${money(product.price)}</b>
      <div class="wishlist-card-actions"><button type="button" data-wishlist-action="view">View Product</button><button type="button" data-wishlist-action="cart">Add to Cart</button><button type="button" data-wishlist-action="remove">Remove ♡</button></div>
    </div>
  </article>`).join("");
}

$("#wishlistList")?.addEventListener("click", event => {
  const button = event.target.closest("button[data-wishlist-action]");
  const card = event.target.closest("[data-product-id]");
  if (!button || !card) return;
  const product = catalogueProducts.find(item => item.id === card.dataset.productId);
  if (!product) return;
  if (button.dataset.wishlistAction === "view") { closeWishlist(); openProductDetails(product.id); }
  else if (button.dataset.wishlistAction === "cart") addProduct({ dataset: { name: product.name, price: String(product.price) } });
  else removeWishlistProduct(product.id);
});

async function trackProductView(product) {
  if (!currentUser || !product || viewUpdatesInFlight.has(product.id)) return;
  viewUpdatesInFlight.add(product.id);
  try {
    const viewedAt = new Date().toISOString();
    const metadataRows = readUserArray("vk_view_history")
      .filter(row => row && row.product_id !== product.id);
    await persistUserArray("vk_view_history", [
      { product_id: product.id, viewed_at: viewedAt },
      ...metadataRows
    ].slice(0, 50));
    const { error } = await supabaseClient.from("view_history").upsert({
      user_id: currentUser.id,
      product_id: product.id,
      product_name: product.name,
      product_price: Number(product.price),
      viewed_at: viewedAt
    }, { onConflict: "user_id,product_id" });
    if (error) console.warn("[VK] view history table unavailable; saved through Supabase Auth metadata", error);
    viewedProducts.add(product.id);
  } finally {
    viewUpdatesInFlight.delete(product.id);
  }
}
/* ---------- Checkout: delivery details, review and saved order ---------- */
const VK_WHATSAPP_ORDER_NUMBER = "918425920360";
let checkoutAddress = null;
let checkoutBusy = false;
const checkoutOverlay = $("#checkoutOverlay"), checkoutModal = $("#checkoutModal");
const shippingFieldNames = ["Name", "Mobile", "Email", "Address1", "Pin", "City", "State", "Country"];
function checkoutTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  return { subtotal, shipping: 0, discount: 0, total: subtotal };
}
function setShippingError(field, message = "") {
  const input = $(`#ship${field}`), error = $(`#ship${field}Error`);
  if (!input || !error) return;
  input.closest(".checkout-field").classList.toggle("invalid", Boolean(message));
  error.textContent = message;
}
function readShippingAddress() {
  return {
    full_name: $("#shipName").value.trim(), mobile: $("#shipMobile").value.replace(/\D/g, ""), email: $("#shipEmail").value.trim(),
    address_line_1: $("#shipAddress1").value.trim(), address_line_2: $("#shipAddress2").value.trim(), landmark: $("#shipLandmark").value.trim(),
    pin_code: $("#shipPin").value.replace(/\D/g, ""), city: $("#shipCity").value.trim(), state: $("#shipState").value.trim(), country: $("#shipCountry").value.trim() || "India"
  };
}
function validateShippingAddress(address) {
  shippingFieldNames.forEach(field => setShippingError(field));
  let valid = true;
  const checks = [
    ["Name", address.full_name, "Enter your full name."], ["Mobile", /^\d{10}$/.test(address.mobile), "Enter a valid 10-digit mobile number."],
    ["Email", /^\S+@\S+\.\S+$/.test(address.email), "Enter a valid email address."], ["Address1", address.address_line_1, "Enter your delivery address."],
    ["Pin", /^\d{6}$/.test(address.pin_code), "Enter a valid 6-digit PIN code."], ["City", address.city, "Enter your city."],
    ["State", address.state, "Enter your state."], ["Country", address.country, "Enter your country."]
  ];
  checks.forEach(([field, result, message]) => { if (!result) { valid = false; setShippingError(field, message); } });
  return valid;
}
function fillShippingAddress(address = {}) {
  $("#shipName").value = address.full_name || [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ");
  $("#shipMobile").value = String(address.mobile || currentUser?.phone || "").replace(/^\+91/, "");
  $("#shipEmail").value = address.email || currentUser?.email || "";
  $("#shipAddress1").value = address.address_line_1 || ""; $("#shipAddress2").value = address.address_line_2 || "";
  $("#shipLandmark").value = address.landmark || ""; $("#shipPin").value = address.pin_code || "";
  $("#shipCity").value = address.city || ""; $("#shipState").value = address.state || ""; $("#shipCountry").value = address.country || "India";
}
async function loadDefaultAddress() {
  if (!currentUser || !supabaseClient) return fillShippingAddress();
  const { data, error } = await supabaseClient.from("saved_addresses").select("*").eq("user_id", currentUser.id).order("is_default", { ascending: false }).limit(1);
  if (error) { console.warn("[VK] saved address unavailable", error); return fillShippingAddress(); }
  fillShippingAddress(data?.[0] || {});
}
function openCheckout() {
  if (!cart.length) return showToast("Your cart is empty.");
  if (!currentUser) { openAuth(); return showToast("Sign in before checkout."); }
  checkoutAddress = null; $("#shippingForm").hidden = false; $("#checkoutReview").hidden = true;
  $("#checkoutTitle").textContent = "Delivery Details"; $("#checkoutStepText").textContent = "Enter a delivery address before continuing to order review.";
  checkoutOverlay.classList.add("show"); checkoutModal.classList.add("open"); loadDefaultAddress();
}
function closeCheckout() { if (checkoutBusy) return; checkoutOverlay.classList.remove("show"); checkoutModal.classList.remove("open"); }
function formatAddress(address) { return [address.address_line_1, address.address_line_2, address.landmark].filter(Boolean).join(", "); }
function whatsappLink(type, order) {
  const address = order.shipping_address || {}; const totals = { subtotal: order.subtotal_amount ?? order.total_amount, shipping: order.shipping_charge ?? 0, discount: order.discount_amount ?? 0, total: order.final_amount ?? order.total_amount };
  const items = (order.items || []).map(item => `${item.name} × ${item.qty} — ${money(item.price * item.qty)}`).join("\n");
  const cancelled = type === "cancel";
  const text = `${cancelled ? "VK NUTRITION — ORDER CANCELLED" : "NEW VK NUTRITION ORDER"}\n\nOrder ID: ${order.order_code || `VK-${order.id}`}\n\nCustomer:\n${order.customer_name || address.full_name || "Customer"}\n${order.customer_mobile || address.mobile || ""}\n\nDelivery Address:\n${formatAddress(address)}\n${address.city || ""}, ${address.state || ""} - ${address.pin_code || ""}\n\n${cancelled ? "Cancelled Items" : "Order"}:\n${items}\n\nSubtotal: ${money(totals.subtotal)}\nDelivery: ${money(totals.shipping)}\nDiscount: ${money(totals.discount)}\nTotal: ${money(totals.total)}\n\nPayment Status: ${order.payment_status || "pending"}\nOrder Status: ${cancelled ? "Cancelled" : (order.status || "Placed")}${cancelled ? `\nCancellation Date/Time: ${formatHistoryDate(order.cancelled_at || new Date().toISOString())}${order.cancellation_reason ? `\nCancellation Reason: ${order.cancellation_reason}` : ""}` : ""}`;
  return `https://wa.me/${VK_WHATSAPP_ORDER_NUMBER}?text=${encodeURIComponent(text)}`;
}
function renderCheckoutReview() {
  const totals = checkoutTotals(); const address = checkoutAddress;
  $("#shippingForm").hidden = true; $("#checkoutReview").hidden = false;
  $("#checkoutTitle").textContent = "Review Order"; $("#checkoutStepText").textContent = "Confirm your delivery details and order summary before payment.";
  $("#checkoutReview").innerHTML = `<div class="checkout-review-delivery"><h3>Deliver To</h3><p><strong>${escapeHtml(address.full_name)}</strong></p><p>${escapeHtml(formatAddress(address))}</p><p>${escapeHtml(address.city)}, ${escapeHtml(address.state)} - ${escapeHtml(address.pin_code)}</p><p>+91 ${escapeHtml(address.mobile)} · ${escapeHtml(address.email)}</p></div><div class="checkout-review-summary"><h3>Order Summary</h3><div class="checkout-review-items">${cart.map(item => `<div class="checkout-review-item"><span>${escapeHtml(item.name)} × ${item.qty}</span><strong>${money(item.price * item.qty)}</strong></div>`).join("")}</div><div class="checkout-review-total"><span>Subtotal</span><span>${money(totals.subtotal)}</span></div><div class="checkout-review-item"><span>Delivery</span><span>${money(totals.shipping)}</span></div><div class="checkout-review-item"><span>Discount</span><span>${money(totals.discount)}</span></div><div class="checkout-review-total"><span>Total</span><span>${money(totals.total)}</span></div></div><div class="checkout-review-actions"><button class="btn btn-dark" id="changeAddressBtn" type="button">CHANGE ADDRESS</button><button class="btn btn-primary" id="placeOrderBtn" type="button">PROCEED TO PAYMENT →</button></div><p class="checkout-note">No live payment gateway is configured in this project. The order will be saved with payment status: Pending.</p>`;
  $("#changeAddressBtn").addEventListener("click", () => { $("#shippingForm").hidden = false; $("#checkoutReview").hidden = true; $("#checkoutTitle").textContent = "Delivery Details"; });
  $("#placeOrderBtn").addEventListener("click", placeCheckoutOrder);
}
async function saveAddressForFuture(address) {
  if (!$("#saveAddress").checked) return;
  const { data: existing } = await supabaseClient.from("saved_addresses").select("id").eq("user_id", currentUser.id).limit(1);
  const payload = { user_id: currentUser.id, ...address, is_default: !(existing?.length) };
  const { error } = await supabaseClient.from("saved_addresses").insert(payload);
  if (error) console.warn("[VK] address was not saved for future orders", error);
}
function orderCode() { return `VK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; }
async function placeCheckoutOrder() {
  if (checkoutBusy || !checkoutAddress || !currentUser) return;
  checkoutBusy = true; const button = $("#placeOrderBtn"); if (button) { button.disabled = true; button.textContent = "SAVING ORDER…"; }
  const totals = checkoutTotals(); const createdAt = new Date().toISOString(); const code = orderCode();
  const payload = { user_id: currentUser.id, order_code: code, customer_name: checkoutAddress.full_name, customer_email: checkoutAddress.email, customer_mobile: `+91${checkoutAddress.mobile}`, shipping_address: checkoutAddress, items: cart.map(item => ({ ...item })), total_amount: totals.total, subtotal_amount: totals.subtotal, shipping_charge: totals.shipping, discount_amount: totals.discount, final_amount: totals.total, payment_method: "pending", payment_status: "pending", status: "pending", whatsapp_order_prepared_at: createdAt };
  const { data, error } = await supabaseClient.from("order_history").insert(payload).select().single();
  if (error) { console.error("[VK] order save error", error); checkoutBusy = false; if (button) { button.disabled = false; button.textContent = "PROCEED TO PAYMENT →"; } return showToast("Could not create the order. Please ensure the latest Supabase setup SQL has been run."); }
  await saveAddressForFuture(checkoutAddress); cart.splice(0, cart.length); renderCart(); closeCart();
  $("#checkoutReview").innerHTML = `<div class="checkout-review-summary"><h3>Order Confirmed</h3><p>Your order has been saved successfully.</p><p><strong>Order ID: ${escapeHtml(data.order_code || code)}</strong></p><p>Payment status: Pending · Order status: Pending</p><a class="whatsapp-action" href="${whatsappLink("order", data)}" target="_blank" rel="noopener">OPEN WHATSAPP ORDER NOTIFICATION</a></div>`;
  $("#checkoutTitle").textContent = "Order Confirmation"; $("#checkoutStepText").textContent = "Your pre-filled WhatsApp notification is ready for the business number."; checkoutBusy = false; showToast("Order created successfully.");
}
$("#checkoutBtn").addEventListener("click", openCheckout); $("#checkoutClose").addEventListener("click", closeCheckout); checkoutOverlay.addEventListener("click", closeCheckout);
$("#shippingForm").addEventListener("submit", event => { event.preventDefault(); const address = readShippingAddress(); if (!validateShippingAddress(address)) return; checkoutAddress = address; renderCheckoutReview(); });

const historyOverlay = $("#historyOverlay"), historyModal = $("#historyModal");
function closeHistory() { historyOverlay.classList.remove("show"); historyModal.classList.remove("open"); }
$("#historyClose").addEventListener("click", closeHistory);
historyOverlay.addEventListener("click", closeHistory);
const wishlistOverlay = $("#wishlistOverlay"), wishlistModal = $("#wishlistModal");
function closeWishlist() { wishlistOverlay.classList.remove("show"); wishlistModal.classList.remove("open"); }
$("#wishlistClose").addEventListener("click", closeWishlist);
wishlistOverlay.addEventListener("click", closeWishlist);

function formatHistoryDate(value) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function renderViewHistory(rows) {
  const list = $("#historyList");
  if (!rows?.length) {
    list.innerHTML = '<p class="history-empty">You haven\'t viewed any products yet.</p>';
    return;
  }
  list.innerHTML = rows.map(row => {
    const product = catalogueProducts.find(item => item.id === row.product_id) || {
      id: row.product_id || "",
      name: row.product_name || "Product",
      price: Number(row.product_price || 0),
      pack: "",
      image: ""
    };
    return `<article class="history-product" data-product-id="${escapeHtml(product.id)}">
      ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : ""}
      <div class="history-product-copy"><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.pack || "Product details")}</span><b>${money(product.price)}</b><small>Viewed ${formatHistoryDate(row.viewed_at)}</small>
        <div class="history-product-actions">${product.id ? '<button type="button" data-history-action="view">View Product</button>' : ""}<button type="button" data-history-action="cart">Add to Cart</button></div>
      </div>
    </article>`;
  }).join("");
}
$("#historyList")?.addEventListener("click", event => {
  const button = event.target.closest("button[data-history-action]");
  const card = event.target.closest("[data-product-id]");
  if (!button || !card) return;
  const product = catalogueProducts.find(item => item.id === card.dataset.productId);
  if (!product) return;
  if (button.dataset.historyAction === "view") { closeHistory(); openProductDetails(product.id); }
  else addProduct({ dataset: { name: product.name, price: String(product.price) } });
});
$("#historyList")?.addEventListener("click", async event => {
  const button = event.target.closest("button[data-order-action]");
  if (!button || button.dataset.orderAction !== "cancel" || button.disabled) return;
  const orderId = button.dataset.orderId;
  if (!confirm("Are you sure you want to cancel this order?")) return;
  const cancellation_reason = prompt("Cancellation reason (optional):") || "";
  button.disabled = true; button.textContent = "CANCELLING…";
  const cancelled_at = new Date().toISOString();
  const { data, error } = await supabaseClient.from("order_history").update({ status: "cancelled", cancelled_at, cancellation_reason, whatsapp_cancel_prepared_at: cancelled_at }).eq("id", orderId).eq("user_id", currentUser.id).select().single();
  if (error) { console.error("[VK] order cancellation error", error); button.disabled = false; button.textContent = "CANCEL ORDER"; return showToast("Order cancellation could not be saved."); }
  const link = whatsappLink("cancel", data);
  button.closest(".history-item").insertAdjacentHTML("beforeend", `<a class="whatsapp-action" href="${link}" target="_blank" rel="noopener">OPEN WHATSAPP CANCELLATION</a>`);
  button.remove(); showToast("Order cancelled successfully.");
});
function mergedViewHistory(tableRows, metadataRows) {
  const rowsByProduct = new Map();
  [...(tableRows || []), ...(metadataRows || [])].forEach((row, index) => {
    if (!row) return;
    const key = row.product_id || `legacy-${index}-${row.product_name || "product"}`;
    const existing = rowsByProduct.get(key);
    if (!existing) return rowsByProduct.set(key, row);
    const newestViewedAt = new Date(existing.viewed_at) >= new Date(row.viewed_at) ? existing.viewed_at : row.viewed_at;
    rowsByProduct.set(key, {
      ...existing,
      ...row,
      product_name: row.product_name || existing.product_name,
      product_price: row.product_price ?? existing.product_price,
      viewed_at: newestViewedAt
    });
  });
  return [...rowsByProduct.values()]
    .sort((left, right) => new Date(right.viewed_at) - new Date(left.viewed_at))
    .slice(0, 30);
}
async function openHistory(type) {
  if (!currentUser) return openAuth();
  closeAccountMenu();
  const config = {
    orders: { title: "Order History", subtitle: "Your saved orders and delivery updates.", table: "order_history", select: "id,order_code,items,total_amount,final_amount,status,payment_status,customer_name,customer_mobile,shipping_address,cancelled_at,cancellation_reason,whatsapp_cancel_prepared_at,created_at", order: "created_at" },
    views: { title: "View History", subtitle: "Products you viewed while signed in.", table: "view_history", select: "product_id,product_name,product_price,viewed_at", order: "viewed_at" },
    logins: { title: "Login History", subtitle: "Your recent account access.", table: "login_events", select: "created_at", order: "created_at" }
  }[type];
  $("#historyTitle").textContent = config.title; $("#historySub").textContent = config.subtitle;
  $("#historyList").innerHTML = '<p class="history-empty">Loading your saved data…</p>';
  historyOverlay.classList.add("show"); historyModal.classList.add("open");
  const { data, error } = await supabaseClient.from(config.table).select(config.select).order(config.order, { ascending: false }).limit(30);
  if (type === "views") {
    if (error) console.warn("[VK] view history table unavailable; using Supabase Auth metadata", error);
    return renderViewHistory(mergedViewHistory(error ? [] : data, readUserArray("vk_view_history")));
  }
  if (error) {
    console.error("[VK] history error", error);
    $("#historyList").innerHTML = '<p class="history-empty">No saved data yet.</p>';
    return;
  }
  if (!data?.length) { $("#historyList").innerHTML = '<p class="history-empty">No saved data yet.</p>'; return; }
  $("#historyList").innerHTML = data.map(row => {
    const date = formatHistoryDate(row.created_at || row.viewed_at);
    if (type === "orders") { const isCancelable = !["cancelled", "shipped", "delivered"].includes(String(row.status).toLowerCase()); return `<article class="history-item"><strong>${escapeHtml(row.order_code || `Order #${row.id}`)} · ${escapeHtml(row.status)} · ${money(row.final_amount ?? row.total_amount)}</strong><span>${row.items.length} item(s) · ${date}</span>${row.shipping_address ? `<span>Deliver to: ${escapeHtml(row.shipping_address.city || "")}, ${escapeHtml(row.shipping_address.state || "")}</span>` : ""}<span>Payment: ${escapeHtml(row.payment_status || "pending")}</span>${row.cancelled_at ? `<span>Cancelled: ${formatHistoryDate(row.cancelled_at)}${row.cancellation_reason ? ` · ${escapeHtml(row.cancellation_reason)}` : ""}</span>` : ""}${isCancelable ? `<button class="order-cancel" type="button" data-order-action="cancel" data-order-id="${row.id}">CANCEL ORDER</button>` : ""}</article>`; }
    return `<article class="history-item"><strong>Signed in</strong><span>${date}</span></article>`;
  }).join("");
}
$("#openOrdersBtn").addEventListener("click", () => openHistory("orders"));
$("#openViewsBtn").addEventListener("click", () => openHistory("views"));
$("#openLoginsBtn").addEventListener("click", () => openHistory("logins"));

const settingsOverlay = $("#settingsOverlay"), settingsModal = $("#settingsModal");
function openSettings() {
  if (!currentUser) return openAuth();
  closeAccountMenu();
  $("#setName").value = currentUser.first_name || "";
  $("#setSurname").value = currentUser.last_name || "";
  $("#setEmail").value = currentUser.email || "";
  settingsOverlay.classList.add("show"); settingsModal.classList.add("open");
}
function closeSettings() { settingsOverlay.classList.remove("show"); settingsModal.classList.remove("open"); }
$("#openProfileBtn").addEventListener("click", openSettings);
$("#openSettingsBtn").addEventListener("click", openSettings);
$("#settingsClose").addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);
$("#settingsForm").addEventListener("submit", async event => {
  event.preventDefault();
  const first_name = $("#setName").value.trim(), last_name = $("#setSurname").value.trim();
  if (!first_name || !last_name) return showToast("Enter your name and surname.");
  const { error } = await supabaseClient.from("profiles").update({ first_name, last_name }).eq("id", currentUser.id);
  if (error) return showToast("Could not save your profile.");
  currentUser = { ...currentUser, first_name, last_name };
  setLoggedIn(currentUser); closeSettings(); showToast("Profile saved.");
});

const languageOverlay = $("#languageOverlay"), languageModal = $("#languageModal");
function openLanguage() { closeAccountMenu(); languageOverlay.classList.add("show"); languageModal.classList.add("open"); }
function closeLanguage() { languageOverlay.classList.remove("show"); languageModal.classList.remove("open"); }
$("#openLanguageBtn").addEventListener("click", openLanguage);
$("#openWishlistBtn").addEventListener("click", openWishlist);
$("#appearanceBtn").addEventListener("click", toggleTheme);
$("#languageClose").addEventListener("click", closeLanguage);
languageOverlay.addEventListener("click", closeLanguage);
document.querySelectorAll(".language-option").forEach(button => button.addEventListener("click", () => { localStorage.setItem("vk-language", button.dataset.language); document.documentElement.lang = button.dataset.language; closeLanguage(); showToast(`${button.textContent} selected.`); }));
$("#deleteAccountBtn").addEventListener("click", async () => {
  if (!currentUser || !confirm("Delete your account permanently?")) return;
  const { error } = await supabaseClient.rpc("delete_user_account");
  if (error) return showToast("Account deletion could not be completed.");
  await supabaseClient.auth.signOut(); closeSettings(); setLoggedOut(); showToast("Your account has been deleted.");
});

/* ---------- Persistent Supabase session ---------- */
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") setLoggedOut();
    else if (session?.user) setTimeout(() => hydrateUser(session.user), 0);
  });
  supabaseClient.auth.getSession().then(({ data }) => hydrateUser(data.session?.user || null));
}
renderCart();
