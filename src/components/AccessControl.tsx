/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, UserCheck, UserX, ToggleLeft, ToggleRight, Search, Plus, Trash2, CheckCircle2, AlertCircle, Info, Mail, Users, Filter } from 'lucide-react';
import { User, UserRole, CompanyProfile } from '../types';

interface AccessControlProps {
  currentUser: User;
  onUserUpdate?: () => void;
  activeCompany: CompanyProfile;
}

export default function AccessControl({ currentUser, onUserUpdate, activeCompany }: AccessControlProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'management' | 'agent' | 'pending'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // New user form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('agent');
  const [newStatus, setNewStatus] = useState<'approved' | 'pending'>('approved');

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch users from localStorage
  const loadUsers = () => {
    const rawUsers = localStorage.getItem('apex_diesel_users');
    if (rawUsers) {
      try {
        setUsers(JSON.parse(rawUsers));
      } catch (e) {
        console.error("Failed to parse users", e);
      }
    }
  };

  useEffect(() => {
    loadUsers();
    // Watch for local storage updates in case other components edit it
    const handleStorageChange = () => loadUsers();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const saveUsers = (updatedUsers: User[]) => {
    setUsers(updatedUsers);
    localStorage.setItem('apex_diesel_users', JSON.stringify(updatedUsers));
    
    // If the current user updated their own record, sync it with active session
    const updatedSelf = updatedUsers.find(u => u.id === currentUser.id);
    if (updatedSelf) {
      localStorage.setItem('apex_diesel_current_user', JSON.stringify(updatedSelf));
    }
    
    if (onUserUpdate) {
      onUserUpdate();
    }
  };

  const clearMessages = () => {
    setSuccessMessage('');
    setErrorMessage('');
  };

  // Authorize / Approve Account
  const handleApprove = (userId: string) => {
    clearMessages();
    const updated = users.map(user => {
      if (user.id === userId) {
        return { ...user, status: 'approved' as const };
      }
      return user;
    });
    saveUsers(updated);
    setSuccessMessage(`Account approved successfully.`);
  };

  // Change Type of Access (Toggle Role)
  const handleToggleRole = (userId: string) => {
    clearMessages();
    
    // Prevent managers from demoting themselves by accident without warning
    if (userId === currentUser.id) {
      if (!window.confirm("Warning: Changing your own access type will demote you from management privileges instantly. Do you want to continue?")) {
        return;
      }
    }

    const updated = users.map(user => {
      if (user.id === userId) {
        const targetRole: UserRole = user.role === 'management' ? 'agent' : 'management';
        return { 
          ...user, 
          role: targetRole,
          // Auto approve them if they are promoted to management
          status: 'approved' as const
        };
      }
      return user;
    });
    saveUsers(updated);
    
    // If demoting self, force refresh or handle session sync
    const targetUser = users.find(u => u.id === userId);
    if (userId === currentUser.id) {
      window.location.reload(); // Refresh to clean layout for safety
    } else {
      setSuccessMessage(`Access level changed successfully for ${activeCompany.name} employee.`);
    }
  };

  // Reject / Suspense / Remove User Profile
  const handleDeleteUser = (userId: string) => {
    clearMessages();
    if (userId === currentUser.id) {
      setErrorMessage("Strict Protection: You cannot terminate your own active management session.");
      return;
    }

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const updated = users.filter(user => user.id !== userId);
    saveUsers(updated);
    setSuccessMessage(`Credentials for ${targetUser.name} (${targetUser.email}) were revoked and the account was removed securely.`);
    setConfirmDeleteId(null);
  };

  // Manually Enroll New Employee
  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!newEmail || !newName || !newPassword) {
      setErrorMessage("Please fill in all employee enrollment details.");
      return;
    }

    const emailExists = users.some(u => u.email.toLowerCase().trim() === newEmail.toLowerCase().trim());
    if (emailExists) {
      setErrorMessage("An enrollment record for this email already exists.");
      return;
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      email: newEmail.toLowerCase().trim(),
      name: newName.trim(),
      passwordHash: newPassword,
      role: newRole,
      status: newStatus,
      companyId: activeCompany.id,
      createdAt: new Date().toISOString()
    };

    const updated = [...users, newUser];
    saveUsers(updated);
    
    // Reset form
    setNewEmail('');
    setNewName('');
    setNewPassword('');
    setNewRole('agent');
    setNewStatus('approved');
    setShowAddForm(false);
    setSuccessMessage(`Successfully enrolled ${newName} as an approved ${newRole}!`);
  };

  // Filter list
  const filteredUsers = users.filter(user => {
    const userCompanyId = user.companyId || 'company-kmc';
    if (userCompanyId !== activeCompany.id) return false;

    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (roleFilter === 'all') return matchesSearch;
    if (roleFilter === 'management') return matchesSearch && user.role === 'management' && user.status !== 'pending';
    if (roleFilter === 'agent') return matchesSearch && user.role === 'agent' && user.status !== 'pending';
    if (roleFilter === 'pending') return matchesSearch && (user.status === 'pending');
    
    return matchesSearch;
  });

  // Access counts (filtered per company)
  const companyUsers = users.filter(user => (user.companyId || 'company-kmc') === activeCompany.id);
  const totalCount = companyUsers.length;
  const managersCount = companyUsers.filter(u => u.role === 'management' && u.status !== 'pending').length;
  const agentsCount = companyUsers.filter(u => u.role === 'agent' && u.status !== 'pending').length;
  const pendingCount = companyUsers.filter(u => u.status === 'pending').length;

  return (
    <div className="space-y-6" id="access-control-panel">
      {/* HEADER SECTION */}
      <div className="bg-[#111625] border border-[#1F293F] rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <Shield className="h-40 w-40 text-[#E5B830]" />
        </div>
        
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-widest font-black" style={{ color: activeCompany.primaryColor || '#E5B830' }}>
                Authorized Operations Console
              </span>
            </div>
            <h1 className="text-2xl font-sans font-extrabold text-white mt-1.5 tracking-tight flex items-center gap-2">
              🛡️ {activeCompany.name} Account Authorization & Staff Control
            </h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl font-sans">
              Approve new management registrations, toggle corporate clearance roles (Management / Agent), suspension controls, and manually enroll new crew profiles into the ledger databases.
            </p>
          </div>
          <button
            onClick={() => {
              clearMessages();
              setShowAddForm(!showAddForm);
            }}
            className="px-5 py-2.5 bg-[#138A8E] hover:bg-[#117C80] text-white rounded-full text-sm font-bold flex items-center gap-2 cursor-pointer transition select-none shadow self-start sm:self-auto hover:scale-[1.01] active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            {showAddForm ? 'Close Enrollment Form' : 'Direct Enroll Employee'}
          </button>
        </div>

        {/* STATS BENTO ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#1C253C]">
          <div className="bg-[#161D32] border border-[#232F4C] p-4 rounded-xl text-left">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">Crew Registered</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-extrabold text-white">{totalCount}</span>
              <span className="text-[10px] text-[#A1A1AA] font-mono">Total Profiles</span>
            </div>
          </div>
          <div className="bg-[#161D32] border border-[#232F4C] p-4 rounded-xl text-left">
            <span className="text-[10px] text-rose-400 font-mono uppercase tracking-wider block">Admin Managers</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-extrabold text-rose-300">{managersCount}</span>
              <span className="text-[10px] text-zinc-500 font-mono">Approved</span>
            </div>
          </div>
          <div className="bg-[#161D32] border border-[#232F4C] p-4 rounded-xl text-left">
            <span className="text-[10px] text-[#11E2BC] font-mono uppercase tracking-wider block">Diesel Agents</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-extrabold text-[#11E2BC]">{agentsCount}</span>
              <span className="text-[10px] text-zinc-500 font-mono">On Field</span>
            </div>
          </div>
          <div className="bg-[#1A1821] border border-amber-500/20 p-4 rounded-xl text-left">
            <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider block">Pending Approvals</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-extrabold text-amber-500">{pendingCount}</span>
              <span className="text-[10px] text-amber-400/40 font-mono">Needs Action</span>
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK STATUS */}
      {successMessage && (
        <div className="bg-[#112423] border border-[#138A8E]/30 text-[#11E2BC] p-4 rounded-xl flex items-start gap-3 text-sm animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#138A8E]" />
          <div>
            <p className="font-bold">Execution Success</p>
            <p className="text-xs text-zinc-300 mt-1">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-[#241315] border border-red-500/20 text-red-300 p-4 rounded-xl flex items-start gap-3 text-sm animate-fadeIn">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <div>
            <p className="font-bold">Clearance Denied</p>
            <p className="text-xs text-zinc-300 mt-1">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* DIRECT ENROLLMENT FORM (EXPANDABLE) */}
      {showAddForm && (
        <div className="bg-[#111625] border border-[#1F293F] p-6 rounded-2xl shadow-lg relative">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            📝 Manual Staff Registration & Enrollment Form
          </h2>
          <form onSubmit={handleAddUserSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5 font-bold">
                Employee Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Marcus Vance"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-xl text-sm text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5 font-bold">
                Work Email Address *
              </label>
              <input
                type="email"
                placeholder="e.g. agent.name@kmc.co.za"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-xl text-sm text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5 font-bold">
                Assigned Security Password *
              </label>
              <input
                type="text"
                placeholder="For initial login setup"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-xl text-sm text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5 font-bold">
                Assigned Access Clearance *
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-xl text-sm text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] outline-none transition"
              >
                <option value="agent">👮 Agent Log Station (Logging access only)</option>
                <option value="management">💼 Management Operations (Full administrative access)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5 font-bold">
                Initial Authorization State *
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as 'approved' | 'pending')}
                className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-xl text-sm text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] outline-none transition"
              >
                <option value="approved">✅ Instantly Approved (Authorized immediately)</option>
                <option value="pending">⏳ Pending Review (Requires manager validation)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-3 bg-[#E5B830] hover:bg-[#cfcf2b] text-[#0C0F1D] rounded-full font-sans font-extrabold text-sm tracking-wide transition hover:scale-[1.01] active:scale-[0.99] shadow cursor-pointer select-none"
              >
                💾 Securely Save & Authorize Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER & CONTROL PANEL FOR REGISTRY */}
      <div className="bg-[#111625] border border-[#1F293F] rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-[#1F293F] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <Search className="h-4.5 w-4.5" />
            </span>
            <input
              type="text"
              placeholder="Search employee register by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2 bg-[#161D32] border border-[#232F4C] rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#138A8E] outline-none transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono uppercase text-zinc-400 font-bold mr-2 flex items-center gap-1.5 select-none">
              <Filter className="h-3.5 w-3.5" /> Filter Access:
            </span>
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition select-none flex items-center gap-1 cursor-pointer border ${
                roleFilter === 'all'
                  ? 'bg-zinc-800 text-white border-zinc-700'
                  : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/5'
              }`}
            >
              <Users className="h-3 w-3" /> All ({totalCount})
            </button>
            <button
              onClick={() => setRoleFilter('pending')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition select-none flex items-center gap-1 cursor-pointer border ${
                roleFilter === 'pending'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/35'
                  : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/5'
              }`}
            >
              <AlertCircle className="h-3 w-3" /> Pending ({pendingCount})
            </button>
            <button
              onClick={() => setRoleFilter('management')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition select-none flex items-center gap-1 cursor-pointer border ${
                roleFilter === 'management'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                  : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/5'
              }`}
            >
              <Shield className="h-3 w-3" /> Managers ({managersCount})
            </button>
            <button
              onClick={() => setRoleFilter('agent')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition select-none flex items-center gap-1 cursor-pointer border ${
                roleFilter === 'agent'
                  ? 'bg-emerald-500/15 text-[#11E2BC] border-emerald-500/35'
                  : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/5'
              }`}
            >
              <UserCheck className="h-3 w-3" /> Agents ({agentsCount})
            </button>
          </div>
        </div>

        {/* REGISTRY LIST */}
        <div className="divide-y divide-[#1D273E] max-h-[500px] overflow-y-auto relative">
          <AnimatePresence mode="popLayout">
            {filteredUsers.length === 0 ? (
              <motion.div 
                key="empty-registry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-12 text-center text-[#A1A1AA] font-sans"
              >
                <Info className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <p className="font-bold">No registered profiles meet search criteria.</p>
                <p className="text-xs text-zinc-500 mt-1">Try resetting the filter or registering a new staff member.</p>
              </motion.div>
            ) : (
              filteredUsers.map((user) => {
                const isPending = user.status === 'pending';
                const isSelf = user.id === currentUser.id;
                
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    key={user.id} 
                    className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors font-sans ${
                      isPending 
                        ? 'bg-gradient-to-r from-[#1E1925] to-[#111625]' 
                        : user.role === 'management' 
                          ? 'hover:bg-[#141B30]' 
                          : 'hover:bg-[#12182A]'
                    }`}
                  >
                    {/* Crew Info */}
                    <div className="flex gap-4 items-start">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#1E253B] to-[#2B3452] border border-[#232D4E] flex items-center justify-center shrink-0 font-mono font-black text-zinc-300 text-sm shadow-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-white text-left font-sans">
                            {user.name} {isSelf && <span className="text-zinc-500 text-xs font-mono font-medium">(You)</span>}
                          </span>
                          
                          {/* Role clearance badge */}
                          <span className={`font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm leading-none shrink-0 ${
                            user.role === 'management'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                              : 'bg-emerald-500/15 text-[#11E2BC] border border-emerald-500/20'
                          }`}>
                            {user.role}
                          </span>

                          {/* Status approval badge */}
                          {isPending ? (
                            <span className="font-mono text-[9px] font-extrabold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-wider border border-amber-500/30 animate-pulse">
                              🚨 Pending Approval
                            </span>
                          ) : (
                            <span className="font-mono text-[9px] font-extrabold bg-[#138A8E]/15 text-[#11E2BC] px-1.5 py-0.5 rounded uppercase tracking-wider border border-[#138A8E]/25">
                              ✓ Active Approved
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                          <span className="flex items-center gap-1.5 font-mono text-zinc-500">
                            <Mail className="h-3 w-3 text-zinc-500" />
                            {user.email}
                          </span>
                          <span className="text-zinc-650 hidden sm:inline">&#8226;</span>
                          <span className="text-[10px] text-zinc-500 font-mono font-medium">
                            Enrolled: {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Area */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {confirmDeleteId === user.id ? (
                        <div className="flex items-center gap-2 bg-[#2D1418] border border-red-500/30 px-3.5 py-1.5 rounded-xl animate-fadeIn">
                          <span className="text-[11px] text-red-300 font-bold font-mono">Delete staff?</span>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-sans font-extrabold text-[10px] uppercase cursor-pointer transition shadow-sm"
                          >
                            Revoke Access
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 bg-[#161D32] hover:bg-[#1C253C] border border-[#232F4C] text-zinc-300 rounded-lg font-sans font-bold text-[10px] uppercase cursor-pointer transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Approve Action */}
                          {isPending && (
                            <button
                              onClick={() => handleApprove(user.id)}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-xs font-bold leading-none flex items-center gap-1 shadow cursor-pointer transition select-none font-sans"
                              title="Authorize this workspace account"
                            >
                              <UserCheck className="h-3.5 w-3.5" /> Approve Account
                            </button>
                          )}

                          {/* Change type of access (Role Toggle) */}
                          <button
                            onClick={() => handleToggleRole(user.id)}
                            className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer select-none font-sans ${
                              user.role === 'management'
                                ? 'border-zinc-800 text-zinc-400 hover:text-white hover:bg-white/5'
                                : 'border-rose-500/20 text-rose-300 hover:text-rose-200 hover:bg-rose-500/5'
                            }`}
                            title={user.role === 'management' ? "Demote account to Diesel Agent" : "Promote account to Administrator"}
                          >
                            {user.role === 'management' ? (
                              <>
                                <ToggleRight className="h-3.5 w-3.5 text-rose-400" /> Convert to Agent
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="h-3.5 w-3.5 text-emerald-400" /> Make Manager
                              </>
                            )}
                          </button>

                          {/* Delete profile control */}
                          <button
                            onClick={() => setConfirmDeleteId(user.id)}
                            disabled={isSelf}
                            className={`p-1.5 rounded-lg border transition ${
                              isSelf 
                                ? 'border-transparent text-zinc-700 cursor-not-allowed select-none' 
                                : 'border-[#1E253B] hover:border-rose-500/35 hover:text-rose-400 text-rose-400/80 bg-rose-500/5 cursor-pointer shadow-sm'
                            }`}
                            title={isSelf ? "Self Protected Session" : "Terminate user profile"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
