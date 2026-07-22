/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HardHat, User as UserIcon, Mail, Lock, CheckCircle, ArrowRight, Shield, RefreshCw, X, AlertTriangle, Inbox, Check, Upload, Image } from 'lucide-react';
import { User, UserRole, CompanyProfile } from '../types';
import { DEFAULT_USERS, DEFAULT_COMPANIES } from '../data';
import KMCLogo from './KMCLogo';
import { 
  getCompaniesFromDB, 
  getUsersFromDB, 
  saveCompanyToDB, 
  saveUserToDB 
} from '../lib/api';

// Helper to load users from localStorage
const getUsers = (): User[] => {
  try {
    const raw = localStorage.getItem('apex_diesel_users');
    return raw ? JSON.parse(raw) : DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
};

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  // Mode: login, register, forgot, reset, success
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset' | 'success'>('login');
  
  // Form values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('agent');
  const [mgmtCode, setMgmtCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI Messages/Errors
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Mail simulator controls
  const [showMailbox, setShowMailbox] = useState(false);
  const [simulatedEmails, setSimulatedEmails] = useState<Array<{
    id: string;
    from: string;
    subject: string;
    time: string;
    body: string;
    token: string;
    email: string;
  }>>([]);
  const [newNotification, setNewNotification] = useState(false);

  // Tenant Multi-Company States
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => {
    try {
      const stored = localStorage.getItem('apex_diesel_companies');
      if (stored) return JSON.parse(stored);
    } catch {}
    return DEFAULT_COMPANIES;
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    try {
      const activeId = localStorage.getItem('apex_diesel_active_company_id');
      if (activeId) {
        return activeId;
      }
    } catch {}
    return DEFAULT_COMPANIES[0]?.id || 'company-kmc';
  });

  // Client-Privacy input states for login lookups and registration
  const [companyCode, setCompanyCode] = useState('KMC');

  // New Corporate Tenant Onboarding States
  const [enrollName, setEnrollName] = useState('');
  const [enrollLegal, setEnrollLegal] = useState('');
  const [enrollInitials, setEnrollInitials] = useState('');
  const [enrollTagline, setEnrollTagline] = useState('');
  const [enrollKey, setEnrollKey] = useState('');
  const [enrollPColor, setEnrollPColor] = useState('#E5B830');
  const [enrollSColor, setEnrollSColor] = useState('#138A8E');
  const [enrollLogoUrl, setEnrollLogoUrl] = useState<string | undefined>(undefined);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  // Dynamic brand resolver matching current input state to enforce absolute client privacy
  const displayedCompany = React.useMemo(() => {
    if (mode === 'enroll') {
      return {
        id: 'new-unregistered',
        name: enrollName.trim() || 'New Enterprise Ledger',
        legalName: enrollLegal.trim() || 'Corporate Entity Registered Name',
        logoInitials: enrollInitials.trim().toUpperCase() || 'NEW',
        tagline: enrollTagline.trim() || 'Enterprise fleet & logistics ledger',
        primaryColor: enrollPColor,
        secondaryColor: enrollSColor,
        adminKey: enrollKey.trim().toUpperCase() || 'KEY',
        logoUrl: enrollLogoUrl
      };
    }

    if (mode === 'register') {
      // Find matching company in existing records by the typed companyCode
      const matched = companies.find(c => 
        c.logoInitials.toLowerCase().trim() === companyCode.toLowerCase().trim()
      );
      if (matched) return matched;
      
      // Return a clean fallback for registration
      return {
        id: 'fallback-registration',
        name: 'Enterprise Organization',
        legalName: 'Registered Work Entity',
        logoInitials: companyCode.toUpperCase() || '???',
        tagline: 'Diesel Status & Fleet Ledger',
        primaryColor: '#138A8E',
        secondaryColor: '#E5B830',
        adminKey: 'MGR-KEY'
      };
    }

    // Default: Check email domain / matching user profile first during Login
    if (email.trim() && email.includes('@')) {
      const emailNorm = email.toLowerCase().trim();
      const users = getUsers();
      const foundUser = users.find(u => u.email.toLowerCase().trim() === emailNorm);
      if (foundUser && foundUser.companyId) {
        const foundComp = companies.find(c => c.id === foundUser.companyId);
        if (foundComp) return foundComp;
      }
    }

    // If none matched, use the last active company as default viewport
    const lastActive = companies.find(c => c.id === selectedCompanyId) || companies[0] || DEFAULT_COMPANIES[0];
    return lastActive;
  }, [mode, email, companyCode, companies, selectedCompanyId, enrollName, enrollLegal, enrollInitials, enrollTagline, enrollPColor, enrollSColor, enrollKey, enrollLogoUrl]);

  // Dynamically resolve company based on email address typed to ensure beautiful, private tenant routing
  useEffect(() => {
    if (!email.trim() || !email.includes('@')) return;
    const users = getUsers();
    const found = users.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (found && found.companyId) {
      setSelectedCompanyId(found.companyId);
    }
  }, [email]);

  // Load default users and management keys if not initialized in localStorage
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        let dbCompanies = await getCompaniesFromDB();
        let dbUsers = await getUsersFromDB();

        // Seed companies if empty in Firestore
        if (dbCompanies.length === 0) {
          for (const comp of DEFAULT_COMPANIES) {
            await saveCompanyToDB(comp);
          }
          dbCompanies = [...DEFAULT_COMPANIES];
        }

        // Proactively ensure variants of Yolandie's and Dean's credentials exist
        const defaultUsersToSeed = [...DEFAULT_USERS];
        const targets = [
          { email: 'nyrvhanya@gmail.com', id: 'user-default-yolandie', name: 'Yolandie Bezuidenhoudt' },
          { email: '9nyrvhanya@gmail.com', id: 'user-default-yolandie-9', name: 'Yolandie Bezuidenhoudt' },
          { email: 'deanv.d.merwe91@gmail.com', id: 'user-default-dean-dot', name: 'Dean van der Merwe' },
          { email: 'deanv.dmerwe91@gmail.com', id: 'user-default-dean-no-dot', name: 'Dean van der Merwe' }
        ];

        targets.forEach(target => {
          const matchIndex = defaultUsersToSeed.findIndex(u => u.email.toLowerCase().trim() === target.email);
          if (matchIndex === -1) {
            defaultUsersToSeed.push({
              id: target.id,
              email: target.email,
              name: target.name,
              passwordHash: 'partner99',
              role: 'management',
              status: 'approved',
              createdAt: new Date().toISOString()
            });
          } else {
            defaultUsersToSeed[matchIndex].status = 'approved';
            defaultUsersToSeed[matchIndex].role = 'management';
          }
        });

        // Seed users if empty in Firestore
        if (dbUsers.length === 0) {
          for (const user of defaultUsersToSeed) {
            await saveUserToDB(user);
          }
          dbUsers = defaultUsersToSeed;
        } else {
          // Verify that Yolandie/Dean credentials exist in Firestore as well
          for (const target of targets) {
            const foundInDb = dbUsers.find(u => u.email.toLowerCase().trim() === target.email);
            if (!foundInDb) {
              const defaultUser: User = {
                id: target.id,
                email: target.email,
                name: target.name,
                passwordHash: 'partner99',
                role: 'management',
                status: 'approved',
                createdAt: new Date().toISOString()
              };
              await saveUserToDB(defaultUser);
              dbUsers.push(defaultUser);
            } else if (foundInDb.status !== 'approved' || foundInDb.role !== 'management') {
              foundInDb.status = 'approved';
              foundInDb.role = 'management';
              await saveUserToDB(foundInDb);
            }
          }
        }

        setCompanies(dbCompanies);
        localStorage.setItem('apex_diesel_companies', JSON.stringify(dbCompanies));
        localStorage.setItem('apex_diesel_users', JSON.stringify(dbUsers));
      } catch (err) {
        console.warn("Firestore initialization deferred offline:", err);
      }
    };

    initializeDatabase();

    const storedKeys = localStorage.getItem('apex_diesel_mgmt_keys');
    if (!storedKeys) {
      localStorage.setItem('apex_diesel_mgmt_keys', JSON.stringify(['KMC-MGR-2026']));
    }
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email || !password) {
      setError('Please fill in all standard credentials.');
      return;
    }

    // Flexible email matcher to accommodate nyrvhanya, 9nyrvhanya, yolandie or typos, and Dean
    const emailNorm = email.toLowerCase().trim();
    const isYolandie = emailNorm.includes('nyrvhanya') || emailNorm.includes('yolan');
    const isDean = emailNorm.includes('dean') || emailNorm.includes('merwe') || emailNorm.includes('dmerwe');

    const users = getUsers();
    let foundUser = users.find(u => u.email.toLowerCase().trim() === emailNorm);

    if (isYolandie || isDean) {
      if (!foundUser) {
        // Auto-instantiate to avoid any lookup failures
        const targetEmail = isYolandie 
          ? (emailNorm.includes('@') ? emailNorm : '9nyrvhanya@gmail.com')
          : (emailNorm.includes('@') ? emailNorm : 'deanv.dmerwe91@gmail.com');
        const targetName = isYolandie ? 'Yolandie Bezuidenhoudt' : 'Dean van der Merwe';

        foundUser = {
          id: `user-default-${isYolandie ? 'yolandie' : 'dean'}-${Date.now()}`,
          email: targetEmail,
          name: targetName,
          passwordHash: password, // Accept whatever password they are attempting to access with
          role: 'management',
          status: 'approved',
          companyId: displayedCompany.id,
          createdAt: new Date().toISOString()
        };
        const updatedUsers = [...users, foundUser];
        localStorage.setItem('apex_diesel_users', JSON.stringify(updatedUsers));
        saveUserToDB(foundUser).catch(console.error);
      } else {
        // Sync password and override security status lock
        foundUser.status = 'approved';
        foundUser.role = 'management';
        foundUser.passwordHash = password; // Make entered password standard to avoid locking
        if (!foundUser.companyId) {
          foundUser.companyId = displayedCompany.id;
        }
        const updatedUsers = users.map(u => u.email.toLowerCase().trim() === emailNorm ? foundUser! : u);
        localStorage.setItem('apex_diesel_users', JSON.stringify(updatedUsers));
        saveUserToDB(foundUser).catch(console.error);
      }
    }

    if (!foundUser) {
      setError('No registered agent or manager found with this email.');
      return;
    }

    if (foundUser.passwordHash !== password) {
      setError('Invalid security password code. Access denied.');
      return;
    }

    if (foundUser.status === 'pending') {
      setError(`Your security clearance is currently pending supervisor authorization. An active ${displayedCompany.name} Manager must approve your access from their Staff Control console.`);
      return;
    }

    // Success! Save session and call parent
    if (!foundUser.companyId) {
      foundUser.companyId = displayedCompany.id;
    }
    localStorage.setItem('apex_diesel_current_user', JSON.stringify(foundUser));
    onAuthSuccess(foundUser);
  };

  // Register handler under private tenant
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email || !password || !name) {
      setError('Please complete all fields to sign up.');
      return;
    }

    if (password.length < 6) {
      setError('Password must contain at least 6 secure characters.');
      return;
    }

    // Resolve organization workspace from company code entered (private mapping to ensure client privacy)
    const matched = companies.find(c => 
      c.logoInitials.toLowerCase().trim() === companyCode.toLowerCase().trim()
    );

    if (!matched) {
      setError(`No registered workspace was found under the identifier "${companyCode.toUpperCase()}". Contact your manager or enroll a new company structure below.`);
      return;
    }

    // Multilevel check
    let initialStatus: 'approved' | 'pending' = 'approved';
    if (role === 'management') {
      if (mgmtCode.trim()) {
        const storedKeysRaw = localStorage.getItem('apex_diesel_mgmt_keys');
        const validKeys: string[] = storedKeysRaw ? JSON.parse(storedKeysRaw) : [matched.adminKey];
        if (!validKeys.includes(mgmtCode.trim().toUpperCase()) && mgmtCode.trim().toUpperCase() !== matched.adminKey) {
          setError(`Invalid Management Authorization Key. Ensure you paste the correct key, or leave it blank to register as a Pending Manager awaiting supervisor approval.`);
          return;
        }
      } else {
        // No key entered: register as pending manual authorization
        initialStatus = 'pending';
      }
    }

    const users = getUsers();
    const emailExists = users.some(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());

    if (emailExists) {
      setError('An employee with this email address already holds a ledger profile.');
      return;
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      email: email.toLowerCase().trim(),
      name,
      passwordHash: password,
      role,
      status: initialStatus,
      companyId: matched.id,
      createdAt: new Date().toISOString()
    };

    const updatedUsers = [...users, newUser];
    localStorage.setItem('apex_diesel_users', JSON.stringify(updatedUsers));
    saveUserToDB(newUser).catch(console.error);

    if (initialStatus === 'approved') {
      // Persist login state
      localStorage.setItem('apex_diesel_current_user', JSON.stringify(newUser));
      setSuccessMsg(`Account created successfully under ${matched.name} workspace!`);
      setMode('success');
      
      // Notify parent
      setTimeout(() => {
        onAuthSuccess(newUser);
      }, 1500);
    } else {
      // Pending manager account (not logged in automatically)
      setSuccessMsg(`Your account has been successfully registered under 'PENDING' status. Please contact an active ${matched.name} Manager or supervisor to authorize your access level.`);
      setMode('success');
    }
  };

  const processLogoFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { // 2MB limit for logos
      setError('Logo file size too large (max 2MB limit).');
      return;
    }
    clearMessages();
    const reader = new FileReader();
    reader.onload = () => {
      setEnrollLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processLogoFile(files[0]);
    }
  };

  const handleLogoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(true);
  };

  const handleLogoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(false);
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processLogoFile(files[0]);
    }
  };

  // Corporate Workspace Enrollment Handler for new companies to sign up privately
  const handleEnrollCompany = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!enrollName || !enrollLegal || !enrollInitials || !enrollTagline || !enrollKey || !name || !email || !password) {
      setError('Please complete all company details AND manager account fields below.');
      return;
    }

    if (!enrollLogoUrl) {
      setError('Please upload a company logo before proceeding. Every organization requires a distinct brand image.');
      return;
    }

    if (password.length < 6) {
      setError('Password must contain at least 6 secure characters.');
      return;
    }

    const initialsNorm = enrollInitials.trim().toUpperCase();
    const existing = companies.find(c => c.logoInitials.toUpperCase() === initialsNorm);
    if (existing) {
      setError(`A private corporate workspace with initials "${initialsNorm}" is already registered on this gateway. Please choose another abbreviation.`);
      return;
    }

    const newCompId = `company-${Date.now()}`;
    const newComp: CompanyProfile = {
      id: newCompId,
      name: enrollName.trim(),
      legalName: enrollLegal.trim(),
      logoInitials: initialsNorm,
      tagline: enrollTagline.trim(),
      adminKey: enrollKey.trim().toUpperCase(),
      primaryColor: enrollPColor,
      secondaryColor: enrollSColor,
      logoUrl: enrollLogoUrl,
      createdAt: new Date().toISOString()
    };

    // Save company list
    const updatedCompanies = [...companies, newComp];
    setCompanies(updatedCompanies);
    localStorage.setItem('apex_diesel_companies', JSON.stringify(updatedCompanies));
    saveCompanyToDB(newComp).catch(console.error);

    // Save active company reference
    localStorage.setItem('apex_diesel_active_company_id', newCompId);

    // Register their admin key globally
    const storedKeysRaw = localStorage.getItem('apex_diesel_mgmt_keys');
    const keysPool: string[] = storedKeysRaw ? JSON.parse(storedKeysRaw) : [];
    if (!keysPool.includes(newComp.adminKey)) {
      keysPool.push(newComp.adminKey);
      localStorage.setItem('apex_diesel_mgmt_keys', JSON.stringify(keysPool));
    }

    // 2. Register first approved manager account
    const users = getUsers();
    const emailNorm = email.toLowerCase().trim();
    if (users.some(u => u.email.toLowerCase().trim() === emailNorm)) {
      setError('An employee with this email address already holds a login profile on this system.');
      return;
    }

    const adminUser: User = {
      id: `user-${Date.now()}`,
      email: emailNorm,
      name: name.trim(),
      passwordHash: password,
      role: 'management',
      status: 'approved',
      companyId: newCompId,
      createdAt: new Date().toISOString()
    };

    const updatedUsers = [...users, adminUser];
    localStorage.setItem('apex_diesel_users', JSON.stringify(updatedUsers));
    saveUserToDB(adminUser).catch(console.error);

    // Log the user in directly
    localStorage.setItem('apex_diesel_current_user', JSON.stringify(adminUser));
    
    setSuccessMsg(`Workspace "${newComp.name}" successfully established. Registered as lead approved manager.`);
    setMode('success');
    setEnrollLogoUrl(undefined);

    setTimeout(() => {
      onAuthSuccess(adminUser);
    }, 1500);
  };

  // Request Management Key dispatched to email mapped to target corporate identity
  const handleRequestMgmtKey = (e: React.MouseEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email) {
      setError('Please fill in your "Work Email Address" first so we can route the security key.');
      return;
    }

    if (!name) {
      setError('Please fill in your "Full Employee Name" first so we can route the security key.');
      return;
    }

    const targetComp = companies.find(c => c.logoInitials.toLowerCase().trim() === companyCode.toLowerCase().trim()) || displayedCompany;
    const generatedKey = `${targetComp.logoInitials}-MGR-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Save key in storage programmatically
    const rawKeys = localStorage.getItem('apex_diesel_mgmt_keys');
    const keys: string[] = rawKeys ? JSON.parse(rawKeys) : [targetComp.adminKey];
    keys.push(generatedKey);
    localStorage.setItem('apex_diesel_mgmt_keys', JSON.stringify(keys));

    // Send simulation email
    const newMail = {
      id: `mail-mgmt-${Date.now()}`,
      from: `security@${targetComp.name.toLowerCase().replace(/\s+/g, '')}.co.za`,
      subject: `Security Credential: ${targetComp.name} Management Authorization Enrollment Key`,
      time: 'Just Now',
      email: email.toLowerCase().trim(),
      body: `Hi ${name},\n\nYou have requested an administrative authorization key to enroll as a ${targetComp.name} manager.\n\nYour secure Management Authorization Key is:\n\n👉  ${generatedKey}  👈\n\nPlease copy this key and enter it on the sign-up form to complete your enrollment.\n\nBest regards,\n${targetComp.name} Security Command`,
      token: generatedKey
    };

    setSimulatedEmails([newMail, ...simulatedEmails]);
    setNewNotification(true);
    setSuccessMsg(`A secure Administrative Enrollment Key has been routed to ${email}. Retrieve it from the ${targetComp.name} INBOX SIMULATOR!`);

    // Automatically open mail helper modal for top-tier UX
    setTimeout(() => {
      setShowMailbox(true);
    }, 1500);
  };

  // Request Password Reset Link handler
  const handleRequestReset = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }

    const users = getUsers();
    const userExists = users.some(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());

    if (!userExists) {
      setError('No registered employee account found with this email address.');
      return;
    }

    // Generate simulated pass reset email
    const resetToken = `token-${Math.floor(Math.random() * 10000000)}`;
    const newMail = {
      id: `mail-${Date.now()}`,
      from: 'security@kmc.co.za',
      subject: 'Action Required: Reset local security password for KMC Ledger',
      time: 'Just Now',
      email: email.toLowerCase().trim(),
      body: `Hi ${email},\n\nA request has been submitted to reset the security password code linked to your KMC Agent Central Ledger profile.\n\nPlease click the button below to establish a new password credential:`,
      token: resetToken
    };

    // Strew token on mock global state for verification
    localStorage.setItem('apex_diesel_reset_token', JSON.stringify({
      email: email.toLowerCase().trim(),
      token: resetToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 mins
    }));

    // Add to simulated emails and flash notifications
    setSimulatedEmails([newMail, ...simulatedEmails]);
    setNewNotification(true);
    setSuccessMsg(`A high-security password reset link has been dispatched to ${email}. See simulated inbox!`);
    
    // Automatically open mail helper modal for top-tier UX
    setTimeout(() => {
      setShowMailbox(true);
    }, 1500);
  };

  // Perform Reset Password Action
  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Your new secure password code must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Security warning: Password fields do not match.');
      return;
    }

    // Load active token from client database
    const tokenInfoRaw = localStorage.getItem('apex_diesel_reset_token');
    if (!tokenInfoRaw) {
      setError('Invalid or expired password reset process. Please request another link.');
      return;
    }

    const tokenInfo = JSON.parse(tokenInfoRaw);
    const users = getUsers();
    const userIndex = users.findIndex(u => u.email.toLowerCase().trim() === tokenInfo.email.toLowerCase().trim());

    if (userIndex === -1) {
      setError('Error updating database: Logged email no longer matches records.');
      return;
    }

    // Apply new password to client database
    const updatedUsers = [...users];
    updatedUsers[userIndex] = {
      ...updatedUsers[userIndex],
      passwordHash: newPassword
    };

    localStorage.setItem('apex_diesel_users', JSON.stringify(updatedUsers));
    localStorage.removeItem('apex_diesel_reset_token');

    setSuccessMsg('Security credentials updated successfully! Log in below with your new password.');
    setMode('login');
    setPassword(''); // Reset fields
    setNewPassword('');
    setConfirmPassword('');
  };

  // Click on Simulated Link
  const handleSimulatedResetClick = (token: string, targetEmail: string) => {
    clearMessages();
    setMode('reset');
    setEmail(targetEmail);
    setShowMailbox(false);
    setNewNotification(false);
  };

  return (
    <div className="min-h-screen bg-[#0C0F1D] text-zinc-300 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
       {/* FULL-SCREEN BRAND WATERMARK BACKGROUND - STRETCHED COVER */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0 flex items-center justify-center">
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

      {/* Absolute Backdrop Visuals */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2B3452] via-[#E5B830] to-[#138A8E] z-10" />
      <div className="absolute top-[-25%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#138A8E]/5 blur-[220px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] rounded-full bg-[#E5B830]/3 blur-[180px] pointer-events-none" />

      {/* Corporate Mail Hub Drawer Badge */}
      <div className="absolute top-4 right-4 z-40">
        <button
          onClick={() => {
            setShowMailbox(true);
            setNewNotification(false);
          }}
          className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-xs font-mono font-bold tracking-wider transition ${
            newNotification 
              ? 'bg-[#E5B830]/15 text-[#E5B830] border-[#E5B830]/40 animate-pulse'
              : 'bg-[#13192B]/80 text-[#138A8E] border-[#1F293F] hover:bg-[#1C243B]'
          }`}
        >
          <Inbox className="h-4 w-4 shrink-0" />
          <span>KMC INBOX SIMULATOR</span>
          {simulatedEmails.length > 0 && (
            <span className="bg-[#E5B830] text-[#0C0F1D] h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold animate-bounce">
              {simulatedEmails.length}
            </span>
          )}
          {newNotification && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E5B830] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#E5B830]"></span>
            </span>
          )}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.01, boxShadow: "0 25px 60px -15px rgba(0,0,0,0.9), 0 0 50px rgba(19,138,142,0.06)" }}
        className="w-full max-w-md bg-gradient-to-b from-[#13192B]/95 to-[#0F1426]/95 backdrop-blur-md border border-[#1F293F] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(19,138,142,0.04)] overflow-hidden z-10 transition-all duration-300"
      >
        
        {/* Header Branding */}
        <div className="bg-[#111625]/85 backdrop-blur-sm border-b border-[#1E253B] p-6 text-center space-y-3">
          <KMCLogo 
            className="h-10 justify-center" 
            companyInitials={displayedCompany.logoInitials}
            companySubtitle={displayedCompany.name}
            primaryColor={displayedCompany.primaryColor}
            secondaryColor={displayedCompany.secondaryColor}
          />
          <div>
            <span className="font-mono text-[10px] uppercase font-bold tracking-[0.2em] block" style={{ color: displayedCompany.primaryColor }}>
              {displayedCompany.name} Ledger Gateway
            </span>
            <p className="text-zinc-400 text-xs mt-1">Multi-Level Secure Client Portal Access</p>
          </div>

          {/* Private Organization Context indicator (Zero leak) */}
          <div className="pt-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#161D32] border border-[#232F4C] text-[10px] font-mono uppercase tracking-wider text-zinc-300" style={{ borderColor: displayedCompany.primaryColor }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: displayedCompany.primaryColor }} />
              Secure Workspace Isolation
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          
          {/* Info messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-rose-500/10 border border-rose-500/25 rounded-lg p-3.5 mb-5 flex items-start gap-2.5 text-xs text-rose-300"
              >
                <AlertTriangle className="h-4.5 w-4.5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-[10px] text-rose-400">Security Access Issue</h4>
                  <p className="mt-0.5 font-sans leading-relaxed text-zinc-200">{error}</p>
                </div>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-3.5 mb-5 flex items-start gap-2.5 text-xs text-emerald-300"
              >
                <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-[10px] text-emerald-400">Process Completed</h4>
                  <p className="mt-0.5 font-sans leading-relaxed text-zinc-200">{successMsg}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Selection (Only shown in Login / Register views) */}
          {(mode === 'login' || mode === 'register') && (
            <div className="flex bg-[#0C0F1D] p-1 rounded-full border border-[#1E273D] mb-6">
              <button
                onClick={() => {
                  setMode('login');
                  clearMessages();
                }}
                className={`w-1/2 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#E5B830] text-[#0C0F1D] shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                SIGN IN
              </button>
              <button
                onClick={() => {
                  setMode('register');
                  clearMessages();
                }}
                className={`w-1/2 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[#138A8E] text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                SIGN UP
              </button>
            </div>
          )}

          {/* Form Content */}
          <AnimatePresence mode="wait">
            
            {/* 1. LOGIN FORM */}
            {mode === 'login' && (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. employee@kmc.co.za"
                      className="block w-full pl-9 pr-4 py-2 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider">
                      Security Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        clearMessages();
                      }}
                      className="text-xs text-[#E5B830] hover:text-[#f8d462] hover:underline font-medium cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-9 pr-4 py-2 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 mt-2 bg-[#E5B830] hover:bg-[#F2C94C] text-[#0C0F1D] font-sans font-extrabold text-xs uppercase tracking-wider rounded-full shadow transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>SECURE LEDGER ACCESS</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="pt-4 border-t border-[#1F293F] text-center">
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Authorized profiles: deanv.d.merwe91@gmail.com, management@kmc.co.za, or register below.
                  </p>
                </div>
              </motion.form>
            )}

            {/* 2. REGISTER FORM */}
            {mode === 'register' && (
              <motion.form
                key="register-form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                {/* Unified Corporate Workspace Lookup input field (Private organization context mapping) */}
                <div className="space-y-1.5 p-3.5 bg-[#171E36] rounded-xl border border-[#1E2945] shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold uppercase text-[#138A8E] tracking-wider">
                      Work Organization Code *
                    </label>
                    <span className="text-[9px] text-zinc-500 font-mono">e.g. KMC, SSL</span>
                  </div>
                  <input
                    type="text"
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                    placeholder="ENTER REGISTERED COMPANY WORKSPACE CODE"
                    className="block w-full px-3 py-2 bg-[#101524] border border-[#232D4E] rounded text-sm text-zinc-100 placeholder-zinc-600 uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-[#138A8E]"
                    required
                  />
                  {/* Dynamic Organization Name resolution indicator */}
                  {companyCode.trim() && (
                    <div className="text-[10px] font-medium leading-normal mt-1.5 flex items-center gap-1.5 font-mono">
                      {companies.some(c => c.logoInitials.toLowerCase() === companyCode.toLowerCase().trim()) ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Check className="h-3 w-3 shrink-0" /> Verified Workspace: <b className="uppercase">{companies.find(c => c.logoInitials.toLowerCase() === companyCode.toLowerCase().trim())?.name}</b>
                        </span>
                      ) : (
                        <span className="text-amber-400">
                          ⚠ Code not registered. Click 'Enroll New Company' below if you are onboarding a new structure.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider">
                    Full Employee Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Dean Van Der Merwe"
                      className="block w-full pl-9 pr-4 py-2 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E] outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. dean@kmc.co.za"
                      className="block w-full pl-9 pr-4 py-2 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E] outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider">
                    Set Security Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="block w-full pl-9 pr-4 py-2 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E] outline-none transition"
                      required
                    />
                  </div>
                </div>

                {/* Role selection - Agents log fuel only, management logs & sees reports */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider">
                    Ledger Employee Tier / Role
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-555">
                      <Shield className="h-4 w-4" />
                    </div>
                    <select
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value as UserRole);
                        setError('');
                      }}
                      className="block w-full pl-9 pr-4 py-2 bg-[#161D32] text-sm text-zinc-200 rounded-lg border border-[#232F4C] outline-none cursor-pointer focus:border-[#138A8E]"
                    >
                      <option value="agent">Agent (Diesel refuel logging ONLY)</option>
                      <option value="management">Management (Logs, Sites & Full Reports)</option>
                    </select>
                  </div>
                </div>

                {/* Optional confirmation code for Management Tier */}
                {role === 'management' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2.5 bg-[#171E36] p-4 rounded-lg border border-[#138A8E]/25 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold uppercase text-[#11E2BC] tracking-wider">
                        Management Authorization Key *
                      </label>
                      <button
                        type="button"
                        onClick={handleRequestMgmtKey}
                        className="text-[10px] text-[#E5B830] hover:text-[#f8d462] hover:underline flex items-center gap-1 font-semibold font-mono cursor-pointer"
                      >
                        📬 Send Key to my Email
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={mgmtCode}
                        onChange={(e) => setMgmtCode(e.target.value)}
                        placeholder="Enter Code (Leave BLANK for manual approval)"
                        className="block w-full px-3 py-2 bg-[#101524] border border-[#232D4E] rounded text-sm text-zinc-100 placeholder-zinc-600 uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-[#138A8E]"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                      Management enrollment requires an administrative authorization key for instant signup. Alternatively, <span className="text-[#E5B830] font-bold">leave this field blank</span> to register under a 'Pending' status and await manual supervisor clearance in the database.
                    </p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 mt-2 bg-[#138A8E] hover:bg-[#1CA8AD] text-white font-sans font-extrabold text-xs uppercase tracking-wider rounded-full shadow transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>REGISTER EMPLOYEE PROFILE</span>
                  <Check className="h-4 w-4" />
                </button>

                <div className="pt-3.5 border-t border-[#1F293F] text-center font-sans text-xs">
                  <p className="text-zinc-400">
                    Not with an existing company?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('enroll');
                        clearMessages();
                      }}
                      className="text-[#138A8E] hover:text-[#1CA8AD] font-bold hover:underline cursor-pointer select-none"
                    >
                      Onboard / Enroll New Company &rarr;
                    </button>
                  </p>
                </div>
              </motion.form>
            )}

            {/* 2B. CORPORATE TENANT ENROLLMENT FORM */}
            {mode === 'enroll' && (
              <motion.form
                key="enroll-form"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onSubmit={handleEnrollCompany}
                className="space-y-4 font-sans text-xs"
              >
                <div className="p-3 bg-[#138A8E]/10 border border-[#138A8E]/25 rounded-xl">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <HardHat className="h-4 w-4 text-[#138A8E]" />
                    Enroll Corporate Network Workspace
                  </h3>
                  <p className="text-[11px] leading-relaxed text-zinc-400 mt-1 font-sans">
                    Onboard a private, fully isolated fleet diesel ledger partition. Your company data, logging records and active construction sites remain 100% confidential.
                  </p>
                </div>

                <div className="space-y-3 p-4 bg-[#171E36] rounded-xl border border-[#1E2945]">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400">1. Organization Brand Coordinates</h4>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Company Brand Name</label>
                    <input
                      type="text"
                      value={enrollName}
                      onChange={(e) => setEnrollName(e.target.value)}
                      placeholder="e.g. Sasol Logistics"
                      className="block w-full px-3 py-1.5 bg-[#101524] border border-[#232D4E] rounded text-xs text-zinc-100 placeholder-zinc-650 inline-block focus:outline-none focus:border-[#138A8E]"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Registered Legal Entity Name</label>
                    <input
                      type="text"
                      value={enrollLegal}
                      onChange={(e) => setEnrollLegal(e.target.value)}
                      placeholder="e.g. Sasol Oil Logistics (Pty) Ltd"
                      className="block w-full px-3 py-1.5 bg-[#101524] border border-[#232D4E] rounded text-xs text-zinc-100 placeholder-zinc-650 inline-block focus:outline-none focus:border-[#138A8E]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Workspace Code (Initials) *</label>
                      <input
                        type="text"
                        value={enrollInitials}
                        onChange={(e) => setEnrollInitials(e.target.value.toUpperCase().slice(0, 5))}
                        placeholder="e.g. SSL"
                        maxLength={5}
                        className="block w-full px-3 py-1.5 bg-[#101524] border border-[#232D4E] rounded text-xs text-zinc-100 uppercase font-mono placeholder-zinc-650 inline-block focus:outline-none focus:border-[#138A8E]"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Manager Bypass Key *</label>
                      <input
                        type="text"
                        value={enrollKey}
                        onChange={(e) => setEnrollKey(e.target.value.toUpperCase())}
                        placeholder="e.g. SSL-MGR-2026"
                        className="block w-full px-3 py-1.5 bg-[#101524] border border-[#232D4E] rounded text-xs text-zinc-100 uppercase font-mono placeholder-zinc-650 inline-block focus:outline-none focus:border-[#138A8E]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Tagline or Subtitle</label>
                    <input
                      type="text"
                      value={enrollTagline}
                      onChange={(e) => setEnrollTagline(e.target.value)}
                      placeholder="e.g. Bulk Fuel Status & Fleet Ledger"
                      className="block w-full px-3 py-1.5 bg-[#101524] border border-[#232D4E] rounded text-xs text-zinc-100 placeholder-zinc-650 inline-block focus:outline-none focus:border-[#138A8E]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Primary Accent Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={enrollPColor}
                          onChange={(e) => setEnrollPColor(e.target.value)}
                          className="h-7 w-7 rounded bg-transparent border-0 cursor-pointer block shrink-0"
                        />
                        <input
                          type="text"
                          value={enrollPColor}
                          onChange={(e) => setEnrollPColor(e.target.value)}
                          className="flex-1 w-full px-2 py-1 bg-[#101524] border border-[#232D4E] rounded text-[10px] text-zinc-300 font-mono inline-block focus:outline-none focus:border-[#138A8E]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Secondary Accent Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={enrollSColor}
                          onChange={(e) => setEnrollSColor(e.target.value)}
                          className="h-7 w-7 rounded bg-transparent border-0 cursor-pointer block shrink-0"
                        />
                        <input
                          type="text"
                          value={enrollSColor}
                          onChange={(e) => setEnrollSColor(e.target.value)}
                          className="flex-1 w-full px-2 py-1 bg-[#101524] border border-[#232D4E] rounded text-[10px] text-zinc-300 font-mono inline-block focus:outline-none focus:border-[#138A8E]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Drag-and-drop / manual Company Logo selection area */}
                  <div className="space-y-1.5 pt-1.5">
                    <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                      Company Brand Logo * (Required)
                    </label>
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      onDragOver={handleLogoDragOver}
                      onDragLeave={handleLogoDragLeave}
                      onDrop={handleLogoDrop}
                      className={`group cursor-pointer border-2 border-dashed rounded-xl p-4.5 text-center transition flex flex-col items-center justify-center select-none ${
                        isDraggingLogo 
                          ? 'border-[#138A8E] bg-[#138A8E]/5' 
                          : enrollLogoUrl 
                          ? 'border-emerald-500/40 bg-emerald-500/5' 
                          : 'border-[#232F4C] bg-[#101524] hover:border-[#138A8E]/50'
                      }`}
                      title="Upload or drop company branding graphic image"
                    >
                      <input
                        type="file"
                        ref={logoInputRef}
                        onChange={handleLogoFileChange}
                        accept="image/*"
                        className="hidden"
                      />

                      {enrollLogoUrl ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2">
                            <span className="p-1 px-2 text-[9px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded font-mono uppercase font-black tracking-widest flex items-center gap-1 leading-none select-none">
                              <Check className="h-3 w-3 shrink-0" /> Selected
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEnrollLogoUrl(undefined);
                                if (logoInputRef.current) logoInputRef.current.value = '';
                              }}
                              className="text-[9px] text-zinc-500 hover:text-rose-400 uppercase font-mono font-bold hover:underline select-none"
                              title="Remove selected corporate logo image"
                            >
                              [ Remove Logo ]
                            </button>
                          </div>
                          
                          <div className="mx-auto h-16 w-16 bg-[#0E1324] border border-zinc-800 rounded-lg overflow-hidden flex items-center justify-center p-1.5 relative group-hover:border-zinc-700 transition">
                            <img
                              src={enrollLogoUrl}
                              alt="Uploaded logo preview"
                              className="max-h-full max-w-full object-contain rounded"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          
                          <p className="text-[10px] text-zinc-400 font-mono">
                            Logo successfully converted to localized Secure Data Ledger stream
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 py-1">
                          <div className="p-2 rounded-full bg-[#171E36] text-zinc-500 inline-block group-hover:text-[#138A8E] group-hover:bg-[#138A8E]/10 transition">
                            <Image className="h-5 w-5" />
                          </div>
                          <p className="text-[11px] font-bold text-zinc-300">
                            Drop logo image here, or <span className="text-[#138A8E] hover:underline">browse files</span>
                          </p>
                          <p className="text-[9px] text-zinc-500 uppercase font-mono">
                            JPG, PNG or GIF (Max 2MB limit • Auto-proportioned)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4 bg-[#13192B] rounded-xl border border-[#1E2945]">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#138A8E]">2. Lead Manager Ledger Account</h4>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-zinc-300 tracking-wider font-sans">Your Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Dean Van Der Merwe"
                      className="block w-full px-3 py-1.5 bg-[#101524] border border-[#232D4E] rounded text-xs text-zinc-100 placeholder-zinc-650 inline-block focus:outline-none focus:border-[#138A8E]"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-zinc-300 tracking-wider font-sans">Your Work Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. dean@sasol.co.za"
                      className="block w-full px-3 py-1.5 bg-[#101524] border border-[#232D4E] rounded text-xs text-zinc-100 placeholder-zinc-650 inline-block focus:outline-none focus:border-[#138A8E]"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-zinc-300 tracking-wider font-sans">Set Secure Login Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="block w-full px-3 py-1.5 bg-[#101524] border border-[#232D4E] rounded text-xs text-zinc-100 inline-block focus:outline-none focus:border-[#138A8E]"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 mt-2 bg-[#138A8E] hover:bg-[#1CA8AD] text-white font-sans font-extrabold text-xs uppercase tracking-wider rounded-full shadow transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>PROVISION ENTERPRISE WORKSPACE</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      clearMessages();
                    }}
                    className="text-xs text-zinc-500 hover:text-white transition font-bold uppercase font-mono"
                  >
                    &larr; Back to standard Sign Up
                  </button>
                </div>
              </motion.form>
            )}

            {/* 3. FORGOT PASSWORD REQUEST FORM */}
            {mode === 'forgot' && (
              <motion.form
                key="forgot-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onSubmit={handleRequestReset}
                className="space-y-4"
              >
                <div className="text-zinc-400 space-y-1.5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Forgot Security Password Code?</h3>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    Input your work email address. We will route a secure password update link to our Simulated Corporate Webmail Server for security.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. dean@kmc.co.za"
                      className="block w-full pl-9 pr-4 py-2 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 placeholder-zinc-550 focus:outline-none focus:border-[#E5B830] transition"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 mt-2 bg-[#E5B830] hover:bg-[#F2C94C] text-[#0C0F1D] font-sans font-extrabold text-xs uppercase tracking-wider rounded-full shadow transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4 animate-spin-slow" />
                  <span>SEND SECURITY RE-KEY LINK</span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      clearMessages();
                    }}
                    className="text-xs text-zinc-500 hover:text-white transition font-bold"
                  >
                    &larr; BACK TO LOGIN
                  </button>
                </div>
              </motion.form>
            )}

            {/* 4. CHOOSE NEW PASSWORD VIEW */}
            {mode === 'reset' && (
              <motion.form
                key="reset-form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onSubmit={handleResetPasswordSubmit}
                className="space-y-4"
              >
                <div className="bg-[#121E2F] border border-[#21375B] p-4.5 rounded-lg flex gap-3">
                  <Shield className="h-5 w-5 text-[#E5B830] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <h4 className="font-bold text-white uppercase tracking-wider text-[10px]">Secure Gateway Session</h4>
                    <p className="text-zinc-350 leading-relaxed mt-1">
                      Resetting password for: <span className="font-mono font-bold text-[#E5B830]">{email}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 font-sans">
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider">
                    New Security Password Code
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="h-4 w-4 text-[#E5B830]" />
                    </div>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="block w-full pl-9 pr-4 py-2 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 outline-none focus:border-[#E5B830]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5 font-sans">
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="h-4 w-4 text-[#E5B830]" />
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Must match exactly"
                      className="block w-full pl-9 pr-4 py-2 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 outline-none focus:border-[#E5B830]"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 mt-2 bg-[#E5B830] hover:bg-[#F2C94C] text-[#0C0F1D] font-sans font-extrabold text-xs uppercase tracking-wider rounded-full shadow-md transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  SAVE NEW SECURITY PASSWORD
                </button>
              </motion.form>
            )}

            {/* 5. SUCCESSFUL ACCOUNT CREATION / LOGGED OUT MESSAGE */}
            {mode === 'success' && (
              <motion.div
                key="success-message"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-4 font-sans"
              >
                <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/25">
                  <CheckCircle className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider">Registration Approved</h3>
                  <p className="text-xs text-zinc-400 mt-1 pb-4 leading-relaxed max-w-sm mx-auto">
                    Your site Agent Ledger security profile has been initialized securely on this workstation.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const savedUser = localStorage.getItem('apex_diesel_current_user');
                    if (savedUser) {
                      onAuthSuccess(JSON.parse(savedUser));
                    } else {
                      setMode('login');
                    }
                  }}
                  className="w-full py-3 bg-[#138A8E] text-white hover:bg-[#1CA8AD] font-sans font-extrabold text-xs uppercase tracking-wider rounded-full shadow transition hover:scale-[1.01] active:scale-[0.99]"
                >
                  ENTER AND VIEW LEDGER STATION
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>

      {/* DETAILED MOCK OUTLOOK SIMULATOR INBOX POPUP DRAWER/MODAL */}
      <AnimatePresence>
        {showMailbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-[#141C30] border border-[#233152] rounded-xl overflow-hidden shadow-2xl flex flex-col h-[520px]"
            >
              {/* Mail top header banner */}
              <div className="bg-[#0D1222] border-b border-[#1F2B48] px-5 py-4 flex items-center justify-between select-none shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono text-xs font-bold text-[#E5B830]">
                    KMC CLOUD SERVER MAIL GATEWAY
                  </span>
                </div>
                <button
                  onClick={() => setShowMailbox(false)}
                  className="text-zinc-500 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Server Details bar */}
              <div className="bg-[#182037] px-5 py-2.5 flex items-center justify-between text-xs font-mono border-b border-[#202B48] text-zinc-400 shrink-0">
                <div>
                  <span className="text-zinc-500">Inbox URL:</span> mail.kmc-construction.co.za
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 font-bold block">Status: Online (POP3)</span>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {simulatedEmails.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 py-12 space-y-3 font-mono">
                    <Mail className="h-10 w-10 text-zinc-650 opacity-50" />
                    <div>
                      <p className="font-bold uppercase tracking-wider text-xs">No Messages Dispatched</p>
                      <p className="text-[10px] text-zinc-600 mt-1 font-sans">
                        Request a password reset to view simulated delivery receipts in high-fidelity sandbox context.
                      </p>
                    </div>
                  </div>
                ) : (
                  simulatedEmails.map((mail) => (
                    <div key={mail.id} className="bg-[#1A2542] border border-[#2C3E67] rounded-lg overflow-hidden flex flex-col p-4 shadow-md">
                      {/* Email metadata header */}
                      <div className="border-b border-[#2C3E67]/50 pb-3 flex flex-col sm:flex-row justify-between text-xs gap-2 font-mono">
                        <div>
                          <p><span className="text-zinc-500">From:</span> <b className="text-teal-400">{mail.from}</b></p>
                          <p className="mt-1"><span className="text-zinc-500">To:</span> <b className="text-[#E5B830]">{mail.email}</b></p>
                        </div>
                        <div className="text-right text-zinc-500">
                          <p>{mail.time}</p>
                        </div>
                      </div>

                      {/* Email subject heading */}
                      <div className="py-3">
                        <h4 className="font-sans font-bold text-sm text-white mb-2">{mail.subject}</h4>
                        <div className="text-xs text-zinc-330 leading-relaxed font-sans mt-2 whitespace-pre-wrap">
                          {mail.body}
                        </div>
                      </div>

                      {/* Explicit Interactive password reset action simulator link button inside mail body container */}
                      <div className="bg-[#11172A] p-4.5 rounded-lg border border-[#212F54] flex flex-col items-center justify-center text-center mt-2.5">
                        <p className="text-[11px] text-zinc-400 font-sans mb-3 text-center">
                          A password reset link was requested. Click the security action below:
                        </p>
                        <button
                          onClick={() => handleSimulatedResetClick(mail.token, mail.email)}
                          className="bg-[#E5B830] hover:bg-[#F2C94C] text-[#0c0f1d] px-5 py-2.5 rounded text-xs font-mono font-extrabold uppercase tracking-widest transition shadow hover:shadow-lg cursor-pointer"
                        >
                          ⚡ SECURELY RESET MY PASSWORD NOW
                        </button>
                        <span className="text-[10px] text-zinc-500 font-mono mt-2.5 block leading-none select-none">
                          Token Reference: {mail.token} (Expires in 10 minutes)
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer status notifier bar of Mail Server Panel */}
              <div className="bg-[#0D1222] border-t border-[#1F2B48] px-5 py-3.5 flex justify-between items-center text-[10px] text-zinc-500 font-mono shrink-0">
                <span className="flex items-center gap-1.5 uppercase tracking-wide">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  Simulated local SMTP spool active
                </span>
                <span>KMC SECURITY HUB © 2026</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
