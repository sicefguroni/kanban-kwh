# ngrok Share Guide (Another Laptop)

Use this quick guide only for sharing your running app to another laptop.

## Required first

1. Start backend:

```powershell
cd backend
npm run dev
```

2. Start backend tunnel:

```powershell
ngrok http 3002
```

3. Run frontend with Live Server on port 5500.

4. Start frontend tunnel:

```powershell
ngrok http 5500
```

## Step 7 (what to share)

Share this full URL format to the other laptop:

```text
https://<frontend-ngrok-url>/login.html?apiBaseUrl=https://<backend-ngrok-url>
```

Example:

```text
https://wxyz-7890.ngrok-free.app/login.html?apiBaseUrl=https://abcd-1234.ngrok-free.app
```

Rules:

- Replace placeholders with real URLs.
- Do not include `<` or `>`.
- Open this full URL at least once so API base is saved in localStorage.

## If login still calls localhost:3002

Run in browser console:

```javascript
localStorage.setItem('kanban_api_base_url', 'https://<backend-ngrok-url>/api');
location.reload();
```

Then reopen the Step 7 URL.

## If placeholder URL was saved by mistake

```javascript
localStorage.removeItem('kanban_api_base_url');
location.reload();
```
