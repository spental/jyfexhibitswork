# FieldDesk: Phone app installation and QR sharing

## Upload to GitHub Pages
1. Keep your existing `config.js` with your Supabase Project URL and **public publishable/anon key** (never a service_role key). The bundled config.js has placeholders by design; if your existing config.js is working, keep it.
2. Upload the new `index.html`, `manifest.webmanifest`, `sw.js`, and `icons/` folder. You can keep your existing `app.js`, `styles.css`, and `supabase-setup.sql` if unchanged.
3. Verify your GitHub Pages HTTPS URL opens normally. Ensure `manifest.webmanifest` and `icons/icon-192.png` load under the same Pages path.
4. Test in a private/incognito tab and on a second phone to ensure the Supabase configuration works for others.

## Install on phone
**Android (Chrome):** Open the FieldDesk URL. Open Chrome menu (three dots); tap **Install app** or **Add to Home screen**. Confirm.
**iPhone (Safari):** Open the FieldDesk URL. Tap Share, then **Add to Home Screen**, and confirm **Add**. On recent iOS, an 'Open as Web App' option may appear; turn it on.

This is a Progressive Web App (PWA), not an App Store submission. It opens with its own icon. It requires internet access to sign in and update work orders.

## Share by QR code
In Google Chrome, open your deployed FieldDesk URL and choose **Share > Create QR code** (menu wording varies). Download or print the QR code. Alternatively, make a QR code with any reputable QR generator using the *public GitHub Pages URL*, not the Supabase project URL.

Visitors scan the QR with the phone camera, open the site in Chrome/Safari, then install using the above steps. Scanning the QR itself opens the site; on iPhone it does not silently install an app.

## Security
Keep Supabase RLS policies enabled. Only put the public publishable/anon key in config.js. Never publish the secret/service_role key.
