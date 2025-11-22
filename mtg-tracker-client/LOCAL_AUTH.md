# Local Development with Authentication

When running the Next.js client locally (on `localhost:3000`), you need to provide a session cookie to authenticate with the backend services running at `https://mtg-tracker.local`.

## Setup

1. **Get your session cookie:**
   - Open your browser and go to `https://mtg-tracker.local`
   - Sign in to your account
   - Open browser DevTools (F12) → Application/Storage tab → Cookies
   - Find the `session` cookie for `mtg-tracker.local`
   - Copy the entire cookie value (it should start with `eyJ...`)

2. **Set the environment variable:**
   - Create or edit `.env.local` in this directory
   - Add the line:
     ```
     NEXT_PUBLIC_SESSION_COOKIE=<paste-your-cookie-value-here>
     ```
   - Example:
     ```
     NEXT_PUBLIC_SESSION_COOKIE=eyJqd3QiOiJleUpoYkdjaU9pSklVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcFpDSTZNU3dpWlcxaGFXd2lPaUpyYjJ4c2FXNWljbUZ1WkdWdVluVnlaMEJuYldGcGJDNWpiMjBpTENKcFlYUWlPakUzTmpNMk56YzJORFo5Lndib05pVHByZGFwak9WVWxCTjVyaHpIWVBTdTlYYUtRaHQ5cFVpNURINVkifQ==
     ```

3. **Start the dev server:**
   ```bash
   npm run dev
   ```

## How It Works

The `build-client.js` file checks for the `NEXT_PUBLIC_SESSION_COOKIE` environment variable when running in development mode and automatically includes it in the `Cookie` header for all API requests to `https://mtg-tracker.local`.

This allows you to:
- Run the client locally on `localhost:3000`
- Make authenticated requests to backend services at `mtg-tracker.local`
- Test features that require authentication without CORS issues

## Updating the Cookie

Session cookies expire after a certain time. If you start getting 401 Unauthorized errors:
1. Sign in again at `https://mtg-tracker.local`
2. Get the new session cookie value
3. Update `NEXT_PUBLIC_SESSION_COOKIE` in `.env.local`
4. Restart your dev server
