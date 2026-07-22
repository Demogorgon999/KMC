var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// functions/api/[[path]].ts
//
// This version uses the D1 database (binding: DB, database: kmc-ledger) that was already
// provisioned but never wired into the code. Previously the worker looked for a KV binding
// called DATA_KV, which was never bound, so every request silently fell back to an in-memory
// object that Cloudflare can wipe at any time (new deployment, instance recycle, etc). That
// is why data kept disappearing regardless of the earlier bug fixes.
//
// D1 is a real SQLite-based database with ACID transactions. Writes are atomic per statement
// (or per batch, using db.batch()), so the read-modify-write race condition that a shared KV
// blob had is structurally impossible here.
//
// Run schema.sql in the D1 console (Storage & Databases -> D1 -> kmc-ledger -> Console)
// before deploying this.

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(jsonResponse, "jsonResponse");

function ensureId(item, prefix) {
  if (!item.id) {
    item.id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return item;
}
__name(ensureId, "ensureId");

// Upsert one row. ON CONFLICT DO UPDATE makes this idempotent: resending the same id just
// overwrites that row's data, atomically, in a single statement.
function upsertStatement(db, table, item, companyId) {
  ensureId(item, table.slice(0, -1)); // "logs" -> "log" prefix, etc.
  const dateTime = item.dateTime || null;
  const realTable = `app_${table}`; // "sites" -> "app_sites", "logs" -> "app_logs", "deliveries" -> "app_deliveries"
  if (table === "sites") {
    return db.prepare(
      `INSERT INTO ${realTable} (id, companyId, data) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`
    ).bind(item.id, companyId, JSON.stringify(item));
  }
  return db.prepare(
    `INSERT INTO ${realTable} (id, companyId, dateTime, data) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, dateTime = excluded.dateTime`
  ).bind(item.id, companyId, dateTime, JSON.stringify(item));
}
__name(upsertStatement, "upsertStatement");

async function loadCompanyData(db, companyId) {
  const [sitesRes, logsRes, deliveriesRes] = await Promise.all([
    db.prepare(`SELECT data FROM app_sites WHERE companyId = ?`).bind(companyId).all(),
    db.prepare(`SELECT data FROM app_logs WHERE companyId = ? ORDER BY dateTime DESC`).bind(companyId).all(),
    db.prepare(`SELECT data FROM app_deliveries WHERE companyId = ? ORDER BY dateTime DESC`).bind(companyId).all()
  ]);
  const parse = (rows) => rows.results.map((r) => JSON.parse(r.data));
  return {
    sites: parse(sitesRes),
    logs: parse(logsRes),
    deliveries: parse(deliveriesRes)
  };
}
__name(loadCompanyData, "loadCompanyData");

async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const db = env.DB;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  try {
    if (path === "/api/health") {
      return jsonResponse({ status: "ok", environment: db ? "production-d1" : "no-db-bound" });
    }

    if (path === "/api/events") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "initial_active_users", data: { users: [] } })}

`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "initial_console_events", data: { events: [] } })}

`));
          controller.close();
        }
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    if (path === "/api/active-users/heartbeat") {
      const body = await request.json().catch(() => ({}));
      const { name, role } = body || {};
      return jsonResponse({
        success: true,
        users: name ? [{ id: "cf-user", email: body.email || "cf@kmc.co.za", name, role: role || "agent", lastSeen: Date.now() }] : []
      });
    }
    if (path === "/api/active-users/logout") {
      return jsonResponse({ success: true });
    }

    if (!db) {
      return jsonResponse({ error: "D1 database not bound. Check the DB binding in Cloudflare Pages settings." }, 500);
    }

    // ---- GET full company data ----
    if (path === "/api/sync/data" && request.method === "GET") {
      const companyId = url.searchParams.get("companyId") || "company-kmc";
      const data = await loadCompanyData(db, companyId);
      return jsonResponse(data);
    }

    // ---- Full sync push: one atomic batch. Either the whole batch commits or none of it
    // does — no partial writes, no interleaving with another agent's concurrent sync. ----
    if (path === "/api/sync/data" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { companyId = "company-kmc", sites = [], logs = [], deliveries = [] } = body || {};

      const statements = [
        ...sites.filter(Boolean).map((s) => upsertStatement(db, "sites", s, companyId)),
        ...logs.filter(Boolean).map((l) => upsertStatement(db, "logs", l, companyId)),
        ...deliveries.filter(Boolean).map((d) => upsertStatement(db, "deliveries", d, companyId))
      ];
      if (statements.length > 0) {
        await db.batch(statements);
      }

      const updatedData = await loadCompanyData(db, companyId);
      return jsonResponse(updatedData);
    }

    // ---- Single log push ----
    if (path === "/api/sync/log" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { log, companyId = "company-kmc" } = body || {};
      if (!log) return jsonResponse({ error: "Log payload missing" }, 400);
      await upsertStatement(db, "logs", log, companyId).run();
      return jsonResponse({ success: true, id: log.id });
    }

    // ---- Batch log push, as a single atomic D1 batch ----
    if (path === "/api/sync/logs-batch" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { logs, companyId = "company-kmc" } = body || {};
      if (!logs || !Array.isArray(logs)) return jsonResponse({ error: "Logs array payload missing" }, 400);

      const skippedInvalid = [];
      const validLogs = [];
      logs.forEach((log) => {
        if (!log || typeof log !== "object") {
          skippedInvalid.push(log);
          return;
        }
        validLogs.push(log);
      });

      if (validLogs.length > 0) {
        const statements = validLogs.map((log) => upsertStatement(db, "logs", log, companyId));
        await db.batch(statements);
      }

      return jsonResponse({
        success: true,
        received: logs.length,
        count: validLogs.length,
        skippedInvalid
      });
    }

    if (path === "/api/sync/delete-log" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { logId, companyId = "company-kmc" } = body || {};
      if (!logId) return jsonResponse({ error: "logId missing" }, 400);
      await db.prepare(`DELETE FROM app_logs WHERE id = ? AND companyId = ?`).bind(logId, companyId).run();
      return jsonResponse({ success: true });
    }

    if (path === "/api/sync/delivery" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { delivery, companyId = "company-kmc" } = body || {};
      if (!delivery) return jsonResponse({ error: "Delivery payload missing" }, 400);
      await upsertStatement(db, "deliveries", delivery, companyId).run();
      return jsonResponse({ success: true, id: delivery.id });
    }

    if (path === "/api/sync/delete-delivery" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { deliveryId, companyId = "company-kmc" } = body || {};
      if (!deliveryId) return jsonResponse({ error: "deliveryId missing" }, 400);
      await db.prepare(`DELETE FROM app_deliveries WHERE id = ? AND companyId = ?`).bind(deliveryId, companyId).run();
      return jsonResponse({ success: true });
    }

    if (path === "/api/sync/override-delivery" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { deliveryId, userName, reason, companyId = "company-kmc" } = body || {};
      const row = await db.prepare(`SELECT data FROM app_deliveries WHERE id = ? AND companyId = ?`).bind(deliveryId, companyId).first();
      if (!row) return jsonResponse({ error: "Delivery not found" }, 404);
      const delivery = JSON.parse(row.data);
      const updated = {
        ...delivery,
        isOverridden: true,
        overrideReason: reason,
        overriddenBy: userName || "Management"
      };
      await db.prepare(`UPDATE app_deliveries SET data = ? WHERE id = ? AND companyId = ?`)
        .bind(JSON.stringify(updated), deliveryId, companyId).run();
      return jsonResponse({ success: true });
    }

    if (path === "/api/sync/site" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { site, companyId = "company-kmc" } = body || {};
      if (!site) return jsonResponse({ error: "Site payload missing" }, 400);
      await upsertStatement(db, "sites", site, companyId).run();
      return jsonResponse({ success: true, id: site.id });
    }

    if (path === "/api/sync/toggle-site" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { siteId, status, companyId = "company-kmc" } = body || {};
      const row = await db.prepare(`SELECT data FROM app_sites WHERE id = ? AND companyId = ?`).bind(siteId, companyId).first();
      if (!row) return jsonResponse({ error: "Site not found" }, 404);
      const site = JSON.parse(row.data);
      const updated = {
        ...site,
        status,
        closedAt: status === "closed" ? (/* @__PURE__ */ new Date()).toISOString() : null
      };
      await db.prepare(`UPDATE app_sites SET data = ? WHERE id = ? AND companyId = ?`)
        .bind(JSON.stringify(updated), siteId, companyId).run();
      return jsonResponse({ success: true });
    }

    if (path === "/api/sync/reset-data" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { companyId = "company-kmc" } = body || {};
      await db.batch([
        db.prepare(`DELETE FROM app_sites WHERE companyId = ?`).bind(companyId),
        db.prepare(`DELETE FROM app_logs WHERE companyId = ?`).bind(companyId),
        db.prepare(`DELETE FROM app_deliveries WHERE companyId = ?`).bind(companyId)
      ]);
      return jsonResponse({ success: true });
    }

    if (path === "/api/sync/load-test-data" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { sites = [], logs = [], deliveries = [], companyId = "company-kmc" } = body || {};
      await db.batch([
        db.prepare(`DELETE FROM app_sites WHERE companyId = ?`).bind(companyId),
        db.prepare(`DELETE FROM app_logs WHERE companyId = ?`).bind(companyId),
        db.prepare(`DELETE FROM app_deliveries WHERE companyId = ?`).bind(companyId)
      ]);
      const statements = [
        ...sites.filter(Boolean).map((s) => upsertStatement(db, "sites", s, companyId)),
        ...logs.filter(Boolean).map((l) => upsertStatement(db, "logs", l, companyId)),
        ...deliveries.filter(Boolean).map((d) => upsertStatement(db, "deliveries", d, companyId))
      ];
      if (statements.length > 0) {
        await db.batch(statements);
      }
      return jsonResponse({ success: true });
    }

    // ==================== COMPANIES API ====================
    if (path === "/api/data/companies" && request.method === "GET") {
      const rows = await db.prepare(`SELECT data FROM app_companies`).all();
      return jsonResponse(rows.results.map((r) => JSON.parse(r.data)));
    }
    if (path === "/api/data/company" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { company } = body || {};
      if (!company || !company.id) return jsonResponse({ error: "Company payload missing id" }, 400);
      await db.prepare(
        `INSERT INTO app_companies (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      ).bind(company.id, JSON.stringify(company)).run();
      return jsonResponse({ success: true });
    }

    // ==================== USERS API ====================
    if (path === "/api/data/users" && request.method === "GET") {
      const rows = await db.prepare(`SELECT data FROM app_users`).all();
      return jsonResponse(rows.results.map((r) => JSON.parse(r.data)));
    }
    if (path === "/api/data/user" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { user } = body || {};
      if (!user) return jsonResponse({ error: "User payload missing" }, 400);
      const userId = user.id || (user.email || "").toLowerCase();
      if (!userId) return jsonResponse({ error: "User payload missing id/email" }, 400);
      await db.prepare(
        `INSERT INTO app_users (id, companyId, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, companyId = excluded.companyId`
      ).bind(userId, user.companyId || null, JSON.stringify({ ...user, id: userId })).run();
      return jsonResponse({ success: true });
    }

    // ==================== RATES API ====================
    if (path === "/api/data/rates" && request.method === "GET") {
      const companyId = url.searchParams.get("companyId") || "company-kmc";
      const rows = await db.prepare(`SELECT data FROM app_rates WHERE companyId = ?`).bind(companyId).all();
      return jsonResponse(rows.results.map((r) => JSON.parse(r.data)));
    }
    if (path === "/api/data/rate" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { rate } = body || {};
      if (!rate || !rate.id || !rate.companyId) return jsonResponse({ error: "Rate payload missing id/companyId" }, 400);
      await db.prepare(
        `INSERT INTO app_rates (id, companyId, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      ).bind(rate.id, rate.companyId, JSON.stringify(rate)).run();
      return jsonResponse({ success: true });
    }

    // ---- Reconciliation / audit endpoint: live counts straight from the database ----
    if (path === "/api/sync/audit" && request.method === "GET") {
      const companyId = url.searchParams.get("companyId") || "company-kmc";
      const [sitesCount, logsCount, deliveriesCount] = await Promise.all([
        db.prepare(`SELECT COUNT(*) as c FROM app_sites WHERE companyId = ?`).bind(companyId).first(),
        db.prepare(`SELECT COUNT(*) as c FROM app_logs WHERE companyId = ?`).bind(companyId).first(),
        db.prepare(`SELECT COUNT(*) as c FROM app_deliveries WHERE companyId = ?`).bind(companyId).first()
      ]);
      return jsonResponse({
        companyId,
        counts: {
          sites: sitesCount.c,
          logs: logsCount.c,
          deliveries: deliveriesCount.c
        },
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }

    if (path === "/api/ai/balance-shifts" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
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
          "User-Agent": "aistudio-build"
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
      const geminiResult = await geminiResponse.json();
      const text = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return jsonResponse(JSON.parse(text));
    }

    if (path === "/api/ai/save-balanced" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { balancedLogs, companyId = "company-kmc" } = body || {};
      if (!Array.isArray(balancedLogs)) {
        return jsonResponse({ error: "Missing balancedLogs array" }, 400);
      }
      let updatedCount = 0;
      for (const balanced of balancedLogs) {
        if (!balanced || !balanced.id) continue;
        const row = await db.prepare(`SELECT data FROM app_logs WHERE id = ? AND companyId = ?`).bind(balanced.id, companyId).first();
        if (!row) continue;
        const log = JSON.parse(row.data);
        const updated = {
          ...log,
          quantityLitres: balanced.quantityLitres,
          vehicleMeterReading: balanced.vehicleMeterReading,
          notes: balanced.explanation ? `[AI Balanced: ${balanced.explanation}] ${log.notes || ""}`.trim() : log.notes
        };
        await db.prepare(`UPDATE app_logs SET data = ? WHERE id = ? AND companyId = ?`)
          .bind(JSON.stringify(updated), balanced.id, companyId).run();
        updatedCount++;
      }
      return jsonResponse({ success: true, count: updatedCount });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    return jsonResponse({ error: err.message || "Internal server error inside serverless handler" }, 500);
  }
}
__name(onRequest, "onRequest");

// src/worker.ts
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const context = {
        request,
        env,
        params: {},
        next: /* @__PURE__ */ __name(async () => new Response("Not Found", { status: 404 }), "next")
      };
      return onRequest(context);
    }
    try {
      return await env.ASSETS.fetch(request);
    } catch (err) {
      return new Response("Not Found", { status: 404 });
    }
  }
};
export {
  worker_default as default
};
