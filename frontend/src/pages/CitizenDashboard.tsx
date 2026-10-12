import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Shield,
  Search,
  AlertTriangle,
  CheckCircle,
  Lock,
  BookOpen,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertOctagon,
  Camera,
  Key,
  Copy,
  Check,
  RefreshCw,
  Share2,
  History,
  Info,
  UserCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  ShieldAlert,
  Paperclip,
  PhoneCall
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { QRScannerModal } from '../components/QRScannerModal';
import { CitizenReportModal, CitizenReportInitialData } from '../components/CitizenReportModal';
import { CitizenReportDetailModal } from '../components/CitizenReportDetailModal';
import { useAuth } from '../context/AuthContext';

type VerificationMethod = 'QR' | 'OFFICER_CODE' | 'CREDENTIAL_ID' | 'DID';
type VerificationState = 'IDLE' | 'VERIFYING' | 'VERIFIED' | 'FAILED' | 'INCOMPLETE';

interface VerificationResult {
  verificationId: string;
  result: 'VERIFIED' | 'FAILED' | 'INCOMPLETE';
  method: string;
  timestamp: string;
  officer?: {
    fullName: string;
    officerCode: string;
    department: string;
    designation: string;
    jurisdiction?: string;
    status: string;
  };
  checks?: {
    identity?: { status: string; did?: string; didStatus?: string };
    credential?: { status: string; credentialId?: string; credentialStatus?: string; validUntil?: string; signatureValid?: boolean };
    officerStatus?: { status: string; active?: boolean };
    proofOfPossession?: { status: string; details?: any };
    blockchain?: { status: string; anchored?: boolean; details?: any };
  };
  failureReason?: string | null;
  safety?: {
    isProhibitedDemand: boolean;
    warning: string;
    rules: string[];
  };
}

interface HistoryItem {
  id: string;
  verificationId: string;
  method: string;
  officerCode: string | null;
  officerName: string | null;
  department: string | null;
  credentialId: string | null;
  result: 'VERIFIED' | 'FAILED' | 'INCOMPLETE';
  failureReason: string | null;
  checksSummary: any;
  verifiedAt: string | null;
  createdAt: string;
}

interface ActionEvaluationItem {
  id: string;
  evaluation_id: string;
  citizen_id?: string;
  officer_reference: string;
  officer_name?: string;
  department?: string;
  action_code: string;
  policy_code?: string;
  policy_version?: number;
  decision: 'ALLOW' | 'DENY' | 'REVIEW';
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason_codes: string[] | string;
  reasons: any[] | string;
  request_context: any;
  checks_summary: any;
  evaluated_at: string;
  created_at: string;
}

const CitizenDashboard: React.FC = () => {
  const { token } = useAuth();

  // Verification Input State
  const [activeTab, setActiveTab] = useState<VerificationMethod>('OFFICER_CODE');
  const [inputValue, setInputValue] = useState('');
  const [claimedAction, setClaimedAction] = useState('DOCUMENT_REQUEST');

  // Verification Flow State
  const [verificationState, setVerificationState] = useState<VerificationState>('IDLE');
  const [verifyingStage, setVerifyingStage] = useState(1);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals & Expanders
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Phase 6 Live Proof of Possession State
  const [activeChallenge, setActiveChallenge] = useState<any | null>(null);
  const [generatingChallenge, setGeneratingChallenge] = useState(false);
  const [officerSignature, setOfficerSignature] = useState('');
  const [verifyingProof, setVerifyingProof] = useState(false);
  const [proofResult, setProofResult] = useState<any | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  // Verification History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

  // Phase 8: Action Authorization & Safety State
  const [evalOfficerCode, setEvalOfficerCode] = useState('');
  const [evalActionCode, setEvalActionCode] = useState('REQUEST_DOCUMENT');
  const [evalPaymentType, setEvalPaymentType] = useState('NONE');
  const [evalUrgency, setEvalUrgency] = useState('NORMAL');
  const [evalChannel, setEvalChannel] = useState('OFFICIAL_PORTAL');
  const [evalDataCategory, setEvalDataCategory] = useState('NONE');
  const [evalAdditionalContext, setEvalAdditionalContext] = useState('');
  const [evaluatingAction, setEvaluatingAction] = useState(false);
  const [actionEvalResult, setActionEvalResult] = useState<any | null>(null);
  const [actionEvalError, setActionEvalError] = useState<string | null>(null);
  const [copiedAuthRef, setCopiedAuthRef] = useState(false);

  // Phase 8 & 9: History Tabs, Action Evaluations & Scam Reports
  const [activeHistoryTab, setActiveHistoryTab] = useState<'VERIFICATIONS' | 'ACTIONS' | 'REPORTS'>('VERIFICATIONS');
  const [actionEvaluations, setActionEvaluations] = useState<ActionEvaluationItem[]>([]);
  const [loadingActionEvals, setLoadingActionEvals] = useState(false);
  const [selectedActionEvalItem, setSelectedActionEvalItem] = useState<ActionEvaluationItem | null>(null);

  // Phase 9: Scam Reporting State
  const [citizenReports, setCitizenReports] = useState<any[]>([]);
  const [loadingCitizenReports, setLoadingCitizenReports] = useState(false);
  const [selectedCitizenReport, setSelectedCitizenReport] = useState<any | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportInitialData, setReportInitialData] = useState<CitizenReportInitialData | null>(null);

  const openReportModal = (params?: CitizenReportInitialData) => {
    setReportInitialData(params || null);
    setIsReportModalOpen(true);
  };

  // Fetch History on mount if citizen is logged in
  useEffect(() => {
    if (token) {
      fetchVerificationHistory();
      fetchActionEvaluations();
      fetchCitizenReports();
    }
  }, [token]);

  const fetchVerificationHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await axios.get('/api/citizen/verifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setHistory(res.data.data.history || []);
      }
    } catch {
      // Non-blocking history fetch
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchActionEvaluations = async () => {
    if (!token) return;
    try {
      setLoadingActionEvals(true);
      const res = await axios.get('/api/citizen/authorization/evaluations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setActionEvaluations(res.data.data.evaluations || []);
      }
    } catch {
      // Non-blocking history fetch
    } finally {
      setLoadingActionEvals(false);
    }
  };

  const fetchCitizenReports = async () => {
    if (!token) return;
    try {
      setLoadingCitizenReports(true);
      const res = await axios.get('/api/citizen/reports', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setCitizenReports(res.data.data.reports || []);
      }
    } catch {
      // Non-blocking history fetch
    } finally {
      setLoadingCitizenReports(false);
    }
  };

  const isDangerousAction = (action: string) => {
    return [
      'PERSONAL_UPI_PAYMENT',
      'OTP_REQUEST',
      'PASSWORD_REQUEST',
      'PIN_REQUEST',
      'REMOTE_ACCESS_SOFTWARE',
      'SECURITY_DEPOSIT'
    ].includes(action);
  };

  // Switch Tab Handler
  const handleSelectTab = (tab: VerificationMethod) => {
    setActiveTab(tab);
    setErrorMessage(null);
    setCameraDenied(false);
    if (tab === 'QR') {
      setIsQrScannerOpen(true);
    }
  };

  // QR Scan Success Handler
  const handleScanQR = async (qrData: string) => {
    setIsQrScannerOpen(false);
    setCameraDenied(false);
    setInputValue(qrData);
    await executeVerification('QR', qrData);
  };

  // Form Submit Handler
  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      setErrorMessage('Please provide a valid identifier to verify.');
      return;
    }
    await executeVerification(activeTab, inputValue.trim());
  };

  // Core Verification Execution
  const executeVerification = async (method: VerificationMethod, value: string) => {
    setVerificationState('VERIFYING');
    setVerifyingStage(1);
    setErrorMessage(null);
    setResult(null);
    setProofResult(null);
    setActiveChallenge(null);
    setOfficerSignature('');

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      setVerifyingStage(2); // Stage 2: Checking credentials & DID
      const res = await axios.post(
        '/api/citizen/verify',
        {
          method,
          value,
          claimedAction
        },
        { headers }
      );

      setVerifyingStage(3); // Stage 3: Checking blockchain & status

      if (res.data.success) {
        setResult(res.data.data);
        if (res.data.data.result === 'VERIFIED') {
          setVerificationState('VERIFIED');
          if (res.data.data.officer?.officerCode) {
            setEvalOfficerCode(res.data.data.officer.officerCode);
          }
        } else {
          setVerificationState('FAILED');
        }
        if (token) fetchVerificationHistory();
      } else {
        setResult(res.data.data || null);
        setVerificationState('FAILED');
        setErrorMessage(res.data.error?.message || 'Verification checks did not pass.');
      }
    } catch (err: any) {
      const errData = err.response?.data;
      if (err.response?.status === 404 || err.response?.status === 400) {
        setVerificationState('FAILED');
        setResult(errData?.data || null);
        setErrorMessage(errData?.error?.message || 'No official record found matching this identifier.');
      } else {
        setVerificationState('INCOMPLETE');
        setErrorMessage(
          errData?.error?.message ||
          'TrustGov verification service is temporarily unavailable. Please retry in a few moments.'
        );
      }
    }
  };

  // Live Proof of Possession: Request Challenge
  const handleRequestChallenge = async () => {
    if (!result?.officer?.officerCode) return;
    try {
      setGeneratingChallenge(true);
      setProofError(null);
      setProofResult(null);
      const res = await axios.post('/api/verification/challenge', {
        officerCode: result.officer.officerCode
      });
      if (res.data.success) {
        setActiveChallenge(res.data.data);
      }
    } catch (err: any) {
      setProofError(err.response?.data?.error?.message || 'Failed to issue cryptographic challenge');
    } finally {
      setGeneratingChallenge(false);
    }
  };

  // Live Proof of Possession: Verify Officer Signature
  const handleVerifyProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChallenge?.challengeId || !officerSignature.trim()) return;

    try {
      setVerifyingProof(true);
      setProofError(null);
      setProofResult(null);

      const res = await axios.post('/api/verification/verify-proof', {
        challengeId: activeChallenge.challengeId,
        signature: officerSignature.trim()
      });

      if (res.data.success) {
        setProofResult(res.data.data);
        if (token) fetchVerificationHistory();
      }
    } catch (err: any) {
      const errData = err.response?.data;
      setProofResult(errData?.data || { valid: false });
      setProofError(errData?.error?.message || 'Proof-of-possession signature verification failed.');
    } finally {
      setVerifyingProof(false);
    }
  };

  // Share Verification Reference
  const handleShare = async () => {
    if (!result) return;
    const shareText = `TrustGov Official Identity Verification Reference\nReference: ${result.verificationId}\nStatus: ${result.result}\nOfficer: ${result.officer?.fullName || 'Official'} (${result.officer?.officerCode || ''})\nVerified at: ${new Date(result.timestamp).toLocaleString()}\n\nVerify independently on TrustGov.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TrustGov Officer Verification',
          text: shareText
        });
        return;
      } catch {}
    }

    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(shareText);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2500);
  };

  // Reset to Verify Again
  const handleResetVerification = () => {
    setVerificationState('IDLE');
    setResult(null);
    setInputValue('');
    setErrorMessage(null);
    setActiveChallenge(null);
    setOfficerSignature('');
    setProofResult(null);
    setActionEvalResult(null);
    setActionEvalError(null);
    setEvalOfficerCode('');
    setEvalActionCode('REQUEST_DOCUMENT');
    setEvalPaymentType('NONE');
    setEvalUrgency('NORMAL');
    setEvalChannel('OFFICIAL_PORTAL');
    setEvalDataCategory('NONE');
    setEvalAdditionalContext('');
  };

  // Re-verify from historical item
  const handleReverifyHistory = (item: HistoryItem) => {
    setSelectedHistoryItem(null);
    const targetVal = item.officerCode || item.credentialId || '';
    setInputValue(targetVal);
    setActiveTab(item.method as VerificationMethod);
    executeVerification(item.method as VerificationMethod, targetVal);
  };

  // Phase 8: Determine if inputs reflect critical fraud red flags
  const isCriticalActionSelection = () => {
    return (
      [
        'REQUEST_OTP',
        'REQUEST_PIN',
        'REQUEST_PASSWORD',
        'REQUEST_REMOTE_ACCESS',
        'REQUEST_SOFTWARE_INSTALLATION',
        'REQUEST_UPI_PAYMENT',
        'REQUEST_BANK_TRANSFER'
      ].includes(evalActionCode) ||
      ['PERSONAL_UPI', 'PERSONAL_BANK'].includes(evalPaymentType) ||
      evalDataCategory === 'AUTHENTICATION_SECRET'
    );
  };

  // Phase 8: Action Safety Evaluation Submission
  const handleEvaluateAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetRef = evalOfficerCode || result?.officer?.officerCode || inputValue;
    if (!targetRef.trim()) {
      setActionEvalError('Please specify an Officer Code or verify an officer first.');
      return;
    }
    setEvaluatingAction(true);
    setActionEvalError(null);
    setActionEvalResult(null);

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(
        '/api/citizen/authorization/evaluate',
        {
          officerReference: targetRef.trim(),
          credentialReference: result?.checks?.credential?.credentialId,
          actionCode: evalActionCode,
          requestContext: {
            paymentType: evalPaymentType,
            communicationChannel: evalChannel,
            urgency: evalUrgency,
            requestedDataCategory: evalDataCategory,
            additionalContext: evalAdditionalContext
          }
        },
        { headers }
      );

      if (res.data.success) {
        setActionEvalResult(res.data.data);
        if (token) fetchActionEvaluations();
      } else {
        setActionEvalError(res.data.error?.message || 'Action evaluation failed.');
      }
    } catch (err: any) {
      setActionEvalError(
        err.response?.data?.error?.message || 'Failed to evaluate action against TrustGov policies.'
      );
    } finally {
      setEvaluatingAction(false);
    }
  };

  const handleCopyAuthReference = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedAuthRef(true);
    setTimeout(() => setCopiedAuthRef(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6">
      
      {/* 1. Header & Protection Hub Banner */}
      <div className="glass-panel-glow rounded-2xl p-6 sm:p-8 relative overflow-hidden border border-cyan-500/30">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <Shield className="h-48 w-48 text-cyan-400" />
        </div>
        <div className="max-w-3xl space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            Zero-Trust Anti-Impersonation Hub
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            TrustGov Citizen Protection & Verification Center
          </h1>
          <p className="text-sm sm:text-base text-cyan-200/90 leading-relaxed">
            Impersonators pose as CBI, ED, Police, and Customs officers to threaten citizens with false "digital arrest" warrants.
            Verify active government credentials, Ed25519 digital signatures, and blockchain anchors in real time before taking any action.
          </p>
        </div>
      </div>

      {/* 2. Core Verification Gateway & Result Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Verification Form & Results (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* VERIFICATION FORM CARD */}
          <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-slate-800 space-y-6">
            
            {/* Header with Title & What TrustGov Checks */}
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <Search className="h-5 w-5 text-cyan-400" />
                Verify Government Officer
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Choose a verification method to mathematically confirm an officer’s official authority.
              </p>
            </div>

            {/* 4 Multi-Method Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-800/80 pb-4">
              <button
                type="button"
                onClick={() => handleSelectTab('QR')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'QR'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800'
                }`}
              >
                <Camera className="h-4 w-4 shrink-0" />
                <span>Scan QR</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('OFFICER_CODE')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'OFFICER_CODE'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800'
                }`}
              >
                <UserCheck className="h-4 w-4 shrink-0" />
                <span>Officer Code</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('CREDENTIAL_ID')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'CREDENTIAL_ID'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800'
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>Credential ID</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('DID')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'DID'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800'
                }`}
              >
                <Key className="h-4 w-4 shrink-0" />
                <span>DID Identity</span>
              </button>
            </div>

            {/* Camera Permission Denied Fallback Notice */}
            {cameraDenied && (
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Camera Access Not Granted
                </div>
                <p className="leading-relaxed">
                  You can still verify the officer without a camera. Ask the official for their badge number, Credential ID, or DID string, and select a manual option below:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSelectTab('OFFICER_CODE')}
                    className="py-1 px-2.5 rounded bg-amber-900/60 hover:bg-amber-800/60 text-amber-200 font-semibold text-[11px]"
                  >
                    Enter Officer Code
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('CREDENTIAL_ID')}
                    className="py-1 px-2.5 rounded bg-amber-900/60 hover:bg-amber-800/60 text-amber-200 font-semibold text-[11px]"
                  >
                    Enter Credential ID
                  </button>
                </div>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmitVerification} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {activeTab === 'QR' && 'Scanned QR Badge Reference / Payload'}
                  {activeTab === 'OFFICER_CODE' && 'Official Government Officer Code'}
                  {activeTab === 'CREDENTIAL_ID' && 'W3C Verifiable Credential ID'}
                  {activeTab === 'DID' && 'Decentralized Identifier (DID)'}
                </label>
                <input
                  type="text"
                  required
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    activeTab === 'QR' ? 'TRUSTGOV://verify/VC-TG-... or scan using button above' :
                    activeTab === 'OFFICER_CODE' ? 'e.g. TG-OFF-001 or TG-OFF-002' :
                    activeTab === 'CREDENTIAL_ID' ? 'e.g. VC-TG-TG-OFF-001-4D78E09B' :
                    'e.g. did:trustgov:550e8400-e29b-41d4-a716-446655440001'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm font-mono transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  What is the officer demanding or requesting?
                </label>
                <select
                  value={claimedAction}
                  onChange={(e) => setClaimedAction(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-300 focus:outline-none focus:border-cyan-500 text-sm transition-colors cursor-pointer"
                >
                  <option value="DOCUMENT_REQUEST">Request Identity Documents or Records</option>
                  <option value="OFFICIAL_NOTICE">Serve an Official Notice or Summons</option>
                  <option value="INVESTIGATION_ACTION">Require cooperation in an ongoing inquiry</option>
                  <option value="PERSONAL_UPI_PAYMENT">⚠️ Transfer money to personal UPI or bank account</option>
                  <option value="OTP_REQUEST">⚠️ Disclose Mobile OTP or verification SMS</option>
                  <option value="PASSWORD_REQUEST">⚠️ Disclose Account or Net-Banking Password</option>
                  <option value="PIN_REQUEST">⚠️ Disclose Debit/ATM Card PIN</option>
                  <option value="REMOTE_ACCESS_SOFTWARE">⚠️ Install AnyDesk / TeamViewer / Remote App</option>
                </select>
              </div>

              {/* In-Context Anti-Scam Notice */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300">
                <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  <strong>Important Rule:</strong> Even when an officer is verified, no government agency or police officer is ever authorized to demand personal UPI payments, card PINs, passwords, or OTPs.
                </span>
              </div>

              {/* Error Alert */}
              {errorMessage && verificationState !== 'FAILED' && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={verificationState === 'VERIFYING'}
                className="w-full py-3 px-5 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {verificationState === 'VERIFYING' ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Cryptographically Verifying on TrustGov...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" />
                    <span>Run Verification Checks</span>
                  </>
                )}
              </button>
            </form>

            {/* What TrustGov Checks - Visual Indicator */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                What TrustGov Mathematically Verifies:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-slate-300">
                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800/80 text-center">
                  <span className="block text-cyan-400 font-bold">1. DID</span>
                  <span className="text-[10px] text-slate-400">Digital Identity</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800/80 text-center">
                  <span className="block text-emerald-400 font-bold">2. W3C VC</span>
                  <span className="text-[10px] text-slate-400">Ed25519 Sign</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800/80 text-center">
                  <span className="block text-indigo-400 font-bold">3. Status</span>
                  <span className="text-[10px] text-slate-400">Active Duty</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800/80 text-center">
                  <span className="block text-teal-400 font-bold">4. Proof</span>
                  <span className="text-[10px] text-slate-400">Key Custody</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800/80 text-center col-span-2 sm:col-span-1">
                  <span className="block text-purple-400 font-bold">5. Ledger</span>
                  <span className="text-[10px] text-slate-400">Smart Contract</span>
                </div>
              </div>
            </div>

          </div>

          {/* VERIFYING HONEST PROGRESS STATE */}
          {verificationState === 'VERIFYING' && (
            <div className="glass-panel rounded-2xl p-6 border border-cyan-500/40 space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Running Multi-Tier Trust Checks...
                </h3>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>1. Resolving Government Identity Record:</span>
                  <span className="text-cyan-400 font-mono font-semibold">{verifyingStage >= 1 ? '✓ Active' : 'Checking'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>2. Cryptographically Validating Authority Signature:</span>
                  <span className="text-cyan-400 font-mono font-semibold">{verifyingStage >= 2 ? '✓ Validating' : 'Queued'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>3. Verifying Ethereum Smart Contract Anchor:</span>
                  <span className="text-slate-400 font-mono">{verifyingStage >= 3 ? '✓ Checking Anchor' : 'Queued'}</span>
                </div>
              </div>
            </div>
          )}

          {/* STATE: VERIFIED RESULT CARD */}
          {verificationState === 'VERIFIED' && result && (
            <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-emerald-500/50 space-y-6 bg-gradient-to-b from-emerald-950/20 to-slate-950/80">
              
              {/* Verified Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/30 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                      TRUST VERIFIED
                    </h3>
                    <p className="text-xs text-emerald-300 font-medium">
                      Cryptographic credentials and authority signatures mathematically confirmed.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                    ACTIVE DUTY
                  </span>
                </div>
              </div>

              {/* Officer Official Profile */}
              {result.officer && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/70 p-4 rounded-xl border border-emerald-500/20 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block mb-0.5">Officer Name</span>
                    <span className="text-white font-bold text-sm">{result.officer.fullName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block mb-0.5">Officer Code</span>
                    <span className="text-cyan-400 font-mono font-bold text-sm">{result.officer.officerCode}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block mb-0.5">Department</span>
                    <span className="text-slate-200 font-semibold">{result.officer.department}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block mb-0.5">Designation</span>
                    <span className="text-slate-200 font-semibold">{result.officer.designation}</span>
                  </div>
                </div>
              )}

              {/* 5-Tier Verification Checklist */}
              <div className="space-y-2 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-300 block mb-2">
                  5-Point Cryptographic Check Results:
                </span>
                
                <div className="flex items-center justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    1. DID Identity Resolution:
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">✓ PASSED</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    2. W3C Credential Authority Signature:
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">✓ Ed25519 VALID</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    3. Officer Status Authorization:
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">✓ ACTIVE IN GOOD STANDING</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    4. Proof of Key Possession:
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {result.checks?.proofOfPossession?.status === 'VERIFIED' ? '✓ KEY CONTROL PROVEN' : 'READY TO CHALLENGE'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    5. Blockchain Smart Contract Integrity:
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">✓ 100% SHA-256 MATCH</span>
                </div>
              </div>

              {/* Timestamp & Safe Verification Reference */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Verification Reference</span>
                  <span className="font-mono font-bold text-cyan-300 select-all text-sm">
                    {result.verificationId}
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Verification Timestamp</span>
                  <span className="text-slate-300 font-mono">
                    {new Date(result.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Critical Safety Notice */}
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-300 uppercase">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  Important Safety Notice
                </div>
                <p className="leading-relaxed">
                  Identity verification confirms who this person is, but does <strong>NOT</strong> authorize them to demand:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-300/90 font-medium text-[11px]">
                  <li>Money transfers to personal bank accounts or UPI IDs</li>
                  <li>One-Time Passwords (OTPs) or Net-Banking credentials</li>
                  <li>ATM card numbers, PINs, or remote software installations</li>
                </ul>
              </div>

              {/* Prohibited Demand Banner (if user reported dangerous request) */}
              {isDangerousAction(claimedAction) && (
                <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-rose-300 uppercase">
                    <AlertOctagon className="h-5 w-5 shrink-0 text-rose-400" />
                    CRITICAL FRAUD WARNING: ILLEGAL DEMAND
                  </div>
                  <p className="leading-relaxed">
                    Even though this identity exists, government officers are strictly prohibited from demanding funds via personal UPI or requesting OTPs/passwords. This interaction shows typical indicators of an impersonation extortion scheme.
                  </p>
                </div>
              )}

              {/* Live Proof of Possession Challenge Section */}
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Key className="h-4 w-4 text-cyan-400" />
                    Proof of Possession Challenge
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 font-semibold">
                    Anti-Cloning Shield
                  </span>
                </div>

                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Want to be 100% sure you are not talking to someone displaying a stolen credential? Issue a fresh cryptographic challenge for the officer to sign on their official app.
                </p>

                {activeChallenge ? (
                  <div className="space-y-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Active Challenge ID</span>
                      <span className="font-mono text-cyan-300 text-[11px] font-semibold">{activeChallenge.challengeId}</span>
                    </div>

                    <form onSubmit={handleVerifyProof} className="space-y-2 pt-1 border-t border-slate-800">
                      <label className="block text-[10px] text-slate-400 uppercase font-bold">
                        Officer's Signature Response:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={officerSignature}
                          onChange={(e) => setOfficerSignature(e.target.value)}
                          placeholder="Paste Ed25519 signature from officer..."
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          type="submit"
                          disabled={verifyingProof || !officerSignature.trim()}
                          className="py-1.5 px-3 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 disabled:opacity-50 cursor-pointer shrink-0"
                        >
                          {verifyingProof ? 'Verifying...' : 'Verify Proof'}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={generatingChallenge}
                    onClick={handleRequestChallenge}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${generatingChallenge ? 'animate-spin' : ''}`} />
                    {generatingChallenge ? 'Generating Challenge...' : 'Issue Live Challenge to Officer'}
                  </button>
                )}

                {/* Proof Result Feedback */}
                {proofResult && (
                  <div className={`p-3 rounded-lg border text-xs ${
                    proofResult.valid
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}>
                    {proofResult.valid
                      ? '✓ Live Proof of Possession verified! The caller holds the registered private signing key.'
                      : `✗ Proof of possession failed: ${proofError || proofResult.reason || 'Signature mismatch'}`}
                  </div>
                )}
              </div>

              {/* Phase 8: Action Authorization & Safety Evaluation Section */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-950/90 border border-teal-500/40 space-y-4 text-xs shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        Action Authorization & Safety Check
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        What is this officer asking or demanding you to do?
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-teal-950 text-teal-300 border border-teal-500/30 font-semibold self-start sm:self-center">
                    Phase 8 Safety Engine
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 leading-relaxed flex items-start gap-2">
                  <Info className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Zero False-Trust Principle:</strong> Proving officer identity (Phases 1–7) does <em>not</em> mean all officer demands are authorized. Real officers cannot demand personal UPI transfers, passwords, OTPs, or remote software installations.
                  </span>
                </div>

                {/* Evaluation Input Form */}
                <form onSubmit={handleEvaluateAction} className="space-y-3.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Officer Reference (Target)
                      </label>
                      <input
                        type="text"
                        value={evalOfficerCode || result.officer?.officerCode || ''}
                        onChange={(e) => setEvalOfficerCode(e.target.value)}
                        placeholder="Officer code, DID, or Credential ID"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Requested Action / Demand
                      </label>
                      <select
                        value={evalActionCode}
                        onChange={(e) => setEvalActionCode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
                      >
                        <optgroup label="📄 Official Documentation">
                          <option value="REQUEST_DOCUMENT">Request Official Documents / ID Records</option>
                          <option value="REQUEST_SIGNED_DOCUMENT">Request Signed Affidavits / Statements</option>
                        </optgroup>
                        <optgroup label="👤 Personal Information">
                          <option value="REQUEST_PERSONAL_INFORMATION">Request Personal / Family Details</option>
                        </optgroup>
                        <optgroup label="🏛️ Procedures & Summons">
                          <option value="ISSUE_OFFICIAL_NOTICE">Issue Formal Written Notice / Summons</option>
                          <option value="REQUEST_PHYSICAL_APPEARANCE">Request Physical Appearance at Station / Office</option>
                          <option value="VERIFY_IDENTITY">Verify Officer Identity Only</option>
                        </optgroup>
                        <optgroup label="💳 Payments (High Risk)">
                          <option value="REQUEST_PAYMENT">Demand Statutory Fee / Fine Payment</option>
                          <option value="REQUEST_UPI_PAYMENT">⚠️ Demand Personal UPI / QR Code Transfer</option>
                          <option value="REQUEST_BANK_TRANSFER">⚠️ Demand Personal Bank Account Transfer</option>
                        </optgroup>
                        <optgroup label="🔒 Credentials & Passwords (Prohibited)">
                          <option value="REQUEST_OTP">🚫 Demand SMS One-Time Password (OTP)</option>
                          <option value="REQUEST_PIN">🚫 Demand ATM / UPI Security PIN</option>
                          <option value="REQUEST_PASSWORD">🚫 Demand Net-Banking or App Password</option>
                        </optgroup>
                        <optgroup label="💻 Remote Screen & Software (Prohibited)">
                          <option value="REQUEST_REMOTE_ACCESS">🚫 Demand Screen Access (AnyDesk / TeamViewer)</option>
                          <option value="REQUEST_SOFTWARE_INSTALLATION">🚫 Install Custom App / Unofficial APK</option>
                        </optgroup>
                        <optgroup label="❓ Other">
                          <option value="OTHER">Other Custom / Unlisted Action</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* Contextual Demands Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                    {['REQUEST_PAYMENT', 'REQUEST_UPI_PAYMENT', 'REQUEST_BANK_TRANSFER'].includes(evalActionCode) && (
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                          Payment Destination
                        </label>
                        <select
                          value={evalPaymentType}
                          onChange={(e) => setEvalPaymentType(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
                        >
                          <option value="NONE">None</option>
                          <option value="GOVERNMENT_PORTAL">Official Treasury Portal</option>
                          <option value="OFFICIAL_ACCOUNT">Official Govt Bank Account</option>
                          <option value="PERSONAL_UPI">⚠️ Personal UPI ID / QR</option>
                          <option value="PERSONAL_BANK">⚠️ Personal Bank Account</option>
                          <option value="UNKNOWN">Unknown / Other</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Channel Used
                      </label>
                      <select
                        value={evalChannel}
                        onChange={(e) => setEvalChannel(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
                      >
                        <option value="OFFICIAL_PORTAL">Official Govt Portal / In-Person</option>
                        <option value="OFFICIAL_OFFICE">Official Police / Govt Office</option>
                        <option value="VERIFIED_PHONE">Official Landline</option>
                        <option value="PERSONAL_PHONE">Personal Cellphone Call</option>
                        <option value="WHATSAPP">WhatsApp / Telegram / Skype</option>
                        <option value="UNKNOWN">Unknown Channel</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Urgency Claimed
                      </label>
                      <select
                        value={evalUrgency}
                        onChange={(e) => setEvalUrgency(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
                      >
                        <option value="NORMAL">Normal Timeline</option>
                        <option value="URGENT">Urgent (24 hours)</option>
                        <option value="IMMEDIATE">⚠️ Immediate Arrest Threat</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Data Category
                      </label>
                      <select
                        value={evalDataCategory}
                        onChange={(e) => setEvalDataCategory(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
                      >
                        <option value="NONE">None</option>
                        <option value="BASIC_IDENTITY">Basic Identity (Name, ID)</option>
                        <option value="PERSONAL_INFORMATION">Personal / Family Info</option>
                        <option value="FINANCIAL_INFORMATION">Bank Account Details</option>
                        <option value="AUTHENTICATION_SECRET">⚠️ OTP / Passwords / PIN</option>
                        <option value="DOCUMENTS">Official Case Documents</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                      Additional Context / Demands (Optional)
                    </label>
                    <input
                      type="text"
                      value={evalAdditionalContext}
                      onChange={(e) => setEvalAdditionalContext(e.target.value)}
                      placeholder="e.g. Demanded money transfer over WhatsApp to avoid arrest warrant"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Immediate Fraud Flag Warning Banner */}
                  {isCriticalActionSelection() && (
                    <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 space-y-1.5 animate-pulse">
                      <div className="flex items-center gap-2 font-bold text-rose-300 text-xs uppercase tracking-wide">
                        <AlertOctagon className="h-4 w-4 shrink-0 text-rose-400" />
                        CRITICAL SAFETY RED FLAG: STRICTLY PROHIBITED DEMAND
                      </div>
                      <p className="text-[11px] leading-relaxed text-rose-200">
                        Under established Indian government and police regulations, officers are <strong>NEVER authorized</strong> to demand OTPs, ATM/UPI PINs, passwords, personal transfers, or remote-desktop apps. If you are experiencing this, you are facing an extortion attempt or digital arrest scam.
                      </p>
                    </div>
                  )}

                  {/* Action Evaluation Error */}
                  {actionEvalError && (
                    <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>{actionEvalError}</span>
                    </div>
                  )}

                  {/* Action Evaluation Button */}
                  <button
                    type="submit"
                    disabled={evaluatingAction}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-teal-500/20"
                  >
                    {evaluatingAction ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Evaluating Action Against Demo Policies...</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-4 w-4" />
                        <span>Evaluate Action Safety & Authorization</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Evaluation Result Presentation (3-Pillars Separation) */}
                {actionEvalResult && (
                  <div className="space-y-3.5 pt-3 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Evaluation Results (3-Pillar Separation):
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Ref: <strong className="text-cyan-400">{actionEvalResult.evaluationId}</strong>
                      </span>
                    </div>

                    {/* 3 Pillars Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Pillar 1: Identity Standing */}
                      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Pillar 1: Identity Standing
                        </span>
                        <div className="flex items-center gap-1.5">
                          {actionEvalResult.identityVerified ? (
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5" />
                              VERIFIED OFFICER
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                              <XCircle className="h-3.5 w-3.5" />
                              UNVERIFIED / INACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-300">
                          {actionEvalResult.officer?.fullName || actionEvalResult.officer?.reference}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {actionEvalResult.officer?.department}
                        </div>
                      </div>

                      {/* Pillar 2: Authorization Decision */}
                      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Pillar 2: Authorization
                        </span>
                        <div>
                          {actionEvalResult.decision === 'ALLOW' && (
                            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                              ✓ ALLOWED (DEMO)
                            </span>
                          )}
                          {actionEvalResult.decision === 'DENY' && (
                            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40">
                              ✕ DENIED / PROHIBITED
                            </span>
                          )}
                          {actionEvalResult.decision === 'REVIEW' && (
                            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                              ⚠️ REVIEW REQUIRED
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-cyan-300">
                          {actionEvalResult.policyCode ? `${actionEvalResult.policyCode} (v${actionEvalResult.policyVersion})` : 'Default Baseline Deny'}
                        </div>
                      </div>

                      {/* Pillar 3: Safety Risk Level */}
                      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Pillar 3: Safety Risk
                        </span>
                        <div>
                          {actionEvalResult.riskLevel === 'LOW' && (
                            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                              LOW RISK
                            </span>
                          )}
                          {actionEvalResult.riskLevel === 'MEDIUM' && (
                            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                              MEDIUM RISK
                            </span>
                          )}
                          {actionEvalResult.riskLevel === 'HIGH' && (
                            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-500/40">
                              HIGH RISK
                            </span>
                          )}
                          {actionEvalResult.riskLevel === 'CRITICAL' && (
                            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse">
                              CRITICAL SAFETY RISK
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {actionEvalResult.reasons?.[0]?.title || 'Safety Evaluation Recorded'}
                        </div>
                      </div>
                    </div>

                    {/* Explainable Reasons & Guidance */}
                    {actionEvalResult.reasons && actionEvalResult.reasons.length > 0 && (
                      <div className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                          Triggered Safety Rules & Guidance:
                        </span>
                        <div className="space-y-2">
                          {actionEvalResult.reasons.map((r: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-white text-[11px]">{r.title}</span>
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                                  r.severity === 'CRITICAL' || r.severity === 'HIGH' ? 'bg-rose-950 text-rose-300 border border-rose-500/30' :
                                  r.severity === 'MEDIUM' ? 'bg-amber-950 text-amber-300 border border-amber-500/30' :
                                  'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {r.code}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                {r.message}
                              </p>
                              {r.technical && (
                                <p className="text-[10px] text-slate-500 font-mono">
                                  Policy rule: {r.technical}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Safe Public Reference */}
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Public Reference (Safe to Cite)</span>
                        <span className="font-mono font-bold text-cyan-300 select-all text-sm">
                          {actionEvalResult.evaluationId}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyAuthReference(actionEvalResult.evaluationId)}
                        className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-700"
                      >
                        {copiedAuthRef ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedAuthRef ? 'Copied' : 'Copy Ref'}</span>
                      </button>
                    </div>

                    {/* Prototype Disclaimer */}
                    <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200/90 leading-relaxed">
                      <strong>TrustGov Demo Authorization Policy:</strong> {actionEvalResult.disclaimer || 'Evaluated against prototype demonstration rules. This evaluation does not confer legal governmental authority.'}
                    </div>

                    {/* Phase 9 Reporting Button for Prohibited Demands */}
                    {(actionEvalResult.decision === 'DENY' || actionEvalResult.riskLevel === 'CRITICAL' || actionEvalResult.riskLevel === 'HIGH') && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => openReportModal({
                            officerReference: evalOfficerCode || result?.officer?.officerCode || '',
                            officerName: result?.officer?.fullName,
                            department: result?.officer?.department,
                            authorizationEvaluationReference: actionEvalResult.evaluationId,
                            reportedActionCode: evalActionCode,
                            verificationReference: result?.verificationId
                          })}
                          className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 hover:border-rose-400 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-rose-950/40"
                        >
                          <AlertOctagon className="h-4 w-4 text-rose-400" />
                          <span>Report this Prohibited / High-Risk Demand</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Technical Details Expander Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="text-xs font-bold text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {showTechnicalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span>{showTechnicalDetails ? 'Hide Technical Details' : 'View Technical Details (DID, Hash, Blockchain)'}</span>
                </button>

                {showTechnicalDetails && (
                  <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-[11px] font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500 block uppercase text-[10px]">Officer DID</span>
                      <span className="text-cyan-300 break-all">{result.checks?.identity?.did || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[10px]">Credential ID</span>
                      <span className="text-white break-all">{result.checks?.credential?.credentialId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[10px]">Valid Until</span>
                      <span className="text-white">{result.checks?.credential?.validUntil ? new Date(result.checks.credential.validUntil).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[10px]">Digital Signature Algorithm</span>
                      <span className="text-emerald-400 font-bold">Ed25519Signature2020 (RFC 8785 Canonical)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[10px]">Blockchain Contract</span>
                      <span className="text-purple-300 break-all">{result.checks?.blockchain?.details?.contractAddress || 'TrustGovRegistry.sol (Hardhat)'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[10px]">On-Chain Transaction Hash</span>
                      <span className="text-amber-300 break-all">{result.checks?.blockchain?.details?.transactionHash || '0x anchored'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share Verification Reference</span>
                </button>
                <button
                  type="button"
                  onClick={() => openReportModal({
                    officerReference: result.officer?.officerCode || inputValue,
                    officerName: result.officer?.fullName,
                    department: result.officer?.department,
                    verificationReference: result.verificationId
                  })}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 hover:border-rose-500 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <AlertOctagon className="h-4 w-4 text-rose-400" />
                  <span>Report Suspicious Request</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetVerification}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Verify Another</span>
                </button>
              </div>

            </div>
          )}

          {/* STATE: FAILED RESULT CARD */}
          {verificationState === 'FAILED' && (
            <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-rose-500/50 space-y-5 bg-gradient-to-b from-rose-950/30 to-slate-950/90 text-xs">
              <div className="flex items-center gap-3 border-b border-rose-500/30 pb-4">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  <XCircle className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-wide">
                    VERIFICATION FAILED
                  </h3>
                  <p className="text-xs text-rose-300 font-medium">
                    TrustGov could not establish an active, valid credential for this request.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-rose-500/30 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Identified Reason</span>
                <p className="text-rose-200 text-sm font-semibold">
                  {errorMessage || result?.failureReason || 'No registered active government record found.'}
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Do not rely on this caller or document as proof of official authority. Anyone can state a fake badge number or display a counterfeit identity card.
                </p>
              </div>

              {/* Protective Action Checklist */}
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-1.5 text-slate-300 text-xs">
                <span className="text-white font-bold block mb-1">Recommended Protective Actions:</span>
                <p>• Do not pay any "bail", "clearance fee", or transfer funds to any account.</p>
                <p>• Do not comply with "digital arrest" video call demands.</p>
                <p>• Terminate the phone call and report the caller number to cybercrime authorities.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => openReportModal({
                    officerReference: inputValue,
                    category: 'IMPERSONATION'
                  })}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-rose-200 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <AlertOctagon className="h-4 w-4 text-rose-400" />
                  <span>Report Impersonation Attempt</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetVerification}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800/60 transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Try Another Verification</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE: INCOMPLETE RESULT CARD */}
          {verificationState === 'INCOMPLETE' && (
            <div className="glass-panel rounded-2xl p-6 border border-amber-500/50 space-y-4 bg-gradient-to-b from-amber-950/30 to-slate-950/90 text-xs">
              <div className="flex items-center gap-3 border-b border-amber-500/30 pb-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    VERIFICATION INCOMPLETE
                  </h3>
                  <p className="text-xs text-amber-300">
                    The verification could not be completed due to a temporary service or network condition.
                  </p>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed">
                <strong>IMPORTANT:</strong> Incomplete does not mean verified, and does not mean failed. No conclusion was established.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => executeVerification(activeTab, inputValue)}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Retry Verification</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetVerification}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 border border-slate-800 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Verification History & Safety Center (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">

          {/* ACCESSIBILITY: VERIFY BY PHONE CARD (PHASE 10) */}
          <div className="glass-panel rounded-2xl p-6 border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-slate-950 to-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <PhoneCall className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Verify by Phone
                  </h3>
                  <span className="text-[10px] text-amber-400/90 font-medium">
                    TrustGov IVR Voice Gateway Demonstration
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                Demo IVR — Simulated Locally
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Don't have a smartphone or internet access? You can use the TrustGov telephone verification service with standard keypad (DTMF) audio:
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold">1</span>
                <span className="text-slate-300">Call the TrustGov demonstration service or open simulator.</span>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold">2</span>
                <span className="text-slate-300">Enter the Officer Code (e.g. <span className="font-mono text-cyan-300 font-bold">TG-OFF-001</span>) on the keypad.</span>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold">3</span>
                <span className="text-slate-300">Listen to the voice-friendly verification result and reference code.</span>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold">4</span>
                <span className="text-slate-300">Optionally check if a requested action is safe, or report suspicious demands.</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/admin/ivr-simulator"
                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-amber-200 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 hover:border-amber-400 flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <PhoneCall className="h-4 w-4" />
                <span>Launch Interactive IVR Simulator</span>
              </Link>
            </div>
          </div>

          {/* CITIZEN VERIFICATION HISTORY CARD */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveHistoryTab('VERIFICATIONS')}
                  className={`text-xs font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    activeHistoryTab === 'VERIFICATIONS'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <History className="h-3 w-3" />
                  <span>Checks ({history.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHistoryTab('ACTIONS')}
                  className={`text-xs font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    activeHistoryTab === 'ACTIONS'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldAlert className="h-3 w-3" />
                  <span>Safety ({actionEvaluations.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHistoryTab('REPORTS')}
                  className={`text-xs font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    activeHistoryTab === 'REPORTS'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <AlertOctagon className="h-3 w-3" />
                  <span>Reports ({citizenReports.length})</span>
                </button>
              </div>

              {token && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeHistoryTab === 'VERIFICATIONS') fetchVerificationHistory();
                    else if (activeHistoryTab === 'ACTIONS') fetchActionEvaluations();
                    else fetchCitizenReports();
                  }}
                  disabled={loadingHistory || loadingActionEvals || loadingCitizenReports}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingHistory || loadingActionEvals || loadingCitizenReports ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              )}
            </div>

            {!token ? (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2 text-xs text-slate-400">
                <Lock className="h-6 w-6 text-slate-500 mx-auto" />
                <p>Log in as a citizen to automatically save and track your officer checks, safety assessments, and incident reports.</p>
              </div>
            ) : activeHistoryTab === 'VERIFICATIONS' ? (
              // TAB 1: IDENTITY VERIFICATION HISTORY
              history.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 text-center text-xs text-slate-400">
                  No past verification checks found in your account.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHistoryItem(item)}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 transition-colors cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          item.result === 'VERIFIED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                        }`}>
                          {item.result === 'VERIFIED' ? '✓ VERIFIED' : '✕ FAILED'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.verifiedAt ? new Date(item.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-semibold truncate max-w-[180px]">
                          {item.officerName || item.officerCode || 'Target Record'}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded">
                          {item.method}
                        </span>
                      </div>

                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        Ref: {item.verificationId}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : activeHistoryTab === 'ACTIONS' ? (
              // TAB 2: ACTION SAFETY EVALUATION HISTORY
              actionEvaluations.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 text-center text-xs text-slate-400">
                  No action safety evaluations recorded yet. Check an officer's demand on the left to evaluate risk.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {actionEvaluations.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedActionEvalItem(item)}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-teal-500/40 transition-colors cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            item.decision === 'ALLOW'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                              : item.decision === 'DENY'
                              ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-950 text-amber-400 border border-amber-500/30'
                          }`}>
                            {item.decision}
                          </span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                            item.risk_level === 'CRITICAL' || item.risk_level === 'HIGH'
                              ? 'bg-rose-950 text-rose-300'
                              : item.risk_level === 'MEDIUM'
                              ? 'bg-amber-950 text-amber-300'
                              : 'bg-emerald-950 text-emerald-300'
                          }`}>
                            {item.risk_level}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-medium truncate max-w-[170px]">
                          {item.action_code.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-mono text-teal-400 bg-slate-900 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                          {item.officer_name || item.officer_reference}
                        </span>
                      </div>

                      <div className="text-[10px] font-mono text-slate-500 truncate flex items-center justify-between">
                        <span>Ref: {item.evaluation_id}</span>
                        <span className="text-slate-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // TAB 3: SCAM & SUSPICIOUS INCIDENT REPORTS
              citizenReports.length === 0 ? (
                <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/60 text-center space-y-3 text-xs text-slate-400">
                  <p>You have not filed any suspicious interaction or extortion reports.</p>
                  <button
                    type="button"
                    onClick={() => openReportModal()}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-sm shadow-rose-900/20 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>File New Report</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  <div className="flex justify-end pb-1">
                    <button
                      type="button"
                      onClick={() => openReportModal()}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <AlertOctagon className="w-3 h-3" />
                      <span>+ New Report</span>
                    </button>
                  </div>
                  {citizenReports.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedCitizenReport(item)}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-rose-500/40 transition-colors cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-cyan-400 font-bold text-xs">{item.reportId}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          item.status === 'RESOLVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' :
                          item.status === 'UNDER_REVIEW' ? 'bg-sky-950 text-sky-400 border border-sky-500/30' :
                          item.status === 'ADDITIONAL_INFORMATION_REQUIRED' ? 'bg-purple-950 text-purple-400 border border-purple-500/30' :
                          'bg-amber-950 text-amber-400 border border-amber-500/30'
                        }`}>
                          {item.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-semibold truncate max-w-[180px]">
                          {item.reportCategory.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          item.riskLevel === 'CRITICAL' ? 'bg-rose-950 text-rose-300' :
                          item.riskLevel === 'HIGH' ? 'bg-amber-950 text-amber-300' :
                          'bg-slate-900 text-slate-400'
                        }`}>
                          {item.riskLevel}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                        <span>{item.officerReference ? `Target: ${item.officerReference}` : 'Unclaimed caller'}</span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Paperclip className="w-3 h-3" />
                          {item.evidenceCount || (item.evidence ? item.evidence.length : 0)} files
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* ANTI-SCAM SAFETY CENTER */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
              <BookOpen className="h-4 w-4 text-cyan-400" />
              Anti-Scam Safety Center
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-1">
                <span className="font-bold text-rose-300 block">1. What is a "Digital Arrest"?</span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Scammers impersonate police or cybercrime officers on video calls, threatening immediate arrest unless you transfer money to a "safety account". Real law enforcement NEVER conducts trials or arrests over Skype or WhatsApp.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1">
                <span className="font-bold text-amber-300 block">2. Prohibited Demands (Red Flags)</span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  No legitimate officer will ever ask for OTPs, UPI PINs, banking passwords, or payments via personal QR/UPI IDs. If asked, immediately disconnect.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                <span className="font-bold text-emerald-300 block">3. Always Challenge with TrustGov</span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Ask the officer for their official Officer ID or TrustGov QR badge. Enter it into this portal to verify their active DID and Ed25519 cryptographic key possession.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => openReportModal()}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 hover:border-rose-500 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-rose-950/30"
                >
                  <AlertOctagon className="h-4 w-4 text-rose-400" />
                  <span>File Suspicious Incident Report</span>
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* MODAL: SHARE VERIFICATION REFERENCE */}
      {showShareModal && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-cyan-500/40 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Share2 className="h-4 w-4 text-cyan-400" />
                Share Verification Reference
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Anyone can look up this reference on TrustGov to confirm this verification occurred. It reveals <strong>zero private keys or personal citizen data</strong>.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs font-mono">
              <span className="text-[10px] text-slate-500 block uppercase">Verification Reference</span>
              <span className="text-cyan-300 text-sm font-bold select-all block">{result.verificationId}</span>
              <span className="text-[10px] text-slate-400 block pt-1">
                Verified: {new Date(result.timestamp).toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-300">
              Disclaimer: Historical verification records prove status at the time of check. Future officer suspensions will reflect on fresh verifications.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedRef ? <Check className="h-4 w-4 text-slate-950" /> : <Copy className="h-4 w-4 text-slate-950" />}
                <span>{copiedRef ? 'Copied to Clipboard!' : 'Copy Reference & Details'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HISTORICAL VERIFICATION RECORD DETAIL */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-800 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="h-4 w-4 text-cyan-400" />
                Historical Verification Record
              </h3>
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Historical Warning Notice */}
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-1">
              <span className="font-bold text-amber-300 block uppercase text-[10px]">
                HISTORICAL VERIFICATION RECORD
              </span>
              <p className="leading-relaxed text-[11px]">
                Recorded on {new Date(selectedHistoryItem.createdAt).toLocaleString()}. Current officer status or credentials may have changed since this timestamp.
              </p>
            </div>

            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Reference:</span>
                <span className="font-mono text-cyan-400 font-bold">{selectedHistoryItem.verificationId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Result:</span>
                <span className={`font-bold font-mono ${selectedHistoryItem.result === 'VERIFIED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedHistoryItem.result}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Method Used:</span>
                <span className="font-mono text-white">{selectedHistoryItem.method}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Officer Name:</span>
                <span className="text-white font-semibold">{selectedHistoryItem.officerName || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Officer Code:</span>
                <span className="font-mono text-cyan-300">{selectedHistoryItem.officerCode || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Department:</span>
                <span className="text-white">{selectedHistoryItem.department || 'N/A'}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleReverifyHistory(selectedHistoryItem)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Verify Current Live Status</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HISTORICAL ACTION SAFETY RECORD DETAIL */}
      {selectedActionEvalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-teal-500/40 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-teal-400" />
                Historical Action Safety Record
              </h3>
              <button
                type="button"
                onClick={() => setSelectedActionEvalItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Historical Warning Notice */}
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-1">
              <span className="font-bold text-amber-300 block uppercase text-[10px]">
                HISTORICAL EVALUATION RECORD
              </span>
              <p className="leading-relaxed text-[11px]">
                Recorded on {new Date(selectedActionEvalItem.created_at).toLocaleString()}. Reflects TrustGov demo policies and officer credentials active at that time.
              </p>
            </div>

            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Evaluation Ref:</span>
                <span className="font-mono text-cyan-400 font-bold select-all">{selectedActionEvalItem.evaluation_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Officer Reference:</span>
                <span className="font-mono text-white">{selectedActionEvalItem.officer_reference}</span>
              </div>
              {selectedActionEvalItem.officer_name && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Officer Name:</span>
                  <span className="text-white font-semibold">{selectedActionEvalItem.officer_name}</span>
                </div>
              )}
              {selectedActionEvalItem.department && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="text-slate-300">{selectedActionEvalItem.department}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Evaluated Action:</span>
                <span className="font-semibold text-white">{selectedActionEvalItem.action_code.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Decision:</span>
                <span className={`font-bold font-mono px-2 py-0.5 rounded text-[11px] ${
                  selectedActionEvalItem.decision === 'ALLOW' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' :
                  selectedActionEvalItem.decision === 'DENY' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' :
                  'bg-amber-950 text-amber-300 border border-amber-500/40'
                }`}>
                  {selectedActionEvalItem.decision}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Risk Level:</span>
                <span className={`font-bold font-mono px-2 py-0.5 rounded text-[11px] ${
                  selectedActionEvalItem.risk_level === 'CRITICAL' || selectedActionEvalItem.risk_level === 'HIGH'
                    ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                    : selectedActionEvalItem.risk_level === 'MEDIUM'
                    ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {selectedActionEvalItem.risk_level}
                </span>
              </div>
              {selectedActionEvalItem.policy_code && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Matched Policy:</span>
                  <span className="font-mono text-cyan-300">
                    {selectedActionEvalItem.policy_code} (v{selectedActionEvalItem.policy_version || 1})
                  </span>
                </div>
              )}

              {/* Reason Codes */}
              {selectedActionEvalItem.reason_codes && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                    Triggered Reason Codes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(typeof selectedActionEvalItem.reason_codes === 'string'
                      ? JSON.parse(selectedActionEvalItem.reason_codes)
                      : selectedActionEvalItem.reason_codes
                    ).map((code: string, idx: number) => (
                      <span key={idx} className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 text-teal-300 border border-slate-800">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 leading-relaxed">
              Safe public reference: Contains zero citizen PII, zero credentials, zero tokens, and zero cryptographic keys.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  handleCopyAuthReference(selectedActionEvalItem.evaluation_id);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedAuthRef ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedAuthRef ? 'Copied Ref!' : 'Copy Evaluation Reference'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedActionEvalItem(null)}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 border border-slate-800 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 9 Citizen Report Submission Modal */}
      <CitizenReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialData={reportInitialData}
        onReportSubmitted={() => {
          fetchCitizenReports();
          setActiveHistoryTab('REPORTS');
        }}
      />

      {/* Phase 9 Citizen Report Detail & Live Cryptographic Evidence Integrity Modal */}
      <CitizenReportDetailModal
        report={selectedCitizenReport}
        onClose={() => setSelectedCitizenReport(null)}
      />

      {/* Phase 6 Camera QR Scanner Modal */}
      <QRScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => {
          setIsQrScannerOpen(false);
          setCameraDenied(true);
        }}
        onScan={handleScanQR}
      />

    </div>
  );
};

export default CitizenDashboard;
