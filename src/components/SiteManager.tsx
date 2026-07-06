/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlusCircle, Search, ToggleLeft, ShieldAlert, Award, PlayCircle, MapPin, Layers, CheckCircle2, XCircle, RotateCcw, Sliders, Calendar } from 'lucide-react';
import { ConstructionSite, DieselLog } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface SiteManagerProps {
  sites: ConstructionSite[];
  logs: DieselLog[];
  onAddSite: (newSite: Omit<ConstructionSite, 'id' | 'createdAt' | 'closedAt' | 'status'>) => void;
  onToggleSiteStatus: (siteId: string) => void;
  onResetData: () => void;
  isDeveloper?: boolean;
}

export default function SiteManager({ sites, logs, onAddSite, onToggleSiteStatus, onResetData, isDeveloper }: SiteManagerProps) {
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

  // Local form states
  const [siteName, setSiteName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [location, setLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // Stats calculate
  const getSiteStats = (siteId: string) => {
    const siteLogs = logs.filter((l) => l.siteId === siteId);
    const totalLitres = siteLogs.reduce((acc, curr) => acc + (curr.quantityLitres || 0), 0);
    return {
      count: siteLogs.length,
      litres: totalLitres || 0,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim() || !siteCode.trim() || !location.trim()) {
      setErrorText('All fields are required.');
      return;
    }

    // Check if code or name is duplicate
    const normalizedCode = siteCode.trim().toUpperCase();
    if (sites.some(s => s.code.toUpperCase() === normalizedCode)) {
      setErrorText(`Site Code "${normalizedCode}" already exists. Please choose a unique identifier.`);
      return;
    }

    onAddSite({
      name: siteName.trim(),
      code: normalizedCode,
      location: location.trim(),
    });

    setSuccessText(`Successfully registered construction site "${siteName.trim()}"!`);
    setSiteName('');
    setSiteCode('');
    setLocation('');
    setErrorText(null);

    setTimeout(() => {
      setSuccessText(null);
    }, 4500);
  };

  // Filter sites
  const filteredSites = sites.filter((site) => {
    const matchesSearch = 
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'active') return matchesSearch && site.status === 'active';
    if (statusFilter === 'closed') return matchesSearch && site.status === 'closed';
    return matchesSearch;
  });

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT COLUMN: ADD NEW SITE */}
      <div className="lg:col-span-1 bg-[#13192B] border border-[#1E273D] rounded-xl shadow-2xl p-4 sm:p-6 self-start">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-5 w-5 text-[#E5B830] shrink-0" />
          <h2 className="font-sans font-bold text-zinc-100 text-base">New Construction Site</h2>
        </div>
        <p className="text-sm text-zinc-350 mb-4 leading-relaxed">
          Register new project sites here. Once configured, site agents will be able to log diesel consumption against them under their unique codes.
        </p>

        {errorText && (
          <div id="site-error-alert" className="mb-4 p-3 bg-rose-950/30 border-l-4 border-rose-500 rounded text-rose-300 text-xs border border-rose-900/40">
            {errorText}
          </div>
        )}

        {successText && (
          <div id="site-success-alert" className="mb-4 p-3 bg-[#138A8E]/10 border-l-4 border-[#138A8E] rounded text-emerald-300 text-xs font-semibold border border-[#138A8E]/30">
            {successText}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs uppercase font-extrabold text-zinc-350 tracking-wider">Site Name *</label>
            <input
              id="new-site-name-input"
              type="text"
              placeholder="e.g. Durban Port Terminal Expansion"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="block w-full px-3 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm font-medium text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs uppercase font-extrabold text-zinc-350 tracking-wider">Unique Site Code *</label>
            <input
              id="new-site-code-input"
              type="text"
              placeholder="e.g. JHB-CENTRAL-01"
              value={siteCode}
              onChange={(e) => setSiteCode(e.target.value)}
              className="block w-full px-3 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm font-bold text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none uppercase font-mono tracking-wider transition"
              required
            />
            <p className="text-xs text-zinc-400 font-mono">Used for reporting and classification keys.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs uppercase font-extrabold text-zinc-350 tracking-wider">Geographical Location *</label>
            <input
              id="new-site-location-input"
              type="text"
              placeholder="e.g. Berth 203, Port of Durban"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="block w-full px-3 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm font-medium text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition"
              required
            />
          </div>

          <button
            id="register-site-button"
            type="submit"
            className="w-full mt-3 py-3 px-5 bg-[#E5B830] hover:bg-[#F2C94C] text-[#0C0F1D] font-sans font-extrabold text-sm uppercase tracking-wider rounded-full shadow-md hover:shadow-lg transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            REGISTER ACTIVE SITE
          </button>
        </form>

        {isDeveloper && (
          <div className="mt-8 pt-6 border-t border-[#1C253C] space-y-3">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <Sliders className="h-4 w-4 text-[#138A8E]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#138A8E]">Ledger Maintenance</span>
            </div>
            <p className="text-xs text-zinc-455 leading-relaxed">
              Need to permanently purge all construction sites and refuel logs from this device?
            </p>
            <button
              id="reset-demo-data-button"
              type="button"
              onClick={() => {
                triggerConfirm({
                  title: 'Clear Database Records',
                  message: 'This will permanently delete ALL registered construction sites and fuel consumption logs from this device. This action is completely irreversible.',
                  confirmLabel: 'Purge Database',
                  variant: 'danger',
                  onConfirm: onResetData,
                });
              }}
              className="w-full py-2 px-4 bg-[#111625] hover:bg-[#1E273D] border border-rose-900/30 text-rose-450 hover:text-rose-400 font-bold tracking-tight text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border-dashed rounded-full"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear All Records
            </button>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: DIRECTORY & ARCHIVE OPERATIONS */}
      <div className="lg:col-span-2 bg-[#13192B] border border-[#1E273D] rounded-xl shadow-2xl p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-sans font-bold text-zinc-100 text-lg">Site Directory & Status Tracking</h2>
            <p className="text-xs text-zinc-400 mt-0.5 font-sans">Manage and close off decommissioned or completed active sites</p>
          </div>
          
          {/* Quick Stats Summary badges */}
          <div className="flex items-center gap-2 text-xs">
            <div className="bg-[#138A8E]/15 text-[#138A8E] border border-[#138A8E]/25 px-3 py-1.5 rounded-full text-xs font-bold font-mono">
              {sites.filter(s => s.status === 'active').length} Active
            </div>
            <div className="bg-zinc-800/40 text-zinc-400 border border-zinc-700/40 px-3 py-1.5 rounded-full text-xs font-bold font-mono">
              {sites.filter(s => s.status === 'closed').length} Closed
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="sm:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              id="site-search-bar"
              type="text"
              placeholder="Search site name, unique code, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm font-medium text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition"
            />
          </div>

          <div>
            <select
              id="site-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="block w-full px-3 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm font-medium text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition cursor-pointer"
            >
              <option value="all">Status: Show All</option>
              <option value="active">Active Projects</option>
              <option value="closed">Closed/Archived</option>
            </select>
          </div>
        </div>

        {/* LISTING */}
        <div className="space-y-4">
          {filteredSites.length === 0 ? (
            <div className="p-12 text-center bg-[#111625] rounded-xl border border-dashed border-[#1E273D]">
              <Search className="h-8 w-8 text-zinc-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-450">No Construction Sites Matched</p>
              <p className="text-xs text-zinc-500 mt-1">Try resetting your filters or registering a new active site.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              <AnimatePresence mode="popLayout">
                {filteredSites.map((site) => {
                  const stats = getSiteStats(site.id);
                  const isActive = site.status === 'active';

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                      whileHover={{ y: -3, transition: { duration: 0.15 } }}
                      key={site.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-colors duration-250 flex flex-col justify-between ${
                        isActive 
                          ? 'bg-[#151D35] border-[#222E4E] border-l-4 border-l-emerald-500 shadow-md shadow-emerald-950/10 hover:border-[#138A8E]/40 hover:shadow-lg hover:shadow-emerald-950/15' 
                          : 'bg-[#0E1322] border-[#182035] border-l-4 border-l-zinc-650 opacity-70 shadow-none'
                      }`}
                    >
                      <div>
                        {/* Badge and Code Header */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded border shrink-0 ${
                            isActive 
                              ? 'text-[#E5B830] bg-[#E5B830]/8 border-[#E5B830]/20' 
                              : 'text-zinc-500 bg-zinc-900/60 border-zinc-800'
                          }`}>
                            {site.code}
                          </span>
                          
                          <div className="flex items-center gap-1.5 font-sans">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1.5 text-xs uppercase font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Operational
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs uppercase font-extrabold text-zinc-400 bg-zinc-900/60 px-2.5 py-1 rounded-full border border-zinc-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                                Closed / Archived
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Site Names */}
                        <h3 className={`font-sans font-extrabold text-base tracking-tight mb-1 line-clamp-1 ${
                          isActive 
                            ? 'text-zinc-100' 
                            : 'text-zinc-405 line-through decoration-zinc-650'
                        }`}>
                          {site.name}
                        </h3>

                        <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-3.5">
                          <MapPin className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-[#138A8E]' : 'text-zinc-600'}`} />
                          <span className={`line-clamp-1 ${isActive ? 'text-zinc-300' : 'text-zinc-550'}`}>{site.location}</span>
                        </div>

                        {/* Cumulative Site Stats */}
                        <div className={`grid grid-cols-2 gap-2 p-3 rounded-xl border font-mono text-sm mb-4 ${
                          isActive 
                            ? 'bg-[#0E1322] border-[#1C253C]' 
                            : 'bg-zinc-950/20 border-zinc-900/40'
                        }`}>
                          <div>
                            <p className={`text-[10px] uppercase font-sans font-bold tracking-wider ${isActive ? 'text-zinc-400' : 'text-zinc-550'}`}>Total Used</p>
                            <p className={`font-bold mt-1 text-sm ${isActive ? 'text-[#E5B830]' : 'text-zinc-500'}`}>
                              {Number((stats.litres || 0).toFixed(1))} <span className="font-semibold text-xs text-zinc-500">L</span>
                            </p>
                          </div>
                          <div>
                            <p className={`text-[10px] uppercase font-sans font-bold tracking-wider ${isActive ? 'text-zinc-400' : 'text-zinc-550'}`}>Ledger Submissions</p>
                            <p className={`font-bold mt-1 text-sm ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                              {stats.count} <span className="font-semibold text-xs text-zinc-500">logs</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action Controls for Status Versatility */}
                      <div className="pt-3 border-t border-[#1E273D] flex items-center justify-between text-xs">
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                          <span>Est. {new Date(site.createdAt).toLocaleDateString()}</span>
                        </div>

                        {isActive ? (
                          <button
                            id={`close-site-${site.id}`}
                            type="button"
                            onClick={() => {
                              triggerConfirm({
                                title: 'Close Off Construction Site',
                                message: `Are you sure you want to CLOSE "${site.name}"? Once closed, site agents will no longer be able to log active diesel consumption against this code.`,
                                confirmLabel: 'Close Off Project',
                                variant: 'warning',
                                onConfirm: () => onToggleSiteStatus(site.id),
                              });
                            }}
                            className="px-3 py-1.5 bg-[#1C253C] hover:bg-rose-950/30 text-[#E5B830] hover:text-rose-400 border border-[#232F4C] hover:border-rose-900/40 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer select-none"
                          >
                            Decommission Project
                          </button>
                        ) : (
                          <button
                            id={`reopen-site-${site.id}`}
                            type="button"
                            onClick={() => {
                              triggerConfirm({
                                title: 'Re-Open Construction Site',
                                message: `Would you like to re-open "${site.name}"? Active site agents will immediately be allowed to file fuel transactions for this site again.`,
                                confirmLabel: 'Re-Open Site',
                                variant: 'info',
                                onConfirm: () => onToggleSiteStatus(site.id),
                              });
                            }}
                            className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer select-none shadow"
                          >
                            Re-open Site
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
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
