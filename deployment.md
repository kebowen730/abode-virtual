# Deployment Guide — Tic-Tac-Toe on Render

## Prerequisites

- A GitHub account
- A [Render](https://render.com) account (free, no credit card required)

---

## Step 1: Initialize Git repo (Claude can do this)

```bash
git init
git add package.json server.js game.js public/
git commit -m "Initial tic-tac-toe app"
```

## Step 2: Create a GitHub repo (YOU)

1. Go to https://github.com/new
2. Create a new repo (e.g. `tic-tac-toe`) — public or private, either works
3. Do NOT initialize with README/gitignore (we already have files)
4. Copy the remote URL

## Step 3: Push to GitHub (Claude can do this once you provide the remote URL)

```bash
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

## Step 4: Deploy on Render (YOU)

1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub account if not already connected
4. Select your `tic-tac-toe` repo
5. Configure:
   - **Name:** tic-tac-toe (or whatever you like)
   - **Region:** closest to you
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
6. Click **Deploy Web Service**
7. Wait ~1-2 minutes for the build to finish

Render will give you a URL like `https://tic-tac-toe-xxxx.onrender.com`.

## Step 5: Test it

Open that URL in two browser tabs (or two different devices) and play a game.

> **Note:** Free Render instances spin down after 15 minutes of inactivity. The first request after sleeping takes ~30-60 seconds to wake up. This is normal for the free tier.

---

## Summary

| Step | Who |
|---|---|
| 1. Init git repo | Claude |
| 2. Create GitHub repo | **You** |
| 3. Push to GitHub | Claude (needs your remote URL) |
| 4. Deploy on Render | **You** (web UI, ~2 min) |
| 5. Test | **You** |
