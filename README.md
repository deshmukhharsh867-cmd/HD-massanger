# 💬 HD Messenger — Real-Time Chat Website

A full-page dark-themed messenger web app. Built with **Node.js + Express + Socket.io** (backend) and **React + Vite** (frontend). Everything is served from a single server.

---

## ✅ Requirements

- **Node.js 18+** → https://nodejs.org (download LTS)

---

## 🚀 Running Locally

Open a terminal in this folder and run:

```bash
# 1. Install all dependencies + build the frontend
npm run setup

# 2. Start the server
npm start
```

Then open **http://localhost:3001** in your browser.

That's it — the server serves the entire website.

---

## 🌐 Deploy to the Web (Free)

### Option A — Railway (recommended, free tier)
1. Push this folder to a GitHub repo
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select your repo — Railway auto-detects Node.js
4. Set these environment variables in Railway dashboard:
   - `JWT_SECRET` = any long random string
   - `PORT` = `3001` (or leave blank, Railway sets it)
5. Set **Start Command**: `npm run setup && npm start`
6. Your app is live at `https://yourapp.railway.app`

### Option B — Render (free tier)
1. Push to GitHub
2. Go to https://render.com → New Web Service → connect repo
3. Build Command: `npm run setup`
4. Start Command: `npm start`
5. Add environment variable: `JWT_SECRET` = random string

### Option C — Local network (share with friends on same Wi-Fi)
```bash
npm run setup
node server/server.js
# Find your local IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
# Share: http://YOUR_LOCAL_IP:3001
```

---

## 📁 Structure

```
hd-messenger/
├── server/
│   ├── server.js       ← Express + Socket.io (main entry)
│   ├── db.js           ← SQLite database
│   ├── .env            ← Config (PORT, JWT_SECRET)
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.jsx            ← Root component
│   │   ├── components/        ← Login, Signup, ChatList, ChatView, Settings
│   │   ├── utils/             ← API, socket, helpers
│   │   └── styles/main.css    ← All styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── package.json  ← Root scripts (setup, build, start)
```

---

## ⚙️ Config (`server/.env`)

| Variable     | Default               | Description                    |
|--------------|-----------------------|--------------------------------|
| `PORT`       | `3001`                | Server port                    |
| `JWT_SECRET` | (change this!)        | Secret for JWT token signing   |
| `DB_PATH`    | `./hd-messenger.db`    | Path to SQLite database file   |

---

## 🔐 Features

- Register & login with email + password (bcrypt hashed, JWT sessions)
- Real-time messaging via Socket.io WebSockets
- Typing indicators & online/offline presence
- Profile name & status editing
- SQLite database — no external DB needed
- Responsive — works on mobile and desktop

