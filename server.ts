import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

interface ActiveUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastSeen: number;
}

interface ConsoleEvent {
  id: string;
  timestamp: string;
  message: string;
  userEmail?: string;
}

// Durable file-based JSON storage configuration
const DATA_DIR = path.join(process.cwd(), "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

interface CompanyData {
  sites: any[];
  logs: any[];
  deliveries: any[];
}

function getCompanyFilePath(companyId: string): string {
  return path.join(DATA_DIR, `company_${companyId}.json`);
}

function readCompanyData(companyId: string): CompanyData {
  ensureDataDir();
  const filePath = getCompanyFilePath(companyId);
  let data: CompanyData = { sites: [], logs: [], deliveries: [] };

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(content);
      if (data && data.logs && Array.isArray(data.logs)) {
        data.logs = data.logs.filter((l: any) => l && l.id && l.id.startsWith('log-'));
      }
    } catch (err) {
      console.error(`Error reading data for company ${companyId}:`, err);
    }
  }

  return data;
}

function saveCompanyData(companyId: string, data: CompanyData) {
  ensureDataDir();
  const filePath = getCompanyFilePath(companyId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error saving data for company ${companyId}:`, err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing with safety bounds
  app.use(express.json({ limit: "50mb" }));

  // In-memory data store for live collaboration and auditing
  const activeUsers: Record<string, ActiveUser> = {};
  const sseClients: any[] = [];
  const consoleEvents: ConsoleEvent[] = [];

  // Helper to add events to the developer console log
  function addConsoleEvent(message: string, userEmail?: string) {
    const evt: ConsoleEvent = {
      id: `dev-event-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      message,
      userEmail,
    };
    consoleEvents.push(evt);
    // Keep last 100 events
    if (consoleEvents.length > 100) {
      consoleEvents.shift();
    }
    broadcast("console_event", evt);
  }

  // Broadcaster function to write to all SSE connections
  function broadcast(type: string, data: any) {
    const msg = `data: ${JSON.stringify({ type, data })}\n\n`;
    sseClients.forEach((client) => {
      try {
        client.write(msg);
      } catch (err) {
        // Ignored, client close handler will remove it
      }
    });
  }

  // Cleanup inactive heartbeats (disconnected users) every 4 seconds
  setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const email in activeUsers) {
      // 10 seconds of no heartbeat is considered disconnected
      if (now - activeUsers[email].lastSeen > 10000) {
        const u = activeUsers[email];
        delete activeUsers[email];
        addConsoleEvent(`Session disconnected: ${u.name} (${u.email}) went offline`, u.email);
        changed = true;
      }
    }
    if (changed) {
      broadcast("active_users", { users: Object.values(activeUsers) });
    }
  }, 4000);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Client Event Stream for Live Notifications & Active Status
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // Establish the SSE tunnel

    // Initialize with active users and direct audit logs
    res.write(
      `data: ${JSON.stringify({
        type: "initial_active_users",
        data: { users: Object.values(activeUsers) },
      })}\n\n`
    );
    res.write(
      `data: ${JSON.stringify({
        type: "initial_console_events",
        data: { events: consoleEvents },
      })}\n\n`
    );

    sseClients.push(res);

    req.on("close", () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) {
        sseClients.splice(idx, 1);
      }
    });
  });

  // Handle heartbeats from active clients
  app.post("/api/active-users/heartbeat", (req, res) => {
    const { id, email, name, role } = req.body || {};
    if (!email || !name) {
      return res.status(400).json({ error: "Required fields name and email are missing" });
    }

    const emailKey = email.toLowerCase().trim();
    const existingUser = activeUsers[emailKey];
    const isNew = !existingUser;

    activeUsers[emailKey] = {
      id: id || `user-${Date.now()}`,
      email: emailKey,
      name,
      role: role || 'agent',
      lastSeen: Date.now(),
    };

    if (isNew) {
      addConsoleEvent(`Session authenticated: ${name} (${role}) initialized connections`, emailKey);
      broadcast("active_users", { users: Object.values(activeUsers) });
    }

    res.json({ success: true, users: Object.values(activeUsers) });
  });

  // Handle explicit session closure
  app.post("/api/active-users/logout", (req, res) => {
    const { email, name } = req.body || {};
    if (email) {
      const emailKey = email.toLowerCase().trim();
      if (activeUsers[emailKey]) {
        addConsoleEvent(`Session terminated: ${name || activeUsers[emailKey].name} logged out securely`, emailKey);
        delete activeUsers[emailKey];
        broadcast("active_users", { users: Object.values(activeUsers) });
      }
    }
    res.json({ success: true });
  });

  // Fetch complete company-isolated persisted database history (sites, logs, recoveries)
  app.get("/api/sync/data", (req, res) => {
    const companyId = (req.query.companyId as string) || "company-kmc";
    const data = readCompanyData(companyId);
    res.json(data);
  });

  // Bidirectional synchronization and merging of client files with server master ledger files
  app.post("/api/sync/data", (req, res) => {
    const { companyId = "company-kmc", sites = [], logs = [], deliveries = [] } = req.body || {};
    const serverData = readCompanyData(companyId);

    // Multi-device merge utility preserving unique entries by id
    const mergeById = (serverList: any[], clientList: any[]) => {
      const map = new Map<string, any>();
      
      if (Array.isArray(clientList)) {
        clientList.forEach(item => {
          if (item && item.id) {
            map.set(item.id, item);
          }
        });
      }

      if (Array.isArray(serverList)) {
        serverList.forEach(item => {
          if (item && item.id) {
            map.set(item.id, item);
          }
        });
      }
      
      return Array.from(map.values());
    };

    const mergedSites = mergeById(serverData.sites, sites);
    const mergedLogs = mergeById(serverData.logs, logs);
    const mergedDeliveries = mergeById(serverData.deliveries, deliveries);

    // Re-verify ordering: newest entries first
    const sortedLogs = mergedLogs.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    const sortedDeliveries = mergedDeliveries.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

    const updatedData = {
      sites: mergedSites,
      logs: sortedLogs,
      deliveries: sortedDeliveries
    };

    saveCompanyData(companyId, updatedData);
    res.json(updatedData);
  });

  // Live Broadcast of captured logs or site adjustments with persistence
  app.post("/api/sync/log", (req, res) => {
    const { log, userName, companyId = "company-kmc" } = req.body || {};
    if (!log) {
      return res.status(400).json({ error: "Log payload missing" });
    }

    const data = readCompanyData(companyId);
    if (log.id && log.id.startsWith('log-')) {
      if (!data.logs.some((l: any) => l.id === log.id)) {
        data.logs.unshift(log);
        saveCompanyData(companyId, data);
      }
    }

    addConsoleEvent(`Diesel Log Capture: ${userName || log.agentName || 'Agent'} registered ${log.quantityLitres}L of fuel for ${log.vehicleNumber}`, log.agentName);
    if (log.id && log.id.startsWith('log-')) {
      broadcast("log_added", { log, companyId });
    }
    res.json({ success: true });
  });

  app.post("/api/sync/logs-batch", (req, res) => {
    const { logs, userName, companyId = "company-kmc" } = req.body || {};
    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: "Logs array payload missing" });
    }

    const data = readCompanyData(companyId);
    const addedLogs: any[] = [];
    
    logs.forEach((log: any) => {
      if (log.id && log.id.startsWith('log-')) {
        if (!data.logs.some((l: any) => l.id === log.id)) {
          data.logs.unshift(log);
          addedLogs.push(log);
        }
      }
    });

    if (addedLogs.length > 0) {
      saveCompanyData(companyId, data);
      addConsoleEvent(`Diesel Bulk Log Capture: ${userName || 'Agent'} registered ${addedLogs.length} bulk refueling entries totaling ${addedLogs.reduce((sum, l) => sum + (l.quantityLitres || 0), 0).toFixed(1)}L`, userName);
      addedLogs.forEach((log) => {
        broadcast("log_added", { log, companyId });
      });
    }

    res.json({ success: true, count: addedLogs.length });
  });

  app.post("/api/sync/delete-log", (req, res) => {
    const { logId, userName, siteName, vehicleNumber, quantity, companyId = "company-kmc" } = req.body || {};
    
    const data = readCompanyData(companyId);
    data.logs = data.logs.filter((l: any) => l.id !== logId);
    saveCompanyData(companyId, data);

    addConsoleEvent(`Diesel Log Removed: ${userName || 'Supervisor'} expunged record ${logId} (${quantity}L for ${vehicleNumber} at ${siteName})`);
    broadcast("log_deleted", { logId, companyId });
    res.json({ success: true });
  });

  app.post("/api/sync/delivery", (req, res) => {
    const { delivery, userName, companyId = "company-kmc" } = req.body || {};
    if (!delivery) {
      return res.status(400).json({ error: "Delivery payload missing" });
    }

    const data = readCompanyData(companyId);
    if (!data.deliveries.some((d: any) => d.id === delivery.id)) {
      data.deliveries.unshift(delivery);
      saveCompanyData(companyId, data);
    }

    const variance = (delivery.closingDip - delivery.openingDip) - delivery.quantityLitres;
    const isUnder = variance < 0;
    const marginText = variance === 0 ? "Perfect match" : `${isUnder ? 'Under' : 'Over'} by ${Math.abs(variance).toFixed(1)}L`;
    addConsoleEvent(`Diesel Delivery: ${userName || delivery.agentName || 'Agent'} registered ${delivery.quantityLitres}L delivery by ${delivery.deliveredBy} (Note: ${delivery.deliveryNote}). Margin check: ${marginText}.`, delivery.agentName);
    broadcast("delivery_added", { delivery, companyId });
    res.json({ success: true });
  });

  app.post("/api/sync/delete-delivery", (req, res) => {
    const { deliveryId, userName, siteName, quantity, deliveredBy, companyId = "company-kmc" } = req.body || {};
    
    const data = readCompanyData(companyId);
    data.deliveries = data.deliveries.filter((d: any) => d.id !== deliveryId);
    saveCompanyData(companyId, data);

    addConsoleEvent(`Diesel Delivery Removed: ${userName || 'Supervisor'} expunged delivery record ${deliveryId} (${quantity}L from ${deliveredBy} at ${siteName})`);
    broadcast("delivery_deleted", { deliveryId, companyId });
    res.json({ success: true });
  });

  app.post("/api/sync/override-delivery", (req, res) => {
    const { deliveryId, userName, reason, companyId = "company-kmc" } = req.body || {};
    
    const data = readCompanyData(companyId);
    data.deliveries = data.deliveries.map((d: any) => {
      if (d.id === deliveryId) {
        return {
          ...d,
          isOverridden: true,
          overrideReason: reason,
          overriddenBy: userName || 'Management'
        };
      }
      return d;
    });
    saveCompanyData(companyId, data);

    addConsoleEvent(`Diesel Delivery Margin Accepted: ${userName || 'Supervisor'} override/approved variance margin for delivery ${deliveryId}. Reason: "${reason}"`);
    broadcast("delivery_overridden", { deliveryId, userName, reason, companyId });
    res.json({ success: true });
  });

  app.post("/api/sync/site", (req, res) => {
    const { site, userName, companyId = "company-kmc" } = req.body || {};
    if (!site) {
      return res.status(400).json({ error: "Site payload missing" });
    }

    const data = readCompanyData(companyId);
    if (!data.sites.some((s: any) => s.id === site.id)) {
      data.sites.push(site);
      saveCompanyData(companyId, data);
    }

    addConsoleEvent(`Project Site Added: ${userName || 'Supervisor'} declared '${site.name}' (${site.code}) active`, userName);
    broadcast("site_added", { site, companyId });
    res.json({ success: true });
  });

  app.post("/api/sync/toggle-site", (req, res) => {
    const { siteId, siteName, status, userName, companyId = "company-kmc" } = req.body || {};
    
    const data = readCompanyData(companyId);
    data.sites = data.sites.map((s: any) => {
      if (s.id === siteId) {
        return {
          ...s,
          status,
          closedAt: status === 'closed' ? new Date().toISOString() : null,
        };
      }
      return s;
    });
    saveCompanyData(companyId, data);

    addConsoleEvent(`Project Site Modified: ${userName || 'Supervisor'} changed status of '${siteName}' to ${status}`);
    broadcast("site_toggled", { siteId, status, companyId });
    res.json({ success: true });
  });

  app.post("/api/sync/reset-data", (req, res) => {
    const { userName, companyId = "company-kmc" } = req.body || {};
    
    const data = { sites: [], logs: [], deliveries: [] };
    saveCompanyData(companyId, data);

    addConsoleEvent(`Database Purged: ${userName || 'Developer'} reverted KMC Ledger State to factory demo template`);
    broadcast("state_reset", { companyId });
    res.json({ success: true });
  });

  app.post("/api/sync/load-test-data", (req, res) => {
    const { sites, logs, deliveries = [], userName, companyId = "company-kmc" } = req.body || {};
    
    const data = {
      sites: sites || [],
      logs: logs || [],
      deliveries: deliveries || []
    };
    saveCompanyData(companyId, data);

    addConsoleEvent(`Testing Rig Loaded: ${userName || 'Developer'} auto-generated 100 high-fidelity logs for data-auditing`);
    broadcast("test_data_loaded", { companyId });
    res.json({ success: true });
  });

  app.post("/api/ai/balance-shifts", async (req, res) => {
    const { siteId, logs, companyId = "company-kmc" } = req.body || {};
    if (!siteId || !Array.isArray(logs)) {
      return res.status(400).json({ error: "Missing required siteId or logs array" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(400).json({
        error: "Gemini API key is not configured. Please add GEMINI_API_KEY in the Settings > Secrets panel of your AI Studio workspace."
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

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

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              balancedLogs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    quantityLitres: { type: Type.NUMBER },
                    vehicleNumber: { type: Type.STRING },
                    vehicleMeterReading: { type: Type.STRING },
                    dateTime: { type: Type.STRING },
                    agentName: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    isBalanced: { type: Type.BOOLEAN, description: "True if any value in this log was adjusted" },
                    explanation: { type: Type.STRING, description: "Short description of what was adjusted and why" }
                  },
                  required: ["id", "quantityLitres", "vehicleMeterReading", "isBalanced", "explanation"]
                }
              },
              summary: {
                type: Type.STRING,
                description: "A summary explaining the overall balancing logic applied, the variance reconciled, and how the day/night entries were balanced backwards from the final highest reading."
              }
            },
            required: ["balancedLogs", "summary"]
          }
        }
      });

      const parsedResult = JSON.parse(aiResponse.text || "{}");
      res.json(parsedResult);
    } catch (err: any) {
      console.error("Error in AI balancing:", err);
      res.status(500).json({ error: err.message || "An error occurred while calling Gemini AI to balance logs." });
    }
  });

  app.post("/api/ai/save-balanced", (req, res) => {
    const { balancedLogs, companyId = "company-kmc" } = req.body || {};
    if (!Array.isArray(balancedLogs)) {
      return res.status(400).json({ error: "Missing balancedLogs array" });
    }

    const data = readCompanyData(companyId);
    let updatedCount = 0;

    data.logs = data.logs.map((log: any) => {
      const balanced = balancedLogs.find((bl: any) => bl.id === log.id);
      if (balanced) {
        updatedCount++;
        return {
          ...log,
          quantityLitres: balanced.quantityLitres,
          vehicleMeterReading: balanced.vehicleMeterReading,
          notes: balanced.explanation ? `[AI Balanced: ${balanced.explanation}] ${log.notes || ''}`.trim() : log.notes
        };
      }
      return log;
    });

    if (updatedCount > 0) {
      saveCompanyData(companyId, data);
      addConsoleEvent(`AI Balancing Committed: ${updatedCount} refueling logs balanced and saved chronologically matching highest final readings`);
      broadcast("logs_balanced", { companyId });
    }

    res.json({ success: true, count: updatedCount });
  });

  // Vite development or production routing
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running on http://localhost:${PORT}`);
  });
}

startServer();
