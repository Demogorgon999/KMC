/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fuel, MapPin, Calendar, Truck, User, Paperclip, AlertTriangle, UploadCloud, CheckCircle, Trash2, HardHat, FileText, Gauge, Clipboard, Plus, Minus, Layers } from 'lucide-react';
import { ConstructionSite, DieselLog, User as UserType, DieselDelivery } from '../types';
import { compressImage } from '../utils/compressor';

interface BulkLogEntry {
  plantNo: string;
  meterReading: string;
  quantity: string;
}

interface AgentTerminalProps {
  sites: ConstructionSite[];
  logs?: DieselLog[];
  onAddLog: (newLog: Omit<DieselLog, 'id' | 'createdAt'>) => void;
  onAddLogsBatch?: (newLogs: Omit<DieselLog, 'id' | 'createdAt'>[]) => void;
  onAddDelivery?: (newDelivery: Omit<DieselDelivery, 'id' | 'createdAt' | 'isOverridden'>) => void;
  currentUser?: UserType;
}

export default function AgentTerminal({ sites, logs = [], onAddLog, onAddLogsBatch, onAddDelivery, currentUser }: AgentTerminalProps) {
  // Get only active sites for logging
  const activeSites = sites.filter((s) => s.status === 'active');

  // Interactive toggle: 'consumption' | 'bulk_consumption' | 'delivery'
  const [activeForm, setActiveForm] = useState<'consumption' | 'bulk_consumption' | 'delivery'>('consumption');

  // Form states - Refueling (Consumption)
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleMeterReading, setVehicleMeterReading] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [agentName, setAgentName] = useState('');
  const [notes, setNotes] = useState('');
  
  // Bulk consumption form states
  const [bulkEntries, setBulkEntries] = useState<BulkLogEntry[]>([
    { plantNo: '', meterReading: '', quantity: '' }
  ]);
  
  // File Upload states (Refueling)
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form states - Bulk Diesel Delivery (New Request)
  const [deliveredBy, setDeliveredBy] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryQty, setDeliveryQty] = useState('');
  const [kmpOrder, setKmpOrder] = useState('');
  const [openingDip, setOpeningDip] = useState('');
  const [closingDip, setClosingDip] = useState('');
  const [deliveryFileName, setDeliveryFileName] = useState<string | null>(null);
  const [deliveryFileBase64, setDeliveryFileBase64] = useState<string | null>(null);
  const [isDraggingDelivery, setIsDraggingDelivery] = useState(false);
  
  // Success toast / feedback state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const deliveryFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with defaults
  useEffect(() => {
    // Current local time format for datetime-local (YYYY-MM-DDTHH:MM)
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    setDateTime(localISOTime);

    // Tie logged-in employee name
    if (currentUser) {
      setAgentName(currentUser.name);
    } else {
      const savedAgent = localStorage.getItem('last_site_agent_name');
      if (savedAgent) setAgentName(savedAgent);
    }

    const savedSiteId = localStorage.getItem('last_site_id');
    if (savedSiteId && activeSites.some(s => s.id === savedSiteId)) {
      setSelectedSiteId(savedSiteId);
    } else if (activeSites.length > 0) {
      setSelectedSiteId(activeSites[0].id);
    }
  }, [sites, currentUser]);

  // Handle file import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setErrorText(null);
    const isImage = file.type.startsWith('image/');

    if (isImage) {
      // Automatic real-time canvas compression for phone camera images
      setFileName(`${file.name.split('.')[0]}_compressed.jpg`);
      try {
        const compressedBase64 = await compressImage(file);
        setFileBase64(compressedBase64);
      } catch (err) {
        console.error("Image compression failed, falling back to original:", err);
        if (file.size > 600 * 1024) {
          setErrorText('Image is too large and could not be compressed under the 600KB real-time limit.');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => setFileBase64(reader.result as string);
        reader.readAsDataURL(file);
      }
    } else {
      // PDF or non-image document limit validation
      if (file.size > 600 * 1024) {
        setErrorText('PDF/Document size is too large (max 600KB). For real-time cloud sync, non-image sheets must be under 600KB.');
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDeliveryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processDeliveryFile(files[0]);
    }
  };

  const processDeliveryFile = async (file: File) => {
    setErrorText(null);
    const isImage = file.type.startsWith('image/');

    if (isImage) {
      // Automatic real-time canvas compression for phone camera images
      setDeliveryFileName(`${file.name.split('.')[0]}_compressed.jpg`);
      try {
        const compressedBase64 = await compressImage(file);
        setDeliveryFileBase64(compressedBase64);
      } catch (err) {
        console.error("Delivery photo compression failed, falling back to original:", err);
        if (file.size > 600 * 1024) {
          setErrorText('Delivery photo is too large and could not be compressed under the 600KB real-time limit.');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => setDeliveryFileBase64(reader.result as string);
        reader.readAsDataURL(file);
      }
    } else {
      // PDF or non-image document limit validation
      if (file.size > 600 * 1024) {
        setErrorText('PDF/Document size is too large (max 600KB). For real-time cloud sync, non-image sheets must be under 600KB.');
        return;
      }
      setDeliveryFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setDeliveryFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeDeliveryFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeliveryFileName(null);
    setDeliveryFileBase64(null);
    if (deliveryFileInputRef.current) {
      deliveryFileInputRef.current.value = '';
    }
  };

  const handleDeliveryDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDelivery(true);
  };

  const handleDeliveryDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDelivery(false);
  };

  const handleDeliveryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDelivery(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processDeliveryFile(files[0]);
    }
  };

  const handleSubmitDelivery = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSiteId) {
      setErrorText('Please select an active construction site.');
      return;
    }
    if (!deliveredBy.trim()) {
      setErrorText('Please enter who delivered the fuel.');
      return;
    }
    if (!deliveryNote.trim()) {
      setErrorText('Please enter the delivery note number.');
      return;
    }
    const parsedQty = parseFloat(deliveryQty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorText('Please enter a valid delivered quantity in litres.');
      return;
    }
    if (!kmpOrder.trim()) {
      setErrorText('Please enter the KMP order number.');
      return;
    }
    const parsedOpen = parseFloat(openingDip);
    if (isNaN(parsedOpen) || parsedOpen < 0) {
      setErrorText('Please enter a valid opening dip tank reading.');
      return;
    }
    const parsedClose = parseFloat(closingDip);
    if (isNaN(parsedClose) || parsedClose < 0) {
      setErrorText('Please enter a valid closing dip tank reading.');
      return;
    }
    // Delivery file is now fully optional as requested
    const deliveryAttachFilename = deliveryFileName || undefined;
    const deliveryAttachBase64 = deliveryFileBase64 || undefined;
    if (!dateTime) {
      setErrorText('Please select the delivery date and time.');
      return;
    }
    if (!agentName.trim()) {
      setErrorText('Please enter your name (Site Agent).');
      return;
    }

    if (onAddDelivery) {
      onAddDelivery({
        siteId: selectedSiteId,
        deliveredBy: deliveredBy.trim(),
        deliveryNote: deliveryNote.trim().toUpperCase(),
        quantityLitres: parsedQty,
        kmpOrder: kmpOrder.trim().toUpperCase(),
        openingDip: parsedOpen,
        closingDip: parsedClose,
        attachmentFilename: deliveryFileName,
        attachmentBase64: deliveryFileBase64,
        dateTime: new Date(dateTime).toISOString(),
        agentName: agentName.trim(),
      });
    }

    // Save metadata preference for agent ease of access
    localStorage.setItem('last_site_agent_name', agentName.trim());
    localStorage.setItem('last_site_id', selectedSiteId);

    const loggedSiteName = sites.find(s => s.id === selectedSiteId)?.name || 'site';
    setSuccessMessage(`Logged Bulk Diesel Delivery of ${parsedQty} Litres from ${deliveredBy.trim()} at ${loggedSiteName}!`);

    // Reset fields
    setDeliveredBy('');
    setDeliveryNote('');
    setDeliveryQty('');
    setKmpOrder('');
    setOpeningDip('');
    setClosingDip('');
    setDeliveryFileName(null);
    setDeliveryFileBase64(null);
    if (deliveryFileInputRef.current) {
      deliveryFileInputRef.current.value = '';
    }
    setErrorText(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFileName(null);
    setFileBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSiteId) {
      setErrorText('Please select an active construction site.');
      return;
    }
    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorText('Please enter a valid diesel quantity in litres.');
      return;
    }
    if (!vehicleNumber.trim()) {
      setErrorText('Please specify a vehicle, machine, or fleet number.');
      return;
    }
    if (!dateTime) {
      setErrorText('Please select the refueling date and time.');
      return;
    }
    if (!agentName.trim()) {
      setErrorText('Please enter your name (Site Agent).');
      return;
    }

    // Save preferences to make subsequent logging faster
    localStorage.setItem('last_site_agent_name', agentName.trim());
    localStorage.setItem('last_site_id', selectedSiteId);

    // Call submit handler
    onAddLog({
      siteId: selectedSiteId,
      quantityLitres: parsedQty,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      vehicleMeterReading: vehicleMeterReading.trim() || undefined,
      dateTime: new Date(dateTime).toISOString(),
      agentName: agentName.trim(),
      logSheetFilename: fileName,
      logSheetBase64: fileBase64,
      notes: notes.trim() || undefined,
    });

    // Provide visual success feedback
    const loggedSiteName = sites.find(s => s.id === selectedSiteId)?.name || 'site';
    setSuccessMessage(`Logged ${parsedQty} Litres for ${vehicleNumber.toUpperCase()} at ${loggedSiteName}!`);
    
    // Clear form inputs but preserve metadata for agent convenience
    setQuantity('');
    setVehicleNumber('');
    setVehicleMeterReading('');
    setNotes('');
    setFileName(null);
    setFileBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setErrorText(null);

    // Scroll to top of the card or terminal
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Toast removal timer
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleSubmitBulk = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSiteId) {
      setErrorText('Please select an active construction site.');
      return;
    }
    if (!dateTime) {
      setErrorText('Please select the refueling date and time.');
      return;
    }
    if (!agentName.trim()) {
      setErrorText('Please enter your name (Site Agent).');
      return;
    }

    // Filter out completely empty rows, but if there's only one row and it's incomplete, throw error
    const validRows = bulkEntries.filter(entry => entry.plantNo.trim() || entry.quantity.trim());
    
    if (validRows.length === 0) {
      setErrorText('Please add at least one complete entry with Plant No and Quantity.');
      return;
    }

    // Validate entries
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      if (!row.plantNo.trim()) {
        setErrorText(`Row ${i + 1} is missing a Plant/Vehicle No.`);
        return;
      }
      const parsedQty = parseFloat(row.quantity);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        setErrorText(`Row ${i + 1} ("${row.plantNo}") has an invalid quantity. Must be a positive number of litres.`);
        return;
      }
    }

    // Prepare batch of logs
    const logsToSubmit = validRows.map(row => ({
      siteId: selectedSiteId,
      quantityLitres: parseFloat(row.quantity),
      vehicleNumber: row.plantNo.trim().toUpperCase(),
      vehicleMeterReading: row.meterReading.trim() || undefined,
      dateTime: new Date(dateTime).toISOString(),
      agentName: agentName.trim(),
      notes: notes.trim() ? `[Bulk Refuel] ${notes.trim()}` : '[Bulk Refuel]',
      logSheetFilename: fileName || undefined,
      logSheetBase64: fileBase64 || undefined
    }));

    // Save preferences
    localStorage.setItem('last_site_agent_name', agentName.trim());
    localStorage.setItem('last_site_id', selectedSiteId);

    // Call batch function or fall back to single additions in sequence
    if (onAddLogsBatch) {
      onAddLogsBatch(logsToSubmit);
    } else {
      logsToSubmit.forEach(l => onAddLog(l));
    }

    // Provide visual success feedback
    const totalQty = logsToSubmit.reduce((sum, l) => sum + l.quantityLitres, 0);
    const loggedSiteName = sites.find(s => s.id === selectedSiteId)?.name || 'site';
    setSuccessMessage(`Logged Bulk Refueling: Registered ${logsToSubmit.length} entries totaling ${totalQty.toFixed(1)} Litres at ${loggedSiteName}!`);

    // Reset fields
    setBulkEntries([{ plantNo: '', meterReading: '', quantity: '' }]);
    setNotes('');
    setFileName(null);
    setFileBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setErrorText(null);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleAddBulkRow = () => {
    setBulkEntries([...bulkEntries, { plantNo: '', meterReading: '', quantity: '' }]);
  };

  const handleRemoveBulkRow = (index: number) => {
    setBulkEntries(bulkEntries.filter((_, idx) => idx !== index));
  };

  const handleUpdateBulkEntry = (index: number, field: keyof BulkLogEntry, value: string) => {
    setBulkEntries(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Real-time Vehicle background mileage calculation
  const getAgentVehicleInsight = () => {
    if (!vehicleNumber.trim()) return null;
    const vNum = vehicleNumber.trim().toUpperCase();

    // Find previous logs for this vehicle that have meter readings
    const matches = logs
      .filter(l => l.vehicleNumber && l.vehicleNumber.trim().toUpperCase() === vNum && l.vehicleMeterReading)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

    if (matches.length === 0) return { isFirst: true };

    const lastLogWithMeter = matches[0];
    const prevMeterStr = lastLogWithMeter.vehicleMeterReading || '';
    const isHrs = prevMeterStr.toLowerCase().includes('hr') || prevMeterStr.toLowerCase().includes('h') || prevMeterStr.toLowerCase().includes('hour');
    
    const prevMeterVal = parseFloat(prevMeterStr.replace(/[^0-9.]/g, ''));
    if (isNaN(prevMeterVal)) return { isFirst: true, lastLog: lastLogWithMeter };

    const currentMeterVal = parseFloat(vehicleMeterReading.replace(/[^0-9.]/g, ''));
    const qtyVal = parseFloat(quantity);

    if (isNaN(currentMeterVal)) {
      return {
        isFirst: false,
        prevMeterValue: prevMeterVal,
        prevMeterStr,
        isHrs,
        lastLog: lastLogWithMeter,
        hasCurrentMeter: false
      };
    }

    const diff = currentMeterVal - prevMeterVal;
    let rate: number | null = null;
    if (diff > 0 && !isNaN(qtyVal) && qtyVal > 0) {
      rate = isHrs ? (qtyVal / diff) : ((qtyVal / diff) * 100);
    }

    return {
      isFirst: false,
      prevMeterValue: prevMeterVal,
      prevMeterStr,
      isHrs,
      lastLog: lastLogWithMeter,
      hasCurrentMeter: true,
      currentMeterValue: currentMeterVal,
      diff,
      rate,
      qtyVal
    };
  };

  const vehicleInsight = getAgentVehicleInsight();

  return (
    <div id="agent-terminal-card" className="w-full max-w-2xl mx-auto bg-gradient-to-b from-[#13192B] to-[#0F1426] border border-[#1E273D] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(19,138,142,0.04)] overflow-hidden transition-all duration-300 hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_50px_rgba(229,184,48,0.06)]">
      {/* Visual Header */}
      <div className="bg-[#181F35] px-4 py-4 sm:px-6 sm:py-5 border-b border-[#232F4C] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#E5B830]/15 text-[#E5B830] border border-[#E5B830]/25 rounded-lg shadow-sm">
            <HardHat id="hardhat-icon" className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <h2 className="font-sans font-bold text-base sm:text-lg text-zinc-100 tracking-tight">Site Agent Terminal</h2>
            <p className="text-xs sm:text-sm text-zinc-350 font-medium">Log real-time diesel refuel transactions instantly</p>
          </div>
        </div>
        <span className="text-[10px] sm:text-xs font-mono uppercase bg-[#138A8E]/20 text-[#138A8E] px-2 py-1 sm:px-3 sm:py-1.5 rounded border border-[#138A8E]/25 tracking-wider font-bold">
          Log Station
        </span>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Alerts and Notices */}
        {successMessage && (
          <div id="terminal-success-alert" className="p-4 bg-emerald-950/30 border-l-4 border-emerald-500 rounded-r-md text-emerald-300 flex items-start gap-3 transition-all border border-emerald-900/40">
            <CheckCircle id="success-check-icon" className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider text-emerald-450">Fuel Logged Successfully</p>
              <p className="text-xs mt-1 text-zinc-300">{successMessage}</p>
            </div>
          </div>
        )}

        {errorText && (
          <div id="terminal-error-alert" className="p-4 bg-rose-950/30 border-l-4 border-rose-500 rounded-r-md text-rose-300 flex items-start gap-3 border border-rose-900/40">
            <AlertTriangle id="error-alert-icon" className="h-5 w-5 text-rose-450 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider text-rose-400">Logging Error</p>
              <p className="text-xs mt-1 text-zinc-300">{errorText}</p>
            </div>
          </div>
        )}

        {activeSites.length === 0 ? (
          <div className="p-8 text-center bg-[#E5B830]/5 rounded-xl border border-dashed border-[#E5B830]/20">
            <AlertTriangle className="h-10 w-10 text-[#E5B830] mx-auto mb-3 animate-pulse" />
            <h3 className="font-bold text-zinc-200 text-sm tracking-tight">No Active Sites Found</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Please switch to the <span className="font-semibold text-[#E5B830]">💼 Manage Project Sites</span> tab to add an active construction site before logging consumption.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Form Selector Tabs */}
            <div className="flex bg-[#111625] p-1.5 rounded-xl border border-[#232F4C] gap-1.5 shrink-0 select-none relative overflow-hidden flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => {
                  setActiveForm('consumption');
                  setErrorText(null);
                }}
                className={`relative flex-1 py-3 px-3 rounded-lg font-sans font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer select-none outline-none transition-colors duration-250 ${
                  activeForm === 'consumption'
                    ? 'text-[#E5B830]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/3'
                }`}
              >
                {activeForm === 'consumption' && (
                  <motion.span
                    layoutId="activeSubformBg"
                    className="absolute inset-0 bg-[#E5B830]/10 border border-[#E5B830]/35 rounded-lg shadow-sm z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <motion.div
                  className="relative z-10 flex items-center justify-center"
                  whileHover={{ scale: 1.25, rotate: 15 }}
                  whileTap={{ scale: 0.85 }}
                >
                  <Fuel className="h-4 w-4" />
                </motion.div>
                <span className="relative z-10">Single Refuel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveForm('bulk_consumption');
                  setErrorText(null);
                }}
                className={`relative flex-1 py-3 px-3 rounded-lg font-sans font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer select-none outline-none transition-colors duration-250 ${
                  activeForm === 'bulk_consumption'
                    ? 'text-[#E5B830]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/3'
                }`}
              >
                {activeForm === 'bulk_consumption' && (
                  <motion.span
                    layoutId="activeSubformBg"
                    className="absolute inset-0 bg-[#E5B830]/15 border border-[#E5B830]/40 rounded-lg shadow-sm z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <motion.div
                  className="relative z-10 flex items-center justify-center"
                  whileHover={{ scale: 1.25, rotate: 5 }}
                  whileTap={{ scale: 0.85 }}
                >
                  <Layers className="h-4 w-4" />
                </motion.div>
                <span className="relative z-10">Bulk Refuel (Multi)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveForm('delivery');
                  setErrorText(null);
                }}
                className={`relative flex-1 py-3 px-3 rounded-lg font-sans font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer select-none outline-none transition-colors duration-250 ${
                  activeForm === 'delivery'
                    ? 'text-[#11E2BC]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/3'
                }`}
              >
                {activeForm === 'delivery' && (
                  <motion.span
                    layoutId="activeSubformBg"
                    className="absolute inset-0 bg-[#138A8E]/10 border border-[#138A8E]/35 rounded-lg shadow-sm z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <motion.div
                  className="relative z-10 flex items-center justify-center"
                  whileHover={{ scale: 1.25, rotate: -15 }}
                  whileTap={{ scale: 0.85 }}
                >
                  <Clipboard className="h-4 w-4" />
                </motion.div>
                <span className="relative z-10">Diesel Delivery</span>
              </button>
            </div>

            {/* 1. SELECT CONSTRUCTION SITE */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                Select Construction Site *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <MapPin className="h-5 w-5 text-[#138A8E]" />
                </div>
                <select
                  id="site-selector"
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="block w-full pl-11 pr-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-base text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition cursor-pointer"
                  required
                >
                  {activeSites.map((site) => (
                    <option key={site.id} value={site.id} className="bg-[#111625] text-zinc-100">
                      [{site.code}] {site.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeForm === 'consumption' ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 2. QUANTITY IN LITRES (BIG DIAL IN EFFECT) */}
                <div className="bg-[#161D32] rounded-xl p-5 border border-[#232F4C] shadow-inner">
                  <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider mb-2">
                    Diesel Quantity (Litres) *
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-4 text-zinc-400 font-bold text-xl select-none flex items-center gap-2">
                      <Fuel className="h-6 w-6 text-[#E5B830]" />
                    </div>
                    <input
                      id="diesel-quantity-input"
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="0.0"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="block w-full pl-14 pr-20 py-3.5 bg-[#111625] border border-[#1E273D] rounded-lg text-xl font-mono font-bold text-zinc-100 focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition text-right shadow-sm focus:bg-[#161C2C]"
                      required
                    />
                    <div className="absolute right-4 text-sm font-bold font-mono text-zinc-400 uppercase select-none">
                      Litres (L)
                    </div>
                  </div>
                </div>

                {/* 3. PLANT / MACHINE FLEET ID & METER READING */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Plant / Vehicle No. *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <Truck className="h-5 w-5 text-[#E5B830]" />
                      </div>
                      <input
                        id="vehicle-number-input"
                        type="text"
                        placeholder="e.g. CAT-HEX-891, GEN-04"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        className="block w-full pl-11 pr-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-base text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition font-sans tracking-wide uppercase font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider flex items-center justify-between">
                      <span>Meter Reading (km or hrs)</span>
                      <span className="text-[10px] text-zinc-400 font-normal normal-case italic">Optional</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <Gauge className="h-5 w-5 text-[#138A8E]" />
                      </div>
                      <input
                        id="vehicle-meter-input"
                        type="text"
                        placeholder="e.g. 15420 km, 452 hrs"
                        value={vehicleMeterReading}
                        onChange={(e) => setVehicleMeterReading(e.target.value)}
                        className="block w-full pl-11 pr-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-base text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition font-sans tracking-wide font-mono"
                      />
                    </div>

                    {/* Real-time background vehicle tracking */}
                    <AnimatePresence>
                      {vehicleInsight && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          className="p-3 bg-gradient-to-r from-[#172033]/90 to-[#121A2A]/90 border border-[#2D3C65]/50 rounded-xl text-xs space-y-1 overflow-hidden"
                        >
                          <div className="flex items-center justify-between text-zinc-350">
                            <span className="font-semibold flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#E5B830]">
                              <Gauge className="h-3 w-3 text-[#138A8E]" />
                              Real-Time Fleet Insight
                            </span>
                            {vehicleInsight.isFirst ? (
                              <span className="font-mono text-[9px] bg-[#E5B830]/8 text-[#E5B830] px-1 rounded border border-[#E5B830]/20 font-bold leading-none py-0.5">
                                First Entry
                              </span>
                            ) : (
                              <span className="font-mono text-[9px] bg-emerald-500/8 text-[#11E2BC] px-1 rounded border border-emerald-500/20 font-bold leading-none py-0.5">
                                Prev: {vehicleInsight.prevMeterStr}
                              </span>
                            )}
                          </div>

                          {vehicleInsight.isFirst ? (
                            <p className="text-[10px] text-zinc-455">
                              This is the first captured fueling log for <span className="text-zinc-300 font-bold">{vehicleNumber.trim().toUpperCase()}</span>. Subsequent entries will calculate mileage.
                            </p>
                          ) : (
                            <div className="space-y-1 text-zinc-400">
                              {!vehicleInsight.hasCurrentMeter ? (
                                <p className="text-[10px] text-zinc-455">
                                  Specify current meter reading (must be &gt; <span className="font-mono text-[#11E2BC]">{vehicleInsight.prevMeterValue}</span>) to calculate distance traveled and consumption economics.
                                </p>
                              ) : (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-0.5 font-mono text-[10px]">
                                  <div>
                                    <span className="text-zinc-500">Delta:</span>{' '}
                                    {vehicleInsight.diff > 0 ? (
                                      <span className="text-emerald-400 font-bold">
                                        +{vehicleInsight.diff.toLocaleString()} {vehicleInsight.isHrs ? 'hrs' : 'km'}
                                      </span>
                                    ) : vehicleInsight.diff === 0 ? (
                                      <span className="text-amber-400 font-bold">0 delta</span>
                                    ) : (
                                      <span className="text-rose-400 font-bold">
                                        Negative gap ({vehicleInsight.diff})
                                      </span>
                                    )}
                                  </div>
                                  {vehicleInsight.rate !== null && vehicleInsight.diff > 0 && (
                                    <div>
                                      <span className="text-zinc-500">Rate:</span>{' '}
                                      <span className="text-[#11E2BC] font-bold">
                                        {vehicleInsight.rate.toFixed(1)} {vehicleInsight.isHrs ? 'L/hr' : 'L/100km'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* 4. DATE AND TIME & SITE AGENT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Fueling Date & Time *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <Calendar className="h-5 w-5 text-[#E5B830]" />
                      </div>
                      <input
                        id="date-time-input"
                        type="datetime-local"
                        value={dateTime}
                        onChange={(e) => setDateTime(e.target.value)}
                        className="block w-full pl-11 pr-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-base text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition cursor-pointer"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Site Agent (Your Name) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 font-sans">
                        <User className="h-5 w-5 text-[#138A8E]" />
                      </div>
                      <input
                        id="agent-name-input"
                        type="text"
                        placeholder="e.g. Marcus Vance"
                        value={agentName}
                        onChange={(e) => !currentUser && setAgentName(e.target.value)}
                        readOnly={!!currentUser}
                        className={`block w-full pl-11 pr-4 py-2.5 border rounded-lg text-base transition font-sans ${
                          currentUser
                            ? 'bg-[#12192B] border-[#138A8E]/30 text-zinc-300 cursor-not-allowed select-none'
                            : 'bg-[#161D32] border-[#232F4C] text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830]'
                        }`}
                        required
                      />
                    </div>
                    {currentUser && (
                      <p className="text-[10px] text-zinc-500 font-mono mt-1 leading-none">
                        Session Sync: Locked to verified card profile ({currentUser.role}).
                      </p>
                    )}
                  </div>
                </div>

                {/* 5. PLACE TO UPLOAD LOG SHEET / TRANSACTION SLIP */}
                <div className="space-y-2">
                  <label id="upload-label" className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                    Upload Fuel Log Sheet or Slip Attachment
                  </label>
                  
                  <div
                    id="dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`group cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center ${
                      isDragging 
                        ? 'border-[#E5B830] bg-[#E5B830]/5' 
                        : fileName 
                        ? 'border-emerald-500/40 bg-emerald-500/5' 
                        : 'border-[#232F4C] bg-[#161D32] hover:border-[#E5B830]/30'
                    }`}
                  >
                    <input
                      id="logsheet-file-upload-input"
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,application/pdf"
                      className="hidden"
                    />

                    {fileBase64 ? (
                      <div className="w-full flex flex-col items-center gap-2">
                        {fileBase64.startsWith('data:image') ? (
                          <div className="relative max-h-48 rounded bg-[#111625] p-1 border border-[#1E273D] overflow-hidden mt-1 shadow-sm">
                            <img 
                              src={fileBase64} 
                              alt="Log Slip Attachment Preview" 
                              className="max-h-40 max-w-full object-contain rounded"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="p-4 bg-[#111625] rounded-lg border border-[#1E273D] text-zinc-350 flex items-center gap-3">
                            <FileText className="h-10 w-10 text-zinc-500" />
                            <div className="text-left">
                              <p className="font-semibold text-xs text-zinc-200">PDF Logsheet Loaded</p>
                              <p className="text-[10px] text-zinc-500 font-mono max-w-xs truncate">{fileName}</p>
                            </div>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-xs text-zinc-300 font-medium font-mono">{fileName}</span>
                          <button
                            type="button"
                            onClick={removeFile}
                            className="p-1 text-zinc-400 hover:text-rose-500 bg-[#1E273F] hover:bg-[#25324D] border border-[#2D395A] rounded-full hover:shadow transition"
                            title="Remove attachment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="h-10 w-10 text-[#138A8E]/60 group-hover:text-[#138A8E] transition mb-2" />
                        <p className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100">
                          Drag & Drop Fuel Slip / Logsheet File
                        </p>
                        <p className="text-xs text-zinc-400 mt-1 font-sans">
                          Supports JPG, PNG, WebP or PDF (Max 8MB File Size)
                        </p>
                        <button
                          type="button"
                          className="mt-3 px-5 py-2 text-xs font-bold bg-[#111625] border border-[#1E273D] rounded-full shadow-sm hover:bg-[#1E273D] text-zinc-200 transition uppercase tracking-wider"
                        >
                          Browse Files
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 6. ADDITIONAL NOTES */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                    Notes / Comments (Optional)
                  </label>
                  <textarea
                    placeholder="e.g. Tank level start/end, delivery slip reference, pipeline meter readings..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition resize-none"
                  />
                </div>

                {/* LOG FUEL SUBMIT ACTION */}
                <button
                  id="submit-fuel-log-button"
                  type="submit"
                  className="w-full py-3.5 px-6 bg-[#E5B830] hover:bg-[#F2C94C] text-[#0C0F1D] font-sans font-extrabold text-sm uppercase tracking-wider rounded-full shadow-lg transform active:scale-[0.98] hover:scale-[1.01] transition duration-150 flex items-center justify-center gap-2 cursor-pointer mt-5"
                >
                  <Fuel className="h-4 w-4" />
                  CONFIRM & LOG CONSUMPTION
                </button>
              </form>
            ) : activeForm === 'bulk_consumption' ? (
              /* DIESEL BULK CONSUMPTION FORM */
              <form onSubmit={handleSubmitBulk} className="space-y-5">
                {/* BRAND NOTICE */}
                <div className="p-4 bg-[#E5B830]/10 rounded-xl border border-[#E5B830]/20 text-zinc-300 text-xs flex gap-3 select-none leading-relaxed">
                  <Layers className="h-5 w-5 text-[#E5B830] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-[#E5B830] uppercase tracking-wide block">Bulk Refueling Log (Multi-Entry)</span>
                    Quickly capture multiple diesel refueling records for active vehicles and plant machinery at your selected construction site.
                  </div>
                </div>

                {/* DATE AND TIME & SITE AGENT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Fueling Date & Time *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <Calendar className="h-5 w-5 text-[#E5B830]" />
                      </div>
                      <input
                        type="datetime-local"
                        value={dateTime}
                        onChange={(e) => setDateTime(e.target.value)}
                        className="block w-full pl-11 pr-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-base text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition cursor-pointer"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Site Agent (Your Name) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 font-sans">
                        <User className="h-5 w-5 text-[#138A8E]" />
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Marcus Vance"
                        value={agentName}
                        onChange={(e) => !currentUser && setAgentName(e.target.value)}
                        readOnly={!!currentUser}
                        className={`block w-full pl-11 pr-4 py-2.5 border rounded-lg text-base transition font-sans ${
                          currentUser
                            ? 'bg-[#12192B] border-[#138A8E]/30 text-zinc-300 cursor-not-allowed select-none'
                            : 'bg-[#161D32] border-[#232F4C] text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830]'
                        }`}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* MULTIPLE ENTRYS GRID */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#232F4C] pb-2">
                    <span className="text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Plant Refuel Entries
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      {bulkEntries.length} {bulkEntries.length === 1 ? 'row' : 'rows'} active
                    </span>
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {bulkEntries.map((entry, index) => (
                      <div key={index} className="p-4 bg-[#161D32] border border-[#232F4C] rounded-xl relative space-y-3 md:space-y-0 md:flex md:items-center md:gap-3">
                        {/* Row Badge */}
                        <div className="absolute top-2 right-2 md:relative md:top-auto md:right-auto flex items-center justify-center h-6 w-6 rounded-full bg-[#111625] text-[10px] font-mono font-bold text-[#E5B830] border border-[#E5B830]/20 shrink-0 select-none">
                          {index + 1}
                        </div>

                        {/* Plant Input */}
                        <div className="flex-1 space-y-1">
                          <span className="md:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Plant / Vehicle No. *</span>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                              <Truck className="h-4 w-4 text-[#E5B830]" />
                            </div>
                            <input
                              type="text"
                              placeholder="PLANT / VEHICLE NO."
                              value={entry.plantNo}
                              onChange={(e) => handleUpdateBulkEntry(index, 'plantNo', e.target.value)}
                              className="block w-full pl-9 pr-3 py-2 bg-[#111625] border border-[#1E273D] rounded-lg text-sm text-zinc-100 placeholder-zinc-650 focus:ring-1 focus:ring-[#E5B830] outline-none uppercase font-bold"
                              required
                            />
                          </div>
                        </div>

                        {/* Meter Input */}
                        <div className="flex-1 space-y-1">
                          <span className="md:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Meter Reading (Optional)</span>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                              <Gauge className="h-4 w-4 text-[#138A8E]" />
                            </div>
                            <input
                              type="text"
                              placeholder="METER (km or hrs)"
                              value={entry.meterReading}
                              onChange={(e) => handleUpdateBulkEntry(index, 'meterReading', e.target.value)}
                              className="block w-full pl-9 pr-3 py-2 bg-[#111625] border border-[#1E273D] rounded-lg text-sm text-zinc-100 placeholder-zinc-650 focus:ring-1 focus:ring-[#E5B830] outline-none font-mono"
                            />
                          </div>
                        </div>

                        {/* Quantity Input */}
                        <div className="w-full md:w-32 space-y-1">
                          <span className="md:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Quantity (Litres) *</span>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              placeholder="LITRES"
                              value={entry.quantity}
                              onChange={(e) => handleUpdateBulkEntry(index, 'quantity', e.target.value)}
                              className="block w-full px-3 py-2 bg-[#111625] border border-[#1E273D] rounded-lg text-sm font-mono font-bold text-zinc-100 placeholder-zinc-650 focus:ring-1 focus:ring-[#E5B830] outline-none text-right"
                              required
                            />
                          </div>
                        </div>

                        {/* Delete Row Button */}
                        {bulkEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBulkRow(index)}
                            className="p-2 text-zinc-400 hover:text-rose-500 bg-[#111625] border border-[#1E273D] rounded-lg hover:shadow-md transition self-end md:self-auto flex items-center justify-center gap-1.5 w-full md:w-auto shrink-0 cursor-pointer"
                            title="Remove entry row"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="md:hidden text-xs font-bold uppercase tracking-wider">Remove Row</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Row and Batch totals */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleAddBulkRow}
                      className="px-4 py-2.5 bg-[#1E273D] hover:bg-[#25324E] text-[#E5B830] border border-[#2D395A] font-sans font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition select-none"
                    >
                      <Plus className="h-4 w-4" />
                      Add Plant Entry Row
                    </button>

                    <div className="bg-[#111625] px-4 py-2.5 rounded-lg border border-[#1E273D] text-xs font-mono text-zinc-400 flex justify-between sm:justify-end gap-4 items-center">
                      <span>Batch Count: <strong className="text-zinc-200">{bulkEntries.filter(e => e.plantNo.trim() && e.quantity.trim()).length}</strong></span>
                      <span className="text-zinc-500">|</span>
                      <span>Batch Total: <strong className="text-[#E5B830]">{bulkEntries.reduce((sum, e) => sum + (parseFloat(e.quantity) || 0), 0).toFixed(1)} L</strong></span>
                    </div>
                  </div>
                </div>

                {/* LOG SHEET / TRANSACTION SLIP */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                    Upload Fuel Log Sheet or Slip Attachment (Optional for Batch)
                  </label>
                  
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`group cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center ${
                      isDragging 
                        ? 'border-[#E5B830] bg-[#E5B830]/5' 
                        : fileName 
                        ? 'border-emerald-500/40 bg-emerald-500/5' 
                        : 'border-[#232F4C] bg-[#161D32] hover:border-[#E5B830]/30'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,application/pdf"
                      className="hidden"
                    />

                    {fileBase64 ? (
                      <div className="w-full flex flex-col items-center gap-2">
                        {fileBase64.startsWith('data:image') ? (
                          <div className="relative max-h-48 rounded bg-[#111625] p-1 border border-[#1E273D] overflow-hidden mt-1 shadow-sm">
                            <img 
                              src={fileBase64} 
                              alt="Log Slip Attachment Preview" 
                              className="max-h-40 max-w-full object-contain rounded"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="p-4 bg-[#111625] rounded-lg border border-[#1E273D] text-zinc-350 flex items-center gap-3">
                            <FileText className="h-10 w-10 text-zinc-500" />
                            <div className="text-left">
                              <p className="font-semibold text-xs text-zinc-200">PDF Logsheet Loaded</p>
                              <p className="text-[10px] text-zinc-500 font-mono max-w-xs truncate">{fileName}</p>
                            </div>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-xs text-zinc-300 font-medium font-mono">{fileName}</span>
                          <button
                            type="button"
                            onClick={removeFile}
                            className="p-1 text-zinc-400 hover:text-rose-500 bg-[#1E273F] hover:bg-[#25324D] border border-[#2D395A] rounded-full hover:shadow transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="h-10 w-10 text-[#138A8E]/60 group-hover:text-[#138A8E] transition mb-2" />
                        <p className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100">
                          Drag & Drop Fuel Slip / Logsheet File
                        </p>
                        <p className="text-xs text-zinc-400 mt-1 font-sans">
                          Supports JPG, PNG, WebP or PDF (Max 8MB File Size)
                        </p>
                        <button
                          type="button"
                          className="mt-3 px-5 py-2 text-xs font-bold bg-[#111625] border border-[#1E273D] rounded-full shadow-sm hover:bg-[#1E273D] text-zinc-200 transition uppercase tracking-wider"
                        >
                          Browse Files
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ADDITIONAL BATCH NOTES */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                    Batch Notes / Comments (Optional)
                  </label>
                  <textarea
                    placeholder="e.g. Total logs matching logsheet, operator remarks..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="block w-full px-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-sm text-zinc-200 placeholder-zinc-550 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#E5B830] focus:border-[#E5B830] outline-none transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 bg-[#E5B830] hover:bg-[#F2C94C] text-[#0C0F1D] font-sans font-extrabold text-sm uppercase tracking-wider rounded-full shadow-lg transform active:scale-[0.98] hover:scale-[1.01] transition duration-150 flex items-center justify-center gap-2 cursor-pointer mt-5"
                >
                  <Layers className="h-4 w-4" />
                  CONFIRM & LOG BULK REFUELING BATCH
                </button>
              </form>
            ) : (
              /* DIESEL BULK DELIVERY FORM */
              <form onSubmit={handleSubmitDelivery} className="space-y-5 flex flex-col">
                {/* BRAND NOTICE */}
                <div className="p-4 bg-[#138A8E]/10 rounded-xl border border-[#138A8E]/20 text-zinc-300 text-xs flex gap-3 select-none leading-relaxed">
                  <Clipboard className="h-5 w-5 text-[#11E2BC] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-[#11E2BC] uppercase tracking-wide block">Inbound Fuel Delivery Audit</span>
                    Please record the exact delivery details. Variance calculations are compiled live based on dip measurements compared with delivery note liters.
                  </div>
                </div>

                {/* ROW: Transporter & Delivery Note Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Delivered By / Transporter *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <Truck className="h-4 w-4 text-[#11E2BC]" />
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. SASOL Fuel, KMP Trans"
                        value={deliveredBy}
                        onChange={(e) => setDeliveredBy(e.target.value)}
                        className="block w-full pl-11 pr-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-base text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E] outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Delivery Note / Slip No *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <FileText className="h-4 w-4 text-[#11E2BC]" />
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. DN-55291-A"
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        className="block w-full pl-11 pr-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-base text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E] outline-none font-mono uppercase tracking-wider font-bold"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* ROW: Supplied Quantity & KMP Order # */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Diesel Supplied / Note Qty (L) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <Fuel className="h-4 w-4 text-[#E5B830]" />
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="0.0"
                        value={deliveryQty}
                        onChange={(e) => setDeliveryQty(e.target.value)}
                        className="block w-full pl-11 pr-16 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-base text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E] outline-none text-right font-mono font-bold"
                        required
                      />
                      <div className="absolute inset-y-0 right-4 flex items-center text-xs font-mono font-bold text-zinc-400 select-none pointer-events-none">
                        L
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      KMP Order / Agreement No *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <FileText className="h-4 w-4 text-[#11E2BC]" />
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. KMP-ORD-9020"
                        value={kmpOrder}
                        onChange={(e) => setKmpOrder(e.target.value)}
                        className="block w-full pl-11 pr-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-base text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E] outline-none font-mono uppercase font-bold tracking-wider"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* BLOC: Opening dip, closing dip & variance check */}
                <div className="bg-[#161D32] p-4 rounded-xl border border-[#232F4C] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                        Opening Dip (Litres) *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                          <Gauge className="h-4 w-4 text-[#138A8E]" />
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0.0"
                          value={openingDip}
                          onChange={(e) => setOpeningDip(e.target.value)}
                          className="block w-full pl-11 pr-4 py-2 bg-[#111625] border border-[#1E273D] rounded-lg text-base text-zinc-100 placeholder-zinc-650 focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E] outline-none font-mono font-bold"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                        Closing Dip (Litres) *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                          <Gauge className="h-4 w-4 text-[#138A8E]" />
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0.0"
                          value={closingDip}
                          onChange={(e) => setClosingDip(e.target.value)}
                          className="block w-full pl-11 pr-4 py-2 bg-[#111625] border border-[#1E273D] rounded-lg text-base text-zinc-100 placeholder-zinc-650 focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E] outline-none font-mono font-bold"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* REAL-TIME DIESEL MARGIN VARIANCE COMPILER CARD */}
                  <div className="p-3 bg-[#0C0F1D] rounded-lg border border-[#1E273F] space-y-1.5 select-none text-xs">
                    <div className="flex justify-between font-mono">
                      <span className="text-zinc-400">Physical Tank Addition Check:</span>
                      <span className="text-zinc-200 font-bold">
                        {((parseFloat(closingDip) || 0) - (parseFloat(openingDip) || 0)).toFixed(1)} L
                      </span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-zinc-400">Transporter Bill Quantity:</span>
                      <span className="text-zinc-200">{(parseFloat(deliveryQty) || 0).toFixed(1)} L</span>
                    </div>
                    <div className="h-px bg-[#1E2736] my-1" />
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold uppercase tracking-wide text-zinc-300 text-[10px]">Variance Margin Check:</span>
                      {!(parseFloat(deliveryQty) > 0) ? (
                        <span className="text-zinc-500 font-mono italic text-[11px]">Awaiting inputs...</span>
                      ) : (() => {
                        const diff = ((parseFloat(closingDip) || 0) - (parseFloat(openingDip) || 0)) - parseFloat(deliveryQty);
                        if (Math.abs(diff) < 0.1) {
                          return (
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 border border-emerald-500/20 rounded uppercase">
                              Verified perfect match
                            </span>
                          );
                        }
                        const pct = (diff / parseFloat(deliveryQty)) * 100;
                        return (
                          <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 border border-rose-500/20 rounded uppercase flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 text-rose-400" />
                            {diff < 0 ? 'Under' : 'Over'}-delivered by {Math.abs(diff).toFixed(1)} L ({pct.toFixed(2)}%)
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* ROW: Date/Time & SITE AGENT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Delivery Date & Time *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <Calendar className="h-4 w-4 text-[#11E2BC]" />
                      </div>
                      <input
                        type="datetime-local"
                        value={dateTime}
                        onChange={(e) => setDateTime(e.target.value)}
                        className="block w-full pl-11 pr-4 py-2.5 bg-[#161D32] border border-[#232F4C] rounded-lg text-base text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E] outline-none transition cursor-pointer"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-zinc-300 tracking-wider">
                      Site Agent Name *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <User className="h-4 w-4 text-[#11E2BC]" />
                      </div>
                      <input
                        type="text"
                        placeholder="Marcus Vance"
                        value={agentName}
                        onChange={(e) => !currentUser && setAgentName(e.target.value)}
                        readOnly={!!currentUser}
                        className={`block w-full pl-11 pr-4 py-2.5 border rounded-lg text-base transition ${
                          currentUser
                            ? 'bg-[#12192B] border-[#138A8E]/20 text-zinc-400 cursor-not-allowed select-none'
                            : 'bg-[#161D32] border-[#232F4C] text-zinc-200 focus:bg-[#1A223C] focus:ring-1 focus:ring-[#138A8E] focus:border-[#138A8E]'
                        }`}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* OPTIONAL IMAGE UPLOAD PLACE (No longer strictly enforced) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-zinc-350 tracking-wider flex items-center justify-between">
                    <span>Upload Signed Transporter Note (Optional)</span>
                    <span className="text-[10px] text-zinc-500 uppercase select-none">OPTIONAL ATTACHMENT</span>
                  </label>

                  <div
                    onClick={() => deliveryFileInputRef.current?.click()}
                    onDragOver={handleDeliveryDragOver}
                    onDragLeave={handleDeliveryDragLeave}
                    onDrop={handleDeliveryDrop}
                    className={`group cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center ${
                      isDraggingDelivery 
                        ? 'border-[#138A8E] bg-[#138A8E]/5' 
                        : deliveryFileName 
                        ? 'border-emerald-500/40 bg-emerald-500/5' 
                        : 'border-[#232F4C] bg-[#161D32] hover:border-[#138A8E]/45'
                    }`}
                  >
                    <input
                      type="file"
                      ref={deliveryFileInputRef}
                      onChange={handleDeliveryFileChange}
                      accept="image/*,application/pdf"
                      className="hidden"
                    />

                    {deliveryFileBase64 ? (
                      <div className="w-full flex flex-col items-center gap-2">
                        {deliveryFileBase64.startsWith('data:image') ? (
                          <div className="relative max-h-48 rounded bg-[#111625] p-1 border border-[#1E273D] overflow-hidden mt-1 shadow-sm">
                            <img 
                              src={deliveryFileBase64} 
                              alt="Delivery Slip Attachment Preview" 
                              className="max-h-40 max-w-full object-contain rounded"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="p-4 bg-[#111625] rounded-lg border border-[#1E273D] text-[#11E2BC] flex items-center gap-3">
                            <FileText className="h-10 w-10 text-zinc-455" />
                            <div className="text-left">
                              <p className="font-semibold text-xs text-zinc-200">PDF Delivery Note Loaded</p>
                              <p className="text-[10px] text-zinc-500 font-mono max-w-xs truncate">{deliveryFileName}</p>
                            </div>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-xs text-zinc-300 font-medium font-mono">{deliveryFileName}</span>
                          <button
                            type="button"
                            onClick={removeDeliveryFile}
                            className="p-1 text-zinc-400 hover:text-rose-500 bg-[#1E273F] hover:bg-[#25324D] border border-[#2D395A] rounded-full hover:shadow transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="h-10 w-10 text-[#138A8E]/60 group-hover:text-[#11E2BC] transition mb-2" />
                        <p className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100">
                          Click / Drag signed delivery note slip here
                        </p>
                        <p className="text-xs text-zinc-400 mt-1 font-sans">
                          An image of the slip is optional (recommended for verification check).
                        </p>
                        <button
                          type="button"
                          className="mt-3 px-5 py-2 text-xs font-bold bg-[#111625] border border-[#1E273D] rounded-full shadow-sm hover:hover:bg-[#1E273D] text-zinc-200 transition uppercase tracking-wider"
                        >
                          Browse Slip Image
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 bg-[#138A8E] hover:bg-[#1bb8bd] text-[#0C0F1D] font-sans font-extrabold text-sm uppercase tracking-wider rounded-full shadow-lg transform active:scale-[0.98] hover:scale-[1.01] transition duration-150 flex items-center justify-center gap-2 cursor-pointer mt-5"
                >
                  <Clipboard className="h-4 w-4" />
                  LOG BULK FUEL DELIVERY
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Footer warning */}
      <div className="bg-[#111625] border-t border-[#1E273D] px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2 text-zinc-450 select-none">
        <div className="flex items-center gap-1.5 font-bold">
          <Paperclip className="h-3.5 w-3.5 text-[#138A8E] shrink-0" />
          <span className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-350">Corporate Audited Ledger</span>
        </div>
        <span className="hidden sm:inline text-zinc-650 font-bold">&#8226;</span>
        <span className="text-[10px] sm:text-xs text-zinc-400">All fuel logs registered securely in local hardware storage.</span>
      </div>
    </div>
  );
}
