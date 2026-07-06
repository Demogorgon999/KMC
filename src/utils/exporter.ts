/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { ConstructionSite, DieselLog, MonthlyDieselRate, DieselDelivery } from '../types';

/**
 * Generates and downloads a multi-sheet Microsoft Excel (.xlsx) workbook.
 * - Sheet 1: Site overview summary
 * - Sheet 2: Bulk Deliveries register (if any recorded)
 * - Sheet 3+: Specific logs for each construction site, classified per site
 */
export function exportToExcel(
  sites: ConstructionSite[],
  logs: DieselLog[],
  deliveries: DieselDelivery[] = [],
  dieselRates: MonthlyDieselRate[] = []
) {
  // Helpers to match logs to their specific rates at the time
  const getLogCost = (log: DieselLog) => {
    try {
      if (!log.dateTime || dieselRates.length === 0) return { cost: 0, rate: 0, hasRate: false };
      const logDateStr = log.dateTime.substring(0, 10);
      const validRates = dieselRates.filter(r => r.effectiveDate <= logDateStr);
      let matchedRate = null;
      if (validRates.length > 0) {
        validRates.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
        matchedRate = validRates[0];
      } else {
        const sortedAll = [...dieselRates].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
        matchedRate = sortedAll[0];
      }
      if (matchedRate) {
        return {
          cost: log.quantityLitres * matchedRate.rate,
          rate: matchedRate.rate,
          hasRate: true
        };
      }
      return { cost: 0, rate: 0, hasRate: false };
    } catch {
      return { cost: 0, rate: 0, hasRate: false };
    }
  };

  // Create workbook
  const wb = XLSX.utils.book_new();

  // 1. Create a general summary sheet
  const summaryData = sites.map((site) => {
    const siteLogs = logs.filter((l) => l.siteId === site.id);
    const totalLitres = siteLogs.reduce((acc, curr) => acc + curr.quantityLitres, 0);
    const estTotalSpend = siteLogs.reduce((sum, log) => {
      const info = getLogCost(log);
      return sum + (info.hasRate ? info.cost : 0);
    }, 0);

    return {
      'Site Code': site.code,
      'Site Name': site.name,
      'Location': site.location,
      'Status': site.status.toUpperCase(),
      'Total Transactions': siteLogs.length,
      'Total Consumption (Litres)': Number(totalLitres.toFixed(1)),
      'Est. Total Cost (ZAR)': Number(estTotalSpend.toFixed(2)),
      'Created Date': new Date(site.createdAt).toLocaleDateString(),
      'Status Date': site.closedAt ? new Date(site.closedAt).toLocaleDateString() : 'N/A',
    };
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Sites Summary');

  // 1.5. Bulk Deliveries sheet
  if (deliveries && deliveries.length > 0) {
    const deliveryRows = deliveries.map((d) => {
      const site = sites.find((s) => s.id === d.siteId);
      const measuredVolume = d.closingDip - d.openingDip;
      const variance = measuredVolume - d.quantityLitres;
      const pctVariance = d.quantityLitres > 0 ? (variance / d.quantityLitres) * 100 : 0;

      return {
        'Date': d.dateTime ? d.dateTime.substring(0, 10) : 'N/A',
        'Site Code': site ? site.code : 'N/A',
        'Site Name': site ? site.name : 'N/A',
        'Supplier/Transporter': d.deliveredBy,
        'Delivery Note Number': d.deliveryNote,
        'KMP Order Number': d.kmpOrder,
        'Liters per Note (L)': d.quantityLitres,
        'Opening Dip Reading (L)': d.openingDip,
        'Closing Dip Reading (L)': d.closingDip,
        'Dip-Measured Gain/Loss (L)': Number(measuredVolume.toFixed(1)),
        'Audit Variance (L)': Number(variance.toFixed(1)),
        'Variance %': `${pctVariance >= 0 ? '+' : ''}${pctVariance.toFixed(2)}%`,
        'Site Agent': d.agentName,
        'State/Verification': d.isOverridden 
          ? `OVERRIDDEN / APPROVED (${d.overrideReason || 'No reason'})` 
          : (Math.abs(pctVariance) > 2 ? 'VARIANCE EXCEEDS 2% (ALERT)' : 'NORMAL'),
        'Attachment/Slip': d.attachmentFilename || 'No upload',
        'Record Created': d.createdAt ? new Date(d.createdAt).toISOString().substring(0, 10) : 'N/A',
        'Delivery ID': d.id,
      };
    });

    const wsDeliveries = XLSX.utils.json_to_sheet(deliveryRows);
    XLSX.utils.book_append_sheet(wb, wsDeliveries, 'Bulk Deliveries');
  } else {
    const emptyDeliveries = [
      {
        'Alert': 'No bulk diesel deliveries recorded yet.',
      }
    ];
    const wsDeliveries = XLSX.utils.json_to_sheet(emptyDeliveries);
    XLSX.utils.book_append_sheet(wb, wsDeliveries, 'Bulk Deliveries');
  }

  // 2. Create classified sheets per site showing both consumptions and deliveries
  sites.forEach((site) => {
    const siteLogs = logs.filter((l) => l.siteId === site.id);
    const siteDeliveries = deliveries.filter((d) => d.siteId === site.id);

    if (siteLogs.length === 0 && siteDeliveries.length === 0) {
      // Create empty template table for this site anyway
      const emptyData = [
        {
          'Alert': `No diesel logs or deliveries recorded for this site yet.`,
        }
      ];
      const wsSite = XLSX.utils.json_to_sheet(emptyData);
      // Sheet names are limited to 31 chars in Excel and cannot contain special chars
      const safeName = (site.code || site.name).substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, wsSite, safeName || `Site-${site.id.slice(-4)}`);
      return;
    }

    const mergedTransactions: Array<{
      type: 'CONSUMPTION' | 'DELIVERY';
      dateTime: string;
      id: string;
      vehicleOrSupplier: string;
      refOrReading: string;
      deliveryNote: string;
      kmpOrder: string;
      meterReading: string;
      receivedLitres: number;
      issuedLitres: number;
      rate: number;
      cost: number;
      agent: string;
      attachment: string;
      notes: string;
    }> = [];

    // Map logs
    siteLogs.forEach((log) => {
      const costInfo = getLogCost(log);
      mergedTransactions.push({
        type: 'CONSUMPTION',
        dateTime: log.dateTime,
        id: log.id,
        vehicleOrSupplier: log.vehicleNumber,
        refOrReading: log.vehicleMeterReading ? `Meter: ${log.vehicleMeterReading}` : 'N/A',
        deliveryNote: '',
        kmpOrder: '',
        meterReading: log.vehicleMeterReading || '',
        receivedLitres: 0,
        issuedLitres: log.quantityLitres,
        rate: costInfo.hasRate ? costInfo.rate : 0,
        cost: costInfo.hasRate ? costInfo.cost : 0,
        agent: log.agentName,
        attachment: log.logSheetFilename || 'No upload',
        notes: log.notes || '',
      });
    });

    // Map deliveries
    siteDeliveries.forEach((d) => {
      const costInfo = getLogCost({
        dateTime: d.dateTime,
        quantityLitres: d.quantityLitres,
      } as any);

      const measuredVolume = d.closingDip - d.openingDip;
      const variance = measuredVolume - d.quantityLitres;
      const pctVariance = d.quantityLitres > 0 ? (variance / d.quantityLitres) * 100 : 0;
      const statusNote = `Dip Open: ${d.openingDip}L, Close: ${d.closingDip}L. Var: ${variance.toFixed(1)}L (${pctVariance >= 0 ? '+' : ''}${pctVariance.toFixed(2)}%)`;

      mergedTransactions.push({
        type: 'DELIVERY',
        dateTime: d.dateTime,
        id: d.id,
        vehicleOrSupplier: `Supplier: ${d.deliveredBy}`,
        refOrReading: d.deliveryNote ? `Note: ${d.deliveryNote} / Order: ${d.kmpOrder}` : 'N/A',
        deliveryNote: d.deliveryNote || '',
        kmpOrder: d.kmpOrder || '',
        meterReading: '',
        receivedLitres: d.quantityLitres,
        issuedLitres: 0,
        rate: costInfo.hasRate ? costInfo.rate : 0,
        cost: costInfo.hasRate ? costInfo.cost : 0,
        agent: d.agentName,
        attachment: d.attachmentFilename || 'No upload',
        notes: statusNote,
      });
    });

    // Sort chronologically descending (newest transactions first)
    mergedTransactions.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

    // Map to worksheet rows
    const compiledRows = mergedTransactions.map((tx) => ({
      'Date': tx.dateTime ? tx.dateTime.substring(0, 10) : 'N/A',
      'Transaction Type': tx.type,
      'Vehicle / Supplier': tx.vehicleOrSupplier,
      'Vehicle Meter Reading': tx.type === 'CONSUMPTION' ? (tx.meterReading || 'N/A') : '',
      'Delivery Note Number': tx.type === 'DELIVERY' ? (tx.deliveryNote || 'N/A') : '',
      'KMP Order Number': tx.type === 'DELIVERY' ? (tx.kmpOrder || 'N/A') : '',
      'Volume Received (L)': tx.receivedLitres > 0 ? tx.receivedLitres : '',
      'Volume Issued (L)': tx.issuedLitres > 0 ? tx.issuedLitres : '',
      'Applied Rate (ZAR/L)': tx.rate,
      'Est. Cost / Value (ZAR)': Number(tx.cost.toFixed(2)),
      'Site Agent': tx.agent,
      'Attachment Filename': tx.attachment,
      'Notes / Audits / Dip readings': tx.notes,
      'Transaction ID': tx.id,
    }));

    // Add totals row
    const totalReceived = siteDeliveries.reduce((sum, d) => sum + d.quantityLitres, 0);
    const totalIssued = siteLogs.reduce((sum, l) => sum + l.quantityLitres, 0);
    const totalIssuedCost = siteLogs.reduce((sum, log) => {
      const info = getLogCost(log);
      return sum + (info.hasRate ? info.cost : 0);
    }, 0);

    compiledRows.push({
      'Date': 'TOTALS',
      'Transaction Type': `${siteLogs.length} logs, ${siteDeliveries.length} deliveries`,
      'Vehicle / Supplier': '',
      'Vehicle Meter Reading': '',
      'Delivery Note Number': '',
      'KMP Order Number': '',
      'Volume Received (L)': Number(totalReceived.toFixed(1)),
      'Volume Issued (L)': Number(totalIssued.toFixed(1)),
      'Applied Rate (ZAR/L)': 0,
      'Est. Cost / Value (ZAR)': Number(totalIssuedCost.toFixed(2)),
      'Site Agent': '',
      'Attachment Filename': '',
      'Notes / Audits / Dip readings': `Summary of deliveries & fuel consumption logs for Site ${site.name}`,
      'Transaction ID': '',
    } as any);

    const wsSite = XLSX.utils.json_to_sheet(compiledRows);
    const safeName = (site.code || site.name).substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '');
    XLSX.utils.book_append_sheet(wb, wsSite, safeName || `Site-${site.id.slice(-4)}`);
  });

  // Write and download
  XLSX.writeFile(wb, `Diesel_Consumption_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Generates a standard comma-separated value (CSV) file of all logs, classified and ordered by site name.
 * Easily importable into Google Sheets, Microsoft Excel, or external analytics platforms.
 */
export function exportToCSV(sites: ConstructionSite[], logs: DieselLog[], dieselRates: MonthlyDieselRate[] = []): string {
  // We'll class/group logs by site, and build CSV rows
  const csvRows: string[] = [];
  
  // Headers
  csvRows.push([
    'Site Code',
    'Site Name',
    'Site Status',
    'Vehicle Number',
    'Vehicle Meter Reading',
    'Date',
    'Quantity (Litres)',
    'Diesel Rate (ZAR/L)',
    'Est. Cost (ZAR)',
    'Logged By (Site Agent)',
    'Log Sheet Path/File',
    'Notes'
  ].join(','));

  // Sort logs by site code, then by date
  const sortedLogs = [...logs].sort((a, b) => {
    const siteA = sites.find(s => s.id === a.siteId);
    const siteB = sites.find(s => s.id === b.siteId);
    if (!siteA || !siteB) return 0;
    const nameCompare = siteA.code.localeCompare(siteB.code);
    if (nameCompare !== 0) return nameCompare;
    return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime();
  });

  // Helper matching
  const getLogCost = (logItem: DieselLog) => {
    try {
      if (!logItem.dateTime || dieselRates.length === 0) return { cost: 0, rate: 0, hasRate: false };
      const logDateStr = logItem.dateTime.substring(0, 10);
      const validRates = dieselRates.filter(r => r.effectiveDate <= logDateStr);
      let matchedRate = null;
      if (validRates.length > 0) {
        validRates.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
        matchedRate = validRates[0];
      } else {
        const sortedAll = [...dieselRates].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
        matchedRate = sortedAll[0];
      }
      if (matchedRate) {
        return {
          cost: logItem.quantityLitres * matchedRate.rate,
          rate: matchedRate.rate,
          hasRate: true
        };
      }
      return { cost: 0, rate: 0, hasRate: false };
    } catch {
      return { cost: 0, rate: 0, hasRate: false };
    }
  };

  sortedLogs.forEach((log) => {
    const site = sites.find((s) => s.id === log.siteId);
    if (!site) return;

    const costInfo = getLogCost(log);

    const row = [
      escapeCSVValue(site.code),
      escapeCSVValue(site.name),
      escapeCSVValue(site.status),
      escapeCSVValue(log.vehicleNumber),
      escapeCSVValue(log.vehicleMeterReading || 'N/A'),
      escapeCSVValue(log.dateTime ? log.dateTime.substring(0, 10) : 'N/A'),
      log.quantityLitres,
      costInfo.hasRate ? costInfo.rate : 0,
      costInfo.hasRate ? Number(costInfo.cost.toFixed(2)) : 0,
      escapeCSVValue(log.agentName),
      escapeCSVValue(log.logSheetFilename || 'None'),
      escapeCSVValue(log.notes || '')
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Trigger download of the CSV file.
 */
export function downloadCSV(csvContent: string, fileName: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Helper to escape CSV cell inputs (handles commas, quotes, and newlines).
 */
function escapeCSVValue(value: string): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates and downloads a diesel rates ledger report in Microsoft Excel (.xlsx) format.
 * Includes precise tracking of starting dates, rates, volumes consumed, and estimated expenditures.
 */
export function exportDieselRatesToExcel(dieselRates: MonthlyDieselRate[], logs: DieselLog[]) {
  // Helpers to match logs to their specific rates at the time
  const getLogCost = (log: DieselLog) => {
    try {
      if (!log.dateTime || dieselRates.length === 0) return { cost: 0, rate: 0, hasRate: false, effectiveDate: '' };
      const logDateStr = log.dateTime.substring(0, 10);
      const validRates = dieselRates.filter(r => r.effectiveDate <= logDateStr);
      let matchedRate = null;
      if (validRates.length > 0) {
        validRates.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
        matchedRate = validRates[0];
      } else {
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

  const wb = XLSX.utils.book_new();

  // Sort rates from latest to oldest
  const sortedRates = [...dieselRates].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  // Compile rate-card rows
  const ledgerData = sortedRates.map((rate) => {
    const logsForThisRate = logs.filter(log => {
      const costInfo = getLogCost(log);
      return costInfo.hasRate && costInfo.effectiveDate === rate.effectiveDate;
    });

    const totalLitres = logsForThisRate.reduce((sum, l) => sum + l.quantityLitres, 0);
    const estSpend = totalLitres * rate.rate;

    return {
      'Effective Start Date': rate.effectiveDate,
      'Diesel Rate (ZAR/L)': rate.rate,
      'Total Volume Consumed (L)': Number(totalLitres.toFixed(1)),
      'Est. Expenditure (ZAR)': Number(estSpend.toFixed(2)),
      'Authorized By': rate.updatedBy,
      'Last Modified Date': rate.updatedAt ? new Date(rate.updatedAt).toISOString().substring(0, 10) : 'N/A',
    };
  });

  const wsRates = XLSX.utils.json_to_sheet(ledgerData);
  XLSX.utils.book_append_sheet(wb, wsRates, 'Rates Ledger');

  // Also include a secondary detailed tab matching every diesel log transaction mapping to its actual diesel rate
  const mappedLogsData = logs
    .filter(log => log.quantityLitres > 0)
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
    .map(log => {
      const costInfo = getLogCost(log);
      return {
        'Log ID': log.id,
        'Date': log.dateTime ? log.dateTime.substring(0, 10) : 'N/A',
        'Vehicle/Equipment #': log.vehicleNumber,
        'Volume (Litres)': log.quantityLitres,
        'Applied Rate Day': costInfo.effectiveDate || 'N/A',
        'Effective Diesel Rate (ZAR/L)': costInfo.hasRate ? costInfo.rate : 0,
        'Total Calc Cost (ZAR)': costInfo.hasRate ? Number(costInfo.cost.toFixed(2)) : 0,
        'Site Agent': log.agentName,
        'Notes': log.notes || ''
      };
    });

  const wsDetails = XLSX.utils.json_to_sheet(mappedLogsData);
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Transaction Rate Audit');

  XLSX.writeFile(wb, `Diesel_Rate_Pricing_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

