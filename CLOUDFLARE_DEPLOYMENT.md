# 🚀 Deploying KMC Diesel Ledger to Cloudflare

This repository is pre-configured for a **one-click, zero-cost, fully-serverless deployment** on Cloudflare Pages using Cloudflare Pages Functions.

---

## ✨ Features of the Cloudflare Architecture

1. **Static Frontend (Cloudflare Pages)**: The React 19 app build output (`dist/`) is served from Cloudflare's ultra-fast global edge network with nearly 0ms latency.
2. **Serverless APIs (Pages Functions)**: All Express APIs have been translated into a native Pages Function (`functions/api/[[path]].ts`). It runs on Cloudflare Workers with fast startup times (<10ms).
3. **Persistent Serverless Database (Cloudflare KV)**: Replaces local file-system writes with **Cloudflare KV Storage** to persist project sites, deliveries, and refueling logs permanently across sessions.
4. **Edge AI Reconciliation**: Interacts directly with Google's Gemini models using optimized lightweight edge-fetch protocols.

---

## 🛠️ Step-by-Step Deployment Guide

### Option 1: Automatic Deployment with GitHub (Recommended)

1. **Commit and Push**:
   Push your entire code base (including the newly added `/functions` and `wrangler.toml` files) to your GitHub repository.

2. **Connect Cloudflare Pages**:
   - Log into the [Cloudflare Dashboard](https://dash.cloudflare.com/).
   - Navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
   - Select your repository and click **Begin setup**.

3. **Configure Build Settings**:
   - **Framework Preset**: None (or Vite)
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
   - **Root Directory**: `/` (Leave as default)

4. **Add Environment Variables**:
   Under the **Environment Variables (advanced)** dropdown in the setup screen, add the following key:
   * **`GEMINI_API_KEY`**: Paste your Google Gemini API Key.

5. **Deploy**:
   Click **Save and Deploy**. Cloudflare will build and host your frontend immediately!

---

### 🗄️ Step 2: Creating and Binding the KV Storage (Required for persistent data)

Since serverless instances do not have a writable local filesystem, you need to bind a Cloudflare KV namespace to hold the site's data records:

1. In the Cloudflare Dashboard, go to **Workers & Pages** > **KV**.
2. Click **Create Namespace**. Name it `KMC_DATA_STORE`.
3. Go back to your Pages Project in the dashboard, select **Settings** > **Functions** (or **Bindings**).
4. Scroll down to **KV Namespace Bindings** and click **Add Binding**.
5. Set:
   * **Variable Name**: `DATA_KV` (This **must** match exactly)
   * **KV Namespace**: Select `KMC_DATA_STORE` from the dropdown list.
6. Click **Save**.
7. *Note: If you are using environments, make sure to add this binding under both "Production" and "Preview" environments.*
8. **Redeploy**: Go to the **Deployments** tab and click **Retry deployment** (or trigger a new git commit) to apply the KV binding.

---

### Option 2: Deploying via Wrangler CLI (Terminal)

If you prefer deploying directly from your command line:

1. Install Wrangler globally (or run using npx):
   ```bash
   npm install -g wrangler
   ```

2. Authenticate Wrangler with your Cloudflare account:
   ```bash
   npx wrangler login
   ```

3. Create your production KV Namespace:
   ```bash
   npx wrangler kv namespace create DATA_KV
   ```
   *Copy the generated namespace ID (e.g. `e0e7bc28c...`) and paste it into your `wrangler.toml` file under the `id` field.*

4. Build your React app:
   ```bash
   npm run build
   ```

5. Deploy the compiled files and serverless functions directly to Cloudflare:
   ```bash
   npx wrangler pages deploy dist --project-name=kmc-ledger-app
   ```

6. Add your Gemini API secret:
   ```bash
   npx wrangler pages secret put GEMINI_API_KEY
   ```

---

## 💻 Local Sandbox Development & Mock KV Testing

To test the serverless environment locally before publishing:

```bash
# Run local Pages development with an emulator-backed KV Namespace
npx wrangler pages dev dist --binding DATA_KV=local_kv --port 3000
```

This will run your entire application locally on `http://localhost:3000` with the serverless backend functions fully working!
