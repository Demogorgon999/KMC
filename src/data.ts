/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConstructionSite, DieselLog, User, DieselDelivery, CompanyProfile } from './types';

export const DEFAULT_COMPANIES: CompanyProfile[] = [
  {
    id: 'company-kmc',
    name: 'KMC Construction',
    legalName: 'KMC Construction (Pty) Ltd',
    logoInitials: 'KMC',
    tagline: 'Diesel Status Track & Fuel Ledger',
    adminKey: 'KMC-MGR-2026',
    primaryColor: '#E5B830', // Gold
    secondaryColor: '#138A8E', // Teal
    createdAt: new Date('2026-01-01').toISOString(),
    registrationNumber: '2016/549301/07'
  }
];

export const DEFAULT_USERS: User[] = [
  {
    id: 'user-default-mgmt',
    email: 'management@kmc.co.za',
    name: 'Dean van der Merwe',
    passwordHash: 'partner99', // Clean text comparison for direct local sandbox storage
    role: 'management',
    status: 'approved',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-default-yolandie',
    email: 'nyrvhanya@gmail.com',
    name: 'Yolandie Bezuidenhoudt',
    passwordHash: 'partner99',
    role: 'management',
    status: 'approved',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-default-yolandie-9',
    email: '9nyrvhanya@gmail.com',
    name: 'Yolandie Bezuidenhoudt',
    passwordHash: 'partner99',
    role: 'management',
    status: 'approved',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-default-agent',
    email: 'agent@kmc.co.za',
    name: 'Marcus Vance',
    passwordHash: 'field88',
    role: 'agent',
    status: 'approved',
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_SITES: ConstructionSite[] = [];

export const DEFAULT_LOGS: DieselLog[] = [];

export const DEFAULT_DELIVERIES: DieselDelivery[] = [];
