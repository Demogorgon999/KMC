# 🚀 Deploying KMC Diesel Ledger to Cloudflare

This repository is pre-configured for a **one-click, zero-cost, fully-serverless deployment** on Cloudflare using **Cloudflare Workers with Static Assets** (or Cloudflare Pages).

---

## 💡 Why the Build Failed previously and how we fixed it

Cloudflare has two options when connecting to Git: **Cloudflare Pages** and **Cloudflare Workers**. 
* Because you selected **Create a Worker**, Cloudflare expected a `main` script entry point and an explicit `[assets]` block inside `wrangler.toml` instead of Pages Functions.
* **We have fully updated your workspace to support Workers with Assets!** We created a unified Worker entry point (`src/worker.ts`) and configured `wrangler.toml` perfectly.
* Now, Cloudflare's `npx wrangler deploy` command will run successfully on your repository!

---

## 🛠️ Step-by-Step Deployment Guide

### Step 1: Push to GitHub & Deploy

1. **Commit and Push**:
   Commit and push all files to your GitHub repository (`Demogorgon999/KMC`).

2. **Trigger Deployment**:
   Go back to the Cloudflare build screen you showed in your screenshot, and click **Deploy** (or **Retry build**). 
   - Since we added `main = "src/worker.ts"` and `[assets] directory = "./dist"` to `wrangler.toml`, **the build will succeed perfectly now!**

3. **Add Environment Variables**:
   Under the **Settings** > **Variables** of your Worker in the Cloudflare dashboard, add:
   * **`GEMINI_API_KEY`**: Your Google Gemini API Key (required for AI shift balancing).

---

## 🗄️ Step 2: Creating and Binding the KV Storage (Required for persistent data)

Since serverless instances do not have a writable local filesystem, you need to bind a Cloudflare KV namespace to hold the site's data records:

1. In the Cloudflare Dashboard, go to **Workers & Pages** > **KV** (under the left menu).
2. Click **Create Namespace**. Name it `KMC_DATA_STORE`.
3. Go back to your Worker project in the dashboard (`kmc`).
4. Navigate to **Settings** > **Bindings** (or **Variables & Bindings**).
5. Click **Add** under **KV namespace bindings**.
6. Set:
   * **Variable Name**: `DATA_KV` (This **must** match exactly)
   * **KV Namespace**: Select `KMC_DATA_STORE` from the dropdown list.
7. Click **Save**.
8. **Redeploy**: Trigger a deployment from the **Deployments** tab so the Worker binds to the KV store.

---

## 💻 Local Sandbox Development & Mock KV Testing

To test the serverless environment locally:

```bash
# Run local Pages / Workers development with an emulator-backed KV Namespace
npx wrangler dev --port 3000
```
