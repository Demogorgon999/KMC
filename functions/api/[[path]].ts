// Cloudflare KV Namespace interface for TypeScript compilation
interface KVNamespace {
  get(key: string, options?: any): Promise<string | null>;
  put(key: string, value: string, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  DATA_KV?: KVNamespace;
  GEMINI_API_KEY?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
}

// In-memory fallback for local development or sandbox without KV bound
const localMemoryStore: Record<string, string> = {};

async function getData(env: Env, key: string): Promise<string | null> {
  if (env.DATA_KV) {
    return await env.DATA_KV.get(key);
  }
  return localMemoryStore[key] || null;
}

async function putData(env: Env, key: string, value: string): Promise<void> {
  if (env.DATA_KV) {
    await env.DATA_KV.put(key, value);
  } else {
    localMemoryStore[key] = value;
  }
}

// Response helper
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequest(context: RequestContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle OPTIONS preflight requests for CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    // 1. Health Check
    if (path === "/api/health") {
      return jsonResponse({ status: "ok", environment: env.DATA_KV ? "production-kv" : "sandbox-memory" });
    }

    // 2. Event Stream (SSE) fallback for Serverless
    if (path === "/api/events") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Send initial active users and console events message to establish the tunnel
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "initial_active_users", data: { users: [] } })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "initial_console_events", data: { events: [] } })}\n\n`));
          // Close immediately as long-running push connections require durable background instances
          controller.close();
        }
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    // 3. Heartbeat & Logout
    if (path === "/api/active-users/heartbeat") {
      const body = await request.json().catch(() => ({})) as any;
      const { name, role } = body || {};
      return jsonResponse({
        success: true,
        users: name ? [{ id: "cf-user", email: body.email || "cf@kmc.co.za", name, role: role || "agent", lastSeen: Date.now() }] : []
      });
    }

    if (path === "/api/active-users/logout") {
      return jsonResponse({ success: true });
    }

    // 4. Fetch complete database history
    if (path === "/api/sync/data" && request.method === "GET") {
      const companyId = url.searchParams.get("companyId") || "company-kmc";
      const dataStr = await getData(env, `company_${companyId}`);
      const data = dataStr ? JSON.parse(dataStr) : { sites: [], logs: [], deliveries: [] };
      return jsonResponse(data);
    }

    // 5. Sync/Merge data
    if (path === "/api/sync/data" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { companyId = "company-kmc", sites = [], logs = [], deliveries = [] } = body || {};
      
      const serverDataStr = await getData(env, `company_${companyId}`);
      const serverData = serverDataStr ? JSON.parse(serverDataStr) : { sites: [], logs: [], deliveries: [] };

      // Merge utilities
      const mergeById = (serverList: any[], clientList: any[]) => {
        const map = new Map<string, any>();
        if (Array.isArray(clientList)) {
          clientList.forEach(item => { if (item && item.id) map.set(item.id, item); });
        }
        if (Array.isArray(serverList)) {
          serverList.forEach(item => { if (item && item.id) map.set(item.id, item); });
        }
        return Array.from(map.values());
      };

      const mergedSites = mergeById(serverData.sites, sites);
      const mergedLogs = mergeById(serverData.logs, logs);
      const mergedDeliveries = mergeById(serverData.deliveries, deliveries);

      const sortedLogs = mergedLogs.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      const sortedDeliveries = mergedDeliveries.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

      const updatedData = {
        sites: mergedSites,
        logs: sortedLogs,
        deliveries: sortedDeliveries
      };

      await putData(env, `company_${companyId}`, JSON.stringify(updatedData));
      return jsonResponse(updatedData);
    }

    // 6. Sync Log (single)
    if (path === "/api/sync/log" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { log, companyId = "company-kmc" } = body || {};
      if (!log) return jsonResponse({ error: "Log payload missing" }, 400);

      const dataStr = await getData(env, `company_${companyId}`);
      const data = dataStr ? JSON.parse(dataStr) : { sites: [], logs: [], deliveries: [] };

      if (log.id && log.id.startsWith("log-")) {
        if (!data.logs.some((l: any) => l.id === log.id)) {
          data.logs.unshift(log);
          await putData(env, `company_${companyId}`, JSON.stringify(data));
        }
      }
      return jsonResponse({ success: true });
    }

    // 7. Sync Logs Batch
    if (path === "/api/sync/logs-batch" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { logs, companyId = "company-kmc" } = body || {};
      if (!logs || !Array.isArray(logs)) return jsonResponse({ error: "Logs array payload missing" }, 400);

      const dataStr = await getData(env, `company_${companyId}`);
      const data = dataStr ? JSON.parse(dataStr) : { sites: [], logs: [], deliveries: [] };
      let added = 0;

      logs.forEach((log: any) => {
        if (log && log.id && log.id.startsWith("log-")) {
          if (!data.logs.some((l: any) => l.id === log.id)) {
            data.logs.unshift(log);
            added++;
          }
        }
      });

      if (added > 0) {
        await putData(env, `company_${companyId}`, JSON.stringify(data));
      }
      return jsonResponse({ success: true, count: added });
    }

    // 8. Delete Log
    if (path === "/api/sync/delete-log" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { logId, companyId = "company-kmc" } = body || {};
      
      const dataStr = await getData(env, `company_${companyId}`);
      const data = dataStr ? JSON.parse(dataStr) : { sites: [], logs: [], deliveries: [] };
      data.logs = data.logs.filter((l: any) => l.id !== logId);
      
      await putData(env, `company_${companyId}`, JSON.stringify(data));
      return jsonResponse({ success: true });
    }

    // 9. Sync Delivery
    if (path === "/api/sync/delivery" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { delivery, companyId = "company-kmc" } = body || {};
      if (!delivery) return jsonResponse({ error: "Delivery payload missing" }, 400);

      const dataStr = await getData(env, `company_${companyId}`);
      const data = dataStr ? JSON.parse(dataStr) : { sites: [], logs: [], deliveries: [] };

      if (!data.deliveries.some((d: any) => d.id === delivery.id)) {
        data.deliveries.unshift(delivery);
        await putData(env, `company_${companyId}`, JSON.stringify(data));
      }
      return jsonResponse({ success: true });
    }

    // 10. Delete Delivery
    if (path === "/api/sync/delete-delivery" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { deliveryId, companyId = "company-kmc" } = body || {};

      const dataStr = await getData(env, `company_${companyId}`);
      const data = dataStr ? JSON.parse(dataStr) : { sites: [], logs: [], deliveries: [] };
      data.deliveries = data.deliveries.filter((d: any) => d.id !== deliveryId);

      await putData(env, `company_${companyId}`, JSON.stringify(data));
      return jsonResponse({ success: true });
    }

    // 11. Override Delivery
    if (path === "/api/sync/override-delivery" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { deliveryId, userName, reason, companyId = "company-kmc" } = body || {};

      const dataStr = await getData(env, `company_${companyId}`);
      const data = dataStr ? JSON.parse(dataStr) : { sites: [], logs: [], deliveries: [] };
      data.deliveries = data.deliveries.map((d: any) => {
        if (d.id === deliveryId) {
          return {
            ...d,
            isOverridden: true,
            overrideReason: reason,
            overriddenBy: userName || "Management"
          };
        }
        return d;
      });

      await putData(env, `company_${companyId}`, JSON.stringify(data));
      return jsonResponse({ success: true });
    }

    // 12. Add Site
    if (path === "/api/sync/site" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { site, companyId = "company-kmc" } = body || {};
      if (!site) return jsonResponse({ error: "Site payload missing" }, 400);

      const dataStr = await getData(env, `company_${companyId}`);
      const data = dataStr ? JSON.parse(dataStr) : { sites: [], logs: [], deliveries: [] };

      if (!data.sites.some((s: any) => s.id === site.id)) {
        data.sites.push(site);
        await putData(env, `company_${companyId}`, JSON.stringify(data));
      }
      return jsonResponse({ success: true });
    }

    // 13. Toggle Site
    if (path === "/api/sync/toggle-site" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { siteId, status, companyId = "company-kmc" } = body || {};

      const dataStr = await getData(env, `company_${companyId}`);
      const data = dataStr ? JSON.parse(dataStr) : { sites: [], logs: [], deliveries: [] };
      data.sites = data.sites.map((s: any) => {
        if (s.id === siteId) {
          return {
            ...s,
            status,
            closedAt: status === "closed" ? new Date().toISOString() : null,
          };
        }
        return s;
      });

      await putData(env, `company_${companyId}`, JSON.stringify(data));
      return jsonResponse({ success: true });
    }

    // 14. Reset Data
    if (path === "/api/sync/reset-data" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { companyId = "company-kmc" } = body || {};
      const data = { sites: [], logs: [], deliveries: [] };
      await putData(env, `company_${companyId}`, JSON.stringify(data));
      return jsonResponse({ success: true });
    }

    // 15. Load Test Data
    if (path === "/api/sync/load-test-data" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { sites = [], logs = [], deliveries = [], companyId = "company-kmc" } = body || {};
      const data = { sites, logs, deliveries };
      await putData(env, `company_${companyId}`, JSON.stringify(data));
      return jsonResponse({ success: true });
    }

    // 16. AI Balance Shifts
    if (path === "/api/ai/balance-shifts" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { logs } = body || {};
      if (!logs || !Array.isArray(logs)) {
        return jsonResponse({ error: "Missing required logs array" }, 400);
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return jsonResponse({
          error: "Gemini API key is not configured in Cloudflare. Please set GEMINI_API_KEY environment variable in your Pages Dashboard."
        }, 400);
      }

      const prompt = `
You are an expert diesel auditor for construction site fuel tanks and fleet management at KMC Construction.
Your task is to balance and reconcile the refueling logs (or meter readings/litres) for a site's shift logs (Day shift and Night shift).

We have received a set of refueling logs for a specific site, but they have errors, inconsistencies, or typing mistakes.
The site operates two shifts per day:
- Day Shift (approximately 06:00 to 18:00)
- Night Shift (approximately 18:00 to 06:00 the next morning)

Your balancing logic must follow these strict rules:
1. Chronological order is key. Sort the logs by date and time (ascending).
2. The last log's reading (the final chronological reading of the site) is the actual ground truth and represents the highest final reading/odometer/litres.
3. "Do not take the first entry as direct": do not assume the initial starting entry's value is completely correct if it leads to mathematically impossible drops or jumps. The whole sequence of cumulative meter readings (or vehicle odometer values) must be balanced backwards from the final highest reading so that every sequential reading is non-decreasing (or increasing logically) and fits the quantities consumed.
4. Calculate balanced/corrected quantities or meter readings so they form a smooth, consistent, mathematically logical trend. If there's a typo (e.g., 12050 instead of 120500, or a missing digit, or inverted digits), correct it.
5. All vehicle meter readings (odometer or hours) should be strictly non-decreasing over time for a given vehicle. If the meter readings of a vehicle across multiple logs are out of sequence or have typos, correct them so they are logically consistent and non-decreasing, ending with the highest final.

Logs to balance:
${JSON.stringify(logs)}

Analyze each log, categorize it into Day Shift (06:00-18:00) or Night Shift (18:00-06:00), and balance them according to the rules above.
Provide corrected vehicleMeterReading and quantityLitres where necessary. Mark if adjusted (isBalanced: true) and explain why in explanation.
`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "aistudio-build",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                balancedLogs: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      quantityLitres: { type: "NUMBER" },
                      vehicleNumber: { type: "STRING" },
                      vehicleMeterReading: { type: "STRING" },
                      dateTime: { type: "STRING" },
                      agentName: { type: "STRING" },
                      notes: { type: "STRING" },
                      isBalanced: { type: "BOOLEAN", description: "True if adjusted" },
                      explanation: { type: "STRING", description: "Short description of what was adjusted" }
                    },
                    required: ["id", "quantityLitres", "vehicleMeterReading", "isBalanced", "explanation"]
                  }
                },
                summary: {
                  type: "STRING",
                  description: "A summary explaining the overall balancing logic applied."
                }
              },
              required: ["balancedLogs", "summary"]
            }
          }
        })
      });

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        return jsonResponse({ error: `Gemini API returned error: ${errorText}` }, 500);
      }

      const geminiResult = await geminiResponse.json() as any;
      const text = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return jsonResponse(JSON.parse(text));
    }

    // 17. AI Save Balanced
    if (path === "/api/ai/save-balanced" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const { balancedLogs, companyId = "company-kmc" } = body || {};
      if (!Array.isArray(balancedLogs)) {
        return jsonResponse({ error: "Missing balancedLogs array" }, 400);
      }

      const dataStr = await getData(env, `company_${companyId}`);
      const data = dataStr ? JSON.parse(dataStr) : { sites: [], logs: [], deliveries: [] };
      let updatedCount = 0;

      data.logs = data.logs.map((log: any) => {
        const balanced = balancedLogs.find((bl: any) => bl.id === log.id);
        if (balanced) {
          updatedCount++;
          return {
            ...log,
            quantityLitres: balanced.quantityLitres,
            vehicleMeterReading: balanced.vehicleMeterReading,
            notes: balanced.explanation ? `[AI Balanced: ${balanced.explanation}] ${log.notes || ""}`.trim() : log.notes
          };
        }
        return log;
      });

      if (updatedCount > 0) {
        await putData(env, `company_${companyId}`, JSON.stringify(data));
      }

      return jsonResponse({ success: true, count: updatedCount });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err: any) {
    return jsonResponse({ error: err.message || "Internal server error inside serverless handler" }, 500);
  }
}
