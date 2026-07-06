import { onRequest } from "../functions/api/[[path]]";

export interface Env {
  DATA_KV?: any;
  GEMINI_API_KEY?: string;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // If it's an API route, handle it using the existing serverless handler
    if (url.pathname.startsWith("/api/")) {
      const context = {
        request,
        env,
        params: {},
        next: async () => new Response("Not Found", { status: 404 }),
      };
      return onRequest(context);
    }

    // Otherwise, let Cloudflare serve static assets from the dist folder
    try {
      return await env.ASSETS.fetch(request);
    } catch (err: any) {
      return new Response("Not Found", { status: 404 });
    }
  }
};
