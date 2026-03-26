# ngrok Share Guide (Another Laptop)

Use this when you want another device to hit your **local** backend + static frontend over the internet.

## Required first

1. **Start the backend** (use the same `PORT` as in `backend/.env`, often `3001`):

**Linux / macOS / Windows:**
```bash
cd backend
npm run dev
```

2. **Start the frontend** (from repo root, `npm run dev` runs both; or only frontend):

```bash
# From project root — serves on port 5173
npm run dev:frontend
```

3. **Two ngrok tunnels** — one for the API, one for the static site (ngrok free tier allows one tunnel per process; run two terminals or use a paid plan / config with multiple agents).

**Linux / macOS / Windows:**
```bash
# Terminal A — backend (replace 3001 if your .env uses another PORT)
ngrok http 3001

# Terminal B — frontend
ngrok http 5173
```

## What to share

Share a single URL that sets the API base for the SPA (query param your app supports):

```text
https://<frontend-ngrok-url>/login.html?apiBaseUrl=https://<backend-ngrok-url>
```

**Important:** Use the **https** URLs ngrok prints (not `http://127.0.0.1`).

Example:

```text
https://wxyz-7890.ngrok-free.app/login.html?apiBaseUrl=https://abcd-1234.ngrok-free.app
```

Rules:

- Replace placeholders with real URLs from the ngrok dashboard / terminal output.
- Do not include `<` or `>`.
- Open this full URL at least once so the API base is applied (or saved in `localStorage` per your app).

## If login still calls localhost:3001

Run in the **browser console** on the frontend ngrok origin (replace with your backend ngrok host):

```javascript
localStorage.setItem('kanban_api_base_url', 'https://abcd-1234.ngrok-free.app/api');
location.reload();
```

Then reload the login page.

## If a wrong URL was saved

```javascript
localStorage.removeItem('kanban_api_base_url');
location.reload();
```

## CORS / ngrok browser warning

- Add your ngrok frontend origin to `CORS_ALLOWED_ORIGINS` (and/or `FRONTEND_URL`) in `backend/.env`, comma-separated, then restart the backend.
- ngrok’s free interstitial page can block API calls from some setups; open the ngrok URL in the browser once to continue.

## Permission denied on `http-server` (exit 126)

If `npm run dev:frontend` fails with **Permission denied** on `node_modules/.bin/http-server`, the scripts now use **`npx http-server`**, which avoids a missing execute bit on that shim. Run `npm run dev` again.

If problems persist, reinstall deps as your normal user (not root):

```bash
rm -rf node_modules && npm install
```

Optionally fix execute bits: `chmod +x node_modules/.bin/*`
