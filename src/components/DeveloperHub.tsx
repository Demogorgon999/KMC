import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, Users, Radio, Activity, Shield, RefreshCw, X, Check, Laptop, Wifi, 
  Clock, Trash2, Cpu, Building, Key, UserCheck, UserX, Plus, ChevronDown, ChevronUp, Save, PlusCircle, Copy, Upload, Image
} from 'lucide-react';
import { User, ConstructionSite, DieselLog, CompanyProfile } from '../types';

interface DeveloperHubProps {
  currentUser: User;
  activeUsers: User[];
  consoleEvents: Array<{
    id: string;
    timestamp: string;
    message: string;
    userEmail?: string;
  }>;
  sites: ConstructionSite[];
  logs: DieselLog[];
  onGenerateTestData?: () => void;
  onResetData?: () => void;
  companies?: CompanyProfile[];
  onUpdateCompanies?: (updated: CompanyProfile[]) => void;
  activeCompany: CompanyProfile;
  onSwitchCompany: (company: CompanyProfile) => void;
}

export default function DeveloperHub({
  currentUser,
  activeUsers,
  consoleEvents,
  sites,
  logs,
  onGenerateTestData,
  onResetData,
  companies = [],
  onUpdateCompanies,
  activeCompany,
  onSwitchCompany,
}: DeveloperHubProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tickerMessage, setTickerMessage] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // New developer-centric sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'tenants'>('audit');

  // Tenant management states
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [expandedCompId, setExpandedCompId] = useState<string | null>(null);
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };
  
  // New Corporate Workspace Onboarding form state
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompLegal, setNewCompLegal] = useState('');
  const [newCompInitials, setNewCompInitials] = useState('');
  const [newCompAdminKey, setNewCompAdminKey] = useState('');
  const [newCompTagline, setNewCompTagline] = useState('Bulk Fuel Status & Fleet Ledger');
  const [newCompPColor, setNewCompPColor] = useState('#138A8E');
  const [newCompSColor, setNewCompSColor] = useState('#E5B830');
  const [newCompLogoUrl, setNewCompLogoUrl] = useState<string | undefined>(undefined);
  const [newCompReg, setNewCompReg] = useState('');
  const [isDraggingDevLogo, setIsDraggingDevLogo] = useState(false);
  const devLogoInputRef = React.useRef<HTMLInputElement>(null);
  const [compError, setCompError] = useState('');
  const [compSuccess, setCompSuccess] = useState('');

  // Corporate editing and deleting state tracker
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editCompName, setEditCompName] = useState('');
  const [editCompLegal, setEditCompLegal] = useState('');
  const [editCompInitials, setEditCompInitials] = useState('');
  const [editCompAdminKey, setEditCompAdminKey] = useState('');
  const [editCompTagline, setEditCompTagline] = useState('');
  const [editCompPColor, setEditCompPColor] = useState('#138A8E');
  const [editCompSColor, setEditCompSColor] = useState('#E5B830');
  const [editCompLogoUrl, setEditCompLogoUrl] = useState<string | undefined>(undefined);
  const [editCompReg, setEditCompReg] = useState('');
  const [isDraggingEditLogo, setIsDraggingEditLogo] = useState(false);
  const editLogoInputRef = useRef<HTMLInputElement>(null);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);

  // Auto-scroll the event console ticker
  useEffect(() => {
    if (terminalEndRef.current && activeSubTab === 'audit') {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleEvents, isOpen, activeSubTab]);

  // Flash ticker when new event lands
  useEffect(() => {
    if (consoleEvents.length > 0) {
      const latest = consoleEvents[0];
      setTickerMessage(latest.message);
      const timer = setTimeout(() => {
        setTickerMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [consoleEvents]);

  // Load all user records to filter by workspace
  const reloadUsers = () => {
    const raw = localStorage.getItem('apex_diesel_users');
    if (raw) {
      setAllUsers(JSON.parse(raw));
    } else {
      setAllUsers([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      reloadUsers();
    }
  }, [isOpen]);

  // Format relative timestamp
  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Never';
    const now = new Date();
    const then = new Date(isoString);
    const diffMs = now.getTime() - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m ago`;
  };

  // Override / update bypass security code for a company
  const handleUpdateBypassKey = (companyId: string, inputCode: string) => {
    if (!onUpdateCompanies) return;
    const cleanKey = inputCode.trim().toUpperCase();
    if (!cleanKey) return;

    const updated = companies.map(c => c.id === companyId ? { ...c, adminKey: cleanKey } : c);
    onUpdateCompanies(updated);

    // Save key in general bypass pool as well so AuthScreen can process double-clearance
    const storedKeysRaw = localStorage.getItem('apex_diesel_mgmt_keys');
    const keysPool: string[] = storedKeysRaw ? JSON.parse(storedKeysRaw) : [];
    if (!keysPool.includes(cleanKey)) {
      keysPool.push(cleanKey);
      localStorage.setItem('apex_diesel_mgmt_keys', JSON.stringify(keysPool));
    }

    setEditingKeys(prev => {
      const copy = { ...prev };
      delete copy[companyId];
      return copy;
    });

    // Append to live developer audits
    fetch('/api/sync/log', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        log: { id: `dev-audit-key-${Date.now()}` }, 
        userName: `Developer Override: Reconfigured security bypass code to "${cleanKey}"` 
      })
    }).catch(() => {});
  };

  // Generate random supervisor enrollment key for a specific company
  const handleGenerateBypassKey = (companyId: string, initials: string) => {
    const generated = `${initials.toUpperCase()}-MGR-${Math.floor(1000 + Math.random() * 9000)}`;
    setEditingKeys(prev => ({
      ...prev,
      [companyId]: generated
    }));
    handleUpdateBypassKey(companyId, generated);
  };

  const processDevLogoFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      setCompError('Logo file size too large (max 2MB limit).');
      return;
    }
    setCompError('');
    const reader = new FileReader();
    reader.onload = () => {
      setNewCompLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDevLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processDevLogoFile(files[0]);
    }
  };

  const handleDevLogoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDevLogo(true);
  };

  const handleDevLogoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDevLogo(false);
  };

  const handleDevLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDevLogo(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processDevLogoFile(files[0]);
    }
  };

  // Direct tenant onboarding from developer desk
  const handleAddCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCompError('');
    setCompSuccess('');

    if (!newCompName || !newCompLegal || !newCompInitials || !newCompAdminKey) {
      setCompError('Please complete name, legal name, initials, and administrative sign-up key.');
      return;
    }

    if (!newCompLogoUrl) {
      setCompError('Please upload a company logo before proceeding. All client entities must declare a branding logo.');
      return;
    }

    const cleanInitials = newCompInitials.trim().toUpperCase();
    const cleanKey = newCompAdminKey.trim().toUpperCase();

    if (companies.some(c => c.logoInitials.toUpperCase() === cleanInitials)) {
      setCompError(`A workspace with abbreviation "${cleanInitials}" already exists.`);
      return;
    }

    const newC: CompanyProfile = {
      id: `company-${Date.now()}`,
      name: newCompName.trim(),
      legalName: newCompLegal.trim(),
      logoInitials: cleanInitials,
      tagline: newCompTagline.trim(),
      adminKey: cleanKey,
      primaryColor: newCompPColor,
      secondaryColor: newCompSColor,
      logoUrl: newCompLogoUrl,
      registrationNumber: newCompReg.trim(),
      createdAt: new Date().toISOString()
    };

    if (onUpdateCompanies) {
      onUpdateCompanies([...companies, newC]);

      // Save key in general bypass pool as well
      const storedKeysRaw = localStorage.getItem('apex_diesel_mgmt_keys');
      const keysPool: string[] = storedKeysRaw ? JSON.parse(storedKeysRaw) : [];
      if (!keysPool.includes(cleanKey)) {
        keysPool.push(cleanKey);
        localStorage.setItem('apex_diesel_mgmt_keys', JSON.stringify(keysPool));
      }

      setCompSuccess(`Workspace "${newC.name}" successfully established.`);
      setNewCompName('');
      setNewCompLegal('');
      setNewCompInitials('');
      setNewCompAdminKey('');
      setNewCompLogoUrl(undefined);
      setNewCompReg('');
      setShowAddCompany(false);

      // Append log
      fetch('/api/sync/log', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          log: { id: `dev-add-comp-${Date.now()}` }, 
          userName: `Developer Portal: Established corporate ledger partitioning for ${newC.name} (${newC.logoInitials})` 
        })
      }).catch(() => {});
    }
  };

  const startEditingCompany = (company: CompanyProfile) => {
    setEditingCompanyId(company.id);
    setEditCompName(company.name);
    setEditCompLegal(company.legalName);
    setEditCompInitials(company.logoInitials);
    setEditCompAdminKey(company.adminKey);
    setEditCompTagline(company.tagline || '');
    setEditCompPColor(company.primaryColor);
    setEditCompSColor(company.secondaryColor);
    setEditCompLogoUrl(company.logoUrl);
    setEditCompReg(company.registrationNumber || '');
    setDeletingCompanyId(null);
  };

  const processEditLogoFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      alert('Logo file size too large (max 2MB limit).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditCompLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleEditLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processEditLogoFile(files[0]);
    }
  };

  const handleEditLogoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingEditLogo(true);
  };

  const handleEditLogoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingEditLogo(false);
  };

  const handleEditLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingEditLogo(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processEditLogoFile(files[0]);
    }
  };

  const handleEditCompanySubmit = (e: React.FormEvent, companyId: string) => {
    e.preventDefault();
    if (!editCompName || !editCompLegal || !editCompInitials || !editCompAdminKey) {
      alert('Please complete company name, legal name, initials, and administrative key.');
      return;
    }

    const initialsNorm = editCompInitials.trim().toUpperCase();
    const keyNorm = editCompAdminKey.trim().toUpperCase();

    // Check if initials conflict with OTHER companies
    if (companies.some(c => c.id !== companyId && c.logoInitials.toUpperCase() === initialsNorm)) {
      alert(`Abbreviation "${initialsNorm}" is already used by another workspace.`);
      return;
    }

    const updated = companies.map(c => {
      if (c.id === companyId) {
        return {
          ...c,
          name: editCompName.trim(),
          legalName: editCompLegal.trim(),
          logoInitials: initialsNorm,
          tagline: editCompTagline.trim(),
          adminKey: keyNorm,
          primaryColor: editCompPColor,
          secondaryColor: editCompSColor,
          logoUrl: editCompLogoUrl,
          registrationNumber: editCompReg.trim()
        };
      }
      return c;
    });

    if (onUpdateCompanies) {
      onUpdateCompanies(updated);
      
      // Also update activeCompany if the edited company is currently active
      if (activeCompany.id === companyId) {
        const matching = updated.find(c => c.id === companyId);
        if (matching) {
          onSwitchCompany(matching);
        }
      }

      setEditingCompanyId(null);

      fetch('/api/sync/log', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          log: { id: `dev-edit-comp-${Date.now()}` }, 
          userName: `Developer Portal: Overhauled corporation ledger settings for ${editCompName.trim()} (${initialsNorm})` 
        })
      }).catch(() => {});
    }
  };

  const handleDeleteCompany = (companyId: string) => {
    // KMC construction cannot be deleted from the sandbox so that a master fall-back always exists
    if (companyId === 'company-kmc') {
      alert('Master system tenant (company-kmc) is protected from deletion to ensure platform stability.');
      return;
    }

    const companyToDelete = companies.find(c => c.id === companyId);
    if (!companyToDelete) return;

    const updated = companies.filter(c => c.id !== companyId);

    if (onUpdateCompanies) {
      onUpdateCompanies(updated);

      // If the deleted company was active, switch to the default KMC company or first available
      if (activeCompany.id === companyId) {
        const fallback = updated.find(c => c.id === 'company-kmc') || updated[0] || companies[0];
        if (fallback) {
          onSwitchCompany(fallback);
        }
      }

      setDeletingCompanyId(null);

      fetch('/api/sync/log', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          log: { id: `dev-del-comp-${Date.now()}` }, 
          userName: `Developer Portal: Expunged workspace tenant partition ${companyToDelete.name} (${companyToDelete.logoInitials})` 
        })
      }).catch(() => {});
    }
  };

  // Grant instant security clearance override for pending staff members
  const handleApproveUser = (userId: string) => {
    const raw = localStorage.getItem('apex_diesel_users');
    if (!raw) return;
    const users: User[] = JSON.parse(raw);
    const updated = users.map(u => u.id === userId ? { ...u, status: 'approved' as const } : u);
    localStorage.setItem('apex_diesel_users', JSON.stringify(updated));
    setAllUsers(updated);

    const targetUser = users.find(u => u.id === userId);
    if (targetUser) {
      const comp = companies.find(c => c.id === targetUser.companyId);
      const companyName = comp ? comp.name : 'Partition';
      
      fetch('/api/sync/log', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          log: { id: `dev-user-override-${Date.now()}` }, 
          userName: `Developer Override: Approved security clearance status for ${targetUser.name} under ${companyName}` 
        })
      }).catch(() => {});
    }
  };

  // Revoke account profile immediately
  const handleRevokeUser = (userId: string) => {
    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return;
    if (confirm(`Completely expunge login profile for employee ${targetUser.name} (${targetUser.email})?`)) {
      const raw = localStorage.getItem('apex_diesel_users');
      if (!raw) return;
      const users: User[] = JSON.parse(raw);
      const updated = users.filter(u => u.id !== userId);
      localStorage.setItem('apex_diesel_users', JSON.stringify(updated));
      setAllUsers(updated);

      fetch('/api/sync/log', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          log: { id: `dev-user-revoke-${Date.now()}` }, 
          userName: `Developer Override: Expunged employee login credentials for ${targetUser.name}` 
        })
      }).catch(() => {});
    }
  };

  // Toggle role helper
  const handleToggleRole = (userId: string) => {
    const raw = localStorage.getItem('apex_diesel_users');
    if (!raw) return;
    const users: User[] = JSON.parse(raw);
    const updated = users.map(u => {
      if (u.id === userId) {
        const newRole = u.role === 'management' ? 'agent' as const : 'management' as const;
        return { ...u, role: newRole };
      }
      return u;
    });
    localStorage.setItem('apex_diesel_users', JSON.stringify(updated));
    setAllUsers(updated);
  };

  const isDev = [
    'deanv.d.merwe91@gmail.com',
    'deanv.dmerwe91@gmail.com'
  ].includes(currentUser?.email?.toLowerCase().trim());
  if (!isDev) return null; // Only render for the developer

  return (
    <>
      {/* FLOATING DEVELOPER TRIGGER TAB */}
      <div 
        id="dev-trigger-station"
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none"
      >
        {/* Realtime stream active ticker */}
        <AnimatePresence>
          {tickerMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="bg-[#0C1221] border border-[#E5B830]/30 shadow-[0_4px_16px_rgba(229,184,48,0.2)] px-3 py-2 rounded-xl text-xs font-mono font-semibold text-zinc-100 flex items-center gap-2 max-w-sm pointer-events-auto select-none backdrop-blur-sm"
            >
              <span className="w-2 h-2 rounded-full bg-[#E5B830] animate-ping shrink-0" />
              <div className="line-clamp-2 leading-snug">
                {tickerMessage}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) reloadUsers();
          }}
          className="bg-amber-500/10 hover:bg-amber-500/20 text-[#E5B830] border border-[#E5B830]/40 py-2.5 px-4 rounded-full font-mono font-black text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(229,184,48,0.15)] pointer-events-auto select-none backdrop-blur-md transition hover:scale-[1.03] active:scale-[0.97]"
          whileTap={{ scale: 0.97 }}
        >
          <Terminal className="h-4 w-4 text-[#E5B830] animate-pulse" />
          <span>DEV STATION</span>
          {activeUsers.length > 0 && (
            <span className="bg-[#E5B830] text-[#0C0F1D] px-1.5 py-0.5 rounded-full font-sans font-extrabold text-[9px] min-w-[16px] text-center leading-none">
              {activeUsers.length}
            </span>
          )}
        </motion.button>
      </div>

      {/* DEVELOPER DASHBOARD DRAWER */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-[#060814]/70 backdrop-blur-xs z-49"
            />

            {/* Panel Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-[#0E1322]/98 border-l border-[#202E4E] shadow-[0_0_50px_rgba(0,0,0,0.6)] z-50 overflow-hidden flex flex-col font-sans"
            >
              {/* Header Bar */}
              <div className="p-5 border-b border-[#202E4E] bg-[#11182C]/90 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#E5B830]/10 border border-[#E5B830]/20">
                    <Shield className="h-5 w-5 text-[#E5B830]" />
                  </div>
                  <div>
                    <h2 className="font-sans font-black text-[#F3F4F6] text-sm uppercase tracking-wider">
                      Developer Command Center
                    </h2>
                    <span className="text-[10px] font-mono text-[#138A8E] uppercase tracking-widest font-bold">
                      Control Desk Mode
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-mono text-[9px] uppercase tracking-wider flex items-center gap-1">
                    <Wifi className="h-2.5 w-2.5 animate-pulse" /> Live
                  </span>
                  
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition border border-transparent hover:border-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Stats overview banner */}
              <div className="grid grid-cols-3 divide-x divide-[#202E4E] border-b border-[#202E4E] bg-[#0C101F]/75 text-center p-3 select-none">
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block uppercase font-bold tracking-wider">ACTIVE CLIENTS</span>
                  <p className="font-mono text-[#E5B830] font-black text-sm mt-0.5">{companies.length}</p>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block uppercase font-bold tracking-wider">PLATFORM LOGS</span>
                  <p className="font-mono text-[#138A8E] font-black text-sm mt-0.5">{logs.length}</p>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block uppercase font-bold tracking-wider">TOTAL SITES</span>
                  <p className="font-mono text-rose-400 font-black text-sm mt-0.5">{sites.length}</p>
                </div>
              </div>

              {/* Sub Tab Navigation */}
              <div className="flex border-b border-[#202E4E] bg-[#11182C]/50">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('audit')}
                  className={`flex-1 py-3 text-center text-[10px] font-mono font-bold uppercase tracking-widest transition-colors select-none cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
                    activeSubTab === 'audit'
                      ? 'border-[#E5B830] text-[#E5B830] bg-[#161F36]/30'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[#161F36]/10'
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Audit Monitor</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubTab('tenants');
                    reloadUsers();
                  }}
                  className={`flex-1 py-3 text-center text-[10px] font-mono font-bold uppercase tracking-widest transition-colors select-none cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
                    activeSubTab === 'tenants'
                      ? 'border-[#138A8E] text-[#138A8E] bg-[#161F36]/30'
                      : 'border-transparent text-zinc-400 hover:text-[#138A8E] hover:bg-[#161F36]/10'
                  }`}
                >
                  <Building className="h-3.5 w-3.5" />
                  <span>Tenant codes ({companies.length})</span>
                </button>
              </div>

              {/* Scrollable Content Workspace */}
              <div className="p-6 flex-1 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
                
                {/* ================== SUB TAB: AUDIT MONITOR ================== */}
                {activeSubTab === 'audit' && (
                  <>
                    {/* 1. SECTOR: ACTIVE USER REGISTRY */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-[#202E4E]/60 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-[#138A8E]" />
                          <h3 className="text-[11px] font-mono font-black text-zinc-350 uppercase tracking-widest">
                            Online Sessions ({activeUsers.length})
                          </h3>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">Self heartbeat trace</span>
                      </div>

                      <div className="space-y-2">
                        {activeUsers.length === 0 ? (
                          <div className="p-4 bg-[#0A0D18] border border-dashed border-[#202E4E] rounded-xl text-center select-none text-xs text-zinc-500 font-mono">
                            No other sessions connected
                          </div>
                        ) : (
                          activeUsers.map((user) => {
                            const isSelf = user.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
                            return (
                              <div 
                                key={user.email} 
                                className={`p-3 bg-[#0A0D18] rounded-xl border border-[#1C263E] flex items-center justify-between transition-all duration-150 hover:border-[#2F3F66] ${
                                  isSelf ? 'ring-1 ring-[#E5B830]/25 bg-[#0F1426]' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="relative">
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#138A8E] to-[#E5B830] flex items-center justify-center text-xs font-mono font-bold text-white select-none">
                                      {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#0A0D18] animate-pulse" />
                                  </div>
                                  <div className="font-sans">
                                    <div className="flex items-center gap-1.5 leading-none">
                                      <span className="font-sans font-black text-zinc-200 text-xs">{user.name}</span>
                                      {isSelf && (
                                        <span className="bg-[#E5B830]/10 text-[#E5B830] text-[8px] font-mono font-black uppercase px-1 py-0.5 rounded tracking-widest border border-[#E5B830]/20 leading-none">
                                          YOU (DEV)
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] font-mono text-zinc-500 block mt-1 leading-none">{user.email}</span>
                                  </div>
                                </div>

                                <div className="text-right font-mono select-none">
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded block text-center max-w-fit ml-auto ${
                                    user.role === 'management'
                                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                      : 'bg-emerald-500/10 text-[#11E2BC] border border-emerald-500/20'
                                  }`}>
                                    {user.role}
                                  </span>
                                  <span className="text-[9px] text-zinc-500 block mt-1.5 leading-none font-semibold">
                                    Online
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* 2. SECTOR: REALTIME OPERATIONS MONITOR */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-[#202E4E]/60 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Radio className="h-3.5 w-3.5 text-rose-400" />
                          <h3 className="text-[11px] font-mono font-black text-zinc-350 uppercase tracking-widest">
                            Live Operations Ticker ({consoleEvents.length})
                          </h3>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> Streaming
                        </span>
                      </div>

                      {/* Terminal Log */}
                      <div className="bg-[#050711] border border-[#19233A] rounded-xl p-4 h-[240px] overflow-y-auto font-mono text-[11px] leading-relaxed select-text flex flex-col gap-2 scrollbar-thin scrollbar-thumb-zinc-900">
                        {consoleEvents.length === 0 ? (
                          <div className="my-auto text-center text-zinc-600 italic select-none">
                            &gt; Waiting for active client interactions...<br/>
                            &gt; Try loading test data or capturing logs to test.
                          </div>
                        ) : (
                          consoleEvents.map((evt, idx) => {
                            let colorClass = 'text-zinc-400';
                            if (evt.message.includes('Authenticated') || evt.message.includes('authorized') || evt.message.includes('Session authenticated')) {
                              colorClass = 'text-emerald-400 font-bold';
                            } else if (evt.message.includes('Log Capture') || evt.message.includes('refuel') || evt.message.includes('Log added')) {
                              colorClass = 'text-[#E5B830]';
                            } else if (evt.message.includes('Site Added') || evt.message.includes('Project Site')) {
                              colorClass = 'text-teal-400';
                            } else if (evt.message.includes('Removed') || evt.message.includes('expunged') || evt.message.includes('disconnected')) {
                              colorClass = 'text-rose-400';
                            } else if (evt.message.includes('reverted') || evt.message.includes('Purged')) {
                              colorClass = 'text-purple-400';
                            }

                            return (
                              <div key={evt.id || idx} className="border-b border-zinc-900/40 pb-1.5 flex flex-col gap-0.5">
                                <div className="flex items-center justify-between text-[9px] text-zinc-650 font-semibold select-none">
                                  <span className="text-zinc-600">[{new Date(evt.timestamp).toLocaleTimeString()}]</span>
                                  <span className="text-zinc-600 block text-right">{getRelativeTime(evt.timestamp)}</span>
                                </div>
                                <div className={`${colorClass} whitespace-pre-wrap break-all mt-0.5`}>
                                  &gt; {evt.message}
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={terminalEndRef} />
                      </div>
                    </div>

                    {/* 3. SECTOR: SIMULATION CONTROLS */}
                    <div className="p-4 bg-[#11162B] border border-[#202E4E] rounded-2xl space-y-3">
                      <div className="flex items-center gap-1 border-b border-[#202E4E] pb-2">
                        <Cpu className="h-4 w-4 text-[#E5B830]" />
                        <span className="text-[11px] font-mono font-black uppercase text-[#E5B830] tracking-wider">
                          Debugger Operations Rig
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-normal font-sans">
                        Instantly load artificial heavy-machinery ledger records to perform reporting and analytics simulations.
                      </p>
                      
                      <div className="pt-2 grid grid-cols-2 gap-2.5">
                        {onGenerateTestData && (
                          <button
                            onClick={onGenerateTestData}
                            className="w-full py-2 bg-[#E5B830] hover:bg-[#F2C94C] text-[#0C0F1D] font-mono font-bold text-[10px] uppercase tracking-wider rounded-xl transition hover:scale-[1.02] active:scale-[0.98] shadow-md select-none cursor-pointer flex items-center justify-center gap-1"
                          >
                            <RefreshCw className="h-3 w-3 animate-spin duration-3000 shrink-0" />
                            <span>Simulate 100 Logs</span>
                          </button>
                        )}

                        {onResetData && (
                          <button
                            onClick={() => {
                              if (confirm("Are you sure you want to revert active ledger database to initial factory demo templates? This will expunge all entries.")) {
                                onResetData();
                              }
                            }}
                            className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:border-rose-400 font-mono font-bold text-[10px] uppercase tracking-wider rounded-xl transition hover:scale-[1.02] active:scale-[0.98] select-none cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Trash2 className="h-3 w-3 shrink-0" />
                            <span>Reset Ledger</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* ================== SUB TAB: TENANTS DIRECTORY ================== */}
                {activeSubTab === 'tenants' && (
                  <div className="space-y-5">
                    
                    {/* Collapsible New Enterprise Onboarding portal */}
                    <div className="p-4 bg-[#11162B] border border-[#202E4E] rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-[#138A8E]" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Onboard Corporate Client
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCompany(!showAddCompany);
                            setCompError('');
                            setCompSuccess('');
                          }}
                          className="text-[10px] uppercase font-mono font-bold text-[#138A8E] hover:underline"
                        >
                          {showAddCompany ? '[ HIDE FORM ]' : '[ OPEN FORM ]'}
                        </button>
                      </div>
                      
                      <p className="text-[11px] leading-relaxed text-zinc-400">
                        Register a discrete, customized ledger tenant space. Clients enroll their supervisors by entering the custom workspace abbreviation and administration bypass key.
                      </p>

                      <AnimatePresence>
                        {showAddCompany && (
                          <motion.form
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            onSubmit={handleAddCompanySubmit}
                            className="space-y-3 pt-3 border-t border-[#1C263E] text-xs"
                          >
                            {compError && (
                              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono leading-normal">
                                ⚠ {compError}
                              </div>
                            )}
                            {compSuccess && (
                              <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono leading-normal">
                                ✓ {compSuccess}
                              </div>
                            )}

                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-zinc-400">Company Name</label>
                              <input
                                type="text"
                                value={newCompName}
                                onChange={e => setNewCompName(e.target.value)}
                                placeholder="e.g. Sasol Logistics"
                                className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200"
                                required
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-zinc-400">Legal Entity Registered Name</label>
                              <input
                                type="text"
                                value={newCompLegal}
                                onChange={e => setNewCompLegal(e.target.value)}
                                placeholder="e.g. Sasol Oil Logistics (Pty) Ltd"
                                className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200"
                                required
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="block text-[10px] uppercase font-bold text-zinc-400">Logistics Code (Initials) *</label>
                                <input
                                  type="text"
                                  value={newCompInitials}
                                  onChange={e => setNewCompInitials(e.target.value.toUpperCase().slice(0, 5))}
                                  placeholder="e.g. SSL"
                                  className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200 uppercase font-mono"
                                  required
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[10px] uppercase font-bold text-zinc-400">Management Bypass Key *</label>
                                <input
                                  type="text"
                                  value={newCompAdminKey}
                                  onChange={e => setNewCompAdminKey(e.target.value.toUpperCase())}
                                  placeholder="e.g. SSL-MGR-2026"
                                  className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200 uppercase font-mono"
                                  required
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="block text-[10px] uppercase font-bold text-zinc-400">Company Registration Number</label>
                                <input
                                  type="text"
                                  value={newCompReg}
                                  onChange={e => setNewCompReg(e.target.value)}
                                  placeholder="e.g. 2016/549301/07"
                                  className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200 font-mono text-[11px]"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[10px] uppercase font-bold text-zinc-400">Corporate Tagline / Subtitle</label>
                                <input
                                  type="text"
                                  value={newCompTagline}
                                  onChange={e => setNewCompTagline(e.target.value)}
                                  placeholder="e.g. Bulk Fuel Status & Fleet Ledger"
                                  className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200 text-[11px]"
                                  required
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="block text-[10px] uppercase font-bold text-zinc-400">Primary Accent Color</label>
                                <div className="flex gap-1.5">
                                  <input
                                    type="color"
                                    value={newCompPColor}
                                    onChange={e => setNewCompPColor(e.target.value)}
                                    className="h-7 w-7 rounded bg-transparent border-0 cursor-pointer block shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={newCompPColor}
                                    onChange={e => setNewCompPColor(e.target.value)}
                                    className="w-full bg-[#090D18] text-[10px] border border-[#1E2945] rounded p-1 font-mono"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[10px] uppercase font-bold text-zinc-400">Secondary Accent Color</label>
                                <div className="flex gap-1.5">
                                  <input
                                    type="color"
                                    value={newCompSColor}
                                    onChange={e => setNewCompSColor(e.target.value)}
                                    className="h-7 w-7 rounded bg-transparent border-0 cursor-pointer block shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={newCompSColor}
                                    onChange={e => setNewCompSColor(e.target.value)}
                                    className="w-full bg-[#090D18] text-[10px] border border-[#1E2945] rounded p-1 font-mono"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Drag-and-drop / manual Company Logo selection area */}
                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-zinc-400">
                                Company Brand Logo * (Required)
                              </label>
                              <div
                                onClick={() => devLogoInputRef.current?.click()}
                                onDragOver={handleDevLogoDragOver}
                                onDragLeave={handleDevLogoDragLeave}
                                onDrop={handleDevLogoDrop}
                                className={`group cursor-pointer border-2 border-dashed rounded-xl p-4 text-center transition flex flex-col items-center justify-center select-none ${
                                  isDraggingDevLogo 
                                    ? 'border-[#138A8E] bg-[#138A8E]/5' 
                                    : newCompLogoUrl 
                                    ? 'border-emerald-500/40 bg-emerald-500/5' 
                                    : 'border-[#1E2945] bg-[#090D18] hover:border-[#138A8E]/50'
                                }`}
                                title="Upload or drop company branding graphic image"
                              >
                                <input
                                  type="file"
                                  ref={devLogoInputRef}
                                  onChange={handleDevLogoFileChange}
                                  accept="image/*"
                                  className="hidden"
                                />

                                {newCompLogoUrl ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <span className="p-0.5 px-1.5 text-[8px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded font-mono uppercase font-black tracking-widest leading-none select-none flex items-center gap-1">
                                        <Check className="h-2.5 w-2.5 shrink-0" /> Selected
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setNewCompLogoUrl(undefined);
                                          if (devLogoInputRef.current) devLogoInputRef.current.value = '';
                                        }}
                                        className="text-[8px] text-zinc-500 hover:text-rose-400 uppercase font-mono font-bold hover:underline select-none"
                                        title="Remove selected corporate logo image"
                                      >
                                        [ Remove ]
                                      </button>
                                    </div>
                                    
                                    <div className="mx-auto h-12 w-12 bg-[#090D18] border border-zinc-800 rounded-lg overflow-hidden flex items-center justify-center p-1 relative group-hover:border-zinc-700 transition">
                                      <img
                                        src={newCompLogoUrl}
                                        alt="Uploaded logo preview"
                                        className="max-h-full max-w-full object-contain rounded"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1 py-0.5">
                                    <div className="p-1 rounded-full bg-[#171E36] text-zinc-500 inline-block group-hover:text-[#138A8E] group-hover:bg-[#138A8E]/10 transition">
                                      <Image className="h-4 w-4" />
                                    </div>
                                    <p className="text-[10px] font-bold text-zinc-300">
                                      Drop logo image here, or <span className="text-[#138A8E] hover:underline">browse files</span>
                                    </p>
                                    <p className="text-[8px] text-zinc-500 uppercase font-mono">
                                      JPG, PNG or GIF (Max 2MB limit • Auto-proportioned)
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="submit"
                              className="w-full py-2 bg-[#138A8E] hover:bg-[#1CA8AD] text-white font-mono uppercase text-[10px] font-bold rounded-xl transition cursor-pointer select-none"
                            >
                              Provision Partition Space
                            </button>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Company list details and administrative bypass code triggers */}
                    <div className="space-y-4">
                      <div className="border-b border-[#202E4E]/60 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-[11px] font-mono font-black text-zinc-350 uppercase tracking-widest">
                            Consolidated Client Workspace Ledger
                          </h3>
                          <p className="text-[9px] text-[#138A8E] font-mono uppercase mt-0.5">
                            Cross-Tenant Isolation Desk • Live Local Statistics
                          </p>
                        </div>
                        <span className="text-[9px] bg-[#111827] px-2 py-1 rounded text-zinc-500 font-mono">
                          PLATFORM TENANTS: {companies.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {companies.map((company) => {
                          const usersInComp = allUsers.filter(u => (u.companyId || 'company-kmc') === company.id);
                          const isExpanded = expandedCompId === company.id;
                          const currentEditKey = editingKeys[company.id] !== undefined 
                            ? editingKeys[company.id] 
                            : company.adminKey;

                          // Dynamic Sandbox Scraping for multi-company metrics
                          let sitesCount = 0;
                          let logsCount = 0;
                          let totalLiters = 0;

                          try {
                            const rawSites = localStorage.getItem(`apex_diesel_sites_${company.id}`);
                            if (rawSites) sitesCount = JSON.parse(rawSites).length;

                            const rawLogs = localStorage.getItem(`apex_diesel_logs_${company.id}`);
                            if (rawLogs) {
                              const parsedLogs = JSON.parse(rawLogs);
                              logsCount = parsedLogs.length;
                              totalLiters = parsedLogs.reduce((acc: number, item: any) => {
                                return acc + (parseFloat(item.litersTransferred) || 0);
                              }, 0);
                            }
                          } catch (e) {
                            console.error("Error scraping metrics for company", company.id, e);
                          }

                          const isActiveView = activeCompany.id === company.id;

                          return (
                            <div 
                              key={company.id} 
                              className={`p-4 rounded-2xl border transition duration-200 ${
                                isActiveView 
                                  ? 'bg-[#121B33]/90 border-[#138A8E] shadow-[0_0_20px_rgba(19,138,142,0.15)] ring-1 ring-[#138A8E]/50' 
                                  : 'bg-[#0A0D18] border-[#1C263D] hover:border-zinc-700'
                              }`}
                            >
                              {/* Header Title with initials badge & active preview indicator */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-zinc-900 pb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {company.logoUrl ? (
                                      <img 
                                        src={company.logoUrl} 
                                        alt={`${company.name} logo`} 
                                        className="h-7 w-7 object-contain rounded-md bg-[#0A0D18] border-2 select-none cursor-pointer p-0.5"
                                        style={{ borderColor: company.primaryColor }}
                                        onClick={() => handleCopyToClipboard(company.logoInitials, `${company.id}-initials`)}
                                        title={`Copy workspace initials: ${company.logoInitials}`}
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <span 
                                        className="px-2 py-0.5 rounded font-mono font-black text-[10px] uppercase tracking-wider text-white select-none cursor-pointer animate-pulse" 
                                        style={{ backgroundColor: company.primaryColor }}
                                        onClick={() => handleCopyToClipboard(company.logoInitials, `${company.id}-initials`)}
                                        title="Copy workspace initials to clipboard"
                                      >
                                        {company.logoInitials}
                                      </span>
                                    )}
                                    <h4 className="font-sans font-black text-zinc-100 text-xs uppercase tracking-wide">
                                      {company.name}
                                    </h4>
                                    
                                    {isActiveView && (
                                      <span className="inline-flex items-center gap-1 text-[8px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full uppercase border border-emerald-500/20 tracking-wider animate-pulse select-none">
                                        <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                                        Current Context
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-mono">
                                    <span className="text-[9px] text-zinc-500 uppercase">
                                      {company.legalName}
                                    </span>
                                    {company.registrationNumber && (
                                      <span className="text-[8px] text-[#E5B830]/85 bg-amber-500/5 px-1.5 py-0.5 border border-amber-500/15 rounded uppercase font-bold">
                                        REG: {company.registrationNumber}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                                  {editingCompanyId !== company.id && (
                                    <button
                                      type="button"
                                      onClick={() => startEditingCompany(company)}
                                      className="p-1 px-2.5 bg-[#171E36] hover:bg-zinc-800 border border-[#253051] hover:border-zinc-700 text-zinc-350 hover:text-white text-[10px] font-mono font-bold rounded-lg transition select-none cursor-pointer flex items-center gap-1 shrink-0"
                                      title="Modify brand logo, registration, and colors"
                                    >
                                      <Building className="h-3 w-3 text-[#138A8E]" />
                                      <span>EDIT BRAND</span>
                                    </button>
                                  )}

                                  {!isActiveView ? (
                                    <button
                                      type="button"
                                      onClick={() => onSwitchCompany(company)}
                                      className="px-3 py-1.5 bg-[#138A8E]/15 hover:bg-[#138A8E]/30 text-xs font-mono font-bold rounded-lg text-[#138A8E] hover:text-[#1EC0C6] border border-[#138A8E]/30 hover:border-[#138A8E]/60 transition select-none cursor-pointer flex items-center gap-1 scale-[0.98] hover:scale-100"
                                      title="Switch operational view context to this company database"
                                    >
                                      <RefreshCw className="h-3 w-3 animate-spin duration-3000" />
                                      <span>ACTIVATE</span>
                                    </button>
                                  ) : (
                                    <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-[10px] font-mono font-bold rounded-lg select-none flex items-center gap-1.5">
                                      <Check className="h-3.5 w-3.5" />
                                      <span>ACTIVE</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {editingCompanyId === company.id ? (
                                <form onSubmit={(e) => handleEditCompanySubmit(e, company.id)} className="space-y-4 py-3 border-t border-b border-zinc-900/60 mt-3">
                                  <div className="bg-[#12182B] p-3.5 rounded-xl border border-zinc-800/40 space-y-3">
                                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                                      <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                                        <Building className="h-3.5 w-3.5 text-[#138A8E]" /> BRAND REGISTRY CONFIGURATION
                                      </span>
                                      <button 
                                        type="button" 
                                        onClick={() => setEditingCompanyId(null)}
                                        className="text-[9px] font-mono text-zinc-400 hover:text-zinc-200 uppercase font-bold"
                                      >
                                        [ ESC ]
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <label className="block text-[9px] uppercase font-bold text-zinc-400">Company Name</label>
                                        <input
                                          type="text"
                                          value={editCompName}
                                          onChange={e => setEditCompName(e.target.value)}
                                          className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200 text-xs"
                                          required
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="block text-[9px] uppercase font-bold text-zinc-400">Legal Name</label>
                                        <input
                                          type="text"
                                          value={editCompLegal}
                                          onChange={e => setEditCompLegal(e.target.value)}
                                          className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200 text-xs"
                                          required
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      <div className="space-y-1">
                                        <label className="block text-[9px] uppercase font-bold text-zinc-400">Registration Code</label>
                                        <input
                                          type="text"
                                          value={editCompReg}
                                          onChange={e => setEditCompReg(e.target.value)}
                                          placeholder="e.g. 2016/549301/07"
                                          className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200 font-mono text-xs"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="block text-[9px] uppercase font-bold text-zinc-400">Code (Abbrev) *</label>
                                        <input
                                          type="text"
                                          value={editCompInitials}
                                          onChange={e => setEditCompInitials(e.target.value.toUpperCase().slice(0, 5))}
                                          className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200 uppercase font-mono text-xs"
                                          required
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="block text-[9px] uppercase font-bold text-zinc-400">Bypass Signup Key *</label>
                                        <input
                                          type="text"
                                          value={editCompAdminKey}
                                          onChange={e => setEditCompAdminKey(e.target.value.toUpperCase())}
                                          className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200 uppercase font-mono text-xs"
                                          required
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[9px] uppercase font-bold text-zinc-400">Tagline / Motto</label>
                                      <input
                                        type="text"
                                        value={editCompTagline}
                                        onChange={e => setEditCompTagline(e.target.value)}
                                        className="w-full bg-[#090D18] border border-[#1E2945] rounded p-1.5 text-zinc-200 text-xs"
                                        required
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <label className="block text-[9px] uppercase font-bold text-zinc-400">Primary Color Ascent</label>
                                        <div className="flex gap-2">
                                          <input
                                            type="color"
                                            value={editCompPColor}
                                            onChange={e => setEditCompPColor(e.target.value)}
                                            className="h-8 w-8 rounded bg-transparent border-0 cursor-pointer block shrink-0"
                                          />
                                          <input
                                            type="text"
                                            value={editCompPColor}
                                            onChange={e => setEditCompPColor(e.target.value)}
                                            className="w-full bg-[#090D18] text-xs border border-[#1E2945] rounded p-1.5 font-mono uppercase text-zinc-300"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="block text-[9px] uppercase font-bold text-zinc-400">Secondary Color Accent</label>
                                        <div className="flex gap-2">
                                          <input
                                            type="color"
                                            value={editCompSColor}
                                            onChange={e => setEditCompSColor(e.target.value)}
                                            className="h-8 w-8 rounded bg-transparent border-0 cursor-pointer block shrink-0"
                                          />
                                          <input
                                            type="text"
                                            value={editCompSColor}
                                            onChange={e => setEditCompSColor(e.target.value)}
                                            className="w-full bg-[#090D18] text-xs border border-[#1E2945] rounded p-1.5 font-mono uppercase text-zinc-300"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Company editing brand Graphic Logo Selection area */}
                                    <div className="space-y-1 pt-1">
                                      <label className="block text-[9px] uppercase font-bold text-zinc-400">
                                        Corporate Brand Graphic Logo (Required)
                                      </label>
                                      <div
                                        onClick={() => editLogoInputRef.current?.click()}
                                        onDragOver={handleEditLogoDragOver}
                                        onDragLeave={handleEditLogoDragLeave}
                                        onDrop={handleEditLogoDrop}
                                        className={`group cursor-pointer border-2 border-dashed rounded-xl p-3 text-center transition flex flex-col items-center justify-center select-none ${
                                          isDraggingEditLogo 
                                            ? 'border-[#138A8E] bg-[#138A8E]/5' 
                                            : editCompLogoUrl 
                                            ? 'border-emerald-500/40 bg-emerald-500/5' 
                                            : 'border-[#1E2945] bg-[#090D18] hover:border-[#138A8E]/50'
                                        }`}
                                      >
                                        <input
                                          type="file"
                                          ref={editLogoInputRef}
                                          onChange={handleEditLogoFileChange}
                                          accept="image/*"
                                          className="hidden"
                                        />

                                        {editCompLogoUrl ? (
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-center gap-1.5">
                                              <span className="p-0.5 px-1 py-0.5 text-[8px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded font-mono uppercase font-black tracking-widest leading-none select-none flex items-center gap-1">
                                                <Check className="h-2.5 w-2.5 shrink-0" /> Loaded
                                              </span>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditCompLogoUrl(undefined);
                                                  if (editLogoInputRef.current) editLogoInputRef.current.value = '';
                                                }}
                                                className="text-[8px] text-zinc-500 hover:text-rose-400 uppercase font-mono font-bold hover:underline select-none"
                                              >
                                                [ Clear Custom Logo ]
                                              </button>
                                            </div>
                                            
                                            <div className="mx-auto h-10 w-10 bg-[#090D18] border border-zinc-800 rounded-lg overflow-hidden flex items-center justify-center p-1 relative">
                                              <img
                                                src={editCompLogoUrl}
                                                alt="Edited logo preview"
                                                className="max-h-full max-w-full object-contain rounded"
                                                referrerPolicy="no-referrer"
                                              />
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="space-y-1 py-0.5">
                                            <div className="p-1 rounded-full bg-[#171E36] text-zinc-500 inline-block group-hover:text-[#138A8E] group-hover:bg-[#138A8E]/10 transition">
                                              <Image className="h-3.5 w-3.5" />
                                            </div>
                                            <p className="text-[10px] font-bold text-zinc-300">
                                              Drop logo image, or <span className="text-[#138A8E] hover:underline">browse</span>
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Edit configuration Submission keys actions */}
                                    <div className="flex gap-2 pt-2 border-t border-zinc-850">
                                      <button
                                        type="submit"
                                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono uppercase text-[10px] font-bold rounded-xl transition cursor-pointer select-none flex items-center justify-center gap-1.5"
                                      >
                                        <Save className="h-3.5 w-3.5" /> SAVE LANDSCAPE ALTERATIONS
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingCompanyId(null)}
                                        className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-mono uppercase text-[10px] font-bold rounded-xl transition cursor-pointer select-none"
                                      >
                                        CANCEL
                                      </button>
                                    </div>
                                  </div>

                                  {/* Company Partition Deletion / Deauthorize Danger Zone */}
                                  <div className="p-3.5 rounded-xl border border-rose-950/20 bg-rose-950/5 space-y-2">
                                    <div className="flex items-center gap-1.5">
                                      <Trash2 className="h-4 w-4 text-rose-500" />
                                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-rose-450">Administrative Decommission</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                                      Deauthorizing deletes this client workspace structure permanently. Users registered under this client initials default back to KMC Construction automatically.
                                    </p>

                                    {company.id === 'company-kmc' ? (
                                      <div className="text-[9px] font-mono uppercase text-zinc-500 italic pb-0.5 select-none">
                                        🔒 Primary Tenant Partition (KMC) is system-protected
                                      </div>
                                    ) : deletingCompanyId !== company.id ? (
                                      <button
                                        type="button"
                                        onClick={() => setDeletingCompanyId(company.id)}
                                        className="py-1.5 px-3 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-900/40 hover:border-rose-800 text-rose-400 hover:text-rose-300 text-[9px] font-mono font-bold rounded-lg transition uppercase select-none cursor-pointer"
                                      >
                                        Purge company partition from platform
                                      </button>
                                    ) : (
                                      <div className="space-y-2 p-2 bg-rose-950/20 border border-rose-800/45 rounded-lg">
                                        <span className="block text-[10px] uppercase font-mono font-black text-rose-400">
                                          ⚠️ ARE YOU SURE? CONFIRM PERMANENT EXPUNGEMENT:
                                        </span>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteCompany(company.id)}
                                            className="px-2.5 py-1 bg-rose-650 hover:bg-rose-500 text-white font-mono text-[9px] font-black rounded uppercase transition cursor-pointer select-none"
                                          >
                                            YES, DELETE DEPLOYMENT
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDeletingCompanyId(null)}
                                            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-450 font-mono text-[9px] font-bold rounded uppercase transition cursor-pointer select-none"
                                          >
                                            ABORT
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </form>
                              ) : (
                                <>
                                  {/* Multi-company view: Live Sandbox Metrics Counters */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 py-3 border-b border-zinc-900/60">
                                    <div className="bg-[#0F1424] p-2.5 rounded-xl border border-zinc-800/40">
                                      <span className="block text-[8px] font-mono uppercase text-zinc-500 tracking-wider">PROJECT SITES</span>
                                      <span className="block text-sm font-mono font-bold text-zinc-200 mt-1">{sitesCount}</span>
                                    </div>
                                    <div className="bg-[#0F1424] p-2.5 rounded-xl border border-zinc-800/40">
                                      <span className="block text-[8px] font-mono uppercase text-zinc-500 tracking-wider">FUEL LOGS</span>
                                      <span className="block text-sm font-mono font-bold text-zinc-200 mt-1">{logsCount}</span>
                                    </div>
                                    <div className="bg-[#0F1424] p-2.5 rounded-xl border border-zinc-800/40">
                                      <span className="block text-[8px] font-mono uppercase text-zinc-500 tracking-wider">LITERS DISBURSED</span>
                                      <span className="block text-sm font-mono font-bold text-zinc-200 mt-1">{totalLiters.toLocaleString()} L</span>
                                    </div>
                                    <div className="bg-[#0F1424] p-2.5 rounded-xl border border-zinc-800/40">
                                      <span className="block text-[8px] font-mono uppercase text-zinc-500 tracking-wider">SECURE STAFF</span>
                                      <span className="block text-sm font-mono font-bold text-zinc-200 mt-1">{usersInComp.length} Profile{usersInComp.length !== 1 ? 's' : ''}</span>
                                    </div>
                                  </div>

                                  {/* Administration keys bypass controller and registration routing */}
                                  <div className="bg-[#101422] p-3 rounded-xl border border-[#1D2743]/65 space-y-2.5 my-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                      <span className="text-[9px] uppercase font-mono font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
                                        <Key className="h-3 w-3 text-[#E5B830]" /> Live Verification Bypass Keys
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[8px] uppercase font-mono text-zinc-500">Sign Up Workspace Abbrev:</span>
                                        <button 
                                          type="button"
                                          onClick={() => handleCopyToClipboard(company.logoInitials, `${company.id}-initials`)}
                                          className="text-[9px] font-mono font-bold text-[#138A8E] hover:underline flex items-center gap-1"
                                        >
                                          {company.logoInitials} 
                                          {copiedId === `${company.id}-initials` ? (
                                            <span className="text-emerald-400 text-[8px] font-sans font-normal">(Copied)</span>
                                          ) : (
                                            <Copy className="h-2.5 w-2.5 text-zinc-500" />
                                          )}
                                        </button>
                                      </div>
                                    </div>

                                    <div className="flex gap-2">
                                      <div className="flex-1 min-w-0 pr-1 select-all relative flex items-center bg-[#070911] border border-[#1E2945] focus-within:border-[#E5B830] rounded-lg">
                                        <input
                                          type="text"
                                          value={currentEditKey}
                                          onChange={(e) => {
                                            const val = e.target.value.toUpperCase();
                                            setEditingKeys(prev => ({
                                              ...prev,
                                              [company.id]: val
                                            }));
                                          }}
                                          placeholder="ENTER WORKSPACE CODE"
                                          className="w-full bg-transparent px-2.5 py-1.5 text-[11px] font-mono uppercase text-zinc-200 focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleCopyToClipboard(currentEditKey, `${company.id}-key`)}
                                          className="p-1 px-1.5 text-zinc-500 hover:text-zinc-200"
                                          title="Copy administrator signup bypass key"
                                        >
                                          {copiedId === `${company.id}-key` ? (
                                            <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                          ) : (
                                            <Copy className="h-3.5 w-3.5 shrink-0" />
                                          )}
                                        </button>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleUpdateBypassKey(company.id, currentEditKey)}
                                        title="Commit key update"
                                        className="p-2 bg-[#138A8E]/15 hover:bg-[#138A8E]/25 text-[#138A8E] border border-[#138A8E]/30 hover:border-[#138A8E]/65 rounded-lg select-none cursor-pointer transition flex items-center gap-1"
                                      >
                                        <Save className="h-3.5 w-3.5 shrink-0" />
                                        <span className="text-[9px] font-mono font-bold uppercase">Save</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleGenerateBypassKey(company.id, company.logoInitials)}
                                        title="Regenerate secure code"
                                        className="p-2 bg-amber-500/10 hover:bg-amber-500/25 text-[#E5B830] border border-amber-500/30 hover:border-amber-500/65 rounded-lg select-none cursor-pointer transition flex items-center gap-1"
                                      >
                                        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                                        <span className="text-[9px] font-mono font-bold uppercase">Gen</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Accordion list details of users registered inside corporate portal */}
                                  <div className="space-y-2 pt-1 border-t border-zinc-900/60 font-sans">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedCompId(isExpanded ? null : company.id)}
                                      className="w-full flex items-center justify-between text-[10px] font-mono uppercase text-[#138A8E] hover:text-[#19AAAF] font-bold py-1.5"
                                    >
                                      <span>{isExpanded ? 'Hide Employee Directory' : 'Show Registered Employee Profiles'}</span>
                                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </button>

                                    <AnimatePresence>
                                      {isExpanded && (
                                        <motion.div 
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="space-y-2 pt-1 overflow-hidden"
                                        >
                                          {usersInComp.length === 0 ? (
                                            <div className="p-3 bg-[#080B13] rounded-xl text-center text-zinc-500 font-mono text-[10px] italic border border-zinc-850">
                                              No employee profiles registered for this company structure yet.
                                            </div>
                                          ) : (
                                            usersInComp.map((emp) => (
                                              <div 
                                                key={emp.id}
                                                className="p-2.5 bg-[#080B13] border border-zinc-805/65 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                              >
                                                <div>
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="font-sans font-bold text-zinc-200 text-xs">{emp.name}</span>
                                                    <span className="text-[8px] uppercase font-mono px-1 py-0.5 rounded bg-zinc-850 text-zinc-400 border border-zinc-750">
                                                      {emp.role}
                                                    </span>
                                                  </div>
                                                  <span className="text-[10px] block text-zinc-500 font-mono mt-0.5">{emp.email}</span>
                                                </div>

                                                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                                  {/* Clearance Status Controls */}
                                                  {emp.status === 'pending' ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleApproveUser(emp.id)}
                                                      className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] uppercase font-bold rounded-lg scale-95 hover:scale-100 transition active:scale-95 cursor-pointer flex items-center gap-1"
                                                    >
                                                      <UserCheck className="h-3 w-3 shrink-0" />
                                                      <span>Instant Clear</span>
                                                    </button>
                                                  ) : (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded">
                                                      Cleared Access
                                                    </span>
                                                  )}

                                                  <button
                                                    type="button"
                                                    onClick={() => handleToggleRole(emp.id)}
                                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 font-mono text-[9px] uppercase font-medium rounded-lg text-zinc-350 scale-95 transition cursor-pointer"
                                                    title="Toggle management vs. agent role"
                                                  >
                                                    Role Swap
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() => handleRevokeUser(emp.id)}
                                                    className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 rounded-lg text-[9px] select-none cursor-pointer scale-95 hover:scale-100 transition active:scale-95 flex items-center gap-1"
                                                    title="Revoke and expunge access credentials"
                                                  >
                                                    <UserX className="h-3 w-3 shrink-0" />
                                                    <span>Purge</span>
                                                  </button>
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Connected Client Token Footprint */}
              <div className="p-4 border-t border-[#202E4E] bg-[#0C101F]/90 font-mono text-[9px] text-zinc-500 flex items-center justify-between select-none">
                <span>DEV: {currentUser.email}</span>
                <span>SECURE ENDPOINT SEC_VAULT_V4</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
