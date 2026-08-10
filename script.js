    /* ---------- Supabase init (safe, will not crash the rest of the script) ---------- */
    const SUPABASE_URL = "https://owpgbkrnimhwvgqntggq.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_yVu_tEIx690wZny03SmjBg_yNQX8toM";
    let supabaseClient = null;
    try {
      if (!window.supabase) {
        console.error("[VK] Supabase library did not load from CDN. Check your network/ad-blocker, or that you are not opening this file via file:// — serve it over http(s) instead.");
      } else {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("[VK] Supabase client created OK.");
      }
    } catch (err) {
      console.error("[VK] Supabase init failed:", err);
    }

    const cart = [];
    let wishlist = 0;
    const $ = s => document.querySelector(s);
    const money = n => "₹" + n.toLocaleString("en-IN");
    const showToast = message => { const t=$("#toast"); t.textContent=message; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2400); };
    function renderCart(){
      $("#cartCount").textContent=cart.reduce((a,x)=>a+x.qty,0);
      $("#drawerCount").textContent=`(${cart.reduce((a,x)=>a+x.qty,0)})`;
      $("#cartTotal").textContent=money(cart.reduce((a,x)=>a+x.price*x.qty,0));
      $("#cartItems").innerHTML=cart.length ? cart.map((x,i)=>`<div class="cart-item"><div class="cart-thumb">⚡</div><div style="flex:1"><h4>${x.name}</h4><p>VK Nutrition · Qty ${x.qty}</p><strong>${money(x.price*x.qty)}</strong></div><button class="close remove" data-i="${i}" style="font-size:18px">×</button></div>`).join("") : `<p style="color:var(--muted);font-size:14px;padding-top:25px">Your cart is empty. Add products to get started.</p>`;
      document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>{cart.splice(b.dataset.i,1);renderCart()});
    }
    function addProduct(card, open=false){
      const item={name:card.dataset.name,price:Number(card.dataset.price),qty:1};
      const exists=cart.find(x=>x.name===item.name); if(exists)exists.qty++; else cart.push(item);
      renderCart(); showToast(`${item.name} added to cart`);
      if(open){$("#drawer").classList.add("open");$("#overlay").classList.add("show")}
    }
    document.querySelectorAll(".add").forEach(b=>b.onclick=e=>addProduct(e.target.closest(".product")));
    document.querySelectorAll(".buy").forEach(b=>b.onclick=e=>addProduct(e.target.closest(".product"),true));
    document.querySelectorAll(".wish").forEach(b=>b.onclick=e=>{const el=e.target; if(!el.classList.contains("active")){el.classList.add("active");el.textContent="♥";wishlist++;}else{el.classList.remove("active");el.textContent="♡";wishlist--} $("#wishCount").textContent=wishlist;});
    const close=()=>{$("#drawer").classList.remove("open");$("#overlay").classList.remove("show")};
    $("#cartBtn").onclick=()=>{$("#drawer").classList.add("open");$("#overlay").classList.add("show")};
    $("#closeCart").onclick=close; $("#overlay").onclick=close;
    $("#checkoutBtn").onclick=()=>showToast(cart.length ? "Checkout is ready for secure payment integration." : "Your cart is currently empty.");
    $("#wishlistBtn").onclick=()=>showToast(wishlist ? `${wishlist} item${wishlist>1?"s":""} saved to wishlist.` : "Your wishlist is empty.");
    $("#menuBtn").onclick=()=>showToast("Navigate using the Shop and Categories links.");
    $("#searchInput").addEventListener("input",e=>{
      const q=e.target.value.toLowerCase();
      document.querySelectorAll(".product").forEach(p=>p.style.display=p.dataset.name.toLowerCase().includes(q)?"block":"none");
    });
    document.querySelector(".newsletter button").onclick=()=>showToast("Thanks — you're on the VK Nutrition list.");

    /* ---------- Auth modal: sign in / sign up + mobile OTP ---------- */
    const authOverlay=$("#authOverlay"), authModal=$("#authModal");
    function openAuth(tab="signin"){
      authOverlay.classList.add("show"); authModal.classList.add("open");
      setAuthTab(tab);
    }
    function closeAuth(){ authOverlay.classList.remove("show"); authModal.classList.remove("open"); }
    $("#authClose").onclick=closeAuth;
    authOverlay.onclick=closeAuth;
    document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeAuth(); });

    function setAuthTab(tab){
      document.querySelectorAll(".auth-tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===tab));
      $("#signinPanel").hidden = tab!=="signin";
      $("#signupPanel").hidden = tab!=="signup";
      $("#authTitle").textContent = tab==="signin" ? "Welcome Back" : "Create an Account";
    }
    document.querySelectorAll(".auth-tab").forEach(t=>t.onclick=()=>setAuthTab(t.dataset.tab));

    function requireSupabase(){
      if(!supabaseClient){
        showToast("Auth isn't ready — Supabase failed to load. Check the console.");
        return false;
      }
      return true;
    }

    /* ---------- Account state: header button + dropdown + settings ---------- */
    let currentUser = null; // { id, email, phone, first_name, last_name }

    function setLoggedIn(user){
      currentUser = user;
      const btn = $("#accountBtn");
      btn.className = "account-btn";
      const label = user.first_name || user.email || user.phone || "Account";
      btn.innerHTML = `<span class="account-avatar">${(user.first_name||label).charAt(0).toUpperCase()}</span><span class="account-name">${label}</span>`;
      $("#accountMenuName").textContent = user.first_name ? `${user.first_name} ${user.last_name||""}`.trim() : "Signed in";
      $("#accountMenuSub").textContent = user.email || user.phone || "";
    }

    function setLoggedOut(){
      currentUser = null;
      const btn = $("#accountBtn");
      btn.className = "btn-login";
      btn.innerHTML = "Login";
      $("#accountMenu").classList.remove("open");
    }

    // The same button opens Login when logged out, and the account menu when logged in.
    function handleAccountButtonClick(e){
      e.stopPropagation();
      if(currentUser){
        $("#accountMenu").classList.toggle("open");
      } else {
        openAuth();
      }
    }
    $("#accountBtn").addEventListener("click", handleAccountButtonClick);
    $("#accountBtnMobile").addEventListener("click", handleAccountButtonClick);
    document.addEventListener("click", (e)=>{
      const wrap = document.querySelector(".account-wrap");
      if(wrap && !wrap.contains(e.target)) $("#accountMenu").classList.remove("open");
    });

    // Logout
    $("#logoutBtn").addEventListener("click", async ()=>{
      $("#accountMenu").classList.remove("open");
      if(supabaseClient){
        try { await supabaseClient.auth.signOut(); } catch(err){ console.error("[VK] signOut error:", err); }
      }
      setLoggedOut();
      showToast("You've been logged out.");
    });

    // Settings modal open/close
    const settingsOverlay=$("#settingsOverlay"), settingsModal=$("#settingsModal");
    function openSettings(mode="settings"){
      $("#accountMenu").classList.remove("open");
      $("#setName").value = currentUser?.first_name || "";
      $("#setSurname").value = currentUser?.last_name || "";
      $("#setEmail").value = currentUser?.email || "";
      $("#settingsTitle").textContent = mode === "profile" ? "Edit Profile" : "Account Settings";
      settingsOverlay.classList.add("show"); settingsModal.classList.add("open");
    }
    function closeSettings(){ settingsOverlay.classList.remove("show"); settingsModal.classList.remove("open"); }
    $("#openProfileBtn").addEventListener("click", ()=>openSettings("profile"));
    $("#openSettingsBtn").addEventListener("click", ()=>openSettings("settings"));
    $("#settingsClose").addEventListener("click", closeSettings);
    settingsOverlay.addEventListener("click", closeSettings);

    $("#settingsForm").addEventListener("submit", async (e)=>{
      e.preventDefault();
      const first_name=$("#setName").value.trim(), last_name=$("#setSurname").value.trim();
      if(!first_name || !last_name){ showToast("Enter your name and surname."); return; }

      if(supabaseClient && currentUser?.id){
        const { error } = await supabaseClient.from("profiles").upsert({
          id: currentUser.id, first_name, last_name, email: currentUser.email || null
        });
        if(error){ console.error("[VK] settings save error:", error); showToast(`Couldn't save: ${error.message}`); return; }
      }

      currentUser.first_name = first_name;
      currentUser.last_name = last_name;
      setLoggedIn(currentUser);
      showToast("Settings saved.");
      closeSettings();
    });

    // Language picker
    const languageOverlay=$("#languageOverlay"), languageModal=$("#languageModal");
    function openLanguage(){
      $("#accountMenu").classList.remove("open");
      const selected=localStorage.getItem("vk-language") || "en";
      document.querySelectorAll(".language-option").forEach(btn=>btn.classList.toggle("active",btn.dataset.language===selected));
      languageOverlay.classList.add("show"); languageModal.classList.add("open");
    }
    function closeLanguage(){ languageOverlay.classList.remove("show"); languageModal.classList.remove("open"); }
    $("#openLanguageBtn").addEventListener("click", openLanguage);
    $("#languageClose").addEventListener("click", closeLanguage);
    languageOverlay.addEventListener("click", closeLanguage);
    document.querySelectorAll(".language-option").forEach(btn=>btn.addEventListener("click",()=>{
      localStorage.setItem("vk-language",btn.dataset.language);
      document.documentElement.lang=btn.dataset.language;
      document.querySelectorAll(".language-option").forEach(option=>option.classList.toggle("active",option===btn));
      showToast(`${btn.textContent} selected.`);
      closeLanguage();
    }));

    // A browser client cannot use the Supabase service-role key. The RPC below should
    // perform the secure server-side deletion, then this client clears its session.
    $("#deleteAccountBtn").addEventListener("click", async ()=>{
      if(!currentUser) return;
      if(!confirm("Delete your VK Nutrition account permanently?")) return;
      if(!supabaseClient){ showToast("Account service is unavailable right now."); return; }
      try {
        const { error } = await supabaseClient.rpc("delete_user_account");
        if(error){
          console.error("[VK] delete account error:", error);
          showToast("Account deletion is not configured on the server yet.");
          return;
        }
        await supabaseClient.auth.signOut();
        closeSettings();
        setLoggedOut();
        showToast("Your account has been deleted.");
      } catch(err){
        console.error("[VK] unexpected delete account error:", err);
        showToast("Could not delete your account. Please try again.");
      }
    });

    // Restore session on page load (in case Supabase already has one)
    (async ()=>{
      if(!supabaseClient) return;
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if(session?.user){
          setLoggedIn({ id: session.user.id, email: session.user.email, phone: session.user.phone });
        }
      } catch(err){ console.error("[VK] getSession error:", err); }
    })();

    // Mobile -> OTP generation helper, shared by sign in and sign up
    function wireOtp({mobileId, sendBtnId, otpFieldId, hintId}){
      const mobileInput=$(mobileId), sendBtn=$(sendBtnId), otpField=$(otpFieldId);
      mobileInput.addEventListener("input",()=>{ mobileInput.value=mobileInput.value.replace(/\D/g,"").slice(0,10); });
      sendBtn.addEventListener("click", async ()=>{
        console.log("[VK] Send OTP clicked for", sendBtnId);
        if(!requireSupabase()) return;

        const mobile=mobileInput.value.trim();
        if(mobile.length!==10){ showToast("Enter a valid 10-digit mobile number."); return; }

        const e164 = "+91"+mobile; // change country code if needed

        sendBtn.disabled=true; sendBtn.textContent="Sending...";

        try {
          const { error } = await supabaseClient.auth.signInWithOtp({ phone: e164 });

          if(error){
            console.error("[VK] signInWithOtp error:", error);
            showToast(`Failed to send OTP: ${error.message}`);
            sendBtn.disabled=false; sendBtn.textContent="Send OTP";
            return;
          }

          otpField.hidden=false;
          if(hintId) $(hintId).textContent=`sent to ${mobile.slice(0,2)}••••••${mobile.slice(-2)}`;
          showToast(`OTP sent to your mobile number ending in ${mobile.slice(-2)}.`);
          let secs=30; sendBtn.textContent=`Resend in ${secs}s`;
          const t=setInterval(()=>{ secs--; if(secs<=0){ clearInterval(t); sendBtn.disabled=false; sendBtn.textContent="Resend OTP"; } else { sendBtn.textContent=`Resend in ${secs}s`; } },1000);
        } catch (err) {
          console.error("[VK] Unexpected error sending OTP:", err);
          showToast("Something went wrong sending the OTP. See console for details.");
          sendBtn.disabled=false; sendBtn.textContent="Send OTP";
        }
      });
    }

    // Sign in — password path
    $("#signinPanel").addEventListener("submit",e=>{
      e.preventDefault();
      const id=$("#siLoginId").value.trim(), pw=$("#siPassword").value;
      if(!id || !pw){ showToast("Enter your login ID and password."); return; }
      setLoggedIn({ email: id });
      showToast(`Signed in as ${id}.`);
      closeAuth();
    });

    // Sign in — mobile OTP path
    wireOtp({mobileId:"#siMobile", sendBtnId:"#siSendOtp", otpFieldId:"#siOtpField", hintId:"#siOtpHint"});
    $("#siVerifyOtp").addEventListener("click", async ()=>{
      if(!requireSupabase()) return;
      const otp=$("#siOtp").value.trim(), mobile=$("#siMobile").value.trim();
      if(otp.length!==6){ showToast("Enter the 6-digit OTP sent to your mobile."); return; }

      const e164 = "+91"+mobile;

      try {
        const { data, error } = await supabaseClient.auth.verifyOtp({
          phone: e164,
          token: otp,
          type: "sms"
        });

        if(error){
          console.error("[VK] verifyOtp error:", error);
          showToast(`Verification failed: ${error.message}`);
          return;
        }

        setLoggedIn({ id: data.user.id, phone: data.user.phone });
        showToast(`Mobile ${mobile} verified — signed in successfully.`);
        closeAuth();
      } catch (err) {
        console.error("[VK] Unexpected error verifying OTP:", err);
        showToast("Something went wrong verifying the OTP. See console for details.");
      }
    });

    // Sign up — mobile OTP
    wireOtp({mobileId:"#suMobile", sendBtnId:"#suSendOtp", otpFieldId:"#suOtpField", hintId:"#suOtpHint"});
    $("#signupPanel").addEventListener("submit", async e=>{
      e.preventDefault();
      if(!requireSupabase()) return;

      const name=$("#suName").value.trim(), surname=$("#suSurname").value.trim(),
            email=$("#suEmail").value.trim(), pw=$("#suPassword").value,
            mobile=$("#suMobile").value.trim(), otp=$("#suOtp").value.trim();
      if(!name || !surname){ showToast("Enter your name and surname."); return; }
      if(!email){ showToast("Enter your email — this becomes your Customer ID."); return; }
      if(!pw || pw.length<6){ showToast("Create a password with at least 6 characters."); return; }
      if(mobile.length!==10){ showToast("Enter a valid 10-digit mobile number."); return; }
      if($("#suOtpField").hidden){ showToast("Send and enter the OTP sent to your mobile to verify it."); return; }
      if(otp.length!==6){ showToast("Enter the 6-digit OTP sent to your mobile."); return; }

      const e164 = "+91"+mobile;

      try {
        const { data, error } = await supabaseClient.auth.verifyOtp({
          phone: e164,
          token: otp,
          type: "sms"
        });

        if(error){
          console.error("[VK] verifyOtp (signup) error:", error);
          showToast(`Verification failed: ${error.message}`);
          return;
        }

        // Save extra profile info (requires a 'profiles' table in Supabase)
        const { error: profileError } = await supabaseClient.from("profiles").upsert({
          id: data.user.id,
          first_name: name,
          last_name: surname,
          email: email
        });
        if(profileError){
          console.error("[VK] profiles upsert error:", profileError);
        }

        setLoggedIn({ id: data.user.id, phone: data.user.phone, email, first_name: name, last_name: surname });
        showToast(`Welcome, ${name}! Your VK Nutrition account is ready.`);
        closeAuth();
      } catch (err) {
        console.error("[VK] Unexpected error during signup:", err);
        showToast("Something went wrong creating your account. See console for details.");
      }
    });
