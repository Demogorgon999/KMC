/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, Download, FileText, Printer, Calendar, Filter, Trash2, Eye, 
  Paperclip, TrendingUp, BarChart3, SlidersHorizontal, ArrowDownAZ, HelpCircle, 
  CheckCircle, PlusCircle, AlertCircle, X, ShieldAlert, Truck, Gauge, Fuel, Clipboard, ShieldCheck,
  ChevronDown, ChevronUp, Sparkles, RefreshCw, Zap
} from 'lucide-react';
import { ConstructionSite, DieselLog, DieselDelivery, CompanyProfile, MonthlyDieselRate, User } from '../types';
import { exportToExcel, exportToCSV, downloadCSV, exportDieselRatesToExcel } from '../utils/exporter';
import ConfirmationModal from './ConfirmationModal';
import SiteConsumptionChart from './SiteConsumptionChart';

interface AnalyticsDashboardProps {
  sites: ConstructionSite[];
  logs: DieselLog[];
  onDeleteLog: (logId: string) => void;
  deliveries?: DieselDelivery[];
  onDeleteDelivery?: (deliveryId: string) => void;
  onOverrideDelivery?: (deliveryId: string, reason: string) => void;
  onGenerateTestData?: () => void;
  onResetData?: () => void;
  isDeveloper?: boolean;
  activeCompany?: CompanyProfile;
  dieselRates?: MonthlyDieselRate[];
  onUpdateDieselRate?: (month: string, price: number) => Promise<void>;
  currentUser?: User;
  onRefreshData?: () => Promise<void> | void;
}

export default function AnalyticsDashboard({ 
  sites, 
  logs, 
  onDeleteLog, 
  deliveries = [], 
  onDeleteDelivery, 
  onOverrideDelivery, 
  onGenerateTestData, 
  onResetData, 
  isDeveloper,
  activeCompany,
  dieselRates = [],
  onUpdateDieselRate,
  currentUser,
  onRefreshData
}: AnalyticsDashboardProps) {
  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    variant: 'info',
    onConfirm: () => {},
  });

  // Day-Specific Diesel Rate Manager States
  const [selectedEffectiveDate, setSelectedEffectiveDate] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [monthRate, setMonthRate] = useState<string>('');
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateSuccess, setRateSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    const existing = dieselRates.find(r => r.effectiveDate === selectedEffectiveDate);
    if (existing) {
      setMonthRate(existing.rate.toString());
    } else {
      setMonthRate('');
    }
  }, [selectedEffectiveDate, dieselRates]);

  const formatEffectiveDateToHuman = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateError(null);
    setRateSuccess(null);

    const price = parseFloat(monthRate);
    if (isNaN(price) || price <= 0) {
      setRateError('Please enter a valid positive numeric rate per litre.');
      return;
    }

    if (!onUpdateDieselRate) return;

    try {
      await onUpdateDieselRate(selectedEffectiveDate, price);
      setRateSuccess(`Configured diesel rate starting from ${formatEffectiveDateToHuman(selectedEffectiveDate)} to R ${price.toFixed(2)}/L!`);
      setTimeout(() => setRateSuccess(null), 4000);
    } catch {
      setRateError('Failed to communicate with the database.');
    }
  };

  const triggerConfirm = (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }) => {
    setConfirmModal({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel,
      variant: options.variant || 'info',
      onConfirm: () => {
        options.onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Filters state
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // UI states
  const [reportTab, setReportTab] = useState<'consumption' | 'deliveries' | 'ai_balance'>('consumption');
  const [isBalancing, setIsBalancing] = useState<boolean>(false);
  const [balancingResult, setBalancingResult] = useState<{
    balancedLogs: Array<{
      id: string;
      quantityLitres: number;
      vehicleNumber: string;
      vehicleMeterReading: string;
      dateTime: string;
      agentName: string;
      notes: string;
      isBalanced: boolean;
      explanation: string;
    }>;
    summary: string;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSavingBalanced, setIsSavingBalanced] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [activePreviewLog, setActivePreviewLog] = useState<DieselLog | null>(null);
  const [activePreviewDelivery, setActivePreviewDelivery] = useState<DieselDelivery | null>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    deliveryId: string;
    siteName: string;
    transporter: string;
    variance: number;
    reason: string;
  } | null>(null);

  // Grouping setting
  const [groupBySite, setGroupBySite] = useState<boolean>(false);
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
  const [isFleetMileageCollapsed, setIsFleetMileageCollapsed] = useState<boolean>(true);

  // Helper to calculate complex fleet tracking and odometer mileage metrics
  const getFleetMetrics = () => {
    // Unique list of vehicle numbers
    const vehicleNumbers = Array.from(
      new Set(logs.map(l => l.vehicleNumber?.trim().toUpperCase()).filter(Boolean))
    ).sort();

    return vehicleNumbers.map(vehicle => {
      // Find all logs for this vehicle, sort ascending by time
      const vLogs = logs
        .filter(l => l.vehicleNumber?.trim().toUpperCase() === vehicle)
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

      const totalL = vLogs.reduce((acc, curr) => acc + (curr.quantityLitres || 0), 0);
      const totalLogsForVehicle = vLogs.length;

      let lastOdometer: number | null = null;
      let firstOdometer: number | null = null;
      let calculatedDistance = 0;
      let matchesHours = false;

      // Scan through logs to find first and last reliable odometer numbers
      const parsedStats = vLogs.map(log => {
        if (!log.vehicleMeterReading) return null;
        const meterStr = log.vehicleMeterReading.toLowerCase();
        const isHrs = meterStr.includes('hr') || meterStr.includes('h') || meterStr.includes('hour');
        if (isHrs) matchesHours = true;

        const val = parseFloat(log.vehicleMeterReading.replace(/[^0-9.]/g, ''));
        return isNaN(val) ? null : { val, isHrs, log };
      }).filter(Boolean) as Array<{ val: number; isHrs: boolean; log: DieselLog }>;

      if (parsedStats.length >= 2) {
        firstOdometer = parsedStats[0].val;
        lastOdometer = parsedStats[parsedStats.length - 1].val;
        calculatedDistance = lastOdometer - firstOdometer;
      }

      // Calculate the detailed refueling hop economics (distance traveled between refueling and fuel efficiency)
      const hopEconomics: Array<{
        fromMeter: number;
        toMeter: number;
        distance: number;
        litresLogged: number;
        efficiencyRate: number; // L/100km or L/hr
        isHrs: boolean;
        date: string;
        siteName: string;
      }> = [];

      for (let i = 1; i < parsedStats.length; i++) {
        const prev = parsedStats[i - 1];
        const curr = parsedStats[i];
        const distance = curr.val - prev.val;
        if (distance > 0) {
          const litresLogged = curr.log.quantityLitres;
          const efficiencyRate = curr.isHrs 
            ? (litresLogged / distance) 
            : ((litresLogged / distance) * 100);

          const matchedSite = sites.find(s => s.id === curr.log.siteId)?.name || 'Unknown Site';

          hopEconomics.push({
            fromMeter: prev.val,
            toMeter: curr.val,
            distance,
            litresLogged,
            efficiencyRate,
            isHrs: curr.isHrs,
            date: curr.log.dateTime,
            siteName: matchedSite
          });
        }
      }

      // Overall average efficiency from the hops
      const avgEfficiency = hopEconomics.length > 0
        ? hopEconomics.reduce((acc, h) => acc + h.efficiencyRate, 0) / hopEconomics.length
        : null;

      // Total distance calculated from the hops
      const totalHopDistance = hopEconomics.reduce((acc, h) => acc + h.distance, 0);

      const latestLog = vLogs[vLogs.length - 1];

      return {
        vehicle,
        totalL,
        totalLogsForVehicle,
        totalDistance: totalHopDistance,
        isHours: matchesHours,
        avgEfficiency, // in L/100km or L/hr
        latestMeter: latestLog?.vehicleMeterReading || '—',
        hopCount: hopEconomics.length,
        hops: hopEconomics
      };
    });
  };

  const fleetMetrics = getFleetMetrics();

  const consByMonth = (() => {
    const monthlyCons: { [monthKey: string]: number } = {};
    logs.forEach(log => {
      if (!log.dateTime) return;
      try {
        const logDate = new Date(log.dateTime);
        const monthKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyCons[monthKey] = (monthlyCons[monthKey] || 0) + log.quantityLitres;
      } catch {}
    });
    return monthlyCons;
  })();

  // Stats calculation
  const totalLitres = logs.reduce((acc, curr) => acc + (curr.quantityLitres || 0), 0);
  const totalLogs = logs.length;
  const avgLitres = totalLogs > 0 ? totalLitres / totalLogs : 0;

  // Resolve rate for a given date to compute costs
  const getLogCost = (log: DieselLog) => {
    try {
      if (!log.dateTime || dieselRates.length === 0) return { cost: 0, rate: 0, hasRate: false, effectiveDate: '' };
      
      // Get the YYYY-MM-DD portion of log.dateTime
      const logDateStr = log.dateTime.substring(0, 10);
      
      // Find rates that are effective on or before the log's date
      const validRates = dieselRates.filter(r => r.effectiveDate <= logDateStr);
      
      let matchedRate = null;
      if (validRates.length > 0) {
        // Sort descending to find the closest active rate definition
        validRates.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
        matchedRate = validRates[0];
      } else {
        // Fallback: use the earliest known rate
        const sortedAll = [...dieselRates].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
        matchedRate = sortedAll[0];
      }

      if (matchedRate) {
        return {
          cost: log.quantityLitres * matchedRate.rate,
          rate: matchedRate.rate,
          hasRate: true,
          effectiveDate: matchedRate.effectiveDate
        };
      }
      return { cost: 0, rate: 0, hasRate: false, effectiveDate: '' };
    } catch {
      return { cost: 0, rate: 0, hasRate: false, effectiveDate: '' };
    }
  };

  const costAnalysis = logs.reduce((acc, curr) => {
    const costInfo = getLogCost(curr);
    if (costInfo.hasRate) {
      return {
        totalCost: acc.totalCost + costInfo.cost,
        unratedLitres: acc.unratedLitres,
        ratedCount: acc.ratedCount + 1
      };
    } else {
      return {
        totalCost: acc.totalCost,
        unratedLitres: acc.unratedLitres + curr.quantityLitres,
        ratedCount: acc.ratedCount
      };
    }
  }, { totalCost: 0, unratedLitres: 0, ratedCount: 0 });

  // Most active site
  const getMostActiveSite = () => {
    if (logs.length === 0) return 'None';
    const counts: { [id: string]: number } = {};
    logs.forEach(l => {
      counts[l.siteId] = (counts[l.siteId] || 0) + l.quantityLitres;
    });
    
    let maxSiteId = '';
    let maxLitres = 0;
    Object.keys(counts).forEach(id => {
      if (counts[id] > maxLitres) {
        maxLitres = counts[id];
        maxSiteId = id;
      }
    });

    const site = sites.find(s => s.id === maxSiteId);
    return site ? `${site.code} (${Math.round(maxLitres)}L)` : 'N/A';
  };

  // Filter processes
  const filteredLogs = logs.filter((log) => {
    // 1. Site Filter
    if (selectedSiteId !== 'all' && log.siteId !== selectedSiteId) return false;

    // 2. Date Filters
    if (startDate) {
      if (new Date(log.dateTime) < new Date(startDate)) return false;
    }
    if (endDate) {
      // Ensure search includes entire end day
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      if (new Date(log.dateTime) > endDateTime) return false;
    }

    // 3. Search Query (Vehicle, Agent Name, Notes, Meter Reading)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const vehicleMatch = log.vehicleNumber.toLowerCase().includes(q);
      const agentMatch = log.agentName.toLowerCase().includes(q);
      const notesMatch = log.notes?.toLowerCase().includes(q) || false;
      const meterMatch = log.vehicleMeterReading?.toLowerCase().includes(q) || false;
      const siteOfLog = sites.find(s => s.id === log.siteId);
      const siteMatch = siteOfLog ? siteOfLog.name.toLowerCase().includes(q) || siteOfLog.code.toLowerCase().includes(q) : false;

      return vehicleMatch || agentMatch || notesMatch || siteMatch || meterMatch;
    }

    return true;
  });

  // Filter processes for deliveries
  const filteredDeliveries = (deliveries || []).filter((delivery) => {
    // 1. Site Filter
    if (selectedSiteId !== 'all' && delivery.siteId !== selectedSiteId) return false;

    // 2. Date Filters
    if (startDate) {
      if (new Date(delivery.dateTime) < new Date(startDate)) return false;
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      if (new Date(delivery.dateTime) > endDateTime) return false;
    }

    // 3. Search Query (Delivered By, Delivery Note, KMP Order, Agent)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const deliveredByMatch = delivery.deliveredBy.toLowerCase().includes(q);
      const deliveryNoteMatch = delivery.deliveryNote.toLowerCase().includes(q);
      const kmpOrderMatch = delivery.kmpOrder.toLowerCase().includes(q);
      const agentMatch = delivery.agentName.toLowerCase().includes(q);
      const siteOfDelivery = sites.find(s => s.id === delivery.siteId);
      const siteMatch = siteOfDelivery ? siteOfDelivery.name.toLowerCase().includes(q) || siteOfDelivery.code.toLowerCase().includes(q) : false;

      return deliveredByMatch || deliveryNoteMatch || kmpOrderMatch || agentMatch || siteMatch;
    }

    return true;
  });

  // Calculate totals of filtered subset
  const filteredLitres = filteredLogs.reduce((acc, curr) => acc + (curr.quantityLitres || 0), 0);
  const filteredDeliveryQty = filteredDeliveries.reduce((acc, curr) => acc + (curr.quantityLitres || 0), 0);

  const totalDeliveryQty = (deliveries || []).reduce((acc, curr) => acc + (curr.quantityLitres || 0), 0);
  const totalDeliveriesCount = deliveries.length;

  // Handlers for exporting
  const handleExportXLSX = () => {
    // We export the site, logs list, bulk deliveries list, and diesel rates
    exportToExcel(sites, logs, deliveries, dieselRates);
    setFeedbackMessage('📊 Excel template (.XLSX) has been compiled and downloaded successfully!');
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleExportCSV = () => {
    const csvContent = exportToCSV(sites, logs, dieselRates);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(csvContent, `Diesel_Logs_Classified_${dateStr}.csv`);
    setFeedbackMessage('📬 Google Sheets compatible (.CSV) format has been downloaded successfully!');
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleExportRatesXLSX = () => {
    exportDieselRatesToExcel(dieselRates, logs);
    setFeedbackMessage('💸 Finance Diesel Price Ledger (.XLSX) compiled and downloaded successfully!');
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Triggers browser native standard printing which translates CSS media queries perfectly
  const handlePrintTrigger = () => {
    setShowPrintView(true);
    setTimeout(() => {
      window.print();
      setShowPrintView(false);
    }, 300);
  };

  const renderGridContent = () => {
    if (reportTab === 'ai_balance') {
      const siteLogs = selectedSiteId === 'all' 
        ? [] 
        : logs.filter(l => l.siteId === selectedSiteId).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

      const handleAiBalance = async () => {
        setIsBalancing(true);
        setAiError(null);
        setBalancingResult(null);
        try {
          const res = await fetch('/api/ai/balance-shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteId: selectedSiteId, logs: siteLogs })
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Balancing failed');
          }
          const result = await res.json();
          setBalancingResult(result);
        } catch (err: any) {
          setAiError(err.message || 'Failed to communicate with AI model.');
        } finally {
          setIsBalancing(false);
        }
      };

      const handleSaveBalanced = async () => {
        if (!balancingResult) return;
        setIsSavingBalanced(true);
        try {
          const res = await fetch('/api/ai/save-balanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balancedLogs: balancingResult.balancedLogs })
          });
          if (res.ok) {
            if (onRefreshData) {
              await onRefreshData();
            }
            setFeedbackMessage('🎉 Reconciled day and night entries successfully saved & committed to the ledger!');
            setBalancingResult(null);
            setTimeout(() => setFeedbackMessage(null), 5000);
          } else {
            const data = await res.json();
            throw new Error(data.error || 'Failed to save');
          }
        } catch (err: any) {
          setAiError(err.message || 'Failed to save balanced logs.');
        } finally {
          setIsSavingBalanced(false);
        }
      };

      if (selectedSiteId === 'all') {
        return (
          <div className="p-16 text-center animate-fade-in">
            <Sparkles className="h-10 w-10 text-purple-400 mx-auto mb-3 animate-pulse" />
            <h3 className="text-base font-bold text-zinc-200">Select a Site to Begin AI Balancing</h3>
            <p className="text-xs text-zinc-400 mt-2 max-w-md mx-auto font-sans">
              To balance Day and Night shift entries chronologically backwards from the highest final odometer/meter reading, please select a specific construction site from the filter above.
            </p>
          </div>
        );
      }

      if (siteLogs.length === 0) {
        return (
          <div className="p-16 text-center animate-fade-in">
            <Fuel className="h-10 w-10 text-zinc-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-zinc-200">No logs recorded for this site</h3>
            <p className="text-xs text-zinc-400 mt-2 max-w-md mx-auto font-sans">
              We couldn't find any refueling logs registered for the selected site. Please switch to the Agent Terminal to record logs or generate high-fidelity test records first.
            </p>
          </div>
        );
      }

      return (
        <div className="p-6 space-y-6 animate-fade-in">
          <div className="bg-[#182035]/50 border border-[#232F4C] p-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">AI Day/Night Shift Reconciler</h3>
              </div>
              <p className="text-xs text-zinc-400 font-sans max-w-2xl leading-relaxed">
                Reconciliation is done back-to-front based on the <strong>final site reading</strong> as ground-truth. Gemini analyzes Day and Night entries, validates meter progression, and balances consumption quantities chronologically backwards.
              </p>
            </div>
            <button
              type="button"
              disabled={isBalancing}
              onClick={handleAiBalance}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-purple-800 disabled:to-indigo-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition duration-200 shadow flex items-center gap-2 select-none shrink-0 cursor-pointer"
            >
              {isBalancing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Balancing Entries...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span>Run AI Shift Reconciler</span>
                </>
              )}
            </button>
          </div>

          {aiError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider font-sans">API Reconciliation Error</h4>
                <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">{aiError}</p>
              </div>
            </div>
          )}

          {balancingResult && (
            <div className="space-y-6 border border-purple-500/30 bg-purple-950/5 p-6 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-purple-950/20 border border-purple-500/20 p-4 rounded-lg">
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5 mb-2 font-sans">
                  <Sparkles className="h-4 w-4" /> Gemini Reconciliation Summary
                </h4>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed whitespace-pre-line">
                  {balancingResult.summary}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-sans">Proposed Balance Revisions</h4>
                  <button
                    type="button"
                    disabled={isSavingBalanced}
                    onClick={handleSaveBalanced}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider rounded transition duration-150 flex items-center gap-2 select-none cursor-pointer animate-pulse"
                  >
                    {isSavingBalanced ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Commit Balanced Ledger</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-[#1E273D]">
                  <table className="w-full text-left border-collapse text-xs font-sans">
                    <thead>
                      <tr className="bg-[#0C0F1D] border-b border-[#1E273D] text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                        <th className="py-2.5 px-3">Date Time</th>
                        <th className="py-2.5 px-3">Shift</th>
                        <th className="py-2.5 px-3">Vehicle</th>
                        <th className="py-2.5 px-3">Agent</th>
                        <th className="py-2.5 px-3 text-right">Original Meter</th>
                        <th className="py-2.5 px-3 text-right bg-purple-500/10 text-purple-300 border-x border-purple-500/20">Balanced Meter</th>
                        <th className="py-2.5 px-3 text-right">Original Litres</th>
                        <th className="py-2.5 px-3 text-right bg-purple-500/10 text-purple-300 border-r border-purple-500/20">Balanced Litres</th>
                        <th className="py-2.5 px-3 max-w-xs">AI Reconciliation Comment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1D263B]/30 text-zinc-300">
                      {balancingResult.balancedLogs.map((blog) => {
                        const original = siteLogs.find(ol => ol.id === blog.id);
                        const hour = new Date(blog.dateTime).getHours();
                        const isDay = hour >= 6 && hour < 18;
                        const isMeterChanged = original?.vehicleMeterReading !== blog.vehicleMeterReading;
                        const isLitresChanged = original?.quantityLitres !== blog.quantityLitres;

                        return (
                          <tr key={blog.id} className="hover:bg-white/5 transition duration-100">
                            <td className="py-2 px-3 font-mono text-zinc-400 whitespace-nowrap">
                              {new Date(blog.dateTime).toLocaleString('en-ZA')}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {isDay ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                                  ☀️ Day
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                                  🌙 Night
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-semibold text-zinc-200">
                              {blog.vehicleNumber}
                            </td>
                            <td className="py-2 px-3 text-zinc-400">
                              {blog.agentName}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-zinc-500">
                              {original?.vehicleMeterReading || '—'}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono font-bold border-x border-purple-500/20 ${isMeterChanged ? 'text-amber-400 bg-amber-500/5' : 'text-zinc-300 bg-purple-500/5'}`}>
                              {blog.vehicleMeterReading} {isMeterChanged && '✨'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-zinc-500">
                              {(original?.quantityLitres || 0).toFixed(1)} L
                            </td>
                            <td className={`py-2 px-3 text-right font-mono font-bold border-r border-purple-500/20 ${isLitresChanged ? 'text-emerald-400 bg-emerald-500/5' : 'text-zinc-300 bg-purple-500/5'}`}>
                              {(blog.quantityLitres || 0).toFixed(1)} L {isLitresChanged && '✨'}
                            </td>
                            <td className="py-2 px-3 text-zinc-400 max-w-xs truncate" title={blog.explanation}>
                              {blog.explanation || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 font-sans">
              Current Chronological Log entries ({siteLogs.length})
            </h4>
            <div className="overflow-x-auto rounded-lg border border-[#1E273D]">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="bg-[#0C0F1D] border-b border-[#1E273D] text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3">Vehicle / Machine</th>
                    <th className="py-2.5 px-3">Meter Reading</th>
                    <th className="py-2.5 px-3 text-right">Liters Logged</th>
                    <th className="py-2.5 px-3">Site Agent</th>
                    <th className="py-2.5 px-3 max-w-xs">Logged Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D263B]/30 text-zinc-300">
                  {siteLogs.map((log, index) => {
                    const hour = new Date(log.dateTime).getHours();
                    const isDay = hour >= 6 && hour < 18;
                    const isLast = index === siteLogs.length - 1;
                    return (
                      <tr key={log.id} className={`hover:bg-white/5 transition duration-100 ${isLast ? 'bg-[#E5B830]/5 border-y border-[#E5B830]/20' : ''}`}>
                        <td className="py-2 px-3 font-mono text-zinc-455 whitespace-nowrap">
                          {new Date(log.dateTime).toLocaleString('en-ZA')}
                        </td>
                        <td className="py-2 px-3">
                          {isDay ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                              ☀️ Day
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                              🌙 Night
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-semibold text-zinc-200">
                          {log.vehicleNumber}
                        </td>
                        <td className="py-2 px-3 font-mono text-zinc-300">
                          {log.vehicleMeterReading || '—'} {isLast && <span className="text-[9px] text-[#E5B830] font-bold uppercase ml-1">(Last Reading / Max)</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-zinc-300">
                          {(log.quantityLitres || 0).toFixed(1)} L
                        </td>
                        <td className="py-2 px-3 text-zinc-455">
                          {log.agentName}
                        </td>
                        <td className="py-2 px-3 text-zinc-400 max-w-xs truncate" title={log.notes}>
                          {log.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (reportTab === 'deliveries') {
      if (filteredDeliveries.length === 0) {
        return (
          <div className="p-16 text-center animate-fade-in">
            <Truck className="h-8 w-8 text-zinc-500 mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-semibold text-zinc-400">No Diesel Deliveries Found</p>
            <p className="text-xs text-zinc-500 mt-1 font-sans">Adjust your filters, or record a bulk delivery inside the Agent Terminal.</p>
          </div>
        );
      }
      return (
        <>
          {/* Desktop Table View for Deliveries */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#0C0F1D] border-b border-[#1E273D] text-xs font-bold uppercase text-zinc-300 tracking-wider">
                  <th className="py-3 px-4 font-sans font-extrabold">Date & Time</th>
                  <th className="py-3 px-4 font-sans font-extrabold">Site</th>
                  <th className="py-3 px-4 font-sans font-extrabold">Delivered By</th>
                  <th className="py-3 px-4 text-center font-sans font-extrabold">Delivery Note</th>
                  <th className="py-3 px-4 text-right font-sans font-extrabold">Invoice Litres</th>
                  <th className="py-3 px-4 text-center font-sans font-extrabold">Dips (Open / Close)</th>
                  <th className="py-3 px-4 text-right font-sans font-extrabold">Margin Variance</th>
                  <th className="py-3 px-4 font-sans font-extrabold">KMP Order #</th>
                  <th className="py-3 px-4 font-sans text-center font-extrabold">Delivery Slip</th>
                  <th className="py-3 px-4 text-right font-sans font-extrabold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D263B]/30 text-zinc-300">
                {filteredDeliveries.map((delivery) => {
                  const site = sites.find(s => s.id === delivery.siteId);
                  const diff = ((delivery.closingDip || 0) - (delivery.openingDip || 0)) - (delivery.quantityLitres || 0);
                  const isPerfect = Math.abs(diff) < 0.1;
                  const pct = (delivery.quantityLitres || 0) > 0 ? (diff / (delivery.quantityLitres || 0)) * 100 : 0;
                  return (
                    <tr key={delivery.id} className="hover:bg-white/5 transition duration-100">
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-455 font-mono text-xs">
                        {new Date(delivery.dateTime).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-sans">
                          <span className="font-mono text-[10px] font-extrabold bg-[#138A8E]/10 text-[#11E2BC] px-1.5 py-0.5 rounded border border-[#138A8E]/25">
                            {site?.code || 'N/A'}
                          </span>
                          <span className="font-semibold text-zinc-200 line-clamp-1 truncate max-w-[130px]" title={site?.name}>
                            {site?.name || 'Unknown Site'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-150 whitespace-nowrap">
                        {delivery.deliveredBy}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-center text-zinc-300 uppercase whitespace-nowrap select-all">
                        {delivery.deliveryNote}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-zinc-200 whitespace-nowrap">
                        {(delivery.quantityLitres || 0).toFixed(1)} L
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs text-zinc-455 whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center leading-normal">
                          <span>Open: <span className="text-zinc-300 font-bold">{(delivery.openingDip || 0).toFixed(0)}L</span></span>
                          <span>Close: <span className="text-zinc-300 font-bold">{(delivery.closingDip || 0).toFixed(0)}L</span></span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end leading-tight">
                          {isPerfect ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-[#107F6E]/40 uppercase tracking-wider">
                              Perfect Match
                            </span>
                          ) : delivery.isOverridden ? (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/25 uppercase tracking-wider flex items-center gap-0.5 leading-none">
                                <ShieldCheck className="h-3 w-3 shrink-0" /> Overridden
                              </span>
                              <span className="text-[9px] text-zinc-450 font-sans italic max-w-[145px] truncate mt-0.5" title={delivery.overrideReason}>
                                Accepted: {delivery.overrideReason}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-extrabold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30 uppercase tracking-wider flex items-center gap-1 select-none animate-pulse">
                                <AlertCircle className="h-3 w-3 text-rose-400 shrink-0" />
                                {diff < 0 ? 'Under' : 'Over'} {(Math.abs(diff) || 0).toFixed(1)} L
                              </span>
                              <span className="text-[9px] text-rose-400 font-mono font-extrabold mt-1">({pct < 0 ? '' : '+'}{(pct || 0).toFixed(1)}% margin)</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-mono font-bold text-zinc-300 uppercase">
                        <div className="flex flex-col">
                          <span>{delivery.kmpOrder}</span>
                          <span className="text-[9.5px] text-zinc-400 font-sans font-normal">By: {delivery.agentName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {delivery.attachmentBase64 ? (
                          <button
                            type="button"
                            onClick={() => setActivePreviewDelivery(delivery)}
                            className="mx-auto p-1.5 px-2.5 text-[#138A8E] hover:text-[#1CA8AD] hover:bg-[#138A8E]/10 border border-[#138A8E]/25 rounded transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-[10px] font-extrabold uppercase leading-none font-sans">View Slip</span>
                          </button>
                        ) : (
                          <span className="text-zinc-600 text-xs italic">No slip attachment</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 text-xs">
                          {!isPerfect && !delivery.isOverridden && onOverrideDelivery && (
                            <button
                              type="button"
                              onClick={() => setOverrideModal({
                                isOpen: true,
                                deliveryId: delivery.id,
                                siteName: site?.name || `${activeCompany?.name || 'KMC'} Site Project`,
                                transporter: delivery.deliveredBy,
                                variance: diff,
                                reason: ''
                              })}
                              className="px-2 py-1 text-xs font-black text-[#E5B830] bg-[#E5B830]/10 hover:bg-[#E5B830]/20 border border-[#E5B830]/25 hover:border-[#E5B830]/40 rounded transition uppercase text-[10px] tracking-wide cursor-pointer flex items-center gap-0.5"
                            >
                              <ShieldAlert className="h-3 w-3 text-[#E5B830] inline shrink-0" />
                              Override
                            </button>
                          )}

                          {onDeleteDelivery && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerConfirm({
                                  title: 'Delete Fuel Bulk Delivery Audit',
                                  message: `Are you sure you want to permanently delete this inbound bulk delivery of ${(delivery.quantityLitres || 0).toFixed(1)} L from transporter ${delivery.deliveredBy} for site ${site?.name}? This action is irreversible.`,
                                  confirmLabel: 'Delete Delivery Note',
                                  variant: 'danger',
                                  onConfirm: () => onDeleteDelivery(delivery.id),
                                });
                              }}
                              className="p-1 px-1.5 text-rose-400 hover:text-rose-300 rounded hover:bg-[#FF3B30]/10 transition cursor-pointer"
                              title="Delete delivery log"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Compact Mobile Card list for Deliveries */}
          <div className="block md:hidden divide-y divide-[#1D263B]/40 text-sm">
            {filteredDeliveries.map((delivery) => {
              const site = sites.find(s => s.id === delivery.siteId);
              const diff = ((delivery.closingDip || 0) - (delivery.openingDip || 0)) - (delivery.quantityLitres || 0);
              const isPerfect = Math.abs(diff) < 0.1;
              const pct = (delivery.quantityLitres || 0) > 0 ? (diff / (delivery.quantityLitres || 0)) * 100 : 0;
              return (
                <div key={delivery.id} className="p-4 space-y-3.5 hover:bg-white/5 transition text-sm">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-zinc-500 text-xs font-mono">
                      {new Date(delivery.dateTime).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    <span className="font-mono text-sm font-black text-zinc-100">
                      {(delivery.quantityLitres || 0).toFixed(1)} L
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500 block mb-0.5 uppercase tracking-wider font-extrabold text-[10px]">Site</span>
                      <div className="flex items-center gap-1 font-sans">
                        <span className="font-mono text-[9px] font-extrabold bg-[#138A8E]/10 text-[#11E2BC] px-1 py-0.5 rounded leading-none shrink-0 border border-[#138A8E]/20">
                          {site?.code || 'N/A'}
                        </span>
                        <span className="font-semibold text-zinc-300 truncate max-w-[100px]" title={site?.name}>
                          {site?.name || 'Unknown Site'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-0.5 uppercase tracking-wider font-extrabold text-[10px]">Transporter</span>
                      <span className="text-zinc-300 font-medium truncate block max-w-[110px]" title={delivery.deliveredBy}>
                        {delivery.deliveredBy}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-0.5 uppercase tracking-wider font-extrabold text-[10px]">Delivery Note</span>
                      <span className="text-zinc-300 font-mono font-bold uppercase block select-all">
                        {delivery.deliveryNote}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-0.5 uppercase tracking-wider font-extrabold text-[10px]">Dips</span>
                      <span className="text-zinc-300 font-mono text-[11px] block leading-none pt-0.5">
                        Open: <span className="font-bold">{(delivery.openingDip || 0).toFixed(0)}</span> | Close: <span className="font-bold">{(delivery.closingDip || 0).toFixed(0)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[#1E273D]/30">
                    <div className="leading-tight">
                      {isPerfect ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-[#107F6E]/30 uppercase">
                          Perfect Match
                        </span>
                      ) : delivery.isOverridden ? (
                        <div className="flex flex-col items-start leading-none">
                          <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/25 uppercase flex items-center gap-0.5">
                            <ShieldCheck className="h-3 w-3" /> Overridden
                          </span>
                          <span className="text-[8px] text-zinc-500 italic max-w-[120px] truncate mt-1">
                            {delivery.overrideReason}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-extrabold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-[#FF3B30]/30 uppercase flex items-center gap-1 animate-pulse">
                          <AlertCircle className="h-3 w-3 text-rose-400" />
                          {diff < 0 ? 'Under' : 'Over'} {(Math.abs(diff) || 0).toFixed(0)} L ({(pct || 0).toFixed(0)}%)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {delivery.attachmentBase64 ? (
                        <button
                          type="button"
                          onClick={() => setActivePreviewDelivery(delivery)}
                          className="px-2 py-1 text-xs text-[#138A8E] hover:text-[#1CA8AD] hover:bg-[#138A8E]/10 border border-[#138A8E]/25 rounded transition flex items-center gap-1 cursor-pointer"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-[9px] font-black uppercase">Slip</span>
                        </button>
                      ) : null}

                      {!isPerfect && !delivery.isOverridden && onOverrideDelivery && (
                        <button
                          type="button"
                          onClick={() => setOverrideModal({
                            isOpen: true,
                            deliveryId: delivery.id,
                            siteName: site?.name || `${activeCompany?.name || 'KMC'} Site Project`,
                            transporter: delivery.deliveredBy,
                            variance: diff,
                            reason: ''
                          })}
                          className="px-2 py-1 text-xs text-[#E5B830] bg-[#E5B830]/10 hover:bg-[#E5B830]/20 border border-[#E5B830]/25 rounded transition flex items-center gap-0.5 cursor-pointer uppercase text-[9px] font-black"
                        >
                          <ShieldAlert className="h-3 w-3 text-[#E5B830]" />
                          Override
                        </button>
                      )}

                      {onDeleteDelivery && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerConfirm({
                              title: 'Delete Fuel Bulk Delivery Audit',
                              message: `Are you sure you want to permanently delete this inbound bulk delivery of ${(delivery.quantityLitres || 0).toFixed(1)} L from transporter ${delivery.deliveredBy} for site ${site?.name}? This action is irreversible.`,
                              confirmLabel: 'Delete Delivery Note',
                              variant: 'danger',
                              onConfirm: () => onDeleteDelivery(delivery.id),
                            });
                          }}
                          className="p-1 px-2 text-rose-400 hover:text-rose-300 rounded hover:bg-[#FF3B30]/10 border border-transparent hover:border-rose-500/20 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      );
    }

    // Otherwise, refueling logs (original consumption content)
    if (filteredLogs.length === 0) {
      return (
        <div className="p-16 text-center animate-fade-in">
          <AlertCircle className="h-8 w-8 text-zinc-550 mx-auto mb-2 animate-pulse" />
          <p className="text-sm font-semibold text-zinc-400">No Diesel Logs Found</p>
          <p className="text-xs text-zinc-500 mt-1 font-sans">Adjust your filters, or log some transactions inside the Agent Terminal.</p>
        </div>
      );
    }

    if (groupBySite) {
      return (
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
          {sites.map((site) => {
            const siteLogsSubset = filteredLogs.filter(l => l.siteId === site.id);
            if (siteLogsSubset.length === 0) return null;
            const siteSum = siteLogsSubset.reduce((acc, curr) => acc + (curr.quantityLitres || 0), 0);

            return (
              <div key={site.id} className="border border-[#1E273D] rounded-xl overflow-hidden shadow-sm bg-[#111625]">
                {/* Site Header Row */}
                <div className="bg-[#181F35] border-b border-[#232F4C] px-3.5 py-3 sm:px-4 sm:py-3 flex items-center justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                      <span className="font-mono text-[10px] sm:text-xs font-extrabold bg-[#E5B830]/15 text-[#E5B830] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded border border-[#E5B830]/25">
                        {site.code}
                      </span>
                      <h4 className="font-sans font-bold text-zinc-200 text-sm sm:text-base leading-tight">{site.name}</h4>
                    </div>
                    <p className="text-[10px] sm:text-xs text-zinc-400 mt-1 font-sans leading-none">{site.location}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-widest leading-none">Sub-Total</p>
                    <p className="font-mono font-bold text-[#E5B830] text-sm sm:text-base mt-2">{Number((siteSum || 0).toFixed(1))} L</p>
                  </div>
                </div>

                {/* Desktop view table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#0C0F1D] border-b border-[#1E273D] text-xs font-bold uppercase text-zinc-300 tracking-wider">
                        <th className="py-3 px-4 font-sans font-extrabold">Date Time</th>
                        <th className="py-3 px-4 font-sans font-extrabold">Vehicle/Machine #</th>
                        <th className="py-3 px-4 text-right font-sans font-extrabold">Fuel Volume</th>
                        <th className="py-3 px-4 font-sans font-extrabold">Logged Agent</th>
                        <th className="py-3 px-4 text-center font-sans font-extrabold">Receipt Logsheet</th>
                        <th className="py-3 px-4 max-w-xs font-sans font-extrabold">Notes</th>
                        <th className="py-3 px-4 text-right font-sans font-extrabold">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E273D]/30 text-sm">
                      {siteLogsSubset.map((log) => (
                        <tr key={log.id} className="hover:bg-white/5 transition">
                          <td className="py-2 px-4 whitespace-nowrap text-zinc-400 font-mono">
                            {new Date(log.dateTime).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-2 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono font-bold text-[#E5B830] bg-[#E5B830]/10 px-1.5 py-0.5 rounded border border-[#E5B830]/20 w-fit">
                                {log.vehicleNumber}
                              </span>
                              {log.vehicleMeterReading && (
                                <span className="text-[10px] text-zinc-400 font-mono pl-0.5" title="Logged meter reading">
                                  Meter: {log.vehicleMeterReading}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-zinc-200 whitespace-nowrap">
                            {(log.quantityLitres || 0).toFixed(1)} L
                          </td>
                          <td className="py-2 px-4 whitespace-nowrap text-zinc-300 font-medium font-sans">
                            {log.agentName}
                          </td>
                          <td className="py-2 px-4 text-center">
                            {log.logSheetBase64 || log.logSheetFilename ? (
                              <button
                                type="button"
                                onClick={() => setActivePreviewLog(log)}
                                className="mx-auto p-1.5 text-[#138A8E] hover:text-[#1CA8AD] hover:bg-[#138A8E]/10 rounded transition shrink-0 inline-flex items-center gap-1 cursor-pointer"
                                title="View uploaded slip receipt"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-bold font-mono">Preview</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-zinc-500 font-sans italic">None</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-zinc-400 italic max-w-xs truncate font-sans" title={log.notes}>
                            {log.notes || '-'}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                triggerConfirm({
                                  title: 'Delete Fuel Consumption Record',
                                  message: `Are you sure you want to delete this fuel entry of ${(log.quantityLitres || 0).toFixed(1)} Litres for vehicle ${log.vehicleNumber} logged by ${log.agentName}? This action is permanent.`,
                                  confirmLabel: 'Delete Entry',
                                  variant: 'danger',
                                  onConfirm: () => onDeleteLog(log.id),
                                });
                              }}
                              className="p-1.5 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-955/20 transition inline-block text-right cursor-pointer"
                              title="Delete log entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Compact Mobile Card view for small cellphones */}
                <div className="block md:hidden divide-y divide-[#1E273D]/30">
                  {siteLogsSubset.map((log) => (
                    <div key={log.id} className="p-3.5 space-y-2.5 hover:bg-white/5 transition text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-zinc-400 font-mono">
                          {new Date(log.dateTime).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <span className="font-mono font-bold text-zinc-200">
                          {log.quantityLitres.toFixed(1)} L
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500 font-mono">Fleet:</span>
                          <span className="font-mono font-bold text-[#E5B830] bg-[#E5B830]/10 px-1.5 py-0.5 rounded border border-[#E5B830]/20 leading-none">
                            {log.vehicleNumber}
                          </span>
                          {log.vehicleMeterReading && (
                            <span className="text-[10px] text-zinc-400 font-mono bg-[#1E273D]/50 px-1.5 py-0.5 rounded border border-[#1E273D] leading-none" title="Vehicle meter reading">
                              ⏱️ {log.vehicleMeterReading}
                            </span>
                          )}
                        </div>
                        <span className="text-zinc-400">
                          By: <span className="font-semibold text-zinc-300">{log.agentName}</span>
                        </span>
                      </div>

                      {log.notes && (
                        <p className="text-xs text-zinc-400 bg-[#0C0F1D]/50 px-2.5 py-1.5 rounded border border-[#1E273D] italic">
                          {log.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-3 pt-1">
                        {log.logSheetBase64 || log.logSheetFilename ? (
                          <button
                            type="button"
                            onClick={() => setActivePreviewLog(log)}
                            className="px-2.5 py-1 text-xs text-[#138A8E] hover:text-[#1CA8AD] hover:bg-[#138A8E]/10 border border-[#138A8E]/25 rounded transition flex items-center gap-1 cursor-pointer"
                          >
                            <Paperclip className="h-3 w-3 shrink-0" />
                            <span className="text-[10px] font-bold">Preview Slip</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => {
                            triggerConfirm({
                              title: 'Delete Fuel Consumption Record',
                              message: `Are you sure you want to delete this fuel entry of ${log.quantityLitres.toFixed(1)} Litres for vehicle ${log.vehicleNumber} logged by ${log.agentName}? This action is permanent.`,
                              confirmLabel: 'Delete Entry',
                              variant: 'danger',
                              onConfirm: () => onDeleteLog(log.id),
                            });
                          }}
                          className="p-1 px-2 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-955/10 border border-transparent hover:border-rose-500/20 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold">Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Chronological flat view
    return (
      <>
        {/* Desktop view table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-sm">
            <thead>
              <tr className="bg-[#0C0F1D] border-b border-[#1E273D] text-xs font-bold uppercase text-zinc-300 tracking-wider">
                <th className="py-3.5 px-4 font-sans font-extrabold">Date & Time</th>
                <th className="py-3.5 px-4 font-sans font-extrabold">Construction Site</th>
                <th className="py-3.5 px-4 font-sans font-extrabold">Vehicle/Fleet ID</th>
                <th className="py-3.5 px-4 text-right font-sans font-extrabold">Quantity</th>
                <th className="py-3.5 px-4 font-sans font-extrabold">Logged By</th>
                <th className="py-3.5 px-4 text-center font-sans font-extrabold">Attachment</th>
                <th className="py-3.5 px-4 max-w-xs font-sans font-extrabold">Notes & Comments</th>
                <th className="py-3.5 px-4 text-right font-sans font-extrabold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D263B]/50 text-sm text-zinc-300">
              {filteredLogs.map((log) => {
                const site = sites.find((s) => s.id === log.siteId);
                return (
                  <tr key={log.id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-zinc-400 font-mono">
                      {new Date(log.dateTime).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-sans">
                        <span className="font-mono text-xs font-extrabold bg-[#E5B830]/10 text-[#E5B830] px-2 py-1 rounded border border-[#E5B830]/20 leading-none uppercase shrink-0">
                          {site?.code || 'N/A'}
                        </span>
                        <span className="font-semibold text-zinc-200 line-clamp-1 truncate max-w-[130px] font-sans">{site?.name || 'Unknown Site'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono font-bold text-zinc-200 bg-[#161D32] px-1.5 py-0.5 rounded border border-[#232F4C] w-fit">
                          {log.vehicleNumber}
                        </span>
                        {log.vehicleMeterReading && (
                          <span className="text-[10px] text-zinc-455 font-mono pl-0.5" title="Logged meter reading">
                            Meter: {log.vehicleMeterReading}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#E5B830] whitespace-nowrap">
                      {(log.quantityLitres || 0).toFixed(1)} L
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-zinc-300 font-medium font-sans">
                      {log.agentName}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {log.logSheetBase64 || log.logSheetFilename ? (
                        <button
                          type="button"
                          onClick={() => setActivePreviewLog(log)}
                          className="p-1 px-2 text-[#138A8E] hover:text-[#1CA8AD] hover:bg-[#138A8E]/10 border border-[#138A8E]/30 rounded transition inline-flex items-center gap-1 cursor-pointer"
                          title="Preview slip image"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-[10px] font-bold font-mono">View</span>
                        </button>
                      ) : (
                        <span className="text-zinc-600 italic font-sans text-xs font-normal">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 italic max-w-xs truncate font-sans" title={log.notes}>
                      {log.notes || '-'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          triggerConfirm({
                            title: 'Delete Fuel Consumption Record',
                            message: `Are you sure you want to delete this fuel entry of ${(log.quantityLitres || 0).toFixed(1)} Litres for vehicle ${log.vehicleNumber} logged by ${log.agentName}? This action is permanent.`,
                            confirmLabel: 'Delete Entry',
                            variant: 'danger',
                            onConfirm: () => onDeleteLog(log.id),
                          });
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-300 rounded hover:bg-[#FF3B30]/10 transition inline-block cursor-pointer"
                        title="Delete log"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Compact Mobile Card list */}
        <div className="block md:hidden divide-y divide-[#1D263B]/40">
          {filteredLogs.map((log) => {
            const site = sites.find((s) => s.id === log.siteId);
            return (
              <div key={log.id} className="p-4 space-y-3.5 hover:bg-white/5 transition text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-455 font-mono">
                    {new Date(log.dateTime).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span className="font-mono font-bold text-sm text-[#E5B830]">
                    {(log.quantityLitres || 0).toFixed(1)} L
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] font-extrabold bg-[#E5B830]/10 text-[#E5B830] px-1.5 py-0.5 rounded border border-[#E5B830]/20 leading-none uppercase">
                    {site?.code || 'N/A'}
                  </span>
                  <span className="text-xs text-zinc-305 font-semibold truncate max-w-[150px] font-sans">
                    {site?.name || 'Unknown Site'}
                  </span>
                  <div className="flex flex-col items-end gap-1 ml-auto">
                    <span className="font-mono text-xs font-bold text-zinc-200 bg-[#161D32] px-1.5 py-0.5 rounded border border-[#232F4C]">
                      {log.vehicleNumber}
                    </span>
                    {log.vehicleMeterReading && (
                      <span className="text-[10px] text-zinc-455 font-mono">
                        Meter: {log.vehicleMeterReading}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-zinc-400 pt-0.5">
                  <span>By: <span className="font-medium text-zinc-300">{log.agentName}</span></span>
                  
                  <div className="flex items-center gap-2">
                    {log.logSheetBase64 || log.logSheetFilename ? (
                      <button
                        type="button"
                        onClick={() => setActivePreviewLog(log)}
                        className="px-2 py-1 text-xs text-[#138A8E] hover:text-[#1CA8AD] hover:bg-[#138A8E]/10 border border-[#138A8E]/25 rounded transition flex items-center gap-1 cursor-pointer"
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-[10px] font-bold">Preview</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        triggerConfirm({
                          title: 'Delete Fuel Consumption Record',
                          message: `Are you sure you want to delete this fuel entry of ${(log.quantityLitres || 0).toFixed(1)} Litres for vehicle ${log.vehicleNumber} logged by ${log.agentName}? This action is permanent.`,
                          confirmLabel: 'Delete Entry',
                          variant: 'danger',
                          onConfirm: () => onDeleteLog(log.id),
                        });
                      }}
                      className="p-1 px-2 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-955/15 border border-transparent hover:border-rose-500/20 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold">Delete</span>
                    </button>
                  </div>
                </div>

                {log.notes && (
                  <p className="text-xs text-zinc-400 bg-[#0C0F1D]/50 px-2.5 py-1.5 rounded border border-[#1D263B]/40 italic font-sans">
                    {log.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* CUMULATIVE STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <motion.div 
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.02 }}
          whileHover={{ y: -4, scale: 1.02, boxShadow: "0 15px 30px -5px rgba(17,226,188,0.06)" }}
          className="bg-[#13192B] border border-[#1E273D] rounded-xl p-4 shadow-sm flex items-center justify-between transition-shadow duration-300"
        >
          <div>
            <p className="text-[10px] font-extrabold text-[#11E2BC] uppercase tracking-widest font-sans">Total Consumption</p>
            <h3 className="font-mono font-bold text-lg text-white mt-1">
              {Number((totalLitres || 0).toFixed(1))} <span className="text-xs text-zinc-400 font-semibold font-sans">Litres</span>
            </h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Cumulative all sites</p>
          </div>
          <motion.div 
            whileHover={{ rotate: 12, scale: 1.1 }}
            className="p-2.5 bg-[#E5B830]/10 text-[#E5B830] rounded-xl border border-[#E5B830]/15"
          >
            <TrendingUp className="h-5 w-5" />
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.035 }}
          whileHover={{ y: -4, scale: 1.02, boxShadow: "0 15px 30px -5px rgba(229,184,48,0.06)" }}
          className="bg-[#13192B] border border-[#1E273D] rounded-xl p-4 shadow-sm flex items-center justify-between transition-shadow duration-300"
        >
          <div>
            <p className="text-[10px] font-extrabold text-[#E5B830] uppercase tracking-widest font-sans">Diesel Expenditure</p>
            <h3 className="font-mono font-bold text-lg text-white mt-1">
              R {costAnalysis.totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            {costAnalysis.unratedLitres > 0 ? (
              <p className="text-[9px] text-orange-400 mt-0.5 leading-none">
                {costAnalysis.unratedLitres.toLocaleString()} L missing rate
              </p>
            ) : (
              <p className="text-[9px] text-[#11E2BC] mt-0.5 leading-none">
                Fully mapped to monthly rates
              </p>
            )}
          </div>
          <motion.div 
            whileHover={{ rotate: 12, scale: 1.1 }}
            className="p-2.5 bg-[#E5B830]/10 text-[#E5B830] rounded-xl border border-[#E5B830]/15"
          >
            <Fuel className="h-5 w-5" />
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.05 }}
          whileHover={{ y: -4, scale: 1.02, boxShadow: "0 15px 30px -5px rgba(19,138,142,0.06)" }}
          className="bg-[#13192B] border border-[#1E273D] rounded-xl p-4 shadow-sm flex items-center justify-between transition-shadow duration-300"
        >
          <div>
            <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-sans">Transactions</p>
            <h3 className="font-mono font-bold text-lg text-white mt-1">
              {totalLogs} <span className="text-xs text-zinc-400 font-semibold font-sans">records</span>
            </h3>
            <p className="text-[10px] text-zinc-400 mt-0.5 font-sans">Logs submitted</p>
          </div>
          <motion.div 
            whileHover={{ rotate: -12, scale: 1.1 }}
            className="p-2.5 bg-[#138A8E]/10 text-[#138A8E] rounded-xl border border-[#138A8E]/15"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.065 }}
          whileHover={{ y: -4, scale: 1.02, boxShadow: "0 15px 30px -5px rgba(229,184,48,0.06)" }}
          className="bg-[#13192B] border border-[#1E273D] rounded-xl p-4 shadow-sm flex items-center justify-between transition-shadow duration-300"
        >
          <div>
            <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-sans">Average Refuel</p>
            <h3 className="font-mono font-bold text-lg text-white mt-1">
              {Number((avgLitres || 0).toFixed(1))} <span className="text-xs text-zinc-400 font-semibold font-sans">L / log</span>
            </h3>
            <p className="text-[10px] text-zinc-400 mt-0.5 font-sans">Mean per vehicle</p>
          </div>
          <motion.div 
            whileHover={{ rotate: 12, scale: 1.1 }}
            className="p-2.5 bg-[#7C7D6E]/15 text-[#CED1A9] rounded-xl border border-[#7C7D6E]/20"
          >
            <BarChart3 className="h-5 w-5" />
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.08 }}
          whileHover={{ y: -4, scale: 1.02, boxShadow: "0 15px 30px -5px rgba(229,184,48,0.06)" }}
          className="bg-[#13192B] border border-[#1E273D] rounded-xl p-4 shadow-sm flex items-center justify-between transition-shadow duration-300"
        >
          <div>
            <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-sans">Peak Load Site</p>
            <h3 className="font-sans font-bold text-sm text-[#E5B830] mt-1 truncate max-w-[140px]" title={getMostActiveSite()}>
              {getMostActiveSite()}
            </h3>
            <p className="text-[10px] text-zinc-400 mt-0.5 font-sans">Max demand source</p>
          </div>
          <motion.div 
            whileHover={{ rotate: -12, scale: 1.1 }}
            className="p-2.5 bg-[#E5B830]/10 text-[#E5B830] rounded-xl border border-[#E5B830]/15"
          >
            <ArrowDownAZ className="h-5 w-5" />
          </motion.div>
        </motion.div>
      </div>

      {/* HISTORICAL CONSUMPTION GRAPH */}
      <SiteConsumptionChart 
        sites={sites} 
        logs={filteredLogs} 
        selectedSiteId={selectedSiteId} 
      />

      {/* BACKGROUND FLEET TELEMETRY & MILEAGE METRICS */}
      <div id="fleet-mileage-metrics-card" className="bg-[#13192B] border border-[#1E273D] rounded-xl p-5 shadow-sm">
        <div 
          onClick={() => setIsFleetMileageCollapsed(!isFleetMileageCollapsed)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div>
            <span className="text-[10px] bg-[#1E253B] text-[#11E2BC] px-2.5 py-1 rounded-full uppercase font-mono font-bold tracking-widest border border-[#232D4E] select-none">
              Active Fleet Mileage Analyzer
            </span>
            <h3 className="font-sans font-extrabold text-base text-white mt-2 flex items-center gap-2 group-hover:text-[#11E2BC] transition-colors">
              Background Odometer & Economy Ledger
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-0.5 leading-relaxed">
              {isFleetMileageCollapsed ? 'Click to expand fleet tracking & mileage metrics.' : 'Automatically track vehicle kilometers/hours in the background. Click to collapse.'}
            </p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-[#1E253B] border border-[#232D4E] flex items-center justify-center text-zinc-300 group-hover:text-white group-hover:bg-[#273252] transition-all shrink-0 ml-4">
            {isFleetMileageCollapsed ? <ChevronDown className="h-5 w-5 animate-pulse" /> : <ChevronUp className="h-5 w-5" />}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!isFleetMileageCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden space-y-4"
            >
              {fleetMetrics.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-[#1E273D] rounded-xl bg-[#0C101E]">
                  <Gauge className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-zinc-400">No active fleet logs recorded yet.</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Refueling transactions with odometer readings will populate here automatically.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {fleetMetrics.map(({ vehicle, totalL, totalLogsForVehicle, totalDistance, isHours, avgEfficiency, latestMeter, hopCount, hops }) => {
                    const isExpanded = expandedVehicle === vehicle;

                    return (
                      <div 
                        key={vehicle} 
                        className="border border-[#1E273D] rounded-xl overflow-hidden bg-[#161D32]/20 hover:bg-[#161D32]/30 transition-colors duration-200"
                      >
                        {/* Summary Bar */}
                        <div 
                          onClick={() => setExpandedVehicle(isExpanded ? null : vehicle)}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-gradient-to-tr from-[#1E253B] to-[#2B3452] rounded-lg flex items-center justify-center border border-[#232F4C] shrink-0">
                              <Truck className="h-5 w-5 text-[#E5B830]" />
                            </div>
                            <div>
                              <h4 className="font-mono font-bold text-sm text-zinc-100 flex items-center gap-2">
                                {vehicle}
                                <span className="font-sans text-[10px] text-zinc-500 font-normal normal-case">
                                  ({totalLogsForVehicle} {totalLogsForVehicle === 1 ? 'log' : 'logs'})
                                </span>
                              </h4>
                              <p className="text-[10px] text-zinc-450 mt-0.5">
                                Latest Reading: <span className="font-mono font-semibold text-zinc-300">{latestMeter}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                            <div className="text-left sm:text-right">
                              <p className="text-[9px] uppercase tracking-wider font-bold text-zinc-500">Distance Covered</p>
                              <p className="font-mono text-xs font-semibold text-zinc-350">
                                {totalDistance > 0 ? `+${totalDistance.toLocaleString()} ${isHours ? 'hrs' : 'km'}` : '—'}
                              </p>
                            </div>

                            <div className="text-left sm:text-right">
                              <p className="text-[9px] uppercase tracking-wider font-bold text-zinc-500">Total Refueled</p>
                              <p className="font-mono text-xs font-bold text-[#E5B830]">
                                {totalL.toFixed(1)} L
                              </p>
                            </div>

                            <div className="text-left sm:text-right">
                              <p className="text-[9px] uppercase tracking-wider font-bold text-[#11E2BC]">Est. Economy Rate</p>
                              <p className="font-mono text-xs font-black text-[#11E2BC]">
                                {avgEfficiency !== null ? (
                                  `${avgEfficiency.toFixed(1)} ${isHours ? 'L/hr' : 'L/100km'}`
                                ) : (
                                  <span className="text-zinc-550 font-normal text-[10px]">Need ≥2 meter logs</span>
                                )}
                              </p>
                            </div>

                            <div className="text-zinc-400">
                              <span className="text-[10px] font-sans hover:text-[#11E2BC] transition underline cursor-pointer decoration-dotted">
                                {isExpanded ? 'Hide Steps' : 'Inspect Hops'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Refuel Hop History */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-[#0C101D] border-t border-[#1E273D] overflow-hidden"
                            >
                              <div className="p-4 space-y-3">
                                <h5 className="text-[10px] uppercase font-bold text-[#E5B830] tracking-wider">Odometer Refueling Journeys (Chronological Steps)</h5>
                                {hops.length === 0 ? (
                                  <p className="text-[10px] text-zinc-500 italic">
                                    Not enough consecutive odometer logs registered to produce comparison segments. Please ensure meter values are entered correctly for consecutive refueling entries.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-[11px] font-mono">
                                      <thead>
                                        <tr className="border-b border-[#1E273D] text-[9px] uppercase text-zinc-550 font-bold select-none">
                                          <th className="pb-1.5 font-semibold">Date</th>
                                          <th className="pb-1.5 font-semibold">Site Project</th>
                                          <th className="pb-1.5 font-semibold">Odometer Range</th>
                                          <th className="pb-1.5 font-semibold text-right">Interval Dist.</th>
                                          <th className="pb-1.5 font-semibold text-right">Fuel Logged</th>
                                          <th className="pb-1.5 font-semibold text-right text-[#11E2BC]">Calculated consumption</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#1E273D]/30">
                                        {hops.map((hop, hopIdx) => (
                                          <tr key={hopIdx} className="hover:bg-white/2 transition-colors">
                                            <td className="py-2 text-zinc-400 font-sans">
                                              {new Date(hop.date).toLocaleDateString()}
                                            </td>
                                            <td className="py-2 text-zinc-300 font-sans truncate max-w-[150px]">
                                              {hop.siteName}
                                            </td>
                                            <td className="py-2 text-zinc-400 font-mono">
                                              {hop.fromMeter.toLocaleString()} → {hop.toMeter.toLocaleString()}
                                            </td>
                                            <td className="py-2 text-right text-zinc-350 font-bold">
                                              +{hop.distance.toLocaleString()} {hop.isHrs ? 'hrs' : 'km'}
                                            </td>
                                            <td className="py-2 text-right text-[#E5B830] font-bold">
                                              {hop.litresLogged.toFixed(1)} L
                                            </td>
                                            <td className="py-2 text-right text-[#11E2BC] font-black">
                                              {hop.efficiencyRate.toFixed(1)} {hop.isHrs ? 'L/hr' : 'L/100km'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DIRECTIVE 5: ADJUSTABLE MONTHLY DIESEL RATE COST CONTROL */}
      <div id="diesel-rates-cost-control-card" className="bg-[#13192B] border border-[#1E273D] rounded-xl p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1D263C] pb-4">
          <div>
            <span className="text-[10px] bg-[#2E281F] text-[#E5B830] px-2.5 py-1 rounded-full uppercase font-mono font-bold tracking-widest border border-[#403423] select-none">
              Budgets & Finance Controller
            </span>
            <h3 className="font-sans font-extrabold text-base text-white mt-2 flex items-center gap-1.5">
              <Fuel className="h-5 w-5 text-[#E5B830]" /> Diesel Cost Control & Monthly Rates Manager
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Set and adjust the diesel currency exchange rate per litre on a monthly basis. All fuel costs are calculated dynamically.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] bg-[#0C101E] px-3 py-1.5 rounded-lg border border-[#1E273D] text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            Role: <strong className="text-white uppercase font-mono text-[10px]">{currentUser?.role || 'Guest'}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ADJUSTER FORM */}
          <div className="lg:col-span-4 bg-[#0C101E] border border-[#1E273D] p-4 rounded-xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#E5B830] font-sans">Set / Adjust Rate</h4>
            
            {currentUser?.role === 'management' ? (
              <form onSubmit={handleRateSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="rate-effective-date-select" className="block text-[10px] font-bold text-zinc-400 uppercase mb-1 font-sans">
                    Effective Start Date
                  </label>
                  <input
                    id="rate-effective-date-select"
                    type="date"
                    required
                    value={selectedEffectiveDate}
                    onChange={(e) => setSelectedEffectiveDate(e.target.value)}
                    className="w-full bg-[#13192B] border border-[#232D4E] rounded-lg px-3 py-2 text-xs font-mono text-white focus:ring-1 focus:ring-[#E5B830] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="rate-price-input" className="block text-[10px] font-bold text-zinc-400 uppercase mb-1 font-sans">
                    Diesel Rate (ZAR / Litre)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-black text-[#E5B830] font-mono">
                      R
                    </span>
                    <input
                      id="rate-price-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="e.g. 25.50"
                      value={monthRate}
                      onChange={(e) => setMonthRate(e.target.value)}
                      className="w-full bg-[#13192B] border border-[#232D4E] rounded-lg pl-8 pr-3 py-2 text-xs font-mono text-white focus:ring-1 focus:ring-[#E5B830] focus:outline-none"
                    />
                  </div>
                </div>

                {rateError && (
                  <div className="text-[10px] bg-red-955/45 text-red-400 border border-red-900/40 p-2 rounded-lg font-sans flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{rateError}</span>
                  </div>
                )}

                {rateSuccess && (
                  <div className="text-[10px] bg-emerald-955/45 text-emerald-400 border border-emerald-900/40 p-2 rounded-lg font-sans flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 shrink-0" />
                    <span>{rateSuccess}</span>
                  </div>
                )}

                <button
                  id="diesel-rate-submit-btn"
                  type="submit"
                  className="w-full py-2 bg-[#E5B830] hover:bg-[#F2C542] text-[#0C101E] text-xs font-bold uppercase rounded-lg shadow-md transition font-sans flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  Save / Adjust Rate
                </button>
              </form>
            ) : (
              <div className="p-4 bg-[#1E1715]/40 border border-[#40231D]/45 text-zinc-300 rounded-xl space-y-2.5">
                <ShieldAlert className="h-6 w-6 text-[#E5634B]" />
                <p className="text-[11px] font-semibold text-white font-sans">Authorized Management Access Only</p>
                <p className="text-[10px] leading-relaxed font-sans text-zinc-400">
                  Your profile role is currently registered as <strong className="text-zinc-300 font-mono uppercase">{currentUser?.role || 'Guest'}</strong>. Monthly rate editing is restricted to authorized company administrators and cost controllers.
                </p>
              </div>
            )}
          </div>

          {/* HISTORICAL RATES TABLE */}
          <div className="lg:col-span-8 bg-[#0C101E] border border-[#1E273D] p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#1D263B]/55 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-sans">
                Rate Card Ledger
              </h4>
              {dieselRates && dieselRates.length > 0 && (
                <button
                  id="download-rates-ledger-btn"
                  onClick={handleExportRatesXLSX}
                  className="flex items-center gap-1.5 text-[10px] bg-[#E5B830]/10 hover:bg-[#E5B830]/20 text-[#E5B830] px-3 py-1 rounded-lg font-bold uppercase border border-[#E5B830]/15 hover:border-[#E5B830]/30 transition shrink-0 cursor-pointer"
                  title="Download Rates Ledger and Full Transaction Rate Auditing Detail as Excel Workbook"
                >
                  <Download className="h-3 w-3" />
                  <span>Download Rates Report</span>
                </button>
              )}
            </div>
            
            {dieselRates.length === 0 ? (
              <div className="p-10 text-center border border-dashed border-[#1E273D] rounded-xl bg-[#13192B]/40">
                <Clipboard className="h-8 w-8 text-zinc-650 mx-auto mb-2" />
                <p className="text-xs font-bold text-zinc-400">No rates registered yet.</p>
                <p className="text-[9px] text-zinc-500 mt-1">
                  Configure monthly rates to map all diesel refueling logs to actual cost expenditures automatically.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] font-sans">
                  <thead>
                    <tr className="border-b border-[#1E273D] text-[9px] uppercase text-zinc-500 font-bold select-none">
                      <th className="pb-2">Effective Date</th>
                      <th className="pb-2 text-right">Fuel Rate</th>
                      <th className="pb-2 text-right">Vol. Consumed</th>
                      <th className="pb-2 text-right text-[#E5B830]">Est. Spend</th>
                      <th className="pb-2 text-right">Audited By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D263B]/35">
                    {/* Sort rates by effectiveDate desc */}
                    {(() => {
                      const todayStr = new Date().toISOString().substring(0, 10);
                      const activeRatesToday = dieselRates.filter(r => r.effectiveDate <= todayStr);
                      let currentRateIdToday = '';
                      if (activeRatesToday.length > 0) {
                        const sorted = [...activeRatesToday].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
                        currentRateIdToday = sorted[0].id;
                      }

                      return dieselRates
                        .slice()
                        .sort((a,b) => b.effectiveDate.localeCompare(a.effectiveDate))
                        .map((rate) => {
                          const logsForThisRate = logs.filter(log => {
                            const costInfo = getLogCost(log);
                            return costInfo.hasRate && costInfo.effectiveDate === rate.effectiveDate;
                          });
                          const lConsumed = logsForThisRate.reduce((sum, log) => sum + log.quantityLitres, 0);
                          const spend = lConsumed * rate.rate;
                          const isCurrentActive = rate.id === currentRateIdToday;

                          return (
                            <tr key={rate.id} className="hover:bg-white/2 transition-colors">
                              <td className="py-2.5 font-bold text-white flex items-center gap-1.5 min-w-[120px]">
                                {formatEffectiveDateToHuman(rate.effectiveDate)}
                                {isCurrentActive && (
                                  <span className="text-[8px] bg-emerald-950 text-[#11E2BC] border border-emerald-900 px-1 py-0.5 rounded font-black uppercase animate-pulse">
                                    Current Today
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 text-right font-mono text-zinc-300 font-bold whitespace-nowrap">
                                R {rate.rate.toFixed(2)} / L
                              </td>
                              <td className="py-2.5 text-right font-mono text-zinc-400">
                                {lConsumed > 0 ? `${lConsumed.toLocaleString()} L` : '0 L'}
                              </td>
                              <td className="py-2.5 text-right font-mono text-[#E5B830] font-black">
                                {spend > 0 ? `R ${spend.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R 0.00'}
                              </td>
                              <td className="py-2.5 text-right text-zinc-400 font-mono text-[10px]">
                                <div className="truncate max-w-[140px]" title={`Last updated: ${new Date(rate.updatedAt).toLocaleDateString()}`}>
                                  {rate.updatedBy} <span className="text-[9px] text-zinc-500 block">{new Date(rate.updatedAt).toLocaleDateString()}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADMIN EXPORTS ACTION BAR */}
      <div className="bg-[#182136] border border-[#232F4C] text-white rounded-xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <span className="text-[10px] bg-[#222E4E] text-[#E5B830] px-2.5 py-1 rounded-full uppercase font-bold tracking-widest border border-[#2D3C65] select-none">
              Classification Report Engine
            </span>
            <h3 className="font-sans font-bold text-base mt-2 text-zinc-100">Export Sites Cumulative Diesel Logs</h3>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed max-w-xl font-sans">
              Download worksheets formatted for spreadsheets or printable auditor logs. Excel outputs automatically classify logs on different tabs grouped by construction site!
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {/* 1. EXCEL EXPORTER */}
            <button
              id="export-excel-btn"
              type="button"
              onClick={handleExportXLSX}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-sans uppercase rounded-full shadow transition flex items-center gap-1.5 cursor-pointer border border-[#1B5E20]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download Excel (.XLSX)
            </button>

            {/* 2. GOOGLE SHEETS CSV EXPORTER */}
            <button
              id="export-csv-btn"
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2 bg-[#111625] hover:bg-[#1E273D] text-[#E5B830] border border-[#1E273D] text-xs font-bold font-sans uppercase rounded-full shadow transition flex items-center gap-1.5 cursor-pointer animate-fade-in"
            >
              <Download className="h-4 w-4" />
              Download Google Sheets (.CSV)
            </button>

            {/* 3. PRINT FOR PDF */}
            <button
              id="export-pdf-btn"
              type="button"
              onClick={handlePrintTrigger}
              className="px-4 py-2 bg-[#2D3452]/40 hover:bg-[#2D3452]/60 text-zinc-100 text-xs font-bold font-sans uppercase rounded-full shadow transition flex items-center gap-1.5 cursor-pointer border border-[#2D3452]"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>

            {/* 4. FINANCE DIESEL RATES REPORT */}
            {dieselRates && dieselRates.length > 0 && (
              <button
                id="export-rates-btn"
                type="button"
                onClick={handleExportRatesXLSX}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold font-sans uppercase rounded-full shadow transition flex items-center gap-1.5 cursor-pointer border border-amber-700 animate-fade-in"
                title="Download Diesel Price Ledger and Full Transaction Audit Worksheet"
              >
                <Fuel className="h-4 w-4" />
                Diesel Rates Report
              </button>
            )}
          </div>
        </div>

        {feedbackMessage && (
          <div id="download-feedback-msg" className="mt-4 p-2.5 bg-[#112423] border border-[#138A8E]/30 text-[#11E2BC] text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="h-4 w-4 shrink-0 text-[#11E2BC]" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {isDeveloper && onGenerateTestData && (
          <div className="mt-4 pt-4 border-t border-[#232F4C] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-2 max-w-xl">
              <span className="text-amber-400 mt-0.5 font-bold font-mono">⚡</span>
              <p className="text-xs text-zinc-350 leading-relaxed font-sans">
                <strong>Auditing Sheet Formats?</strong> Generate <span className="text-[#E5B830] font-bold font-mono">100 premium randomized logs</span> to check spreadsheet formatting, report multi-tab sheets, and site search logic, or revert to clean defaults.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 self-stretch sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerConfirm({
                    title: '⚡ Generate 100 Records Test Dataset?',
                    message: 'This will instantly insert 100 premium diesel consumption logs and 4 corporate construction sites into your browser ledger. Existing sites are auto-matched, and new ones are created if none exist.',
                    confirmLabel: 'Generate Test Dataset',
                    variant: 'info',
                    onConfirm: () => {
                      onGenerateTestData();
                      setFeedbackMessage('⚡ 100 high-fidelity test logs and construction project sites have been enrolled in the local database successfully!');
                      setTimeout(() => setFeedbackMessage(null), 5050);
                    }
                  });
                }}
                className="px-4 py-2 bg-[#E5B830]/10 hover:bg-[#E5B830]/20 text-[#E5B830] border border-[#E5B830]/25 text-xs font-bold font-sans uppercase rounded-full transition duration-150 cursor-pointer select-none shadow shrink-0"
              >
                Generate 100 Test Logs
              </button>

              {onResetData && (
                <button
                  type="button"
                  onClick={() => {
                    triggerConfirm({
                      title: '🗑️ Delete Test Logs & Revert Ledger?',
                      message: 'Are you sure you want to completely clear the 100 test logs and revert your local database to original pristine corporate logsheet defaults?',
                      confirmLabel: 'Delete & Revert Data',
                      variant: 'danger',
                      onConfirm: () => {
                        onResetData();
                        setFeedbackMessage('🗑️ Test datasets cleared successfully! Local ledger restored to standard initial defaults.');
                        setTimeout(() => setFeedbackMessage(null), 5050);
                      }
                    });
                  }}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-extrabold border border-rose-500/25 text-xs font-sans uppercase rounded-full transition duration-150 cursor-pointer select-none shadow shrink-0"
                >
                  Delete & Revert Test Data
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FILTER & DATA ROW CONTROLS */}
      <div className="bg-[#13192B] border border-[#1E273D] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 pb-2.5 border-b border-[#1E273D]/30">
          <div className="flex bg-[#111625] p-1.5 rounded-xl border border-[#232F4C] gap-1 shrink-0 select-none">
            <button
              type="button"
              onClick={() => setReportTab('consumption')}
              className={`py-2.5 px-4 rounded-lg font-sans font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition duration-200 cursor-pointer border ${
                reportTab === 'consumption'
                  ? 'bg-[#E5B830]/15 border-[#E5B830]/35 text-[#E5B830] shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-white/5'
              }`}
            >
              <Fuel className="h-4 w-4" />
              <span>Fleet Refueling Logs</span>
            </button>
            <button
              type="button"
              onClick={() => setReportTab('deliveries')}
              className={`py-2.5 px-4 rounded-lg font-sans font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition duration-200 cursor-pointer border ${
                reportTab === 'deliveries'
                  ? 'bg-[#138A8E]/15 border-[#138A8E]/35 text-[#11E2BC] shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-white/5'
              }`}
            >
              <Clipboard className="h-4 w-4" />
              <span>Bulk Deliveries Logs</span>
            </button>
            <button
              type="button"
              onClick={() => setReportTab('ai_balance')}
              className={`py-2.5 px-4 rounded-lg font-sans font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition duration-200 cursor-pointer border ${
                reportTab === 'ai_balance'
                  ? 'bg-purple-500/15 border-purple-500/35 text-purple-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-white/5'
              }`}
            >
              <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
              <span>AI Day/Night Balancer</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Visual Classification Toggle */}
            <div className={`flex items-center gap-2 bg-[#161D32] border border-[#232F4C] px-3 py-1.5 rounded-lg transition-opacity ${reportTab === 'deliveries' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <span className="text-xs font-semibold text-zinc-400 select-none">Classify/Group-by Site:</span>
              <button
                id="group-by-site-toggle"
                type="button"
                onClick={() => setGroupBySite(!groupBySite)}
                className={`w-10 h-6 rounded-full p-1 transition-colors outline-none cursor-pointer ${
                  groupBySite ? 'bg-[#E5B830]' : 'bg-[#1E273F]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    groupBySite ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* INPUT FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Site select */}
          <div>
            <label className="block text-xs uppercase font-extrabold text-zinc-300 tracking-wider mb-1.5 font-sans">Filter Site</label>
            <select
              id="dashboard-site-filter"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm font-medium text-zinc-200 focus:bg-[#1A223C] outline-none"
            >
              <option value="all">All Sites (Unfiltered)</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  [{s.code}] {s.name} {s.status === 'closed' ? '(Closed)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs uppercase font-extrabold text-zinc-300 tracking-wider mb-1.5 font-sans">Start Date</label>
            <input
              id="filter-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 outline-none focus:bg-[#1A223C]"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs uppercase font-extrabold text-zinc-300 tracking-wider mb-1.5 font-sans">End Date</label>
            <input
              id="filter-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-[#D4D4D8] outline-none focus:bg-[#1A223C]"
            />
          </div>

          {/* Search bar */}
          <div>
            <label className="block text-xs uppercase font-extrabold text-zinc-300 tracking-wider mb-1.5 font-sans">Search Keyword</label>
            <input
              id="filter-search-input"
              type="text"
              placeholder="Machine code, agent, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-[#D4D4D8] placeholder-zinc-550 outline-none focus:bg-[#1A223C]"
            />
          </div>
        </div>

        {/* SUB-TOTALS INDICATOR */}
        {(selectedSiteId !== 'all' || startDate || endDate || searchQuery) && (
          reportTab === 'consumption' ? (
            <div className="mt-3 py-2 px-3 bg-[#E5B830]/10 border border-[#E5B830]/20 rounded-lg text-xs text-zinc-200 flex justify-between items-center select-none font-medium">
              <span>Filter Active: Listing <span className="font-bold text-[#E5B830] font-sans">{filteredLogs.length}</span> of {totalLogs} transactions</span>
              <span>Filtered Total: <span className="font-bold underline text-[#E5B830] font-mono">{Number((filteredLitres || 0).toFixed(1))} Litres</span></span>
            </div>
          ) : (
            <div className="mt-3 py-2 px-3 bg-[#138A8E]/10 border border-[#138A8E]/30 rounded-lg text-xs text-zinc-200 flex justify-between items-center select-none font-medium">
              <span>Filter Active: Listing <span className="font-bold text-[#11E2BC] bg-[#11E2BC]/10 px-1.5 py-0.5 rounded border border-[#11E2BC]/20 font-sans">{filteredDeliveries.length}</span> of {totalDeliveriesCount} deliveries</span>
              <span>Filtered Total: <span className="font-bold underline text-[#11E2BC] font-mono">{Number((filteredDeliveryQty || 0).toFixed(1))} Litres</span></span>
            </div>
          )
        )}
      </div>

      {/* CORE GRID LOGS VIEW */}
      <div className="bg-[#13192B] border border-[#1E273D] rounded-xl shadow-sm overflow-hidden animate-fade-in">
        {renderGridContent()}
      </div>

      {/* RENDER MODAL PREVIEW FOR LOGSHEETS */}
      {activePreviewLog && (
        <div id="file-preview-modal" className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#13192B] rounded-xl overflow-hidden shadow-2xl max-w-lg w-full border border-[#1E273D] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Title bar */}
            <div className="bg-[#181F35] text-white px-5 py-4 flex items-center justify-between border-b border-[#232F4C]">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-[#138A8E]" />
                <h3 className="font-sans font-bold text-sm text-zinc-200 font-sans">Attachment: Log Sheet / Slip</h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewLog(null)}
                className="p-1 text-zinc-450 hover:text-white rounded-full bg-[#1E273D] hover:bg-[#25324D] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Contents */}
            <div className="p-6">
              <div className="bg-[#111625] rounded-lg p-3 text-xs text-zinc-350 space-y-2 mb-4 border border-[#1E273D]">
                <p><strong>Site:</strong> {sites.find(s => s.id === activePreviewLog.siteId)?.name || `${activeCompany?.name || 'KMC'} Project`}</p>
                <p><strong>Log Ref:</strong> {activePreviewLog.quantityLitres} Litres at {new Date(activePreviewLog.dateTime).toLocaleString()} ({activePreviewLog.vehicleNumber})</p>
                {activePreviewLog.vehicleMeterReading && (
                  <p><strong>Meter Reading:</strong> <span className="font-mono text-[#E5B830] font-bold">{activePreviewLog.vehicleMeterReading}</span></p>
                )}
                <p><strong>Agent:</strong> {activePreviewLog.agentName}</p>
              </div>

              {activePreviewLog.logSheetBase64 ? (
                activePreviewLog.logSheetBase64.startsWith('data:image') ? (
                  <div className="max-h-96 rounded border border-[#1E273D] overflow-y-auto bg-black flex items-center justify-center p-2">
                    <img 
                      src={activePreviewLog.logSheetBase64} 
                      alt="Full receipts logs slip preview" 
                      className="max-h-80 max-w-full object-contain rounded animate-fade-in"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="p-8 text-center bg-[#111625] border border-[#1E273D] rounded-xl">
                    <FileText className="h-16 w-16 text-zinc-500 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-zinc-200 font-sans">PDF Logsheet File</p>
                    <p className="text-xs text-zinc-500 font-mono mt-1">{activePreviewLog.logSheetFilename}</p>
                    <a
                      href={activePreviewLog.logSheetBase64}
                      download={activePreviewLog.logSheetFilename || 'download.pdf'}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#E5B830] hover:bg-[#F2C94C] text-[#0C0F1D] text-xs font-bold rounded-lg transition font-sans"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF Logsheet
                    </a>
                  </div>
                )
              ) : (
                <div className="p-12 text-center bg-[#111625] border border-[#1E273D] rounded-xl">
                  <FileText className="h-12 w-12 text-zinc-650 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">File uploaded without persistent data backing.</p>
                  <p className="text-[10px] text-zinc-400 mt-1 font-mono">Filename: {activePreviewLog.logSheetFilename}</p>
                </div>
              )}
            </div>

            {/* Close */}
            <div className="px-5 py-3.5 bg-[#111625] border-t border-[#1E273D] text-right">
              <button
                type="button"
                onClick={() => setActivePreviewLog(null)}
                className="px-4 py-1.5 bg-[#1E273D] hover:bg-[#25324D] text-[#E5B830] text-xs font-bold font-sans uppercase rounded border border-[#2D395A] shadow-sm cursor-pointer"
              >
                Dismiss Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL HIDDEN PRINT FRAME (VISIBLE ONLY WHEN PRINT DIALOG TRIGGERS) */}
      {showPrintView && (
        <div className="fixed inset-0 bg-white text-black p-10 z-[100] h-full overflow-y-auto block print-layout">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Construction Header */}
            <div className="border-b-4 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black uppercase text-slate-900 tracking-tight font-sans">
                  {activeCompany?.legalName || 'KMC Construction (Pty) Ltd'}
                </h1>
                <p className="text-xs text-slate-600 font-bold uppercase font-sans mt-1">
                  {reportTab === 'consumption'
                    ? 'Diesel Fuel Consumption Summary Report'
                    : 'Diesel Bulk Deliveries Audit Summary Report'
                  }
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Extracted On: {new Date().toLocaleString()} (Local Station)
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold text-slate-800">{activeCompany?.name || 'KMC'} Fleet & Logistics</p>
                <p className="text-slate-600 mt-0.5">diesel-management@{(activeCompany?.name || 'kmcconstruction').toLowerCase().replace(/\s+/g, '')}.co.za</p>
                <p className="text-[11px] text-slate-500 font-mono">Report Ref: {(activeCompany?.logoInitials || 'KMC')}-DSL-{new Date().toISOString().slice(0, 10)}</p>
              </div>
            </div>

            {/* Print Meta Details */}
            <div className="grid grid-cols-3 gap-6 bg-slate-100 p-4 border border-slate-300 text-xs rounded">
              <div>
                <p className="text-slate-500 font-bold uppercase text-[9px]">Scope Filter</p>
                <p className="font-bold text-slate-800 mt-1">
                  {selectedSiteId === 'all' ? 'All Active & Closed Sites' : `${sites.find(s=>s.id===selectedSiteId)?.name} (${sites.find(s=>s.id===selectedSiteId)?.code})`}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-bold uppercase text-[9px]">Period Window</p>
                <p className="font-bold text-slate-800 mt-1">
                  {startDate || 'Earliest Logs'} to {endDate || 'Latest Current Date'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-bold uppercase text-[9px]">Cumulative Volume</p>
                <p className="font-bold text-slate-900 mt-1 font-mono text-sm underline">
                  {reportTab === 'consumption'
                    ? `${Number((filteredLitres || 0).toFixed(1))} Litres (${filteredLogs.length} logs)`
                    : `${Number((filteredDeliveryQty || 0).toFixed(1))} Litres (${filteredDeliveries.length} deliveries)`
                  }
                </p>
              </div>
            </div>

            {/* Print Data Table */}
            <div>
              {reportTab === 'consumption' ? (
                <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-400 text-[10px] font-bold uppercase text-slate-800">
                      <th className="py-2 px-3 border border-slate-400">Date Time</th>
                      <th className="py-2 px-3 border border-slate-400">Site Code / Name</th>
                      <th className="py-2 px-3 border border-slate-400">Vehicle / Fleet #</th>
                      <th className="py-2 px-3 border border-slate-400 text-right">Fuel (L)</th>
                      <th className="py-2 px-3 border border-slate-400">Site Agent</th>
                      <th className="py-2 px-3 border border-slate-400">Slip Referenced</th>
                      <th className="py-2 px-3 border border-slate-400 max-w-xs">Audit Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {filteredLogs.map((log) => {
                      const site = sites.find(s => s.id === log.siteId);
                      return (
                        <tr key={log.id} className="text-[11px]">
                          <td className="py-1.5 px-3 border border-slate-300 font-mono text-slate-600 font-sans">
                            {new Date(log.dateTime).toLocaleString('en-ZA')}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-bold font-sans">
                            [{site?.code}] {site?.name.substring(0, 20)}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-mono">
                            <div className="font-semibold">{log.vehicleNumber}</div>
                            {log.vehicleMeterReading && (
                              <div className="text-[9px] text-slate-500 font-normal">Meter: {log.vehicleMeterReading}</div>
                            )}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-bold text-black font-sans">
                            {(log.quantityLitres || 0).toFixed(1)} L
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-medium font-sans">
                            {log.agentName}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-mono">
                            {log.logSheetFilename || 'No record slip uploaded'}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 text-slate-500 italic font-sans animate-fade-in">
                            {log.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 font-bold font-sans">
                      <td colSpan={3} className="py-2 px-3 border border-slate-400 text-right text-xs">REPORT SUB-TOTALS</td>
                      <td className="py-2 px-3 border border-slate-400 text-right font-mono text-sm underline text-xs">{Number((filteredLitres || 0).toFixed(1))} L</td>
                      <td colSpan={3} className="py-2 px-3 border border-slate-400 font-normal italic text-slate-500 text-xs">
                        {activeCompany?.name || 'KMC Construction'} Diesel Ledger Classified Audit
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-400 text-[10px] font-bold uppercase text-slate-800">
                      <th className="py-2 px-3 border border-slate-400">Date Time</th>
                      <th className="py-2 px-3 border border-slate-400">Site Code / Name</th>
                      <th className="py-2 px-3 border border-slate-400">Supplier/Transporter</th>
                      <th className="py-2 px-3 border border-slate-400">Delivery Note Number</th>
                      <th className="py-2 px-3 border border-slate-400">KMP Order Number</th>
                      <th className="py-2 px-3 border border-slate-400 text-right">Invoice Vol (L)</th>
                      <th className="py-2 px-3 border border-slate-400 text-right">Variance (L)</th>
                      <th className="py-2 px-3 border border-slate-400">Site Agent</th>
                      <th className="py-2 px-3 border border-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {filteredDeliveries.map((delivery) => {
                      const site = sites.find(s => s.id === delivery.siteId);
                      const diff = ((delivery.closingDip || 0) - (delivery.openingDip || 0)) - (delivery.quantityLitres || 0);
                      const isPerfect = Math.abs(diff) < 0.1;
                      const pct = (delivery.quantityLitres || 0) > 0 ? (diff / (delivery.quantityLitres || 0)) * 100 : 0;
                      return (
                        <tr key={delivery.id} className="text-[11px]">
                          <td className="py-1.5 px-3 border border-slate-300 font-mono text-slate-600 font-sans">
                            {new Date(delivery.dateTime).toLocaleString('en-ZA')}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-bold font-sans">
                            [{site?.code || 'N/A'}] {site?.name?.substring(0, 20) || 'Unknown Site'}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-sans font-medium text-slate-700">
                            {delivery.deliveredBy}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-mono font-bold uppercase">
                            {delivery.deliveryNote}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-mono font-bold uppercase">
                            {delivery.kmpOrder}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-bold text-black font-sans">
                            {(delivery.quantityLitres || 0).toFixed(1)} L
                          </td>
                          <td className={`py-1.5 px-3 border border-slate-300 text-right font-mono font-bold font-sans ${isPerfect ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isPerfect ? '0.0 L' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)} L (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)`}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-medium font-sans">
                            {delivery.agentName}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-sans text-[10px]">
                            {isPerfect ? 'Perfect Match' : delivery.isOverridden ? 'Overridden' : 'Variance Alert'}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 font-bold font-sans">
                      <td colSpan={5} className="py-2 px-3 border border-slate-400 text-right text-xs">REPORT SUB-TOTALS</td>
                      <td className="py-2 px-3 border border-slate-400 text-right font-mono text-sm underline text-xs">{Number((filteredDeliveryQty || 0).toFixed(1))} L</td>
                      <td colSpan={3} className="py-2 px-3 border border-slate-400 font-normal italic text-slate-500 text-xs">
                        {activeCompany?.name || 'KMC Construction'} Diesel Deliveries Classified Audit
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Signature section */}
            <div className="grid grid-cols-2 gap-12 pt-16 font-sans">
              <div>
                <div className="border-b border-black h-8"></div>
                <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Authorized {activeCompany?.logoInitials || 'KMC'} Representative</p>
                <p className="text-[9px] text-slate-400">Date: ________________________</p>
              </div>
              <div>
                <div className="border-b border-black h-8"></div>
                <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Internal Site Agent Supervisor</p>
                <p className="text-[9px] text-slate-400">Date: ________________________</p>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    
      {/* Confirmation Overlay */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}
