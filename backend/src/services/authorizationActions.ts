/**
 * TRUSTGOV - PHASE 8: CENTRALIZED ACTION CATALOG
 * Defines all standard actions officers might request, categorized and classified.
 */

import { ActionCode, ActionDefinition } from '../types/authorization';

export const ACTION_CATALOG: Record<ActionCode, ActionDefinition> = {
  VERIFY_IDENTITY: {
    actionCode: 'VERIFY_IDENTITY',
    displayName: 'Verify Officer Identity',
    description: 'Verify the identity, credentials, and digital standing of the officer.',
    category: 'IDENTITY',
    safetyClassification: 'STANDARD'
  },
  REQUEST_DOCUMENT: {
    actionCode: 'REQUEST_DOCUMENT',
    displayName: 'Request Official Documents',
    description: 'Request official identification or case-relevant documents via designated official channels.',
    category: 'DOCUMENTATION',
    safetyClassification: 'STANDARD'
  },
  REQUEST_PERSONAL_INFORMATION: {
    actionCode: 'REQUEST_PERSONAL_INFORMATION',
    displayName: 'Request Personal Information',
    description: 'Request basic personal information (name, address, contact) for official investigation.',
    category: 'INFORMATION',
    safetyClassification: 'CONTROLLED'
  },
  REQUEST_PAYMENT: {
    actionCode: 'REQUEST_PAYMENT',
    displayName: 'Request Payment / Fee',
    description: 'Demand payment of official statutory fees or penalties.',
    category: 'PAYMENT',
    safetyClassification: 'HIGH_RISK'
  },
  REQUEST_UPI_PAYMENT: {
    actionCode: 'REQUEST_UPI_PAYMENT',
    displayName: 'Request Personal UPI Payment',
    description: 'Request money transfer via personal UPI virtual payment address or QR code.',
    category: 'PAYMENT',
    safetyClassification: 'PROHIBITED'
  },
  REQUEST_BANK_TRANSFER: {
    actionCode: 'REQUEST_BANK_TRANSFER',
    displayName: 'Request Personal Bank Transfer',
    description: 'Request money transfer into an individual or personal bank account.',
    category: 'PAYMENT',
    safetyClassification: 'PROHIBITED'
  },
  REQUEST_OTP: {
    actionCode: 'REQUEST_OTP',
    displayName: 'Request One-Time Password (OTP)',
    description: 'Demand citizen share an SMS or email OTP.',
    category: 'CREDENTIAL_REQUEST',
    safetyClassification: 'PROHIBITED'
  },
  REQUEST_PIN: {
    actionCode: 'REQUEST_PIN',
    displayName: 'Request PIN (ATM / UPI / Security)',
    description: 'Demand citizen disclose security PIN or passcode.',
    category: 'CREDENTIAL_REQUEST',
    safetyClassification: 'PROHIBITED'
  },
  REQUEST_PASSWORD: {
    actionCode: 'REQUEST_PASSWORD',
    displayName: 'Request Password',
    description: 'Demand citizen disclose account passwords.',
    category: 'CREDENTIAL_REQUEST',
    safetyClassification: 'PROHIBITED'
  },
  REQUEST_REMOTE_ACCESS: {
    actionCode: 'REQUEST_REMOTE_ACCESS',
    displayName: 'Request Remote Screen Access',
    description: 'Demand citizen install or allow remote screen-sharing tools (AnyDesk, TeamViewer, RustDesk).',
    category: 'SYSTEM_ACCESS',
    safetyClassification: 'PROHIBITED'
  },
  REQUEST_SOFTWARE_INSTALLATION: {
    actionCode: 'REQUEST_SOFTWARE_INSTALLATION',
    displayName: 'Request Software Installation',
    description: 'Instruct citizen to download and install custom APK files or unverified software.',
    category: 'SYSTEM_ACCESS',
    safetyClassification: 'PROHIBITED'
  },
  REQUEST_PHYSICAL_APPEARANCE: {
    actionCode: 'REQUEST_PHYSICAL_APPEARANCE',
    displayName: 'Request Physical Appearance',
    description: 'Summon citizen to appear physically at an official government office or station.',
    category: 'PROCEDURAL',
    safetyClassification: 'CONTROLLED'
  },
  ISSUE_OFFICIAL_NOTICE: {
    actionCode: 'ISSUE_OFFICIAL_NOTICE',
    displayName: 'Issue Official Notice / Summons',
    description: 'Serve a formal written legal summons or statutory notice with verification reference.',
    category: 'PROCEDURAL',
    safetyClassification: 'STANDARD'
  },
  REQUEST_SIGNED_DOCUMENT: {
    actionCode: 'REQUEST_SIGNED_DOCUMENT',
    displayName: 'Request Signed Document',
    description: 'Request formal signed affidavits or declarations.',
    category: 'DOCUMENTATION',
    safetyClassification: 'STANDARD'
  },
  OTHER: {
    actionCode: 'OTHER',
    displayName: 'Other Custom Action',
    description: 'Any action not specifically defined in standard categories.',
    category: 'GENERAL',
    safetyClassification: 'REVIEW_REQUIRED'
  }
};

export function getAllActions(): ActionDefinition[] {
  return Object.values(ACTION_CATALOG);
}

export function getActionDefinition(code: string): ActionDefinition | null {
  return ACTION_CATALOG[code as ActionCode] || null;
}

export function isValidActionCode(code: string): code is ActionCode {
  return code in ACTION_CATALOG;
}
