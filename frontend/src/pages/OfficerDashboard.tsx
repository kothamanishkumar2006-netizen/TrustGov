import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Key,
  Copy,
  Check,
  Fingerprint,
  FileCheck,
  ShieldCheck,
  Code,
  ChevronDown,
  ChevronUp,
  Database,
  QrCode,
  PenTool,
  Send,
  RefreshCw,
  Lock,
  Info,
  X
} from 'lucide-react';
import { OfficerQRModal } from '../components/OfficerQRModal';

const OfficerDashboard: React.FC = () => {
  const { user, officerDetails, token } = useAuth();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [showVcDoc, setShowVcDoc] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);

  // Phase 5: Blockchain State
  const [blockchainRecord, setBlockchainRecord] = useState<any | null>(null);
  const [loadingBc, setLoadingBc] = useState(false);
  const [verifyingBc, setVerifyingBc] = useState(false);
  const [bcVerificationResult, setBcVerificationResult] = useState<any | null>(null);

  // Phase 6: QR & Proof of Possession State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [pendingChallenges, setPendingChallenges] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [challengeToSign, setChallengeToSign] = useState('');
  const [signingChallenge, setSigningChallenge] = useState(false);
  const [signSuccess, setSignSuccess] = useState<any | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  const fetchOfficerCredentials = async () => {
    try {
      setLoadingCreds(true);
      const res = await axios.get('/api/officer/credentials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setCredentials(res.data.data.credentials || []);
      }
    } catch (err) {
      console.error('Failed to fetch credentials:', err);
    } finally {
      setLoadingCreds(false);
    }
  };

  const fetchPendingChallenges = async () => {
    try {
      setLoadingPending(true);
      const res = await axios.get('/api/officer/proof/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setPendingChallenges(res.data.data.challenges || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending challenges:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  // Phase 8: Authorization Scope State
  const [authScope, setAuthScope] = useState<any | null>(null);
  const [loadingScope, setLoadingScope] = useState(false);

  const fetchAuthorizationScope = async () => {
    try {
      setLoadingScope(true);
      const res = await axios.get('/api/officer/authorization/scope', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setAuthScope(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch authorization scope:', err);
    } finally {
      setLoadingScope(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchOfficerCredentials();
      fetchPendingChallenges();
      fetchAuthorizationScope();
      const interval = setInterval(fetchPendingChallenges, 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const activeCred = credentials.find((c: any) => c.status === 'ACTIVE') || (credentials.length > 0 ? credentials[0] : null);

  const handleSignChallenge = async (chId?: string) => {
    const idToSign = chId || challengeToSign;
    if (!idToSign.trim()) {
      setSignError('Please enter or select a Challenge ID');
      return;
    }
    try {
      setSigningChallenge(true);
      setSignError(null);
      setSignSuccess(null);
      const res = await axios.post(
        '/api/officer/proof/sign',
        { challengeId: idToSign.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setSignSuccess(res.data.data);
        fetchPendingChallenges();
      }
    } catch (err: any) {
      setSignError(err.response?.data?.error?.message || 'Failed to sign challenge with key custody');
    } finally {
      setSigningChallenge(false);
    }
  };

  useEffect(() => {
    const fetchBlockchainRecord = async () => {
      if (!activeCred?.credentialId) return;
      try {
        setLoadingBc(true);
        const res = await axios.get(`/api/blockchain/credentials/${activeCred.credentialId}`);
        if (res.data.success && res.data.data.anchored) {
          setBlockchainRecord(res.data.data);
        } else {
          setBlockchainRecord(null);
        }
      } catch (err) {
        setBlockchainRecord(null);
      } finally {
        setLoadingBc(false);
      }
    };

    fetchBlockchainRecord();
  }, [activeCred]);

  const handleVerifyMyCredential = async (credId: string) => {
    try {
      setVerifying(true);
      setVerificationResult(null);
      const res = await axios.get(`/api/credentials/${credId}/verify`);
      if (res.data.success) {
        setVerificationResult(res.data.data);
      }
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        reason: err.response?.data?.error?.message || 'Verification failed'
      });
    } finally {
      setVerifying(false);
    }
  };

  // Phase 5: Verify on-chain blockchain integrity
  const handleVerifyMyBlockchain = async (credId: string) => {
    try {
      setVerifyingBc(true);
      setBcVerificationResult(null);
      const res = await axios.get(`/api/blockchain/credentials/${credId}/verify`);
      if (res.data.success) {
        setBcVerificationResult(res.data.data);
      }
    } catch (err: any) {
      setBcVerificationResult({
        valid: false,
        reason: err.response?.data?.error?.message || 'Blockchain verification failed'
      });
    } finally {
      setVerifyingBc(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20';
      case 'REVOKED':
        return 'bg-rose-950/60 text-rose-400 border border-rose-500/20';
      case 'EXPIRED':
        return 'bg-amber-950/60 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-slate-900 text-slate-400 border border-slate-800';
    }
  };

  // Mock list of authorizations for UI demo in Phase 1
  const authorizationsMock = [
    { action: 'DOCUMENT_REQUEST', allowed: true, desc: 'Request official identity documents' },
    { action: 'OFFICIAL_NOTICE', allowed: true, desc: 'Serve official notices to citizens' },
    { action: 'INVESTIGATION_ACTION', allowed: true, desc: 'Conduct investigation-related queries' },
    { action: 'PERSONAL_UPI_PAYMENT', allowed: false, desc: 'Receive money to a personal UPI/bank account' },
    { action: 'OTP_REQUEST', allowed: false, desc: 'Ask citizens for one-time passwords (OTP)' },
    { action: 'PASSWORD_REQUEST', allowed: false, desc: 'Ask citizens for passwords' },
    { action: 'PIN_REQUEST', allowed: false, desc: 'Ask citizens for card/banking PINs' },
  ];

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-400" />
            Officer Cryptographic Control Panel
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Verify pending verification requests, sign challenges, and manage your digital identity credential.
          </p>
        </div>
        {activeCred && (
          <button
            type="button"
            onClick={() => setIsQrModalOpen(true)}
            className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <QrCode className="h-4 w-4" />
            Show Verification QR Badge
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Profile, DID and Credentials Info */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Identity Profile Card */}
          <div className="glass-panel rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase border-b border-slate-900 pb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-400" /> Digital Profile
            </h3>
            
            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Officer Name</span>
                <span className="text-sm font-bold text-white block mt-0.5">{user?.name}</span>
              </div>
              
              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Officer ID</span>
                <span className="text-sm font-semibold text-cyan-400 font-mono block mt-0.5">{officerDetails?.officer_code || 'TG-OFF-001'}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Department</span>
                <span className="text-sm font-semibold text-slate-300 block mt-0.5">{officerDetails?.department || 'Demo Central Bureau of Investigation'}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Designation</span>
                <span className="text-sm text-slate-300 block mt-0.5">{officerDetails?.designation || 'Deputy Superintendent'}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Jurisdiction</span>
                <span className="text-sm text-slate-400 block mt-0.5">{officerDetails?.jurisdiction || 'Regional Office'}</span>
              </div>
            </div>
          </div>

          {/* Cryptographic DID Metadata */}
          <div className="glass-panel rounded-xl p-6 space-y-5 border border-cyan-500/20">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-cyan-400" /> Cryptographic Identity
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                Phase 3
              </span>
            </div>

            <div className="space-y-4">
              {/* DID */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                    Decentralized Identifier (DID)
                  </span>
                  <button
                    onClick={() => copyToClipboard(officerDetails?.did || 'did:trustgov:demo:cib:tg-off-001', 'did')}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'did' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedField === 'did' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <span className="text-xs font-mono break-all text-cyan-300 block mt-1 bg-slate-900/80 p-2.5 rounded border border-slate-800 select-all">
                  {officerDetails?.did || 'did:trustgov:demo:cib:tg-off-001'}
                </span>
              </div>

              {/* Algorithm & Status */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                    Key Type
                  </span>
                  <span className="inline-block text-xs font-mono font-semibold px-2 py-1 rounded mt-1 bg-slate-900 text-indigo-300 border border-indigo-500/30">
                    {officerDetails?.key_type || 'Ed25519'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                    Identity Status
                  </span>
                  <span className={`inline-block text-[10px] font-bold tracking-wider px-2 py-1 rounded mt-1 uppercase ${getStatusColor(officerDetails?.did_status || user?.status || 'ACTIVE')}`}>
                    {officerDetails?.did_status || user?.status || 'ACTIVE'}
                  </span>
                </div>
              </div>

              {/* Public Verification Key */}
              <div className="pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold flex items-center gap-1">
                    <Key className="h-3 w-3 text-cyan-400" /> Public Verification Key
                  </span>
                  <button
                    onClick={() => copyToClipboard(officerDetails?.public_key || '04-mock-public-key', 'pubKey')}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'pubKey' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedField === 'pubKey' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <span className="text-[10px] font-mono break-all text-slate-300 block mt-1 bg-slate-900/60 p-2 rounded border border-slate-800 max-h-20 overflow-y-auto select-all">
                  {officerDetails?.public_key || 'z6MkemMNhF7WuBVhjeSexMQfCn9EJRgp3H43ULEjPGz9RpUJ'}
                </span>
              </div>

              {/* Officer Explanation Banner */}
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-cyan-300 text-[11px] leading-relaxed">
                <strong className="block text-white font-semibold mb-0.5">
                  Verifiable Digital Identity Active
                </strong>
                This is your cryptographically verifiable digital identity. Citizens and automated verification gateways use your public key to verify your official actions without exposing sensitive government credentials.
              </div>
            </div>
          </div>

          {/* Phase 4: Verifiable Credential Metadata Card */}
          <div className="glass-panel rounded-xl p-6 space-y-5 border border-indigo-500/20">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-indigo-400" /> Verifiable Credential
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-500/30">
                Phase 4
              </span>
            </div>

            {loadingCreds ? (
              <div className="py-6 flex items-center justify-center space-y-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            ) : activeCred ? (
              <div className="space-y-4">
                {/* Credential ID */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                      Credential Identifier
                    </span>
                    <button
                      onClick={() => copyToClipboard(activeCred.credentialId, 'credId')}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'credId' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedField === 'credId' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <span className="text-xs font-mono break-all text-indigo-300 block mt-1 bg-slate-900/80 p-2.5 rounded border border-slate-800 select-all font-semibold">
                    {activeCred.credentialId}
                  </span>
                </div>

                {/* Status & Validity */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                      Status
                    </span>
                    <span className={`inline-block text-[10px] font-bold tracking-wider px-2 py-1 rounded mt-1 uppercase ${getStatusColor(activeCred.status)}`}>
                      {activeCred.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                      Expires
                    </span>
                    <span className="inline-block text-xs font-mono text-slate-300 mt-1">
                      {new Date(activeCred.validUntil).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Issuer Authority */}
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                    Issuing Authority DID
                  </span>
                  <span className="text-[11px] font-mono break-all text-cyan-300 block mt-1 bg-slate-900/60 p-2 rounded border border-slate-800 select-all">
                    {activeCred.issuerDid}
                  </span>
                </div>

                {/* Verification Action */}
                <div className="pt-2 border-t border-slate-900 space-y-3">
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => handleVerifyMyCredential(activeCred.credentialId)}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {verifying ? 'Checking Cryptographic Signature...' : 'Verify My Credential Authenticity'}
                  </button>

                  {/* Real-time Verification Result */}
                  {verificationResult && (
                    <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      verificationResult.valid
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                    }`}>
                      <div className="flex items-center gap-2 font-bold">
                        {verificationResult.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                        {verificationResult.valid ? 'Signature & Credential Valid' : 'Verification Failed'}
                      </div>
                      <p className="text-[11px] opacity-90">
                        {verificationResult.valid
                          ? 'Ed25519 digital signature verified against TrustGov National Issuance Authority.'
                          : `Reason: ${verificationResult.reason}`}
                      </p>
                    </div>
                  )}

                  {/* View VC JSON Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowVcDoc(!showVcDoc)}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-[11px] text-slate-400 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-mono">
                        <Code className="h-3 w-3 text-indigo-400" />
                        {showVcDoc ? 'Hide Credential JSON' : 'View W3C Credential JSON'}
                      </span>
                      {showVcDoc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {showVcDoc && (
                      <div className="mt-2 p-2.5 rounded bg-slate-950 border border-indigo-500/20 text-indigo-300 font-mono text-[10px] relative">
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(activeCred.credential, null, 2), 'vcJson')}
                          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-cyan-400 flex items-center gap-1"
                        >
                          {copiedField === 'vcJson' ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                          {copiedField === 'vcJson' ? 'Copied' : 'Copy'}
                        </button>
                        <pre className="overflow-x-auto max-h-48">
                          {JSON.stringify(activeCred.credential, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  No active Verifiable Credential has been issued yet. Contact your department administrator to mint your official credential.
                </p>
              </div>
            )}
          </div>

          {/* Phase 5: Blockchain Integrity Anchor Card */}
          <div className="glass-panel rounded-xl p-6 space-y-5 border border-emerald-500/20">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" /> Blockchain Integrity Anchor
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                Phase 5
              </span>
            </div>

            {loadingBc ? (
              <div className="py-6 flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            ) : blockchainRecord ? (
              <div className="space-y-4">
                {/* Tx Hash */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                      Transaction Hash
                    </span>
                    <button
                      onClick={() => copyToClipboard(blockchainRecord.txHash, 'bcTx')}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'bcTx' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedField === 'bcTx' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <span className="text-xs font-mono break-all text-emerald-300 block mt-1 bg-slate-900/80 p-2.5 rounded border border-slate-800 select-all font-semibold">
                    {blockchainRecord.txHash}
                  </span>
                </div>

                {/* On-Chain Status & Block */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                      On-Chain Status
                    </span>
                    <span className={`inline-block text-[10px] font-bold tracking-wider px-2 py-1 rounded mt-1 uppercase ${
                      blockchainRecord.status === 'ACTIVE'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                        : blockchainRecord.status === 'SUSPENDED'
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-950/60 text-rose-400 border border-rose-500/20'
                    }`}>
                      {blockchainRecord.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                      Block Number
                    </span>
                    <span className="inline-block text-xs font-mono text-slate-300 mt-1">
                      #{blockchainRecord.blockNumber}
                    </span>
                  </div>
                </div>

                {/* Canonical Hash */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                      Canonical RFC 8785 Hash
                    </span>
                    <button
                      onClick={() => copyToClipboard(blockchainRecord.credentialHash, 'bcHash')}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'bcHash' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedField === 'bcHash' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <span className="text-[10px] font-mono break-all text-cyan-300 block mt-1 bg-slate-900/60 p-2 rounded border border-slate-800 select-all">
                    {blockchainRecord.credentialHash}
                  </span>
                </div>

                {/* Verify Action */}
                <div className="pt-2 border-t border-slate-900 space-y-3">
                  <button
                    type="button"
                    disabled={verifyingBc}
                    onClick={() => handleVerifyMyBlockchain(activeCred!.credentialId)}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {verifyingBc ? 'Auditing Smart Contract Integrity...' : 'Verify Blockchain Integrity'}
                  </button>

                  {/* Blockchain Verification Result */}
                  {bcVerificationResult && (
                    <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      bcVerificationResult.valid && bcVerificationResult.anchored
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                    }`}>
                      <div className="flex items-center gap-2 font-bold">
                        {bcVerificationResult.valid && bcVerificationResult.anchored
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          : <XCircle className="h-4 w-4 text-rose-400" />}
                        {bcVerificationResult.valid && bcVerificationResult.anchored
                          ? 'Smart Contract Integrity Confirmed'
                          : 'Integrity Audit Failed'}
                      </div>
                      <p className="text-[11px] opacity-90">
                        {bcVerificationResult.valid && bcVerificationResult.anchored
                          ? `RFC 8785 hash matches on-chain registry entry. Status: ${bcVerificationResult.onChainStatus}. Block #${bcVerificationResult.blockNumber || blockchainRecord.blockNumber}.`
                          : `Reason: ${bcVerificationResult.reason}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  {activeCred
                    ? 'This credential has not yet been anchored to the blockchain registry. Contact your administrator to anchor your credential.'
                    : 'No active credential available to anchor.'}
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Pending Requests Queue & Actions Matrix */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Verification Requests & Challenge Signing Gateway */}
          <div className="glass-panel border-cyan-500/20 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
                  Proof of Possession Challenge Gateway
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchPendingChallenges}
                  disabled={loadingPending}
                  className="p-1 rounded-md text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 transition-colors"
                  title="Refresh Challenges"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingPending ? 'animate-spin' : ''}`} />
                </button>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              When citizens scan your badge or request verification, incoming cryptographic challenges appear here. Signing proves physical custody of your officer private key without exposing raw key material.
            </p>

            {/* Pending Challenges List */}
            {loadingPending ? (
              <div className="py-6 flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              </div>
            ) : pendingChallenges.length > 0 ? (
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
                  Pending Citizen Challenges ({pendingChallenges.length})
                </span>
                {pendingChallenges.map((ch) => (
                  <div key={ch.challengeId} className="p-3.5 rounded-lg bg-slate-950/80 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-cyan-300 select-all">
                          {ch.challengeId}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30">
                          PENDING
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Audience: <span className="text-slate-300 font-mono">{ch.audience}</span> • Expires: {new Date(ch.expiresAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={signingChallenge}
                      onClick={() => handleSignChallenge(ch.challengeId)}
                      className="py-1.5 px-3 rounded-lg text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      <PenTool className="h-3.5 w-3.5" />
                      Sign Proof
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center rounded-xl bg-slate-950/40 border border-slate-900 space-y-2">
                <Clock className="h-6 w-6 text-slate-600" />
                <p className="text-xs font-semibold text-slate-400">No Citizen Challenges in Queue</p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Waiting for citizen requests. You can also manually sign a specific challenge ID below.
                </p>
              </div>
            )}

            {/* Manual Challenge ID Input & Sign */}
            <div className="pt-2 border-t border-slate-900/80 space-y-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Sign Challenge by ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={challengeToSign}
                  onChange={(e) => setChallengeToSign(e.target.value)}
                  placeholder="Enter or paste UUID challenge ID..."
                  className="flex-1 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  disabled={signingChallenge || !challengeToSign.trim()}
                  onClick={() => handleSignChallenge()}
                  className="py-2 px-3.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  {signingChallenge ? 'Signing...' : 'Sign'}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {signError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{signError}</span>
              </div>
            )}

            {/* Success Result Display */}
            {signSuccess && (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    CHALLENGE CRYPTOGRAPHICALLY SIGNED
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-500/30">
                    STATUS: SIGNED
                  </span>
                </div>

                <div className="space-y-2 text-xs bg-slate-950/80 p-3 rounded-lg border border-emerald-500/20">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">Challenge ID</span>
                    <span className="text-cyan-300 font-mono text-[11px] block break-all select-all font-semibold">
                      {signSuccess.challengeId}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-slate-400 block font-bold">
                        Ed25519 Proof-of-Possession Signature (Base64)
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(signSuccess.signature, 'proofSig')}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'proofSig' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copiedField === 'proofSig' ? 'Copied' : 'Copy Signature'}
                      </button>
                    </div>
                    <span className="text-[10px] font-mono break-all text-emerald-300 block mt-1 bg-slate-900/90 p-2 rounded border border-slate-800 select-all max-h-16 overflow-y-auto">
                      {signSuccess.signature}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-300/80">
                  The citizen verifier can now validate this signature against your DID public key and blockchain registry.
                </p>
              </div>
            )}
          </div>

          {/* Authorization Rules Matrix */}
          <div className="glass-panel rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase border-b border-slate-900 pb-3">
              Your Official Authority Matrix (RBAC)
            </h3>
            <p className="text-xs text-slate-500">
              The system automatically flags transactions based on these rules. Legitimate transactions will show as APPROVED. Financial requests are always DENIED.
            </p>
            
            <div className="space-y-2.5">
              {authorizationsMock.map((auth) => (
                <div key={auth.action} className="flex items-center justify-between p-3 rounded-lg border border-slate-900 bg-slate-950/20 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono font-bold text-slate-300">{auth.action}</span>
                    <p className="text-slate-500 text-[10px]">{auth.desc}</p>
                  </div>
                  <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border uppercase ${
                    auth.allowed 
                      ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' 
                      : 'bg-rose-950/30 text-rose-500 border-rose-500/20'
                  }`}>
                    {auth.allowed ? 'ALLOWED' : 'DENIED'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification History Logs */}
          <div className="glass-panel rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase border-b border-slate-900 pb-3">
              Local Verification History Log
            </h3>
            
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Successful Authentications</span>
                <span className="font-semibold text-slate-300">0</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-900/60 pt-2.5">
                <span className="flex items-center gap-1.5"><XCircle className="h-4 w-4 text-rose-500" /> Failed Attempts</span>
                <span className="font-semibold text-slate-300">0</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-900/60 pt-2.5">
                <span className="flex items-center gap-1.5"><AlertCircle className="h-4 w-4 text-amber-500" /> Rejected Requests</span>
                <span className="font-semibold text-slate-300">0</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Phase 8: Officer Authorization Scope Panel */}
      <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Lock className="h-3.5 w-3.5" />
              Phase 8 Authorization Scope
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              Configured Authorization Scope
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              TrustGov Demo Authorization Policy &amp; Permitted Departmental Actions (Read-Only)
            </p>
          </div>

          <button
            onClick={fetchAuthorizationScope}
            className="self-start sm:self-auto p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Refresh scope"
          >
            <RefreshCw className={`h-4 w-4 ${loadingScope ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadingScope ? (
          <div className="py-8 text-center text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-cyan-400 mb-2" />
            Loading officer authorization scope...
          </div>
        ) : authScope ? (
          <div className="space-y-6">
            {/* Meta tags */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Assigned Department</span>
                <span className="font-semibold text-white mt-0.5 block">{authScope.department}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Designated Role</span>
                <span className="font-semibold text-white mt-0.5 block">{authScope.role}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Authority Mode</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-500/30 mt-0.5">
                  <Lock className="h-3 w-3" />
                  Read-Only Scope
                </span>
              </div>
            </div>

            {/* Allowed & Prohibited Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Allowed Actions */}
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Configured Permitted Actions ({authScope.allowedActions?.length || 0})
                </div>
                {authScope.allowedActions?.length > 0 ? (
                  <ul className="space-y-2 text-xs">
                    {authScope.allowedActions.map((act: string) => (
                      <li key={act} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-200 font-mono">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">No specific actions permitted under current demo policy.</p>
                )}
              </div>

              {/* Prohibited Actions */}
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400">
                  <XCircle className="h-4 w-4 text-rose-400" />
                  Strictly Prohibited Requests ({authScope.prohibitedActions?.length || 0})
                </div>
                {authScope.prohibitedActions?.length > 0 ? (
                  <ul className="space-y-2 text-xs">
                    {authScope.prohibitedActions.map((act: string) => (
                      <li key={act} className="flex items-center gap-2 p-2 rounded-lg bg-rose-950/20 border border-rose-500/20 text-rose-200 font-mono">
                        <X className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">No prohibited actions listed.</p>
                )}
              </div>
            </div>

            {/* Active Policies Table */}
            {authScope.activePolicies?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Departmental Policies ({authScope.activePolicies.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 border border-slate-800 rounded-xl overflow-hidden">
                    <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Policy Code</th>
                        <th className="py-2.5 px-3">Version</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Decision</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Effective Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                      {authScope.activePolicies.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-bold text-white">{p.policyCode}</td>
                          <td className="py-2.5 px-3 font-mono text-cyan-400">v{p.version}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">{p.actionCode}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.decision === 'ALLOW' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                            }`}>
                              {p.decision}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-emerald-400 font-semibold">{p.status}</td>
                          <td className="py-2.5 px-3 text-slate-400">{new Date(p.effectiveFrom).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Disclaimer Banner */}
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong>TrustGov Demo Authorization Policy:</strong> These rules demonstrate automated authorization boundary checks. Real legal authority is governed by departmental regulations, statutory powers, and verified official warrants. Officers cannot modify their own authorization scope.
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Phase 6: Officer QR Badge Modal */}
      {activeCred && (
        <OfficerQRModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          credentialId={activeCred.credentialId}
          officerCode={officerDetails?.officer_code || 'TG-OFF-001'}
          officerName={user?.name || 'Government Officer'}
          department={officerDetails?.department || 'Official Agency'}
        />
      )}
    </div>
  );
};

export default OfficerDashboard;
