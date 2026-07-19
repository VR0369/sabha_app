# Deploying to Render (free)

This deploys the app as **two Render services** from one Blueprint
([`render.yaml`](render.yaml)):

- **sabha-attendance-api** — the FastAPI backend (free web service)
- **sabha-attendance-web** — the React/Vite frontend (free static site)

Your database stays on **MongoDB Atlas** (free M0) — nothing to move.

> ⏱️ ~10 minutes. You'll need a **GitHub** (or GitLab/Bitbucket) account and a free
> **Render** account (<https://render.com>).

---

## 0. Good to know first

- The free backend **sleeps after ~15 min of inactivity**; the next request wakes it
  in ~30–60s. That's fine for a weekly attendance tool. (Upgrade the backend to a
  paid instance later if you want it always warm.)
- **No secrets are committed.** `backend/.env` is git-ignored; every real value goes
  into Render's dashboard. The app reads plain environment variables directly, so no
  `.env` file is needed in the cloud.

## 1. Push the repo to GitHub

Render deploys from a git remote. Create an empty repo on github.com, then:

```bash
git remote add origin https://github.com/<you>/sabha_app.git
git add .
git commit -m "Prepare for deployment"
git push -u origin main
```

Double-check that `render.yaml` is in the repo **root** and that `backend/.env` was
**not** pushed (it's git-ignored — good, it holds your live credentials).

## 2. Prepare MongoDB Atlas

1. Atlas → **Network Access** → add **`0.0.0.0/0`** ("Allow access from anywhere").
   Render's free services use dynamic outbound IPs, so a fixed IP allowlist won't work.
2. Atlas → **Database Access** → confirm the DB username/password you'll use in the
   connection string.

## 3. Create the Blueprint on Render

1. <https://dashboard.render.com> → **New +** → **Blueprint**.
2. Connect GitHub and select the `sabha_app` repo.
3. Render reads `render.yaml` and shows both services → click **Apply**.
4. When prompted, fill in the values marked *(set in dashboard)*:
   - **MONGODB_URI** — your full Atlas string, e.g.
     `mongodb+srv://sevak_369:<password>@sabha.sidxfrt.mongodb.net/?retryWrites=true&w=majority`
   - **FIRST_ADMIN_PASSWORD** — the password for your first admin login
   - **GOOGLE_CLIENT_ID** / **VITE_GOOGLE_CLIENT_ID** — your OAuth Web-app Client
     ID (the **same** value in both). Skip these if you're not using Google
     Sign-In; the app falls back to email + password login.
   - Leave **CORS_ORIGINS** and **VITE_API_BASE** empty for now → filled in step 5.

The first build starts automatically.

## 4. Note the two URLs

Once both services finish deploying, copy their URLs from the dashboard:

- Backend → `https://sabha-attendance-api.onrender.com`
- Frontend → `https://sabha-attendance-web.onrender.com`

> If a name was already taken, Render appends random characters. **Use whatever the
> dashboard actually shows.**

## 5. Wire the two services together

This is the step people miss — do both halves.

**Backend** → the `sabha-attendance-api` service → **Environment** → add/set:

```
CORS_ORIGINS = https://sabha-attendance-web.onrender.com
```

(Use your real frontend URL. To keep local dev working too, comma-separate:
`https://sabha-attendance-web.onrender.com,http://localhost:5173`.) **Save** — the
backend redeploys.

**Frontend** → the `sabha-attendance-web` service → **Environment** → add/set:

```
VITE_API_BASE = https://sabha-attendance-api.onrender.com
```

(Use your real backend URL, **no** trailing `/api` — the app already adds it.) **Save**,
then **Manual Deploy → Deploy latest commit**. A static build must be **rebuilt** to
bake the new value into the JavaScript.

> **Using Google Sign-In?** In the [Google Cloud Console](https://console.cloud.google.com/)
> add your production frontend URL (e.g. `https://sabha-attendance-web.onrender.com`)
> to the OAuth client's **Authorized JavaScript origins**, then redeploy the frontend
> so `VITE_GOOGLE_CLIENT_ID` is baked in.

## 6. Log in

Open the **frontend** URL and sign in:

- **Email:** `admin@sabha.app` (your `FIRST_ADMIN_EMAIL`)
- **Password:** whatever you set for `FIRST_ADMIN_PASSWORD`

The admin account is created automatically on the backend's first successful startup
(only when the users collection is empty). From **Users**, you can then add more
admins or **coordinators**.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Page loads but every API call fails / CORS error in browser console | `VITE_API_BASE` (frontend) and/or `CORS_ORIGINS` (backend) are wrong. They must be the **exact** `https://…onrender.com` origins. Redeploy the frontend after changing `VITE_API_BASE`. |
| Backend log: `bad auth : Authentication failed` | Wrong `MONGODB_URI` user/password, or special characters not percent-encoded (`@` → `%40`). |
| Backend log: server selection / connection timeout to Atlas | Atlas **Network Access** isn't `0.0.0.0/0`. |
| 404 when refreshing a sub-page (e.g. `/dashboard`) | The SPA rewrite in `render.yaml` handles this — confirm the frontend redeployed after the last change. |
| Frontend build fails with `vite: not found` | Build command must be `npm ci --include=dev && npm run build` (Vite is a devDependency). |
| First request after a while is slow | Expected on the free tier (cold start). Upgrade the backend instance to remove it. |

## Notes

- **`JWT_SECRET`** is auto-generated by Render (`generateValue: true`) — you don't set
  it. Changing it later logs everyone out (all existing tokens become invalid).
- Changing **`FIRST_ADMIN_PASSWORD`** after the admin already exists has no effect (the
  bootstrap only runs once). To change the password later, update it directly in the
  database — ask and I'll provide a small script.
- **Custom domain:** each service → **Settings → Custom Domains**. If you add one,
  update `CORS_ORIGINS` (backend) and `VITE_API_BASE` (frontend) to match, and
  redeploy the frontend.
## Auto-deploy on every push

Both services set `autoDeploy: true` and `branch: main` in `render.yaml`, so **after
you connect the Blueprint once, every `git push` to `main` redeploys automatically** —
Render's GitHub App does this via webhooks, so you don't need GitHub Actions or any
extra CI. A push rebuilds the frontend too, so `VITE_API_BASE` is re-baked from the
current value each time.

- **Verify it's on:** each service → **Settings → Build & Deploy** → *Auto-Deploy* = `Yes`,
  tracking branch `main`.
- **Deploy only when tests pass:** change `autoDeploy: true` to
  `autoDeployTrigger: checksPass` (requires status checks on the repo).
- **Note:** changing an env var *in the dashboard* (e.g. `VITE_API_BASE`) does **not**
  trigger an auto-deploy — only a git push (or a manual deploy) does. So after editing a
  frontend env var, click **Manual Deploy → Deploy latest commit** once.
- **Pause temporarily:** set `autoDeploy: false`, or use **Settings → Suspend** on the service.
