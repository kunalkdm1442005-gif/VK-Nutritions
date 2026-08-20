/* VK Nutrition storefront and Supabase email-OTP authentication. */
const SUPABASE_URL = "https://owpgbkrnimhwvgqntggq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yVu_tEIx690wZny03SmjBg_yNQX8toM";
const $ = selector => document.querySelector(selector);
const cart = [];
const viewedProducts = new Set();
let currentUser = null;
let wishlist = 0;
let supabaseClient = null;

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
if (slides.length > 1) { showSlide(0); setInterval(() => showSlide(activeSlide + 1), 4000); }

function renderCart() {
  const quantity = cart.reduce((total, item) => total + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  $("#cartCount").textContent = quantity;
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
document.querySelectorAll(".add").forEach(button => button.addEventListener("click", event => addProduct(event.currentTarget.closest(".product"))));
document.querySelectorAll(".buy").forEach(button => button.addEventListener("click", event => addProduct(event.currentTarget.closest(".product"), true)));
document.querySelectorAll(".wish").forEach(button => button.addEventListener("click", event => {
  const heart = event.currentTarget;
  heart.classList.toggle("active");
  const saved = heart.classList.contains("active");
  heart.textContent = saved ? "♥" : "♡";
  wishlist += saved ? 1 : -1;
  $("#wishCount").textContent = wishlist;
  showToast(saved ? "Saved to wishlist." : "Removed from wishlist.");
}));
$("#cartBtn").addEventListener("click", () => { $("#drawer").classList.add("open"); $("#overlay").classList.add("show"); });
$("#closeCart").addEventListener("click", closeCart);
$("#overlay").addEventListener("click", closeCart);
$("#wishlistBtn").addEventListener("click", () => showToast(wishlist ? `${wishlist} saved item${wishlist === 1 ? "" : "s"}.` : "Your wishlist is empty."));
$("#searchInput").addEventListener("input", event => {
  const query = event.target.value.toLowerCase();
  document.querySelectorAll(".product").forEach(product => { product.style.display = product.dataset.name.toLowerCase().includes(query) ? "block" : "none"; });
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
  const desktop = $("#accountBtn");
  desktop.className = "account-btn";
  desktop.innerHTML = "♙";
  desktop.setAttribute("aria-label", "Login or create account");
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
    last_name: profile?.last_name || authUser.user_metadata?.last_name || ""
  });
}
function closeAccountMenu() {
  $("#accountMenu").classList.remove("open");
  $("#accountBtn").setAttribute("aria-expanded", "false");
}
function closeHamburgerMenu() {
  const menu = document.querySelector(".mobile-menu");
  if (menu) menu.removeAttribute("open");
}
function toggleAccountMenu() {
  closeHamburgerMenu();
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
const hamburgerMenu = document.querySelector(".mobile-menu");
hamburgerMenu.addEventListener("toggle", () => {
  if (hamburgerMenu.open) closeAccountMenu();
});
document.addEventListener("click", event => {
  const menu = $("#accountMenu");
  const desktopButton = $("#accountBtn");
  if (!menu.contains(event.target) && !desktopButton.contains(event.target)) closeAccountMenu();
  if (hamburgerMenu && !hamburgerMenu.contains(event.target)) closeHamburgerMenu();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeAccountMenu();
    closeHamburgerMenu();
  }
});
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
  if (error) return showToast("That OTP is invalid or has expired. Request a new code.");
  await hydrateUser(data.user);
  await supabaseClient.from("login_events").insert({ user_id: data.user.id });
  closeAuth(); showToast(mode === "su" ? "Your account is ready." : "Signed in successfully.");
}
$("#signinPanel").addEventListener("submit", event => { event.preventDefault(); verifyOtp("si"); });
$("#signupPanel").addEventListener("submit", event => { event.preventDefault(); verifyOtp("su"); });
$("#siMobile").addEventListener("input", event => event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10));
$("#suMobile").addEventListener("input", event => event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10));

/* ---------- Customer data: profile, saved orders, views, login dates ---------- */
async function trackProductView(card) {
  if (!currentUser || viewedProducts.has(card.dataset.name)) return;
  viewedProducts.add(card.dataset.name);
  const { error } = await supabaseClient.from("view_history").insert({ user_id: currentUser.id, product_name: card.dataset.name, product_price: Number(card.dataset.price) });
  if (error) console.error("[VK] view history error", error);
}
document.querySelectorAll(".product").forEach(card => card.addEventListener("click", event => {
  if (!event.target.closest("button")) trackProductView(card);
}));
$("#checkoutBtn").addEventListener("click", async () => {
  if (!cart.length) return showToast("Your cart is empty.");
  if (!currentUser) { openAuth(); return showToast("Sign in to save your order."); }
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const { error } = await supabaseClient.from("order_history").insert({ user_id: currentUser.id, items: cart, total_amount: total, status: "pending" });
  if (error) { console.error("[VK] order save error", error); return showToast("Could not save your order. Please try again."); }
  cart.splice(0, cart.length); renderCart(); closeCart();
  showToast("Order saved. Payment confirmation can be added next.");
});

const historyOverlay = $("#historyOverlay"), historyModal = $("#historyModal");
function closeHistory() { historyOverlay.classList.remove("show"); historyModal.classList.remove("open"); }
$("#historyClose").addEventListener("click", closeHistory);
historyOverlay.addEventListener("click", closeHistory);
async function openHistory(type) {
  if (!currentUser) return openAuth();
  closeAccountMenu();
  closeHamburgerMenu();
  const config = {
    orders: { title: "Order History", subtitle: "Your saved order requests.", table: "order_history", select: "items,total_amount,status,created_at", order: "created_at" },
    views: { title: "View History", subtitle: "Products you viewed while signed in.", table: "view_history", select: "product_name,product_price,viewed_at", order: "viewed_at" },
    logins: { title: "Login History", subtitle: "Your recent account access.", table: "login_events", select: "created_at", order: "created_at" }
  }[type];
  $("#historyTitle").textContent = config.title; $("#historySub").textContent = config.subtitle;
  $("#historyList").innerHTML = '<p class="history-empty">Loading your saved data…</p>';
  historyOverlay.classList.add("show"); historyModal.classList.add("open");
  const { data, error } = await supabaseClient.from(config.table).select(config.select).order(config.order, { ascending: false }).limit(30);
  if (error) { console.error("[VK] history error", error); $("#historyList").innerHTML = '<p class="history-empty">Your data is not available yet. Run supabase-setup.sql first.</p>'; return; }
  if (!data?.length) { $("#historyList").innerHTML = '<p class="history-empty">No saved data yet.</p>'; return; }
  $("#historyList").innerHTML = data.map(row => {
    const date = new Date(row.created_at || row.viewed_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    if (type === "orders") return `<article class="history-item"><strong>${escapeHtml(row.status)} order · ${money(row.total_amount)}</strong><span>${row.items.length} item(s) · ${date}</span></article>`;
    if (type === "views") return `<article class="history-item"><strong>${escapeHtml(row.product_name)}</strong><span>${money(row.product_price)} · ${date}</span></article>`;
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
  closeHamburgerMenu();
  $("#setName").value = currentUser.first_name || "";
  $("#setSurname").value = currentUser.last_name || "";
  $("#setEmail").value = currentUser.email || "";
  settingsOverlay.classList.add("show"); settingsModal.classList.add("open");
}
function closeSettings() { settingsOverlay.classList.remove("show"); settingsModal.classList.remove("open"); }
$("#openProfileBtn").addEventListener("click", openSettings);
$("#openSettingsBtn").addEventListener("click", openSettings);
$("#openSettingsBtnMobile").addEventListener("click", openSettings);
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
function openLanguage() { closeAccountMenu(); closeHamburgerMenu(); languageOverlay.classList.add("show"); languageModal.classList.add("open"); }
function closeLanguage() { languageOverlay.classList.remove("show"); languageModal.classList.remove("open"); }
$("#openLanguageBtn").addEventListener("click", openLanguage);
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
