import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  getDocFromServer,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { CompanyProfile, User, ConstructionSite, DieselLog, DieselDelivery, MonthlyDieselRate } from '../types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust modern multi-tab IndexedDB cache persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  // Asynchronously log the error to the 'error_logs' Firestore collection for developer inspection
  const errorId = `err-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  setDoc(doc(db, 'error_logs', errorId), {
    id: errorId,
    companyId: path ? (path.split('/')[0] || 'unknown') : 'unknown',
    timestamp: new Date().toISOString(),
    userName: auth.currentUser?.email || 'unauthenticated',
    errorType: 'firestore-operation',
    message: errInfo.error,
    payloadInfo: `Operation: ${operationType}, Path: ${path}`
  }).catch(logErr => {
    console.error("Could not write sync error to Firestore error_logs:", logErr);
  });

  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection on Boot as requested by the skill instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Gracefully catch unavailable/offline modes since we have robust IndexedDB cache persistence
    console.log("ℹ️ Apex Diesel: Operating offline with robust local IndexedDB cache sync active.");
  }
}
testConnection();

// Collection Constants
const COMPANIES_COLL = 'companies';
const USERS_COLL = 'users';
const SITES_COLL = 'sites';
const LOGS_COLL = 'logs';
const DELIVERIES_COLL = 'deliveries';

// ==================== COMPANIES API ====================
export async function getCompaniesFromDB(): Promise<CompanyProfile[]> {
  try {
    const snap = await getDocs(collection(db, COMPANIES_COLL));
    const list: CompanyProfile[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as CompanyProfile);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, COMPANIES_COLL);
    return [];
  }
}

export async function saveCompanyToDB(company: CompanyProfile): Promise<void> {
  try {
    await setDoc(doc(db, COMPANIES_COLL, company.id), company);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COMPANIES_COLL}/${company.id}`);
  }
}

// ==================== USERS API ====================
export async function getUsersFromDB(): Promise<User[]> {
  try {
    const snap = await getDocs(collection(db, USERS_COLL));
    const list: User[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as User);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, USERS_COLL);
    return [];
  }
}

export async function saveUserToDB(user: User): Promise<void> {
  const userId = user.id || user.email.toLowerCase();
  try {
    await setDoc(doc(db, USERS_COLL, userId), user);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${USERS_COLL}/${userId}`);
  }
}

// ==================== SITES API ====================
export async function getSitesFromDB(companyId: string): Promise<ConstructionSite[]> {
  try {
    const q = query(collection(db, SITES_COLL), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    const list: ConstructionSite[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as ConstructionSite);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, SITES_COLL);
    return [];
  }
}

export async function saveSiteToDB(site: ConstructionSite & { companyId: string }): Promise<void> {
  try {
    await setDoc(doc(db, SITES_COLL, site.id), site);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${SITES_COLL}/${site.id}`);
  }
}

export async function updateSiteStatusInDB(siteId: string, status: 'active' | 'closed', closedAt: string | null): Promise<void> {
  try {
    const ref = doc(db, SITES_COLL, siteId);
    await updateDoc(ref, { status, closedAt });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${SITES_COLL}/${siteId}`);
  }
}

// ==================== LOGS API ====================
export async function getLogsFromDB(companyId: string): Promise<DieselLog[]> {
  try {
    const q = query(collection(db, LOGS_COLL), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    const list: DieselLog[] = [];
    snap.forEach((doc) => {
      const log = doc.data() as DieselLog;
      if (log && log.id) {
        if (log.id.startsWith('log-')) {
          list.push(log);
        } else if (log.id.startsWith('sync-log-')) {
          deleteDoc(doc.ref).catch(() => {});
        }
      }
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, LOGS_COLL);
    return [];
  }
}

export async function saveLogToDB(log: DieselLog & { companyId: string }): Promise<void> {
  if (!log.id || !log.id.startsWith('log-')) return;
  try {
    const cleaned = { ...log };
    if (cleaned.logSheetBase64 && cleaned.logSheetBase64.length > 600 * 1024) {
      cleaned.logSheetBase64 = null;
      cleaned.notes = (cleaned.notes || '') + " (Attachment auto-removed: original file exceeded safe real-time sync limit)";
    }
    await setDoc(doc(db, LOGS_COLL, log.id), cleaned);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${LOGS_COLL}/${log.id}`);
  }
}

export async function deleteLogFromDB(logId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, LOGS_COLL, logId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${LOGS_COLL}/${logId}`);
  }
}

// ==================== DELIVERIES API ====================
export async function getDeliveriesFromDB(companyId: string): Promise<DieselDelivery[]> {
  try {
    const q = query(collection(db, DELIVERIES_COLL), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    const list: DieselDelivery[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as DieselDelivery);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, DELIVERIES_COLL);
    return [];
  }
}

export async function saveDeliveryToDB(delivery: DieselDelivery & { companyId: string }): Promise<void> {
  try {
    const cleaned = { ...delivery };
    if (cleaned.attachmentBase64 && cleaned.attachmentBase64.length > 600 * 1024) {
      cleaned.attachmentBase64 = null;
      cleaned.deliveryNote = (cleaned.deliveryNote || '') + " (Attachment auto-removed: original file exceeded safe real-time sync limit)";
    }
    await setDoc(doc(db, DELIVERIES_COLL, delivery.id), cleaned);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${DELIVERIES_COLL}/${delivery.id}`);
  }
}

export async function deleteDeliveryFromDB(deliveryId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, DELIVERIES_COLL, deliveryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${DELIVERIES_COLL}/${deliveryId}`);
  }
}

export async function overrideDeliveryInDB(deliveryId: string, overrideReason: string, overriddenBy: string): Promise<void> {
  try {
    const ref = doc(db, DELIVERIES_COLL, deliveryId);
    await updateDoc(ref, { isOverridden: true, overrideReason, overriddenBy });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${DELIVERIES_COLL}/${deliveryId}`);
  }
}

// ==================== ADMINISTRATIVE APIs ====================
export async function resetCompanyDataInDB(companyId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    // Query logs
    const lSnap = await getDocs(query(collection(db, LOGS_COLL), where("companyId", "==", companyId)));
    lSnap.forEach((doc) => batch.delete(doc.ref));

    // Query deliveries
    const dSnap = await getDocs(query(collection(db, DELIVERIES_COLL), where("companyId", "==", companyId)));
    dSnap.forEach((doc) => batch.delete(doc.ref));

    // Query sites
    const sSnap = await getDocs(query(collection(db, SITES_COLL), where("companyId", "==", companyId)));
    sSnap.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `batch-purge-company-${companyId}`);
  }
}

export async function seedTestDataInDB(
  companyId: string, 
  sites: ConstructionSite[], 
  logs: DieselLog[]
): Promise<void> {
  try {
    const batch = writeBatch(db);

    // Save sites
    sites.forEach((site) => {
      const ref = doc(db, SITES_COLL, site.id);
      batch.set(ref, { ...site, companyId });
    });

    // Save logs
    logs.forEach((log) => {
      const ref = doc(db, LOGS_COLL, log.id);
      batch.set(ref, { ...log, companyId });
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `batch-seed-company-${companyId}`);
  }
}

// ==================== REALTIME SUBSCRIPTIONS ====================
export function subscribeToSitesInDB(
  companyId: string, 
  onUpdate: (sites: ConstructionSite[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, SITES_COLL), where("companyId", "==", companyId));
  return onSnapshot(q, (snap) => {
    const list: ConstructionSite[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as ConstructionSite);
    });
    onUpdate(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, SITES_COLL);
    if (onError) onError(err);
  });
}

export function subscribeToLogsInDB(
  companyId: string, 
  onUpdate: (logs: DieselLog[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, LOGS_COLL), where("companyId", "==", companyId));
  return onSnapshot(q, (snap) => {
    const list: DieselLog[] = [];
    snap.forEach((doc) => {
      const log = doc.data() as DieselLog;
      if (log && log.id) {
        if (log.id.startsWith('log-')) {
          list.push(log);
        } else if (log.id.startsWith('sync-log-')) {
          deleteDoc(doc.ref).catch(() => {});
        }
      }
    });
    onUpdate(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, LOGS_COLL);
    if (onError) onError(err);
  });
}

export function subscribeToDeliveriesInDB(
  companyId: string, 
  onUpdate: (deliveries: DieselDelivery[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, DELIVERIES_COLL), where("companyId", "==", companyId));
  return onSnapshot(q, (snap) => {
    const list: DieselDelivery[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as DieselDelivery);
    });
    onUpdate(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, DELIVERIES_COLL);
    if (onError) onError(err);
  });
}

// ==================== RATES API ====================
const RATES_COLL = 'rates';

export async function getRatesFromDB(companyId: string): Promise<MonthlyDieselRate[]> {
  try {
    const q = query(collection(db, RATES_COLL), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    const list: MonthlyDieselRate[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as MonthlyDieselRate);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, RATES_COLL);
    return [];
  }
}

export async function saveRateToDB(rate: MonthlyDieselRate): Promise<void> {
  try {
    await setDoc(doc(db, RATES_COLL, rate.id), rate);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${RATES_COLL}/${rate.id}`);
  }
}

export function subscribeToRatesInDB(
  companyId: string, 
  onUpdate: (rates: MonthlyDieselRate[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, RATES_COLL), where("companyId", "==", companyId));
  return onSnapshot(q, (snap) => {
    const list: MonthlyDieselRate[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as MonthlyDieselRate);
    });
    onUpdate(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, RATES_COLL);
    if (onError) onError(err);
  });
}

// ==================== BATCH SAVE APIS ====================
export async function saveSitesInBatchToDB(sites: (ConstructionSite & { companyId: string })[]): Promise<void> {
  if (sites.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < sites.length; i += chunkSize) {
    const chunk = sites.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((site) => {
      batch.set(doc(db, SITES_COLL, site.id), site);
    });
    try {
      await batch.commit();
    } catch (batchErr) {
      console.warn("Sites batch write failed. Retrying with individual writes:", batchErr);
      for (const site of chunk) {
        try {
          await setDoc(doc(db, SITES_COLL, site.id), site);
        } catch (indivErr) {
          console.error(`Individual site save failed for ${site.id}:`, indivErr);
        }
      }
    }
  }
}

export async function saveLogsInBatchToDB(logs: (DieselLog & { companyId: string })[]): Promise<void> {
  const filteredLogs = logs.filter(l => l && l.id && l.id.startsWith('log-'));
  if (filteredLogs.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < filteredLogs.length; i += chunkSize) {
    const chunk = filteredLogs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((log) => {
      const cleaned = { ...log };
      if (cleaned.logSheetBase64 && cleaned.logSheetBase64.length > 600 * 1024) {
        cleaned.logSheetBase64 = null;
        cleaned.notes = (cleaned.notes || '') + " (Attachment auto-removed: original file exceeded safe real-time sync limit)";
      }
      batch.set(doc(db, LOGS_COLL, log.id), cleaned);
    });
    try {
      await batch.commit();
    } catch (batchErr) {
      console.warn("Logs batch write failed. Retrying with individual writes:", batchErr);
      for (const log of chunk) {
        try {
          const cleaned = { ...log };
          if (cleaned.logSheetBase64 && cleaned.logSheetBase64.length > 600 * 1024) {
            cleaned.logSheetBase64 = null;
            cleaned.notes = (cleaned.notes || '') + " (Attachment auto-removed: original file exceeded safe real-time sync limit)";
          }
          await setDoc(doc(db, LOGS_COLL, log.id), cleaned);
        } catch (indivErr) {
          console.error(`Individual log save failed for ${log.id}:`, indivErr);
        }
      }
    }
  }
}

export async function saveDeliveriesInBatchToDB(deliveries: (DieselDelivery & { companyId: string })[]): Promise<void> {
  if (deliveries.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < deliveries.length; i += chunkSize) {
    const chunk = deliveries.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((delivery) => {
      const cleaned = { ...delivery };
      if (cleaned.attachmentBase64 && cleaned.attachmentBase64.length > 600 * 1024) {
        cleaned.attachmentBase64 = null;
        cleaned.deliveryNote = (cleaned.deliveryNote || '') + " (Attachment auto-removed: original file exceeded safe real-time sync limit)";
      }
      batch.set(doc(db, DELIVERIES_COLL, delivery.id), cleaned);
    });
    try {
      await batch.commit();
    } catch (batchErr) {
      console.warn("Deliveries batch write failed. Retrying with individual writes:", batchErr);
      for (const delivery of chunk) {
        try {
          const cleaned = { ...delivery };
          if (cleaned.attachmentBase64 && cleaned.attachmentBase64.length > 600 * 1024) {
            cleaned.attachmentBase64 = null;
            cleaned.deliveryNote = (cleaned.deliveryNote || '') + " (Attachment auto-removed: original file exceeded safe real-time sync limit)";
          }
          await setDoc(doc(db, DELIVERIES_COLL, delivery.id), cleaned);
        } catch (indivErr) {
          console.error(`Individual delivery save failed for ${delivery.id}:`, indivErr);
        }
      }
    }
  }
}



