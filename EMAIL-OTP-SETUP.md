# Make Supabase send a VK Nutrition email OTP (not a link)

The website already requests an email OTP. The email content is controlled by Supabase, so this must be changed in the Supabase dashboard.

1. Open **Supabase Dashboard → Authentication → Email Templates**.
2. Open **Confirm signup**. Set the subject to `VK Nutrition — Your verification code`.
3. Replace the template body with the contents of `supabase-email-otp-template.html`, then save.
4. Open **Magic Link**. Use the same subject and the same template body, then save.
5. Make sure the body contains `{{ .Token }}` and does **not** contain `{{ .ConfirmationURL }}`. The token produces an OTP code; the confirmation URL produces a link.

## Change “Supabase Auth” to “VK Nutrition”

The default Supabase email sender cannot be renamed from website code. In **Authentication → SMTP Settings**, configure a custom SMTP provider such as Resend, Brevo, or SendGrid:

- Sender name: `VK Nutrition`
- Sender email: an address on your verified domain, for example `support@yourdomain.com`

After custom SMTP is enabled, emails will show **VK Nutrition** as the sender. The email delivery provider controls delivery time and rate limits; the website itself adds no waiting delay.
