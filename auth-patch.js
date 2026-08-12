/* VK Nutrition authentication: secure Supabase Auth session and registration flow. */
(() => {
  const sb = window.vkSupabase;
  if (!sb) return;

  const get = selector => document.querySelector(selector);
  const toast = message => {
    const element = get("#toast");
    element.textContent = message;
    element.classList.add("show");
    setTimeout(() => element.classList.remove("show"), 3000);
  };
  const closeAuth = () => {
    get("#authOverlay").classList.remove("show");
    get("#authModal").classList.remove("open");
  };
  const mobileToE164 = value => `+91${value.replace(/\D/g, "").slice(-10)}`;

  async function showAccount(user) {
    if (!user) {
      window.setLoggedOut?.();
      return;
    }
    const { data } = await sb.from("profiles")
      .select("first_name,last_name,email,mobile")
      .eq("id", user.id)
      .maybeSingle();
    window.setLoggedIn?.({
      id: user.id,
      email: user.email || data?.email || "",
      phone: data?.mobile || user.phone || "",
      first_name: data?.first_name || user.user_metadata?.first_name || "",
      last_name: data?.last_name || user.user_metadata?.last_name || ""
    });
  }

  // Keep the UI synchronized with Supabase's persisted and auto-refreshed session.
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.setLoggedOut?.();
    } else if (session?.user) {
      setTimeout(() => showAccount(session.user), 0);
    }
  });
  sb.auth.getSession().then(({ data }) => showAccount(data.session?.user || null));

  // Replace older demo listeners so authentication always goes through Supabase Auth.
  const signInForm = get("#signinPanel");
  const signUpForm = get("#signupPanel");
  const freshSignIn = signInForm.cloneNode(true);
  const freshSignUp = signUpForm.cloneNode(true);
  signInForm.replaceWith(freshSignIn);
  signUpForm.replaceWith(freshSignUp);

  freshSignIn.addEventListener("submit", async event => {
    event.preventDefault();
    const email = get("#siLoginId").value.trim().toLowerCase();
    const password = get("#siPassword").value;
    if (!email || !password) return toast("Enter your email and password.");

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return toast("Incorrect email or password.");
    await showAccount(data.user);
    closeAuth();
    toast("Signed in successfully.");
  });

  freshSignUp.addEventListener("submit", async event => {
    event.preventDefault();
    const firstName = get("#suName").value.trim();
    const lastName = get("#suSurname").value.trim();
    const email = get("#suEmail").value.trim().toLowerCase();
    const password = get("#suPassword").value;
    const mobile = get("#suMobile").value.replace(/\D/g, "");
    if (!firstName || !lastName) return toast("Enter your name and surname.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Enter a valid email address.");
    if (password.length < 8) return toast("Use a password with at least 8 characters.");
    if (mobile.length !== 10) return toast("Enter a valid 10-digit mobile number.");

    const { data: available, error: availabilityError } = await sb.rpc("vk_registration_available", {
      registration_email: email,
      registration_mobile: mobileToE164(mobile)
    });
    if (availabilityError) {
      console.error("[VK] registration validation error", availabilityError);
      return toast("Account validation is unavailable. Please try again shortly.");
    }
    if (!available) return toast("An account already exists with this email or mobile number. Please sign in.");

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, mobile: mobileToE164(mobile) } }
    });
    if (error) {
      console.error("[VK] sign-up error", error);
      return toast(/duplicate|exists|registered/i.test(error.message)
        ? "An account already exists with this email or mobile number. Please sign in."
        : error.message);
    }
    if (data.session) {
      await showAccount(data.user);
      closeAuth();
      toast(`Welcome, ${firstName}! Your account is ready.`);
    } else {
      toast("Account created. Confirm your verification email, then sign in.");
      get('[data-tab="signin"]').click();
    }
  });
})();
