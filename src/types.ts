/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'management' | 'agent';

export interface CompanyProfile {
  id: string;
  name: string;
  legalName: string;
  logoInitials: string;
  tagline: string;
  adminKey: string; // Passcode used by managers to register for this specific company
  primaryColor: string; // Hex color or Tailwind name
  secondaryColor: string; // Hex color or Tailwind name
  createdAt: string;
  logoUrl?: string; // Uploaded company logo graphic as base64 string
  registrationNumber?: string; // Official corporate registration code
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // Stored user password
  role: UserRole;
  createdAt: string;
  status?: 'approved' | 'pending'; // Access approval status for multilevel security
  companyId?: string; // Links employee profile to their respective corporate profile
}

export interface PasswordResetToken {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
}

export interface ConstructionSite {
  id: string;
  name: string;
  code: string;
  location: string;
  status: 'active' | 'closed';
  createdAt: string;
  closedAt: string | null;
}

export interface DieselLog {
  id: string;
  siteId: string;
  quantityLitres: number;
  vehicleNumber: string;
  vehicleMeterReading?: string; // e.g. odometer readings (km or hrs) on refueling
  dateTime: string;
  agentName: string;
  logSheetFilename: string | null;
  logSheetBase64: string | null; // Standard Base64 data URI for viewing the upload
  notes?: string;
  createdAt: string;
}

export interface SiteStatistics {
  siteId: string;
  totalLitres: number;
  logCount: number;
  averageTransaction: number;
}

export interface DieselDelivery {
  id: string;
  siteId: string;
  deliveredBy: string;
  deliveryNote: string;
  quantityLitres: number;
  kmpOrder: string;
  openingDip: number; // Fuel level before delivery (Litres)
  closingDip: number; // Fuel level after delivery (Litres)
  attachmentFilename: string | null; // Image upload is required
  attachmentBase64: string | null;
  dateTime: string;
  agentName: string;
  isOverridden: boolean; // reviewed/overridden by management to accept the margin
  overrideReason?: string;
  overriddenBy?: string;
  createdAt: string;
}

export interface MonthlyDieselRate {
  id: string; // companyId_YYYY-MM-DD
  companyId: string;
  effectiveDate: string; // YYYY-MM-DD (e.g., "2026-06-15")
  rate: number; // price per litre (e.g., 25.50 ZAR or USD)
  updatedAt: string;
  updatedBy: string;
}

