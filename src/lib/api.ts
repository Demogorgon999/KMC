/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ====================================================================
// D1 / Cloudflare Worker backed data layer.
//
// This module is a drop-in replacement for lib/firebase.ts. Every function
// here has the SAME name and signature as its Firestore equivalent, so
// App.tsx and AuthScreen.tsx only need to change their import path, not
// their calling code.
//
// Firestore has been removed entirely to eliminate the two-database
// "self-healing" sync loop that kept resurrecting deleted/bad records.
// Cloudflare D1 (via the existing /api/* Worker routes) is now the single
// source of truth.
//
// Real-time "subscribe" functions are implemented via polling (default
// every 5 seconds) since D1/Workers don't have a native push mechanism
// like Firestore's onSnapshot. This trades instant push updates for a
// short (few-second) delay, in exchange for having only one database to
// reason about.
// ====================================================================

import { ConstructionSite, DieselLog, User, DieselDelivery, CompanyProfile, MonthlyDieselRate } from '../types';

const POLL_INTERVAL_MS = 5000;

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
}

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json); } catch { return fallback; }
}

// ==================== COMPANIES API ====================
export async function getCompaniesFromDB(): Promise<CompanyProfile[]> {
  try {
    return await apiGet<CompanyProfile[]>('/api/data/companies');
  } catch (err) {
    console.error('getCompaniesFromDB failed:', err);
    return [];
  }
}

export async function saveCompanyToDB(company: CompanyProfile): Promise<void> {
  try {
    await apiPost('/api/data/company', { company });
  } catch (err) {
    console.error('saveCompanyToDB failed:', err);
  }
}

// ==================== USERS API ====================
export async function getUsersFromDB(): Promise<User[]> {
  try {
    return await apiGet<User[]>('/api/data/users');
  } catch (err) {
    console.error('getUsersFromDB failed:', err);
    return [];
  }
}

export async function saveUserToDB(user: User): Promise<void> {
  try {
    await apiPost('/api/data/user', { user });
  } catch (err) {
    console.error('saveUserToDB failed:', err);
  }
}

// ==================== SITES API ====================
export async function getSitesFromDB(companyId: string): Promise<ConstructionSite[]> {
  try {
    const data = await apiGet<{ sites: ConstructionSite[] }>(`/api/sync/data?companyId=${encodeURIComponent(companyId)}`);
    return data.sites || [];
  } catch (err) {
    console.error('getSitesFromDB failed:', err);
    return [];
  }
}

function isValidSite(site: any): boolean {
  return !!(site && site.id && site.name && site.code && site.location);
}

export async function saveSiteToDB(site: ConstructionSite & { companyId: string }): Promise<void> {
  if (!isValidSite(site)) {
    console.error('saveSiteToDB rejected: site is missing required fields (name/code/location)', site);
    return;
  }
  try {
    await apiPost('/api/sync/site', { site, companyId: site.companyId });
  } catch (err) {
    console.error('saveSiteToDB failed:', err);
  }
}

export async function updateSiteStatusInDB(siteId: string, status: 'active' | 'closed', closedAt: string | null): Promise<void> {
  try {
    await apiPost('/api/sync/toggle-site', { siteId, status });
  } catch (err) {
    console.error('updateSiteStatusInDB failed:', err);
  }
}

// ==================== LOGS API ====================
export async function getLogsFromDB(companyId: string): Promise<DieselLog[]> {
  try {
    const data = await apiGet<{ logs: DieselLog[] }>(`/api/sync/data?companyId=${encodeURIComponent(companyId)}`);
    return (data.logs || []).filter(l => l && l.id && l.id.startsWith('log-'));
  } catch (err) {
    console.error('getLogsFromDB failed:', err);
    return [];
  }
}

export async function saveLogToDB(log: DieselLog & { companyId: string }): Promise<void> {
  if (!log.id || !log.id.startsWith('log-')) return;
  try {
    const cleaned = { ...log };
    if (cleaned.logSheetBase64 && cleaned.logSheetBase64.length > 600 * 1024) {
      cleaned.logSheetBase64 = null;
      cleaned.notes = (cleaned.notes || '') + " (Attachment auto-removed: original file exceeded safe sync limit)";
    }
    await apiPost('/api/sync/log', { log: cleaned, companyId: log.companyId });
  } catch (err) {
    console.error('saveLogToDB failed:', err);
  }
}

export async function deleteLogFromDB(logId: string): Promise<void> {
  try {
    await apiPost('/api/sync/delete-log', { logId });
  } catch (err) {
    console.error('deleteLogFromDB failed:', err);
  }
}

// ==================== DELIVERIES API ====================
export async function getDeliveriesFromDB(companyId: string): Promise<DieselDelivery[]> {
  try {
    const data = await apiGet<{ deliveries: DieselDelivery[] }>(`/api/sync/data?companyId=${encodeURIComponent(companyId)}`);
    return data.deliveries || [];
  } catch (err) {
    console.error('getDeliveriesFromDB failed:', err);
    return [];
  }
}

export async function saveDeliveryToDB(delivery: DieselDelivery & { companyId: string }): Promise<void> {
  try {
    const cleaned = { ...delivery };
    if (cleaned.attachmentBase64 && cleaned.attachmentBase64.length > 600 * 1024) {
      cleaned.attachmentBase64 = null;
      cleaned.deliveryNote = (cleaned.deliveryNote || '') + " (Attachment auto-removed: original file exceeded safe sync limit)";
    }
    await apiPost('/api/sync/delivery', { delivery: cleaned, companyId: delivery.companyId });
  } catch (err) {
    console.error('saveDeliveryToDB failed:', err);
  }
}

export async function deleteDeliveryFromDB(deliveryId: string): Promise<void> {
  try {
    await apiPost('/api/sync/delete-delivery', { deliveryId });
  } catch (err) {
    console.error('deleteDeliveryFromDB failed:', err);
  }
}

export async function overrideDeliveryInDB(deliveryId: string, overrideReason: string, overriddenBy: string): Promise<void> {
  try {
    await apiPost('/api/sync/override-delivery', { deliveryId, reason: overrideReason, userName: overriddenBy });
  } catch (err) {
    console.error('overrideDeliveryInDB failed:', err);
  }
}

// ==================== ADMINISTRATIVE APIs ====================
export async function resetCompanyDataInDB(companyId: string): Promise<void> {
  try {
    await apiPost('/api/sync/reset-data', { companyId });
  } catch (err) {
    console.error('resetCompanyDataInDB failed:', err);
  }
}

export async function seedTestDataInDB(
  companyId: string,
  sites: ConstructionSite[],
  logs: DieselLog[]
): Promise<void> {
  try {
    await apiPost('/api/sync/load-test-data', {
      companyId,
      sites: sites.map(s => ({ ...s, companyId })),
      logs: logs.map(l => ({ ...l, companyId })),
      deliveries: []
    });
  } catch (err) {
    console.error('seedTestDataInDB failed:', err);
  }
}

// ==================== POLLING-BASED "REALTIME" SUBSCRIPTIONS ====================
// D1/Workers have no native push mechanism, so these poll on an interval instead
// of Firestore's onSnapshot. Returns an unsubscribe function, same as before.

export function subscribeToSitesInDB(
  companyId: string,
  onUpdate: (sites: ConstructionSite[]) => void,
  onError?: (err: unknown) => void
): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const sites = await getSitesFromDB(companyId);
      if (!stopped) onUpdate(sites);
    } catch (err) {
      if (onError) onError(err);
    }
  };
  tick();
  const interval = setInterval(tick, POLL_INTERVAL_MS);
  return () => { stopped = true; clearInterval(interval); };
}

export function subscribeToLogsInDB(
  companyId: string,
  onUpdate: (logs: DieselLog[]) => void,
  onError?: (err: unknown) => void
): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const logs = await getLogsFromDB(companyId);
      if (!stopped) onUpdate(logs);
    } catch (err) {
      if (onError) onError(err);
    }
  };
  tick();
  const interval = setInterval(tick, POLL_INTERVAL_MS);
  return () => { stopped = true; clearInterval(interval); };
}

export function subscribeToDeliveriesInDB(
  companyId: string,
  onUpdate: (deliveries: DieselDelivery[]) => void,
  onError?: (err: unknown) => void
): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const deliveries = await getDeliveriesFromDB(companyId);
      if (!stopped) onUpdate(deliveries);
    } catch (err) {
      if (onError) onError(err);
    }
  };
  tick();
  const interval = setInterval(tick, POLL_INTERVAL_MS);
  return () => { stopped = true; clearInterval(interval); };
}

// ==================== RATES API ====================
export async function getRatesFromDB(companyId: string): Promise<MonthlyDieselRate[]> {
  try {
    return await apiGet<MonthlyDieselRate[]>(`/api/data/rates?companyId=${encodeURIComponent(companyId)}`);
  } catch (err) {
    console.error('getRatesFromDB failed:', err);
    return [];
  }
}

export async function saveRateToDB(rate: MonthlyDieselRate): Promise<void> {
  try {
    await apiPost('/api/data/rate', { rate });
  } catch (err) {
    console.error('saveRateToDB failed:', err);
  }
}

export function subscribeToRatesInDB(
  companyId: string,
  onUpdate: (rates: MonthlyDieselRate[]) => void,
  onError?: (err: unknown) => void
): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const rates = await getRatesFromDB(companyId);
      if (!stopped) onUpdate(rates);
    } catch (err) {
      if (onError) onError(err);
    }
  };
  tick();
  const interval = setInterval(tick, POLL_INTERVAL_MS);
  return () => { stopped = true; clearInterval(interval); };
}

// ==================== BATCH SAVE APIs ====================
// These reuse the existing full-sync endpoint, which upserts each array
// independently and atomically (D1 batch), passing empty arrays for the
// collections not being written in this call.

export async function saveSitesInBatchToDB(sites: (ConstructionSite & { companyId: string })[]): Promise<void> {
  const validSites = sites.filter(isValidSite);
  const rejected = sites.length - validSites.length;
  if (rejected > 0) {
    console.error(`saveSitesInBatchToDB rejected ${rejected} malformed site(s) (missing name/code/location)`, sites.filter(s => !isValidSite(s)));
  }
  if (validSites.length === 0) return;
  const companyId = validSites[0].companyId;
  try {
    await apiPost('/api/sync/data', { companyId, sites: validSites, logs: [], deliveries: [] });
  } catch (err) {
    console.error('saveSitesInBatchToDB failed:', err);
  }
}

export async function saveLogsInBatchToDB(logs: (DieselLog & { companyId: string })[]): Promise<void> {
  const filteredLogs = logs.filter(l => l && l.id && l.id.startsWith('log-'));
  if (filteredLogs.length === 0) return;
  const companyId = filteredLogs[0].companyId;
  try {
    await apiPost('/api/sync/logs-batch', { companyId, logs: filteredLogs });
  } catch (err) {
    console.error('saveLogsInBatchToDB failed:', err);
  }
}

export async function saveDeliveriesInBatchToDB(deliveries: (DieselDelivery & { companyId: string })[]): Promise<void> {
  if (deliveries.length === 0) return;
  const companyId = deliveries[0].companyId;
  try {
    await apiPost('/api/sync/data', { companyId, sites: [], logs: [], deliveries });
  } catch (err) {
    console.error('saveDeliveriesInBatchToDB failed:', err);
  }
}
