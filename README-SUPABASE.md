# VK Nutrition Supabase setup

This folder is the fixed version of the VK Nutrition storefront. The Supabase URL and browser-safe publishable key are already configured in `script.js`.

## One-time Supabase setup

1. Open the project SQL Editor: https://supabase.com/dashboard/project/owpgbkrnimhwvgqntggq/sql/new
2. Open `supabase/schema.sql`, paste the complete file into the SQL Editor, and click **Run**.
3. In Supabase, open **Authentication -> Providers** and enable **Email**.
4. If email confirmation is enabled, configure the project Site URL and redirect URL to the URL where this storefront will be hosted. Users must confirm their email before password sign-in.
5. Phone OTP is optional. To use the mobile OTP path, enable **Phone** and configure an SMS provider in Supabase Authentication.

The SQL creates the `profiles` table, unique email/phone checks, row-level security policies, a profile trigger for new Auth users, and the secure account-deletion RPC used by the app.

## Run the storefront

Serve the folder over HTTP or HTTPS; do not open `index.html` directly with `file://`.

For a local test, from this folder run:

```powershell
py -m http.server 4174
```

Then open http://127.0.0.1:4174/.

## Auth behavior fixed

- Sign up creates a real Supabase email/password user and stores the profile metadata.
- Duplicate email and mobile numbers are checked before signup.
- Sign in uses Supabase `signInWithPassword` instead of a local hard-coded password.
- Sessions persist across refreshes and the profile is reloaded from `profiles`.
- The mobile profile button opens the profile settings after login.

Never put a Supabase `service_role` key in browser code. Only the publishable/anon key belongs in `script.js`.
