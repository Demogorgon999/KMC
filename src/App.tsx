/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HardHat, Layers, BarChart3, LogOut, Shield, X, ChevronDown, Building2, Plus, Check } from 'lucide-react';
import { ConstructionSite, DieselLog, User, DieselDelivery, CompanyProfile, MonthlyDieselRate } from './types';
import { DEFAULT_SITES, DEFAULT_LOGS, DEFAULT_DELIVERIES, DEFAULT_COMPANIES } from './data';
import AgentTerminal from './components/AgentTerminal';
import SiteManager from './components/SiteManager';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AccessControl from './components/AccessControl';
import AuthScreen from './components/AuthScreen';
import KMCLogo from './components/KMCLogo';
import DeveloperHub from './components/DeveloperHub';
import { 
  getSitesFromDB, 
  getLogsFromDB, 
  getDeliveriesFromDB, 
  saveSiteToDB, 
  saveLogToDB, 
  deleteLogFromDB, 
  saveDeliveryToDB, 
  deleteDeliveryFromDB, 
  overrideDeliveryInDB, 
  updateSiteStatusInDB, 
  resetCompanyDataInDB, 
  seedTestDataInDB,
  subscribeToSitesInDB,
  subscribeToLogsInDB,
  subscribeToDeliveriesInDB,
  getRatesFromDB,
  saveRateToDB,
  subscribeToRatesInDB,
  saveSitesInBatchToDB,
  saveLogsInBatchToDB,
  saveDeliveriesInBatchToDB
} from './lib/firebase';

export default function App() {
  // Main states
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const userRaw = localStorage.getItem('apex_diesel_current_user');
      return userRaw ? JSON.parse(userRaw) : null;
    } catch {
      return null;
    }
  });

  const isDeveloper = currentUser && [
    'deanv.d.merwe91@gmail.com',
    'deanv.dmerwe91@gmail.com'
  ].includes(currentUser.email?.toLowerCase().trim());

  // Dynamic Tenant & Company States
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => {
    try {
      const stored = localStorage.getItem('apex_diesel_companies');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignored
    }
    return DEFAULT_COMPANIES;
  });

  const [activeCompany, setActiveCompany] = useState<CompanyProfile>(() => {
    try {
      const storedActiveId = localStorage.getItem('apex_diesel_active_company_id');
      const storedCompanies = localStorage.getItem('apex_diesel_companies');
      const currentList: CompanyProfile[] = storedCompanies ? JSON.parse(storedCompanies) : DEFAULT_COMPANIES;
      if (storedActiveId) {
        const found = currentList.find(c => c.id === storedActiveId);
        if (found) return found;
      }
    } catch {
      // Ignored
    }
    return DEFAULT_COMPANIES[0];
  });

  const activeCompanyIdRef = useRef(activeCompany.id);
  useEffect(() => {
    activeCompanyIdRef.current = activeCompany.id;
  }, [activeCompany.id]);

  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [logs, setLogs] = useState<DieselLog[]>([]);
  const [deliveries, setDeliveries] = useState<DieselDelivery[]>([]);
  const [dieselRates, setDieselRates] = useState<MonthlyDieselRate[]>([]);
  const [activeTab, setActiveTab] = useState<'agent' | 'sites' | 'analytics' | 'users'>('agent');
  const [appInitialized, setAppInitialized] = useState(false);
  const [firestoreSyncStatus, setFirestoreSyncStatus] = useState<'connecting' | 'synced' | 'offline'>('connecting');

  // Real-time server state sync, heartbeats and live toast variables
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [consoleEvents, setConsoleEvents] = useState<any[]>([]);
  const [liveNotification, setLiveNotification] = useState<{ message: string; timestamp: Date } | null>(null);

  // Periodic heartbeat reporting
  useEffect(() => {
    if (!currentUser) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/active-users/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.name,
            role: currentUser.role
          })
        });
      } catch (err) {
        console.warn("Heartbeat reporting temporarily unavailable (server restarting or offline):", err);
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [currentUser]);

  // Handle Server-Sent Events (SSE) stream for real-time broadcasts
  useEffect(() => {
    if (!currentUser) return;

    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { type, data } = payload;

        if (data && data.companyId && data.companyId !== activeCompanyIdRef.current) {
          return; // Strictly isolate tenant event broadcasts
        }

        if (type === 'initial_active_users' || type === 'active_users') {
          setActiveUsers(data.users);
        } else if (type === 'initial_console_events') {
          setConsoleEvents(data.events);
        } else if (type === 'console_event') {
          setConsoleEvents((prev) => [data, ...prev].slice(0, 50));
        } else if (type === 'log_added') {
          if (!data.log || !data.log.id || !data.log.id.startsWith('log-')) return;
          setLogs((prev) => {
            const exists = prev.some(l => l.id === data.log.id);
            if (exists) return prev;
            const updated = [data.log, ...prev];
            const compId = activeCompanyIdRef.current;
            localStorage.setItem(`apex_diesel_logs_${compId}`, JSON.stringify(updated));
            if (compId === 'company-kmc') {
              localStorage.setItem('apex_diesel_logs', JSON.stringify(updated));
            }
            setLiveNotification({
              message: `Live Diesel Log Added: ${data.log.agentName} captured ${data.log.quantityLitres}L for fleet ${data.log.vehicleNumber}.`,
              timestamp: new Date()
            });
            return updated;
          });
        } else if (type === 'log_deleted') {
          setLogs((prev) => {
            const updated = prev.filter(l => l.id !== data.logId);
            const compId = activeCompanyIdRef.current;
            localStorage.setItem(`apex_diesel_logs_${compId}`, JSON.stringify(updated));
            if (compId === 'company-kmc') {
              localStorage.setItem('apex_diesel_logs', JSON.stringify(updated));
            }
            return updated;
          });
        } else if (type === 'delivery_added') {
          setDeliveries((prev) => {
            const exists = prev.some(d => d.id === data.delivery.id);
            if (exists) return prev;
            const updated = [data.delivery, ...prev];
            const compId = activeCompanyIdRef.current;
            localStorage.setItem(`apex_diesel_deliveries_${compId}`, JSON.stringify(updated));
            if (compId === 'company-kmc') {
              localStorage.setItem('apex_diesel_deliveries', JSON.stringify(updated));
            }
            setLiveNotification({
              message: `Live Diesel Delivery Added: ${data.delivery.agentName} captured ${data.delivery.quantityLitres}L of delivered fuel from ${data.delivery.deliveredBy}.`,
              timestamp: new Date()
            });
            return updated;
          });
        } else if (type === 'delivery_deleted') {
          setDeliveries((prev) => {
            const updated = prev.filter(d => d.id !== data.deliveryId);
            const compId = activeCompanyIdRef.current;
            localStorage.setItem(`apex_diesel_deliveries_${compId}`, JSON.stringify(updated));
            if (compId === 'company-kmc') {
              localStorage.setItem('apex_diesel_deliveries', JSON.stringify(updated));
            }
            return updated;
          });
        } else if (type === 'delivery_overridden') {
          setDeliveries((prev) => {
            const updated = prev.map(d => {
              if (d.id === data.deliveryId) {
                return {
                  ...d,
                  isOverridden: true,
                  overrideReason: data.reason,
                  overriddenBy: data.userName || 'Management'
                };
              }
              return d;
            });
            const compId = activeCompanyIdRef.current;
            localStorage.setItem(`apex_diesel_deliveries_${compId}`, JSON.stringify(updated));
            if (compId === 'company-kmc') {
              localStorage.setItem('apex_diesel_deliveries', JSON.stringify(updated));
            }
            return updated;
          });
        } else if (type === 'site_added') {
          setSites((prev) => {
            const exists = prev.some(s => s.id === data.site.id);
            if (exists) return prev;
            const updated = [...prev, data.site];
            const compId = activeCompanyIdRef.current;
            localStorage.setItem(`apex_diesel_sites_${compId}`, JSON.stringify(updated));
            if (compId === 'company-kmc') {
              localStorage.setItem('apex_diesel_sites', JSON.stringify(updated));
            }
            setLiveNotification({
              message: `Live Project Site Added: '${data.site.name}' (${data.site.code}) is now active.`,
              timestamp: new Date()
            });
            return updated;
          });
        } else if (type === 'site_toggled') {
          setSites((prev) => {
            const updated = prev.map(s => {
              if (s.id === data.siteId) {
                return {
                  ...s,
                  status: data.status,
                  closedAt: data.status === 'closed' ? new Date().toISOString() : null,
                };
              }
              return s;
            });
            const compId = activeCompanyIdRef.current;
            localStorage.setItem(`apex_diesel_sites_${compId}`, JSON.stringify(updated));
            if (compId === 'company-kmc') {
              localStorage.setItem('apex_diesel_sites', JSON.stringify(updated));
            }
            return updated;
          });
        } else if (type === 'state_reset') {
          setSites(DEFAULT_SITES);
          setLogs(DEFAULT_LOGS);
          setDeliveries(DEFAULT_DELIVERIES);
          const compId = activeCompanyIdRef.current;
          localStorage.setItem(`apex_diesel_sites_${compId}`, JSON.stringify(DEFAULT_SITES));
          localStorage.setItem(`apex_diesel_logs_${compId}`, JSON.stringify(DEFAULT_LOGS));
          localStorage.setItem(`apex_diesel_deliveries_${compId}`, JSON.stringify(DEFAULT_DELIVERIES));
          if (compId === 'company-kmc') {
            localStorage.setItem('apex_diesel_sites', JSON.stringify(DEFAULT_SITES));
            localStorage.setItem('apex_diesel_logs', JSON.stringify(DEFAULT_LOGS));
            localStorage.setItem('apex_diesel_deliveries', JSON.stringify(DEFAULT_DELIVERIES));
          }
          setLiveNotification({
            message: "Ledger databases reverted to standard factory templates.",
            timestamp: new Date()
          });
        } else if (type === 'test_data_loaded') {
          handleLoadTestDataLocally(true);
        }
      } catch (err) {
        console.error("Error parsing real-time server payload:", err);
      }
    };

    eventSource.onerror = (err) => {
      // Gracefully log telemetry link reconnection attempt (an expected behavior during container sleep/reboot intervals)
      console.log("Telemetry stream re-establishing in background... (Native live Firestore synchronization is active and unaffected).", err);
    };

    return () => {
      eventSource.close();
    };
  }, [currentUser]);

  // Lock active corporate context to logged in user's company to guarantee absolute privacy
  useEffect(() => {
    if (currentUser && currentUser.companyId && !isDeveloper) {
      const matched = companies.find(c => c.id === currentUser.companyId);
      if (matched && matched.id !== activeCompany.id) {
        setActiveCompany(matched);
        localStorage.setItem('apex_diesel_active_company_id', matched.id);
      }
    }
  }, [currentUser, companies, activeCompany.id, isDeveloper]);

  // Dismiss notifications
  useEffect(() => {
    if (liveNotification) {
      const t = setTimeout(() => {
        setLiveNotification(null);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [liveNotification]);

  // Load from database and synchronize with central ledger server whenever activeCompany changes
  useEffect(() => {
    let active = true;
    const companyId = activeCompany.id;

    let parsedSites: ConstructionSite[] = [];
    let parsedLogs: DieselLog[] = [];
    let parsedDeliveries: DieselDelivery[] = [];
    let parsedRates: MonthlyDieselRate[] = [];

    // 1. Instantly pull and load existing client data from localStorage for near-zero startup latency
    try {
      const storedSites = localStorage.getItem(`apex_diesel_sites_${companyId}`);
      const storedLogs = localStorage.getItem(`apex_diesel_logs_${companyId}`);
      const storedDeliveries = localStorage.getItem(`apex_diesel_deliveries_${companyId}`);

      parsedSites = storedSites ? JSON.parse(storedSites) : [];
      parsedLogs = storedLogs ? JSON.parse(storedLogs) : [];
      parsedDeliveries = storedDeliveries ? JSON.parse(storedDeliveries) : [];

      if (companyId === 'company-kmc') {
        const legacySites = localStorage.getItem('apex_diesel_sites');
        const legacyLogs = localStorage.getItem('apex_diesel_logs');
        const legacyDeliveries = localStorage.getItem('apex_diesel_deliveries');
        
        if (legacySites && parsedSites.length === 0) {
          try { parsedSites = JSON.parse(legacySites); } catch {}
        }
        if (legacyLogs && parsedLogs.length === 0) {
          try { parsedLogs = JSON.parse(legacyLogs); } catch {}
        }
        if (legacyDeliveries && parsedDeliveries.length === 0) {
          try { parsedDeliveries = JSON.parse(legacyDeliveries); } catch {}
        }
      }

      if (parsedSites.length > 0) setSites(parsedSites);
      parsedLogs = parsedLogs.filter(l => l && l.id && l.id.startsWith('log-'));
      if (parsedLogs.length > 0) setLogs(parsedLogs);
      if (parsedDeliveries.length > 0) setDeliveries(parsedDeliveries);

      const storedRates = localStorage.getItem(`apex_diesel_rates_${companyId}`);
      if (storedRates) {
        try {
          parsedRates = JSON.parse(storedRates);
          if (parsedRates.length > 0) {
            setDieselRates(parsedRates);
          }
        } catch {}
      }
    } catch (e) {
      console.error("Failed to load records from client storage:", e);
    }

    let unsubSites: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;
    let unsubDeliveries: (() => void) | null = null;
    let unsubRates: (() => void) | null = null;

    // 2. Enable fully-live, real-time reactive Firestore listeners for ultimate multi-session sync
    // We launch these IMMEDIATELY so we catch every live change in real-time right from boot-up!
    unsubSites = subscribeToSitesInDB(companyId, (dbSites) => {
      if (!active) return;
      setSites(dbSites);
      setFirestoreSyncStatus('synced');
      localStorage.setItem(`apex_diesel_sites_${companyId}`, JSON.stringify(dbSites));
      if (companyId === 'company-kmc') {
        localStorage.setItem('apex_diesel_sites', JSON.stringify(dbSites));
      }
    });

    unsubLogs = subscribeToLogsInDB(companyId, (dbLogs) => {
      if (!active) return;
      const filteredDbLogs = dbLogs.filter(l => l && l.id && l.id.startsWith('log-'));
      const sortedLogs = filteredDbLogs.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      setLogs(sortedLogs);
      setFirestoreSyncStatus('synced');
      localStorage.setItem(`apex_diesel_logs_${companyId}`, JSON.stringify(sortedLogs));
      if (companyId === 'company-kmc') {
        localStorage.setItem('apex_diesel_logs', JSON.stringify(sortedLogs));
      }
    });

    unsubDeliveries = subscribeToDeliveriesInDB(companyId, (dbDeliveries) => {
      if (!active) return;
      const sortedDeliveries = dbDeliveries.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      setDeliveries(sortedDeliveries);
      setFirestoreSyncStatus('synced');
      localStorage.setItem(`apex_diesel_deliveries_${companyId}`, JSON.stringify(sortedDeliveries));
      if (companyId === 'company-kmc') {
        localStorage.setItem('apex_diesel_deliveries', JSON.stringify(sortedDeliveries));
      }
    });

    unsubRates = subscribeToRatesInDB(companyId, (dbRates) => {
      if (!active) return;
      setDieselRates(dbRates);
      setFirestoreSyncStatus('synced');
      localStorage.setItem(`apex_diesel_rates_${companyId}`, JSON.stringify(dbRates));
    });

    // 3. Fetch ground-truth records from Firestore directly and sync in background
    const loadAndSynchronizeDB = async () => {
      try {
        const dbSites = await getSitesFromDB(companyId);
        const dbLogs = await getLogsFromDB(companyId);
        const dbDeliveries = await getDeliveriesFromDB(companyId);
        const dbRates = await getRatesFromDB(companyId);

        if (!active) return;

        // Fetch server-side master JSON file backup data to self-heal and restore Firestore if it got reset/deleted
        let serverSites: ConstructionSite[] = [];
        let serverLogs: DieselLog[] = [];
        let serverDeliveries: DieselDelivery[] = [];
        try {
          const srvRes = await fetch(`/api/sync/data?companyId=${companyId}`);
          if (srvRes.ok) {
            const srvData = await srvRes.json();
            serverSites = srvData.sites || [];
            serverLogs = srvData.logs || [];
            serverDeliveries = srvData.deliveries || [];
          }
        } catch (srvErr) {
          console.warn("Failed to fetch server master backup during sync:", srvErr);
        }

        // Identify items present in server master ledger file but completely missing in Firestore database
        const missingInDBSites = serverSites.filter(srv => !dbSites.some(db => db.id === srv.id));
        const missingInDBLogs = serverLogs.filter(srv => !dbLogs.some(db => db.id === srv.id));
        const missingInDBDeliveries = serverDeliveries.filter(srv => !dbDeliveries.some(db => db.id === srv.id));

        let didHealFirestore = false;
        if (missingInDBSites.length > 0) {
          didHealFirestore = true;
          await saveSitesInBatchToDB(missingInDBSites.map(s => ({ ...s, companyId })));
        }
        if (missingInDBLogs.length > 0) {
          didHealFirestore = true;
          await saveLogsInBatchToDB(missingInDBLogs.map(l => ({ ...l, companyId })));
        }
        if (missingInDBDeliveries.length > 0) {
          didHealFirestore = true;
          await saveDeliveriesInBatchToDB(missingInDBDeliveries.map(d => ({ ...d, companyId })));
        }

        // If Firestore had to be healed, refetch ground-truth
        let currentDBSites = dbSites;
        let currentDBLogs = dbLogs;
        let currentDBDeliveries = dbDeliveries;
        if (didHealFirestore) {
          currentDBSites = await getSitesFromDB(companyId);
          currentDBLogs = await getLogsFromDB(companyId);
          currentDBDeliveries = await getDeliveriesFromDB(companyId);
        }

        // Perform bidirectional offline-first merging:
        // Find local-only items that are present in client's local states but absent in central database
        const localOnlySites = parsedSites.filter(local => !currentDBSites.some(db => db.id === local.id));
        const localOnlyLogs = parsedLogs.filter(local => !currentDBLogs.some(db => db.id === local.id));
        const localOnlyDeliveries = parsedDeliveries.filter(local => !currentDBDeliveries.some(db => db.id === local.id));
        const localOnlyRates = parsedRates.filter(local => !dbRates.some(db => db.id === local.id));

        let didUploadLocal = false;

        if (localOnlySites.length > 0) {
          didUploadLocal = true;
          await saveSitesInBatchToDB(localOnlySites.map(s => ({ ...s, companyId })));
        }

        if (localOnlyLogs.length > 0) {
          didUploadLocal = true;
          await saveLogsInBatchToDB(localOnlyLogs.map(l => ({ ...l, companyId })));
        }

        if (localOnlyDeliveries.length > 0) {
          didUploadLocal = true;
          await saveDeliveriesInBatchToDB(localOnlyDeliveries.map(d => ({ ...d, companyId })));
        }

        if (localOnlyRates.length > 0) {
          didUploadLocal = true;
          for (const r of localOnlyRates) {
            await saveRateToDB({ ...r, companyId });
          }
        }

        let finalSites = currentDBSites;
        let finalLogs = currentDBLogs;
        let finalDeliveries = currentDBDeliveries;
        let finalRates = dbRates;

        // If local data was updated online, refetch to acquire the fully authenticated central dataset
        if (didUploadLocal || didHealFirestore) {
          finalSites = await getSitesFromDB(companyId);
          finalLogs = await getLogsFromDB(companyId);
          finalDeliveries = await getDeliveriesFromDB(companyId);
          finalRates = await getRatesFromDB(companyId);

          const syncUserName = currentUser ? currentUser.name : "Yolandie Bezuidenhoudt";
          const countsText = `${localOnlySites.length + missingInDBSites.length} sites, ${localOnlyLogs.length + missingInDBLogs.length} logs, ${localOnlyDeliveries.length + missingInDBDeliveries.length} deliveries, ${localOnlyRates.length} rates`;

          // Log the synchronized upload to the Developer HUB event ticker.
          fetch('/api/sync/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              log: {
                id: `sync-log-${Date.now()}`,
                companyId,
                siteId: 'all',
                quantityLitres: 0,
                vehicleNumber: 'N/A',
                dateTime: new Date().toISOString(),
                agentName: syncUserName,
                notes: `Synchronized offline browser data and restored server-backup to Firebase: ${countsText}`,
                createdAt: new Date().toISOString()
              },
              userName: `Sync Service: Merged and persistent-uploaded offline/server-backup data from ${syncUserName}'s browser (${countsText}) to Firestore`,
              companyId
            })
          }).catch(() => {});
        }

        // Re-verify ordering: newest entries first
        const sortedLogs = finalLogs.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        const sortedDeliveries = finalDeliveries.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

        // Notify server SSE hub of complete merged data
        await fetch(`/api/sync/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            sites: finalSites,
            logs: sortedLogs,
            deliveries: sortedDeliveries
          })
        });

        if (active) {
          setFirestoreSyncStatus('synced');
        }
      } catch (err) {
        console.warn("Central sync unreachable. Portal performing in offline-first mode.", err);
        if (active) {
          setFirestoreSyncStatus('offline');
        }
      } finally {
        if (active) {
          setAppInitialized(true);
        }
      }
    };

    loadAndSynchronizeDB();

    const handleOnlineStatusChange = () => {
      if (window.navigator.onLine && active) {
        setFirestoreSyncStatus('syncing');
        loadAndSynchronizeDB();
      }
    };
    window.addEventListener('online', handleOnlineStatusChange);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnlineStatusChange);
      if (unsubSites) unsubSites();
      if (unsubLogs) unsubLogs();
      if (unsubDeliveries) unsubDeliveries();
      if (unsubRates) unsubRates();
    };
  }, [activeCompany.id]);

  // Write changes to localStorage whenever sites, logs or deliveries update
  const saveSitesToStorage = (updatedSites: ConstructionSite[]) => {
    setSites(updatedSites);
    localStorage.setItem(`apex_diesel_sites_${activeCompany.id}`, JSON.stringify(updatedSites));
    if (activeCompany.id === 'company-kmc') {
      localStorage.setItem('apex_diesel_sites', JSON.stringify(updatedSites));
    }
  };

  const saveLogsToStorage = (updatedLogs: DieselLog[]) => {
    setLogs(updatedLogs);
    localStorage.setItem(`apex_diesel_logs_${activeCompany.id}`, JSON.stringify(updatedLogs));
    if (activeCompany.id === 'company-kmc') {
      localStorage.setItem('apex_diesel_logs', JSON.stringify(updatedLogs));
    }
  };

  const saveDeliveriesToStorage = (updatedDeliveries: DieselDelivery[]) => {
    setDeliveries(updatedDeliveries);
    localStorage.setItem(`apex_diesel_deliveries_${activeCompany.id}`, JSON.stringify(updatedDeliveries));
    if (activeCompany.id === 'company-kmc') {
      localStorage.setItem('apex_diesel_deliveries', JSON.stringify(updatedDeliveries));
    }
  };

  // Add diesel consumption log
  const handleAddLog = async (newLogData: Omit<DieselLog, 'id' | 'createdAt'>) => {
    const timestamp = new Date().toISOString();
    const newLog: DieselLog = {
      ...newLogData,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: timestamp,
    };
    const updated = [newLog, ...logs];
    saveLogsToStorage(updated);

    try {
      // Save directly to Firestore Database
      await saveLogToDB({ ...newLog, companyId: activeCompany.id });

      await fetch('/api/sync/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: newLog, userName: currentUser?.name, companyId: activeCompany.id })
      });
    } catch (e) {
      console.error("SSE sync log transfer failed:", e);
    }
  };

  // Add diesel consumption logs in batch
  const handleAddLogsBatch = async (newLogsData: Omit<DieselLog, 'id' | 'createdAt'>[]) => {
    const timestamp = new Date().toISOString();
    const newLogs: DieselLog[] = newLogsData.map((logData, idx) => ({
      ...logData,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}-${idx}`,
      createdAt: timestamp,
    }));

    const updated = [...newLogs, ...logs];
    saveLogsToStorage(updated);

    try {
      // Save directly to Firestore Database in batch
      await saveLogsInBatchToDB(newLogs.map(l => ({ ...l, companyId: activeCompany.id })));

      await fetch('/api/sync/logs-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: newLogs, userName: currentUser?.name, companyId: activeCompany.id })
      });
    } catch (e) {
      console.error("SSE sync logs batch transfer failed:", e);
    }
  };

  // Add or update diesel rate with effective date
  const handleUpdateDieselRate = async (effectiveDate: string, price: number) => {
    if (!currentUser) return;
    const rateId = `${activeCompany.id}_${effectiveDate}`;
    const newRate: MonthlyDieselRate = {
      id: rateId,
      companyId: activeCompany.id,
      effectiveDate,
      rate: price,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name
    };

    const updatedRates = [newRate, ...dieselRates.filter(r => r.id !== rateId)];
    setDieselRates(updatedRates);
    localStorage.setItem(`apex_diesel_rates_${activeCompany.id}`, JSON.stringify(updatedRates));

    try {
      await saveRateToDB(newRate);

      await fetch('/api/sync/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log: {
            id: `rate-update-${Date.now()}`,
            companyId: activeCompany.id,
            siteId: 'all',
            quantityLitres: 0,
            vehicleNumber: 'N/A',
            dateTime: new Date().toISOString(),
            agentName: currentUser.name,
            notes: `Adjusted Diesel Rate (effective ${effectiveDate}) to R ${price.toFixed(2)}/L`,
            createdAt: new Date().toISOString()
          },
          userName: `Cost Control: ${currentUser.name} adjusted the diesel rate (effective ${effectiveDate}) to R ${price.toFixed(2)}/L`,
          companyId: activeCompany.id
        })
      });
    } catch (err) {
      console.error("Failed to update diesel rate:", err);
    }
  };

  // Add diesel delivery log
  const handleAddDelivery = async (newDeliveryData: Omit<DieselDelivery, 'id' | 'createdAt' | 'isOverridden'>) => {
    const timestamp = new Date().toISOString();
    const newDelivery: DieselDelivery = {
      ...newDeliveryData,
      id: `delivery-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: timestamp,
      isOverridden: false
    };
    const updated = [newDelivery, ...deliveries];
    saveDeliveriesToStorage(updated);

    try {
      // Save directly to Firestore Database
      await saveDeliveryToDB({ ...newDelivery, companyId: activeCompany.id });

      await fetch('/api/sync/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery: newDelivery, userName: currentUser?.name, companyId: activeCompany.id })
      });
    } catch (e) {
      console.error("SSE sync delivery transfer failed:", e);
    }
  };

  // Delete diesel delivery
  const handleDeleteDelivery = async (deliveryId: string) => {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;
    const siteName = sites.find(s => s.id === delivery.siteId)?.name || 'Unknown';

    const updated = deliveries.filter(d => d.id !== deliveryId);
    saveDeliveriesToStorage(updated);

    try {
      // Delete directly from Firestore Database
      await deleteDeliveryFromDB(deliveryId);

      await fetch('/api/sync/delete-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryId,
          userName: currentUser?.name,
          siteName,
          quantity: delivery.quantityLitres,
          deliveredBy: delivery.deliveredBy,
          companyId: activeCompany.id
         })
       });
     } catch (e) {
       console.error("SSE delivery delete notice failed:", e);
     }
  };

  // Review & accept override for a diesel delivery margin
  const handleOverrideDelivery = async (deliveryId: string, reason: string) => {
    const updated = deliveries.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          isOverridden: true,
          overrideReason: reason,
          overriddenBy: currentUser?.name || 'Management Office'
        };
      }
      return d;
    });
    saveDeliveriesToStorage(updated);

    try {
      // Update directly in Firestore Database
      await overrideDeliveryInDB(deliveryId, reason, currentUser?.name || 'Management Office');

      await fetch('/api/sync/override-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryId,
          userName: currentUser?.name,
          reason,
          companyId: activeCompany.id
        })
      });
    } catch (e) {
      console.error("SSE override notice failed:", e);
    }
  };

  // Add a new construction site
  const handleAddSite = async (siteData: Omit<ConstructionSite, 'id' | 'createdAt' | 'closedAt' | 'status'>) => {
    const newSite: ConstructionSite = {
      ...siteData,
      id: `site-${Date.now()}`,
      status: 'active',
      createdAt: new Date().toISOString(),
      closedAt: null,
    };
    const updated = [...sites, newSite];
    saveSitesToStorage(updated);

    try {
      // Save directly to Firestore Database
      await saveSiteToDB({ ...newSite, companyId: activeCompany.id });

      await fetch('/api/sync/site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: newSite, userName: currentUser?.name, companyId: activeCompany.id })
      });
    } catch (e) {
      console.error("SSE sync site transfer failed:", e);
    }
  };

  // Toggle active/closed status of a site (Close off or Reopen)
  const handleToggleSiteStatus = async (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const newStatus = site.status === 'active' ? 'closed' : 'active';
    const closedAt = newStatus === 'closed' ? new Date().toISOString() : null;

    const updated = sites.map((s) => {
      if (s.id === siteId) {
        return {
          ...s,
          status: newStatus as 'active' | 'closed',
          closedAt,
        };
      }
      return s;
    });
    saveSitesToStorage(updated);

    try {
      // Update directly in Firestore Database
      await updateSiteStatusInDB(siteId, newStatus, closedAt);

      await fetch('/api/sync/toggle-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          siteName: site.name,
          status: newStatus,
          userName: currentUser?.name,
          companyId: activeCompany.id
        })
      });
    } catch (e) {
      console.error("SSE sync state write failed:", e);
    }
  };

  // Delete an erroneous log entry
  const handleDeleteLog = async (logId: string) => {
    const log = logs.find(l => l.id === logId);
    if (!log) return;
    const siteName = sites.find(s => s.id === log.siteId)?.name || 'Unknown';

    const updated = logs.filter((l) => l.id !== logId);
    saveLogsToStorage(updated);

    try {
      // Delete directly from Firestore Database
      await deleteLogFromDB(logId);

      await fetch('/api/sync/delete-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logId,
          userName: currentUser?.name,
          siteName,
          vehicleNumber: log.vehicleNumber,
          quantity: log.quantityLitres,
          companyId: activeCompany.id
        })
      });
    } catch (e) {
      console.error("SSE expunge notification failed:", e);
    }
  };

  // Completely reset databases to standard demo templates
  const handleResetData = async () => {
    setSites(DEFAULT_SITES);
    setLogs(DEFAULT_LOGS);
    setDeliveries(DEFAULT_DELIVERIES);
    localStorage.setItem('apex_diesel_sites', JSON.stringify(DEFAULT_SITES));
    localStorage.setItem('apex_diesel_logs', JSON.stringify(DEFAULT_LOGS));
    localStorage.setItem('apex_diesel_deliveries', JSON.stringify(DEFAULT_DELIVERIES));

    try {
      // Purge and Seed directly in Firestore Database
      await resetCompanyDataInDB(activeCompany.id);
      await seedTestDataInDB(activeCompany.id, DEFAULT_SITES, DEFAULT_LOGS);

      await fetch('/api/sync/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: currentUser?.name, companyId: activeCompany.id })
      });
    } catch (e) {
      console.error("Database purge notification failed:", e);
    }
  };

  const handleRefreshData = async () => {
    try {
      const companyId = activeCompany?.id || "company-kmc";
      const srvRes = await fetch(`/api/sync/data?companyId=${companyId}`);
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        const serverLogs = srvData.logs || [];
        const serverDeliveries = srvData.deliveries || [];
        setLogs(serverLogs);
        setDeliveries(serverDeliveries);
        localStorage.setItem(`apex_diesel_logs_${companyId}`, JSON.stringify(serverLogs));
        localStorage.setItem(`apex_diesel_deliveries_${companyId}`, JSON.stringify(serverDeliveries));
        if (companyId === 'company-kmc') {
          localStorage.setItem('apex_diesel_logs', JSON.stringify(serverLogs));
          localStorage.setItem('apex_diesel_deliveries', JSON.stringify(serverDeliveries));
        }
      }
    } catch (err) {
      console.error("Failed to refresh data after balancing:", err);
    }
  };

  // Generate 100 high-fidelity test records for manager sheets and charts auditing
  const handleLoadTestDataLocally = (skipPost?: boolean) => {
    let targetSites = [...sites];
    if (targetSites.filter(s => s.status === 'active').length === 0) {
      targetSites = [
        {
          id: 'site-test-1',
          name: 'Sandton Gateway Interchange',
          code: 'SGI-205',
          location: 'Johannesburg, Gauteng',
          status: 'active',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          closedAt: null
        },
        {
          id: 'site-test-2',
          name: 'N2 Durban Port Expansion',
          code: 'DPE-408',
          location: 'Durban, KwaZulu-Natal',
          status: 'active',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          closedAt: null
        },
        {
          id: 'site-test-3',
          name: 'Coega Industrial Salt Bypass',
          code: 'CIB-102',
          location: 'Gqeberha, Eastern Cape',
          status: 'active',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          closedAt: null
        },
        {
          id: 'site-test-4',
          name: 'Cape Town Airport Flyover',
          code: 'CAF-309',
          location: 'Cape Town, Western Cape',
          status: 'active',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          closedAt: null
        }
      ];
      saveSitesToStorage(targetSites);
    }

    const generatedLogs: DieselLog[] = [];
    const vehicles = [
      'CAT-401X', 'CAT-220B', 'KOMATSU-D9', 'VOLVO-FH16', 'ACTROS-3344', 
      'BELL-B40E', 'HITACHI-EX200', 'BOBCAT-S450', 'LIEBHERR-920', 'SCANIA-G460'
    ];
    const agents = ['Marcus Vance', 'Lesego Ndlovu', 'Sipho Zuma', 'Sarah Jenkins', 'Devon Naidoo'];
    const logFnames = [
      'kmc_logsheet_0521.jpg', 'd_sheet_sandton_v2.pdf', 'coega_refuel_signed.jpg', 
      'port_log_fleet_scanned.png', 'airport_refuel_page3.pdf'
    ];
    const fuelNotes = [
      'Standard end of shift status top-up.',
      'Primary engine filter replaced, refueled.',
      'Completed overnight haul run refuel.',
      'Dual tank reserve filled to maximum capacity.',
      'Fuel quality benchmark safety checked and logged.',
      'Authorized project team operations bulk fill.',
      'Routine diesel top-up for heavy compaction grader.',
      'Under supervision site fuel dispatch.'
    ];

    const now = Date.now();
    for (let i = 0; i < 100; i++) {
      const daysAgo = Math.random() * 30;
      const hoursAgo = Math.random() * 24;
      const logTime = new Date(now - (daysAgo * 24 + hoursAgo) * 60 * 60 * 1000);
      
      const randomSite = targetSites[Math.floor(Math.random() * targetSites.length)];
      const randomQuantity = Math.floor(60 + Math.random() * 340);
      const randomVehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      const randomNotes = fuelNotes[Math.floor(Math.random() * fuelNotes.length)];
      
      const hasAttachment = Math.random() < 0.6;
      const logFilename = hasAttachment ? logFnames[Math.floor(Math.random() * logFnames.length)] : null;
      const logBase64 = hasAttachment ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkQA8AAM0AN/Z/FkwAAAAASUVORK5CYII=' : null;

      const meterVal = Math.floor(800 + Math.random() * 45000);
      const randomMeter = Math.random() < 0.25
        ? `${Math.floor(meterVal / 100)} hrs`
        : `${meterVal} km`;

      generatedLogs.push({
        id: `log-test-${1000 + i}`,
        siteId: randomSite.id,
        quantityLitres: randomQuantity,
        vehicleNumber: randomVehicle,
        vehicleMeterReading: randomMeter,
        dateTime: logTime.toISOString(),
        agentName: randomAgent,
        logSheetFilename: logFilename,
        logSheetBase64: logBase64,
        notes: randomNotes,
        createdAt: logTime.toISOString()
      });
    }

    generatedLogs.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    saveLogsToStorage(generatedLogs);

    if (!skipPost) {
      // Seed directly in Firestore Database
      seedTestDataInDB(activeCompany.id, targetSites, generatedLogs).catch(console.error);

      fetch('/api/sync/load-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sites: targetSites,
          logs: generatedLogs,
          deliveries: [],
          userName: currentUser?.name,
          companyId: activeCompany.id
        })
      }).catch(err => console.error(err));
    }
  };

  const handleLoadTestData = () => {
    handleLoadTestDataLocally(false);
  };

  // Redirect agents if they attempt to view unauthorized tabs
  useEffect(() => {
    if (currentUser?.role === 'agent' && activeTab !== 'agent') {
      setActiveTab('agent');
    }
  }, [currentUser, activeTab]);

  const handleLogout = async () => {
    if (currentUser) {
      try {
        await fetch('/api/active-users/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentUser.email, name: currentUser.name })
        });
      } catch (err) {
        // Ignored
      }
    }
    localStorage.removeItem('apex_diesel_current_user');
    setCurrentUser(null);
  };

  const handleUserSync = () => {
    try {
      const userRaw = localStorage.getItem('apex_diesel_current_user');
      if (userRaw) {
        setCurrentUser(JSON.parse(userRaw));
      }
    } catch {
      // Ignore
    }
  };

  if (!appInitialized) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <KMCLogo className="h-16 justify-center" />
          <div className="h-8 w-8 border-3 border-[#E5B830] border-t-transparent rounded-full animate-spin mx-auto mt-4" />
          <p className="font-mono text-sm text-zinc-400 uppercase tracking-[0.2em] mt-2 font-bold">Loading KMC Ledger...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={(user) => setCurrentUser(user)} />;
  }

  // Active projects count
  const activeCount = sites.filter(s => s.status === 'active').length;

  return (
    <div className="min-h-screen bg-[#0C0F1D] text-zinc-350 pb-16 flex flex-col font-sans transition-colors duration-200 relative overflow-x-hidden">
      
      {/* FULL-SCREEN BRAND WATERMARK BACKGROUND - STRETCHED COVER */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden z-0 flex items-center justify-center">
        <motion.svg
          animate={{ rotate: -360 }}
          transition={{ ease: "linear", duration: 240, repeat: Infinity }}
          style={{ transformOrigin: 'center' }}
          viewBox="0 0 100 103"
          className="w-full h-full opacity-[0.14] sm:opacity-[0.18] md:opacity-[0.22] transition-opacity duration-300 transform scale-105"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon 
            points="20,15 48,50 20,58" 
            fill="#2B3452" 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
          />
          <polygon 
            points="20,58 48,50 20,93" 
            fill="#E5B830" 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
          />
          <polygon 
            points="48,34 84,15 84,46" 
            fill="#E5B830" 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
          />
          <polygon 
            points="48,34 84,46 66,54" 
            fill="#138A8E" 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
          />
          <polygon 
            points="48,50 66,54 84,72" 
            fill="#2B3452" 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
          />
          <polygon 
            points="48,50 84,72 84,103" 
            fill="#7C7D6E" 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
          />
        </motion.svg>
      </div>
      
      {/* BRAND & TOP UTILITY BAR */}
      <header id="kmc-main-header" className="bg-[#111625]/90 backdrop-blur-sm border-b border-[#1F293F] text-white relative shadow-lg z-10">
        {/* Visual Brand Decorative Border Line with perfect gradient */}
        <div className="h-1 flex overflow-hidden select-none bg-zinc-900 border-b border-[#1E253B]">
          <div className="w-1/3 h-full bg-[#2B3452]" />
          <div className="w-1/3 h-full bg-[#E5B830]" />
          <div className="w-1/3 h-full bg-[#138A8E]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="relative self-center sm:self-auto">
            <div
              className="flex items-center gap-3.5 p-2 sm:p-2.5 rounded-2xl transition-all select-none text-left bg-[#111625]/60 border border-[#1E253B]"
            >
              <KMCLogo 
                className="h-9 sm:h-11 shadow-inner animate-[pulse_3s_infinite]" 
                hideText={true} 
                primaryColor={activeCompany?.primaryColor || '#138A8E'}
                secondaryColor={activeCompany?.secondaryColor || '#E5B830'}
                logoUrl={activeCompany?.logoUrl}
              />
              <div className="flex flex-col justify-center leading-none">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="font-sans font-black text-[#F3F4F6] text-sm sm:text-base tracking-wide uppercase line-clamp-1 max-w-[150px] sm:max-w-[200px]">
                    {activeCompany?.name || 'Enterprise Portal'}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[8.5px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    <span className="h-1 w-1 bg-emerald-400 rounded-full animate-pulse" />
                    Isolated Tenant
                  </span>
                </div>
                <span className="font-sans font-semibold text-[9px] sm:text-[10px] tracking-[0.14em] uppercase mt-1" style={{ color: activeCompany?.primaryColor || '#138A8E' }}>
                  {activeCompany?.tagline || 'Secure Fleet Status & Ledger'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats overview and active user profile inside the header */}
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 w-full sm:w-auto">
            <div className="text-left sm:text-right hidden sm:block font-mono select-none border-r border-[#1F293F] pr-3 sm:pr-5">
              <span className="text-[#A1A1AA] uppercase tracking-wider text-[9px] sm:text-[10px] font-bold block font-bold">Live Enrolment</span>
              <p className="font-bold text-[#E5B830] text-[11px] sm:text-xs mt-0.5">{activeCount} active / {sites.length} sites</p>
            </div>

            {/* Cloud ledger verification engine status */}
            <div className="text-left sm:text-right hidden sm:block font-mono select-none border-r border-[#1F293F] pr-3 sm:pr-5">
              <span className="text-[#A1A1AA] uppercase tracking-wider text-[9px] sm:text-[10px] font-bold block">Cloud Storage</span>
              <div className="flex items-center gap-1.5 mt-0.5 justify-start sm:justify-end">
                {firestoreSyncStatus === 'synced' ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-bold text-emerald-400 uppercase tracking-tight">Firestore Synced</span>
                  </>
                ) : firestoreSyncStatus === 'connecting' ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500 animate-pulse"></span>
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-bold text-amber-500 uppercase tracking-tight">Connecting DB...</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-bold text-rose-400 uppercase tracking-tight">Offline Archive</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 bg-[#161D32] border border-[#232F4C] px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl text-left shadow-sm ml-auto sm:ml-0">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-tr from-[#138A8E] to-[#E5B830] flex items-center justify-center font-mono font-bold text-white text-[11px] sm:text-xs select-none shadow">
                {currentUser?.name?.charAt(0).toUpperCase() || 'K'}
              </div>
              <div className="font-sans">
                <div className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <span className="font-sans font-extrabold text-[#F4F4F5] text-[11px] sm:text-xs line-clamp-1 max-w-[90px] sm:max-w-[120px]" title={currentUser?.name}>
                    {currentUser?.name}
                  </span>
                  <span className={`font-mono text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm leading-none shrink-0 ${
                    currentUser?.role === 'management'
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                      : 'bg-emerald-500/15 text-[#11E2BC] border border-emerald-500/20'
                  }`}>
                    {currentUser?.role}
                  </span>
                </div>
                <span className="font-mono text-[8px] sm:text-[9px] text-[#81818B] block mt-1 leading-none">
                  {currentUser?.email}
                </span>
              </div>
              
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                title="Secure logout of session"
                className="ml-1 sm:ml-2.5 p-1 sm:p-1.5 rounded-full border border-[#1E253B] hover:border-red-500/30 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/5 transition cursor-pointer select-none"
              >
                <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MULTI-ORGANIZATION LEDGER CONTEXT SELECTOR TABS (DEVELOPER CONTROL) */}
      {isDeveloper && (
        <section id="dev-multitenant-switcher" className="bg-[#090D1A] border-b border-[#1E2945] py-2.5 px-4 relative z-40 select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#138A8E]/10 border border-[#138A8E]/25 text-[#138A8E]">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-[10px] font-mono font-black uppercase text-zinc-350 tracking-wider flex items-center gap-1.5 leading-none">
                  Cross-Tenant Ledger Control Desk
                </h2>
                <span className="text-[8.5px] font-mono uppercase text-[#138A8E] font-semibold mt-0.5 block leading-none">
                  Select a registered organization database to load partition
                </span>
              </div>
            </div>

            {/* Render each company as an active tab */}
            <div className="flex flex-wrap items-center gap-2">
              {companies.map((comp) => {
                const isActive = activeCompany.id === comp.id;
                
                // Get dynamic details for visual depth
                let sitesLen = 0;
                let logsLen = 0;
                try {
                  const rawSites = localStorage.getItem(`apex_diesel_sites_${comp.id}`);
                  if (rawSites) sitesLen = JSON.parse(rawSites).length;
                  const rawLogs = localStorage.getItem(`apex_diesel_logs_${comp.id}`);
                  if (rawLogs) logsLen = JSON.parse(rawLogs).length;
                } catch {}

                return (
                  <button
                    key={comp.id}
                    id={`comp-tab-${comp.id}`}
                    onClick={() => {
                      setActiveCompany(comp);
                      localStorage.setItem('apex_diesel_active_company_id', comp.id);
                      setLiveNotification({
                        message: `System context switched to '${comp.name}' database ledger successfully.`,
                        timestamp: new Date()
                      });
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all duration-200 flex items-center gap-2.5 border select-none cursor-pointer ${
                      isActive
                        ? 'bg-[#121B33]/90 text-[#1EC0C6] border-[#138A8E] shadow-[0_0_15px_rgba(19,138,142,0.15)] ring-1 ring-[#138A8E]/30'
                        : 'bg-[#101424]/65 text-zinc-500 hover:text-zinc-300 border-zinc-800/70 hover:border-zinc-700'
                    }`}
                    title={`Activate ${comp.name} ledger partition context`}
                  >
                    <span 
                      className="px-1.5 py-0.5 rounded font-mono font-black text-[9px] text-white flex items-center justify-center shrink-0 shadow-sm transition"
                      style={{ backgroundColor: isActive ? comp.primaryColor : '#1E253B' }}
                    >
                      {comp.logoInitials}
                    </span>
                    <span className="truncate max-w-[140px] sm:max-w-none">{comp.name}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[8.5px] font-mono font-bold px-1 py-0.2 rounded ${
                        isActive ? 'bg-[#138A8E]/25 text-[#1EC0C6]' : 'bg-[#0E1325] text-zinc-650'
                      }`}>
                        {sitesLen} S
                      </span>
                      <span className={`text-[8.5px] font-mono font-bold px-1 py-0.2 rounded ${
                        isActive ? 'bg-[#138A8E]/25 text-[#1EC0C6]' : 'bg-[#0E1325] text-zinc-650'
                      }`}>
                        {logsLen} L
                      </span>
                    </div>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* PRIMARY NAVIGATION TABS */}
      <div className="bg-[#13192B] border-b border-[#1C253C] sticky top-0 z-45 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <nav className="flex space-x-2 py-2.5 overflow-x-auto scrollbar-none w-full -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible shrink-0 select-none" aria-label="Tabs">
              {/* TAB 1: SITE AGENT */}
              <button
                id="tab-btn-agent"
                onClick={() => setActiveTab('agent')}
                className={`relative py-2 px-4 sm:py-2.5 sm:px-5 rounded-full font-sans font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 transition-colors duration-250 cursor-pointer select-none shrink-0 outline-none ${
                  activeTab === 'agent'
                    ? 'text-[#E5B830]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/3'
                }`}
              >
                {activeTab === 'agent' && (
                  <motion.span
                    layoutId="activeTabBackground"
                    className="absolute inset-0 bg-[#E5B830]/10 border border-[#E5B830]/35 rounded-full shadow-[0_0_15px_rgba(229,184,48,0.12)] z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <motion.div
                  className="relative z-10 flex items-center justify-center"
                  whileHover={{ scale: 1.25, rotate: 12 }}
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 15 }}
                >
                  <HardHat className="h-4 w-4 shrink-0" />
                </motion.div>
                <span className="relative z-10">Agent Log<span className="hidden md:inline"> Station</span></span>
              </button>
 
              {/* TAB 2 & 3: MANAGEMENT ONLY */}
              {currentUser?.role === 'management' && (
                <>
                  {/* TAB 2: MANAGE SITES */}
                  <button
                    id="tab-btn-sites"
                    onClick={() => setActiveTab('sites')}
                    className={`relative py-2 px-4 sm:py-2.5 sm:px-5 rounded-full font-sans font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 transition-colors duration-250 cursor-pointer select-none shrink-0 outline-none ${
                      activeTab === 'sites'
                        ? 'text-[#138A8E]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/3'
                    }`}
                  >
                    {activeTab === 'sites' && (
                      <motion.span
                        layoutId="activeTabBackground"
                        className="absolute inset-0 bg-[#138A8E]/10 border border-[#138A8E]/35 rounded-full shadow-[0_0_15px_rgba(19,138,142,0.12)] z-0"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <motion.div
                      className="relative z-10 flex items-center justify-center"
                      whileHover={{ scale: 1.25, rotate: -12 }}
                      whileTap={{ scale: 0.85 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 15 }}
                    >
                      <Layers className="h-4 w-4 shrink-0" />
                    </motion.div>
                    <span className="relative z-10">Project Sites<span className="hidden md:inline"> Manager</span></span>
                  </button>
 
                  {/* TAB 3: REPORTS & EXPORTS */}
                  <button
                    id="tab-btn-analytics"
                    onClick={() => setActiveTab('analytics')}
                    className={`relative py-2 px-4 sm:py-2.5 sm:px-5 rounded-full font-sans font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 transition-colors duration-250 cursor-pointer select-none shrink-0 outline-none ${
                      activeTab === 'analytics'
                        ? 'text-[#D2D3C4]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/3'
                    }`}
                  >
                    {activeTab === 'analytics' && (
                      <motion.span
                        layoutId="activeTabBackground"
                        className="absolute inset-0 bg-[#7C7D6E]/20 border border-[#7C7D6E]/35 rounded-full shadow-[0_0_15px_rgba(124,125,110,0.12)] z-0"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <motion.div
                      className="relative z-10 flex items-center justify-center"
                      whileHover={{ scale: 1.25, y: -2 }}
                      whileTap={{ scale: 0.85 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 15 }}
                    >
                      <BarChart3 className="h-4 w-4 shrink-0" />
                    </motion.div>
                    <span className="relative z-10">Reports<span className="hidden md:inline"> & Export</span></span>
                  </button>
 
                  {/* TAB 4: STAFF ACCESS CONTROL */}
                  <button
                    id="tab-btn-users"
                    onClick={() => setActiveTab('users')}
                    className={`relative py-2 px-4 sm:py-2.5 sm:px-5 rounded-full font-sans font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 transition-colors duration-250 cursor-pointer select-none shrink-0 outline-none ${
                      activeTab === 'users'
                        ? 'text-rose-300'
                        : 'text-zinc-400 hover:text-white hover:bg-white/3'
                    }`}
                  >
                    {activeTab === 'users' && (
                      <motion.span
                        layoutId="activeTabBackground"
                        className="absolute inset-0 bg-rose-500/10 border border-rose-500/35 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.12)] z-0"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <motion.div
                      className="relative z-10 flex items-center justify-center"
                      whileHover={{ scale: 1.25, rotate: 15 }}
                      whileTap={{ scale: 0.85 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 15 }}
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                    </motion.div>
                    <span className="relative z-10">Staff<span className="hidden md:inline"> Access</span></span>
                  </button>
                </>
              )}
            </nav>

            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest hidden lg:block select-none shrink-0">
              Secured Decentralized Ledger
            </span>
          </div>
        </div>
      </div>

      {/* CORE WORKSPACE PANEL CONTAINERS */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="w-full"
          >
            {activeTab === 'agent' && (
              <div id="tab-agent-panel">
                <AgentTerminal 
                  sites={sites} 
                  logs={logs}
                  onAddLog={handleAddLog} 
                  onAddLogsBatch={handleAddLogsBatch}
                  onAddDelivery={handleAddDelivery} 
                  currentUser={currentUser} 
                />
              </div>
            )}

            {activeTab === 'sites' && (
              <div id="tab-sites-panel">
                <SiteManager 
                  sites={sites} 
                  logs={logs} 
                  onAddSite={handleAddSite} 
                  onToggleSiteStatus={handleToggleSiteStatus}
                  onResetData={handleResetData}
                  isDeveloper={['deanv.d.merwe91@gmail.com', 'deanv.dmerwe91@gmail.com'].includes(currentUser?.email?.toLowerCase().trim())}
                />
              </div>
            )}

            {activeTab === 'analytics' && (
              <div id="tab-analytics-panel">
                <AnalyticsDashboard 
                  sites={sites} 
                  logs={logs} 
                  onDeleteLog={handleDeleteLog} 
                  deliveries={deliveries}
                  onDeleteDelivery={handleDeleteDelivery}
                  onOverrideDelivery={handleOverrideDelivery}
                  onGenerateTestData={handleLoadTestData}
                  onResetData={handleResetData}
                  isDeveloper={['deanv.d.merwe91@gmail.com', 'deanv.dmerwe91@gmail.com'].includes(currentUser?.email?.toLowerCase().trim())}
                  activeCompany={activeCompany}
                  dieselRates={dieselRates}
                  onUpdateDieselRate={handleUpdateDieselRate}
                  currentUser={currentUser || undefined}
                  onRefreshData={handleRefreshData}
                />
              </div>
            )}

            {activeTab === 'users' && currentUser && (
              <div id="tab-users-panel">
                <AccessControl 
                  currentUser={currentUser} 
                  onUserUpdate={handleUserSync} 
                  activeCompany={activeCompany}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FLOATING REAL-TIME CAPTURE NOTIFICATION TOAST */}
      <AnimatePresence>
        {liveNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-[#11182C]/95 backdrop-blur-md border border-teal-500/40 text-zinc-100 py-3 px-5 rounded-2xl shadow-[0_10px_30px_rgba(19,138,142,0.3)] flex items-center gap-3.5 max-w-md font-sans border-l-4 border-l-[#138A8E] select-none"
          >
            <div className="h-6 w-6 rounded-full bg-[#138A8E]/10 flex items-center justify-center animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-[#11E2BC]" />
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#11E2BC] font-black tracking-widest uppercase">REAL-TIME BROADCAST</p>
              <p className="text-xs font-semibold mt-0.5 text-zinc-200 leading-snug">{liveNotification.message}</p>
            </div>
            <button
              onClick={() => setLiveNotification(null)}
              className="ml-auto text-zinc-500 hover:text-zinc-200 transition p-1 rounded-md cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DEVELOPER LIVE SESSIONS MONITOR CONTROL PANEL */}
      {currentUser && isDeveloper && (
        <DeveloperHub
          currentUser={currentUser}
          activeUsers={activeUsers}
          consoleEvents={consoleEvents}
          sites={sites}
          logs={logs}
          onGenerateTestData={handleLoadTestData}
          onResetData={handleResetData}
          companies={companies}
          onUpdateCompanies={(updated) => {
            setCompanies(updated);
            localStorage.setItem('apex_diesel_companies', JSON.stringify(updated));
          }}
          activeCompany={activeCompany}
          onSwitchCompany={(comp) => {
            setActiveCompany(comp);
            localStorage.setItem('apex_diesel_active_company_id', comp.id);
            setLiveNotification({
              message: `Developer system context switched to '${comp.name}' database ledger.`,
              timestamp: new Date()
            });
          }}
        />
      )}

      {/* SYSTEM MARGINS NOTATION BACKGROUND FOOTER */}
      <footer className="mt-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-zinc-400 select-none z-10 max-w-7xl mx-auto w-full">
        <div className="border-t border-[#1F293F] pt-8 flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
          <div className="text-left">
            <p className="font-bold uppercase tracking-wider text-[11px]" style={{ color: activeCompany.primaryColor }}>
              {activeCompany.legalName}
            </p>
            <p className="mt-1 text-zinc-400">Internal site Agent Central Ledger. Sandboxed local file storage vault.</p>
          </div>
          <div className="text-right">
            <p className="text-zinc-350 font-semibold text-xs">Tri-Color Identity Architecture • Dynamic Tenant Portal</p>
            <p className="text-xs text-zinc-500 mt-1">Version 3.1.0-MULTI_TENANT (Custom Active Release)</p>
          </div>
        </div>
      </footer>

      {/* COMPANY ENROLLMENT MODAL OVERLAY */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 font-sans select-none overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg bg-[#141A2E] border border-zinc-800 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative"
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[#232F4C] bg-[#101525] flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-[#E5B830]" style={{ color: activeCompany.primaryColor }} />
                <div className="text-left">
                  <h3 className="font-sans font-black text-[#F4F4F5] text-sm uppercase tracking-wide">
                    Enroll New Corporate Tenant
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Configure branding & management access bypass keys</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEnrollModal(false)}
                className="text-zinc-500 hover:text-white transition p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={(e) => {
              e.preventDefault();
              const target = e.currentTarget;
              const name = (target.elements.namedItem('comp_name') as HTMLInputElement).value.trim();
              const legalName = (target.elements.namedItem('comp_legal') as HTMLInputElement).value.trim();
              const initials = (target.elements.namedItem('comp_initials') as HTMLInputElement).value.trim().toUpperCase();
              const tagline = (target.elements.namedItem('comp_tagline') as HTMLInputElement).value.trim();
              const adminKey = (target.elements.namedItem('comp_key') as HTMLInputElement).value.trim().toUpperCase();
              const pColor = (target.elements.namedItem('comp_pcolor') as HTMLInputElement).value;
              const sColor = (target.elements.namedItem('comp_scolor') as HTMLInputElement).value;

              if (!name || !legalName || !initials || !tagline || !adminKey) {
                alert('Please complete all standard corporate profile attributes.');
                return;
              }

              const newComp: CompanyProfile = {
                id: `company-${Date.now()}`,
                name,
                legalName,
                logoInitials: initials,
                tagline,
                adminKey,
                primaryColor: pColor,
                secondaryColor: sColor,
                createdAt: new Date().toISOString()
              };

              const updatedCompanies = [...companies, newComp];
              setCompanies(updatedCompanies);
              localStorage.setItem('apex_diesel_companies', JSON.stringify(updatedCompanies));

              // Auto-seed management keys to make sure managers can bypass auth codes
              const storedKeysRaw = localStorage.getItem('apex_diesel_mgmt_keys');
              const currentKeys: string[] = storedKeysRaw ? JSON.parse(storedKeysRaw) : ['KMC-MGR-2026'];
              if (!currentKeys.includes(adminKey)) {
                currentKeys.push(adminKey);
                localStorage.setItem('apex_diesel_mgmt_keys', JSON.stringify(currentKeys));
              }

              // Set as active
              setActiveCompany(newComp);
              localStorage.setItem('apex_diesel_active_company_id', newComp.id);

              setShowEnrollModal(false);
              setLiveNotification({
                message: `Corp Tenant Bootstrapped: '${name}' enrolled. Dynamic sandbox initialized.`,
                timestamp: new Date()
              });
            }}
            className="p-6 space-y-4 text-left text-xs text-zinc-350"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 align-left">Company Brand Name</label>
                  <input
                    type="text"
                    name="comp_name"
                    placeholder="e.g. Sasol Logistics"
                    required
                    className="w-full bg-[#1A223B] border border-[#232F4C] rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-500 font-sans focus:outline-none focus:border-[#E5B830] transition text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">Logo Short Initials</label>
                  <input
                    type="text"
                    name="comp_initials"
                    maxLength={5}
                    placeholder="e.g. SSL"
                    required
                    className="w-full bg-[#1A223B] border border-[#232F4C] rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-500 font-sans focus:outline-none focus:border-[#E5B830] transition text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">Legal Entity Registered Name</label>
                <input
                  type="text"
                  name="comp_legal"
                  placeholder="e.g. Sasol Oil Logistics (Pty) Ltd"
                  required
                  className="w-full bg-[#1A223B] border border-[#232F4C] rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-500 font-sans focus:outline-none focus:border-[#E5B830] transition text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">Branding Corporate Tagline</label>
                <input
                  type="text"
                  name="comp_tagline"
                  placeholder="e.g. Diesel Status & Fleet Ledger"
                  required
                  className="w-full bg-[#1A223B] border border-[#232F4C] rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-500 font-sans focus:outline-none focus:border-[#E5B830] transition text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">Manager Administrative Access Bypass Key</label>
                <div className="relative">
                  <input
                    type="text"
                    name="comp_key"
                    placeholder="e.g. SASOL-MGR-2026"
                    required
                    className="w-full bg-[#1A223B] border border-[#232F4C] rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:border-[#E5B830] transition text-xs"
                  />
                  <span className="text-[9px] text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 font-mono">(Key for Manager Signup)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">Brand Main Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="comp_pcolor"
                      defaultValue="#E5B830"
                      className="w-10 h-10 bg-transparent border border-zinc-800 rounded-lg cursor-pointer p-0 select-none overflow-hidden"
                    />
                    <span className="font-mono text-zinc-400">Primary Color</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">Brand Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="comp_scolor"
                      defaultValue="#138A8E"
                      className="w-10 h-10 bg-transparent border border-zinc-800 rounded-lg cursor-pointer p-0 select-none overflow-hidden"
                    />
                    <span className="font-mono text-zinc-400">Secondary Color</span>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-5 border-t border-[#232F4C] flex items-center justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-5 py-2.5 border border-[#232F4C] hover:bg-zinc-800 text-zinc-300 rounded-xl font-bold font-sans transition cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#E5B830] hover:bg-[#E5B830]/90 text-slate-950 font-bold font-sans rounded-xl transition shadow shadow-[0_4px_14px_rgba(229,184,48,0.3)] cursor-pointer select-none"
                  style={{ backgroundColor: activeCompany.primaryColor }}
                >
                  Create Tenant Profile
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
