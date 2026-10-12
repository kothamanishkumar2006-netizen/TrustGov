import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { AuthorizationPolicyManagement } from '../components/AuthorizationPolicyManagement';
import {
  Shield,
  UserPlus,
  Search,
  Filter,
  Eye,
  Edit2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Building2,
  MapPin,
  Mail,
  Phone,
  X,
  RefreshCw,
  Award,
  Key,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  Fingerprint,
  FileCheck,
  ShieldCheck,
  Database
} from 'lucide-react';

export interface Officer {
  id: string;
  user_id?: string;
  officer_code: string;
  full_name: string;
  department: string;
  designation: string;
  jurisdiction: string;
  official_email: string;
  official_phone: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  created_at: string;
  updated_at: string;
  did?: string | null;
  public_key?: string | null;
  did_identity?: {
    id: string;
    did: string;
    key_type: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
    public_key: string;
    created_at: string;
    updated_at?: string;
    didDocument?: any;
  } | null;
  verifiable_credential?: {
    id: string;
    credentialId: string;
    officerDid: string;
    issuerDid: string;
    credentialType: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
    issuedAt: string;
    validFrom: string;
    validUntil: string;
    suspendedAt?: string | null;
    revokedAt?: string | null;
    credential: any;
  } | null;
  blockchain_anchor?: {
    id: string;
    credentialId: string;
    credentialHash: string;
    officerDidHash: string;
    issuerDidHash: string;
    txHash: string;
    blockNumber: number;
    contractAddress: string;
    chainId: number;
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
    anchoredAt: string;
  } | null;
  placeholders?: {
    did: string;
    credential: string;
    blockchain: string;
  };
}

const DEPARTMENTS = [
  'Central Investigation Bureau',
  'Enforcement Directorate',
  'Income Tax Department',
  'Police Department',
  'Cyber Crime Division',
  'National Security Guard',
  'Revenue Intelligence'
];

const OfficerManagement: React.FC = () => {
  const { token } = useAuth();

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null);

  // Phase 3: DID State
  const [issuingDID, setIssuingDID] = useState(false);
  const [didIssueError, setDidIssueError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showDidDocument, setShowDidDocument] = useState(false);

  // Phase 4: Verifiable Credential State
  const [issuingVC, setIssuingVC] = useState(false);
  const [vcIssueError, setVcIssueError] = useState<string | null>(null);
  const [showVcDocument, setShowVcDocument] = useState(false);
  const [isVcVerifyModalOpen, setIsVcVerifyModalOpen] = useState(false);
  const [verifyingVc, setVerifyingVc] = useState(false);
  const [vcVerificationResult, setVcVerificationResult] = useState<any | null>(null);
  const [vcValidityDays, setVcValidityDays] = useState(365);
  const [updatingVcStatus, setUpdatingVcStatus] = useState(false);

  // Phase 5: Blockchain Registry State
  const [anchoringBlockchain, setAnchoringBlockchain] = useState(false);
  const [blockchainAnchorError, setBlockchainAnchorError] = useState<string | null>(null);
  const [isBcVerifyModalOpen, setIsBcVerifyModalOpen] = useState(false);
  const [verifyingBlockchain, setVerifyingBlockchain] = useState(false);
  const [bcVerificationResult, setBcVerificationResult] = useState<any | null>(null);

  // Phase 8: Admin Tabs State
  const [activeAdminTab, setActiveAdminTab] = useState<'OFFICERS' | 'POLICIES'>('OFFICERS');

  // Status Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    officer: Officer | null;
    targetStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | null;
    actionLabel: string;
  }>({
    isOpen: false,
    officer: null,
    targetStatus: null,
    actionLabel: ''
  });

  // Forms state
  const [formData, setFormData] = useState({
    full_name: '',
    officer_code: '',
    department: DEPARTMENTS[0],
    designation: '',
    jurisdiction: '',
    official_email: '',
    official_phone: '',
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Officers List
  const fetchOfficers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (departmentFilter !== 'ALL') params.department = departmentFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await axios.get('/api/admin/officers', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (res.data.success) {
        setOfficers(res.data.data.officers || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch officers list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchOfficers();
    }
  }, [token, searchQuery, departmentFilter, statusFilter]);

  // Flash success notification
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Open Details Modal
  // Open Details Modal
  const handleOpenDetails = async (officerId: string) => {
    setShowDidDocument(false);
    setShowVcDocument(false);
    setDidIssueError(null);
    setVcIssueError(null);
    try {
      const res = await axios.get(`/api/admin/officers/${officerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setSelectedOfficer(res.data.data.officer);
        setIsDetailsOpen(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load officer details');
    }
  };

  // Phase 3: Handle DID Issuance
  const handleIssueDID = async (officerId: string) => {
    setDidIssueError(null);
    try {
      setIssuingDID(true);
      const res = await axios.post(`/api/admin/officers/${officerId}/did`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        triggerSuccess(`Cryptographic DID issued successfully: ${res.data.data.did}`);
        const detailRes = await axios.get(`/api/admin/officers/${officerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (detailRes.data.success) {
          setSelectedOfficer(detailRes.data.data.officer);
        }
        fetchOfficers();
      }
    } catch (err: any) {
      setDidIssueError(err.response?.data?.error?.message || 'Failed to issue officer DID.');
    } finally {
      setIssuingDID(false);
    }
  };

  // Phase 4: Handle VC Issuance
  const handleIssueVC = async (officerId: string) => {
    setVcIssueError(null);
    try {
      setIssuingVC(true);
      const res = await axios.post(`/api/admin/officers/${officerId}/credentials`, {
        validityDays: Number(vcValidityDays) || 365
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        triggerSuccess(`Verifiable Credential issued successfully: ${res.data.data.credentialId}`);
        const detailRes = await axios.get(`/api/admin/officers/${officerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (detailRes.data.success) {
          setSelectedOfficer(detailRes.data.data.officer);
        }
        fetchOfficers();
      }
    } catch (err: any) {
      setVcIssueError(err.response?.data?.error?.message || 'Failed to issue Verifiable Credential.');
    } finally {
      setIssuingVC(false);
    }
  };

  // Phase 4: Handle VC Cryptographic Verification
  const handleVerifyCredential = async (credentialId: string) => {
    try {
      setVerifyingVc(true);
      setVcVerificationResult(null);
      setIsVcVerifyModalOpen(true);
      const res = await axios.get(`/api/credentials/${credentialId}/verify`);
      if (res.data.success) {
        setVcVerificationResult(res.data.data);
      }
    } catch (err: any) {
      setVcVerificationResult({
        valid: false,
        reason: err.response?.data?.error?.message || 'Verification request failed'
      });
    } finally {
      setVerifyingVc(false);
    }
  };

  // Phase 4: Handle VC Status Update (ACTIVE / SUSPENDED / REVOKED)
  const handleUpdateCredentialStatus = async (credentialId: string, targetStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED') => {
    try {
      setUpdatingVcStatus(true);
      const res = await axios.patch(`/api/admin/credentials/${credentialId}/status`, {
        status: targetStatus,
        reason: `Admin updated status to ${targetStatus}`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        triggerSuccess(`Credential status successfully updated to ${targetStatus}`);
        if (selectedOfficer) {
          const detailRes = await axios.get(`/api/admin/officers/${selectedOfficer.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (detailRes.data.success) {
            setSelectedOfficer(detailRes.data.data.officer);
          }
        }
        fetchOfficers();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update credential status');
    } finally {
      setUpdatingVcStatus(false);
    }
  };

  // Phase 5: Handle Blockchain Anchor
  const handleAnchorToBlockchain = async (credentialId: string) => {
    setBlockchainAnchorError(null);
    try {
      setAnchoringBlockchain(true);
      const res = await axios.post(`/api/admin/credentials/${credentialId}/blockchain-anchor`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        triggerSuccess(`Credential successfully anchored to Blockchain! Tx: ${res.data.data.transactionHash.slice(0, 10)}...`);
        if (selectedOfficer) {
          const detailRes = await axios.get(`/api/admin/officers/${selectedOfficer.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (detailRes.data.success) {
            setSelectedOfficer(detailRes.data.data.officer);
          }
        }
        fetchOfficers();
      }
    } catch (err: any) {
      setBlockchainAnchorError(err.response?.data?.error?.message || 'Failed to anchor credential to blockchain');
    } finally {
      setAnchoringBlockchain(false);
    }
  };

  // Phase 5: Handle Blockchain Integrity Verification
  const handleVerifyBlockchainIntegrity = async (credentialId: string) => {
    try {
      setVerifyingBlockchain(true);
      setBcVerificationResult(null);
      setIsBcVerifyModalOpen(true);
      const res = await axios.get(`/api/blockchain/credentials/${credentialId}/verify`);
      if (res.data.success) {
        setBcVerificationResult(res.data.data);
      }
    } catch (err: any) {
      setBcVerificationResult({
        valid: false,
        reason: err.response?.data?.error?.message || 'Blockchain verification request failed'
      });
    } finally {
      setVerifyingBlockchain(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Open Edit Modal
  const handleOpenEdit = (officer: Officer) => {
    setSelectedOfficer(officer);
    setFormData({
      full_name: officer.full_name || '',
      officer_code: officer.officer_code,
      department: officer.department,
      designation: officer.designation,
      jurisdiction: officer.jurisdiction,
      official_email: officer.official_email,
      official_phone: officer.official_phone || '',
      status: officer.status
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      full_name: '',
      officer_code: '',
      department: DEPARTMENTS[0],
      designation: '',
      jurisdiction: '',
      official_email: '',
      official_phone: '',
      status: 'ACTIVE'
    });
    setFormError(null);
    setIsCreateOpen(true);
  };

  // Handle Create Officer Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side quick validation
    if (!formData.full_name || !formData.officer_code || !formData.designation || !formData.jurisdiction || !formData.official_email || !formData.official_phone) {
      setFormError('All fields are mandatory.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post('/api/admin/officers', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setIsCreateOpen(false);
        triggerSuccess(`Officer ${formData.full_name} (${formData.officer_code}) successfully registered!`);
        fetchOfficers();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Failed to create officer record.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Officer Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficer) return;
    setFormError(null);

    try {
      setSubmitting(true);
      const res = await axios.put(`/api/admin/officers/${selectedOfficer.id}`, {
        full_name: formData.full_name,
        department: formData.department,
        designation: formData.designation,
        jurisdiction: formData.jurisdiction,
        official_phone: formData.official_phone
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setIsEditOpen(false);
        triggerSuccess(`Officer ${formData.full_name} details updated successfully.`);
        fetchOfficers();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Failed to update officer.');
    } finally {
      setSubmitting(false);
    }
  };

  // Status Change Confirmation
  const openStatusConfirm = (officer: Officer, targetStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED') => {
    const actionLabel = targetStatus === 'ACTIVE'
      ? 'Activate'
      : (targetStatus === 'SUSPENDED' ? 'Suspend' : 'Revoke');

    setConfirmDialog({
      isOpen: true,
      officer,
      targetStatus,
      actionLabel
    });
  };

  const handleExecuteStatusChange = async () => {
    if (!confirmDialog.officer || !confirmDialog.targetStatus) return;

    try {
      setSubmitting(true);
      const res = await axios.patch(
        `/api/admin/officers/${confirmDialog.officer.id}/status`,
        { status: confirmDialog.targetStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        triggerSuccess(`Officer ${confirmDialog.officer.officer_code} status set to ${confirmDialog.targetStatus}.`);
        setConfirmDialog({ isOpen: false, officer: null, targetStatus: null, actionLabel: '' });
        fetchOfficers();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to change officer status');
    } finally {
      setSubmitting(false);
    }
  };

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            ACTIVE
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
            SUSPENDED
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-400 border border-rose-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
            REVOKED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-400 bg-slate-900 border border-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Shield className="h-7 w-7 text-cyan-400" />
            Government Officer Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative registry of credentialed government officials. Supervise active duties, suspension rules, and revocation mandates.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          Register New Officer
        </button>
      </div>

      {/* Admin Section Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-900 pb-3">
        <button
          onClick={() => setActiveAdminTab('OFFICERS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
            activeAdminTab === 'OFFICERS'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Shield className="h-4 w-4 text-cyan-400" />
          Officers & Digital Credentials
        </button>

        <button
          onClick={() => setActiveAdminTab('POLICIES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
            activeAdminTab === 'POLICIES'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Lock className="h-4 w-4 text-cyan-400" />
          Authorization Policies & Risk Engine
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {activeAdminTab === 'POLICIES' ? (
        <AuthorizationPolicyManagement token={token} />
      ) : (
        <>
          {/* Control Bar: Search & Filters */}
          <div className="glass-panel rounded-xl p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by officer code, name, department, or official email..."
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REVOKED">Revoked</option>
            </select>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchOfficers}
            className="p-2 rounded-lg border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Officers Table */}
      <div className="glass-panel rounded-xl overflow-hidden shadow-2xl border border-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/60 text-slate-400 border-b border-slate-900 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Officer Code</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Department & Designation</th>
                <th className="py-3 px-4">Jurisdiction</th>
                <th className="py-3 px-4">Official Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {loading && officers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400"></div>
                      <span>Querying Officer Registry...</span>
                    </div>
                  </td>
                </tr>
              ) : officers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 text-slate-600" />
                      <p className="font-semibold text-slate-400">No officers found matching the filter criteria.</p>
                      <button
                        onClick={() => { setSearchQuery(''); setDepartmentFilter('ALL'); setStatusFilter('ALL'); }}
                        className="text-xs text-cyan-400 hover:underline"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                officers.map((officer) => (
                  <tr key={officer.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                      {officer.officer_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-white block">{officer.full_name || 'N/A'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-200 font-medium block">{officer.department}</span>
                      <span className="text-slate-500 text-[11px] block">{officer.designation}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                        {officer.jurisdiction}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      <span className="block text-slate-300 font-mono text-[11px]">{officer.official_email}</span>
                      <span className="block text-slate-500 text-[10px]">{officer.official_phone}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(officer.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* View Details */}
                        <button
                          onClick={() => handleOpenDetails(officer.id)}
                          className="p-1.5 rounded-lg border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/30 text-slate-400 hover:text-cyan-300 transition-all cursor-pointer"
                          title="View Complete Officer Dossier"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* Edit Officer */}
                        <button
                          onClick={() => handleOpenEdit(officer)}
                          className="p-1.5 rounded-lg border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/30 text-slate-400 hover:text-indigo-300 transition-all cursor-pointer"
                          title="Edit Officer Information"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Status Actions */}
                        {officer.status !== 'ACTIVE' && (
                          <button
                            onClick={() => openStatusConfirm(officer, 'ACTIVE')}
                            className="p-1.5 rounded-lg border border-emerald-900/50 hover:bg-emerald-950/50 text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer"
                            title="Activate Officer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {officer.status === 'ACTIVE' && (
                          <button
                            onClick={() => openStatusConfirm(officer, 'SUSPENDED')}
                            className="p-1.5 rounded-lg border border-amber-900/50 hover:bg-amber-950/50 text-amber-400 hover:text-amber-300 transition-all cursor-pointer"
                            title="Suspend Officer"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {officer.status !== 'REVOKED' && (
                          <button
                            onClick={() => openStatusConfirm(officer, 'REVOKED')}
                            className="p-1.5 rounded-lg border border-rose-900/50 hover:bg-rose-950/50 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
                            title="Revoke Officer Authority"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )}

      {/* ======================================================== */}
      {/* 1. CREATE OFFICER MODAL                                  */}
      {/* ======================================================== */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-cyan-500/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-cyan-400" />
                Register New Government Officer
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Officer Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.officer_code}
                    onChange={(e) => setFormData({ ...formData, officer_code: e.target.value })}
                    placeholder="e.g. TG-OFF-007"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-cyan-400 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Superintendent of Police"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Jurisdiction / Division *
                </label>
                <input
                  type="text"
                  required
                  value={formData.jurisdiction}
                  onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                  placeholder="e.g. North Zone Regional Headquarters, New Delhi"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.official_email}
                    onChange={(e) => setFormData({ ...formData, official_email: e.target.value })}
                    placeholder="officer@agency.gov.in"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Official Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.official_phone}
                    onChange={(e) => setFormData({ ...formData, official_phone: e.target.value })}
                    placeholder="+91 99999 12345"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Initial Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ACTIVE">ACTIVE (Authorized on Duty)</option>
                  <option value="SUSPENDED">SUSPENDED (Temporarily Barred)</option>
                  <option value="REVOKED">REVOKED (Permanently Deauthorized)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  ) : null}
                  Register Official
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. EDIT OFFICER MODAL                                    */}
      {/* ======================================================== */}
      {isEditOpen && selectedOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-indigo-500/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-indigo-400" />
                Edit Officer: {selectedOfficer.officer_code}
              </h2>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Jurisdiction *
                </label>
                <input
                  type="text"
                  required
                  value={formData.jurisdiction}
                  onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Official Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.official_phone}
                  onChange={(e) => setFormData({ ...formData, official_phone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-indigo-400 hover:bg-indigo-300 transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  ) : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. OFFICER DETAILS DOSSIER MODAL                         */}
      {/* ======================================================== */}
      {isDetailsOpen && selectedOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-cyan-500/20 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold">
                  {selectedOfficer.officer_code.slice(-3)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedOfficer.full_name || 'Official Profile'}</h2>
                  <span className="text-xs font-mono text-cyan-400">{selectedOfficer.officer_code}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedOfficer.status)}
                <button onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Profile Core Attributes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-900 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 text-cyan-400" /> Department
                </span>
                <p className="text-sm font-semibold text-white">{selectedOfficer.department}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-900 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Award className="h-3 w-3 text-indigo-400" /> Designation
                </span>
                <p className="text-sm font-semibold text-white">{selectedOfficer.designation}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-900 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-emerald-400" /> Jurisdiction
                </span>
                <p className="text-sm text-slate-200">{selectedOfficer.jurisdiction}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-900 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-amber-400" /> Official Email
                </span>
                <p className="text-sm font-mono text-cyan-300 break-all">{selectedOfficer.official_email}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-900 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-slate-400" /> Official Phone
                </span>
                <p className="text-sm font-mono text-slate-300">{selectedOfficer.official_phone || 'Not registered'}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-900 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-slate-400" /> Registration Timestamp
                </span>
                <p className="text-xs text-slate-400">
                  {new Date(selectedOfficer.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* ======================================================== */}
            {/* Phase 3: Cryptographic Identity & DID Section            */}
            {/* ======================================================== */}
            <div className="rounded-xl border border-cyan-500/30 p-4 bg-slate-950/60 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <Fingerprint className="h-5 w-5 text-cyan-400" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      Decentralized Identifier (DID) & Cryptographic Identity
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
                        Phase 3
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Ed25519 Cryptographic Verification Key & Prototype DID (<code className="text-cyan-400">did:trustgov:&lt;uuid&gt;</code>)
                    </p>
                  </div>
                </div>

                <div>
                  {(selectedOfficer.did_identity?.did || selectedOfficer.did) ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                      <Check className="h-3 w-3" /> DID Already Issued
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40">
                      Not Issued Yet
                    </span>
                  )}
                </div>
              </div>

              {/* If DID is already issued */}
              {(selectedOfficer.did_identity?.did || selectedOfficer.did) ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* DID Value */}
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Decentralized Identifier (DID)
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedOfficer.did_identity?.did || selectedOfficer.did || '', 'did')}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                          title="Copy DID"
                        >
                          {copiedField === 'did' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copiedField === 'did' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs font-mono text-cyan-300 break-all select-all">
                        {selectedOfficer.did_identity?.did || selectedOfficer.did}
                      </p>
                    </div>

                    {/* Key Type & Identity Status */}
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Algorithm & Identity Status
                        </span>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-indigo-500/30">
                          {selectedOfficer.did_identity?.key_type || 'Ed25519'}
                        </span>
                        <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded uppercase ${
                          (selectedOfficer.did_identity?.status || selectedOfficer.status) === 'ACTIVE'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                            : (selectedOfficer.did_identity?.status || selectedOfficer.status) === 'SUSPENDED'
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-950/60 text-rose-400 border border-rose-500/20'
                        }`}>
                          {selectedOfficer.did_identity?.status || selectedOfficer.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Public Verification Key */}
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Key className="h-3 w-3 text-cyan-400" /> Public Verification Key (Ed25519 Multibase)
                      </span>
                      <button
                        onClick={() => copyToClipboard(selectedOfficer.did_identity?.public_key || selectedOfficer.public_key || '', 'publicKey')}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                        title="Copy Public Key"
                      >
                        {copiedField === 'publicKey' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copiedField === 'publicKey' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[11px] font-mono text-slate-300 break-all bg-slate-950/60 p-2 rounded border border-slate-900 select-all">
                      {selectedOfficer.did_identity?.public_key || selectedOfficer.public_key || 'N/A'}
                    </p>
                  </div>

                  {/* DID Document View Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDidDocument(!showDidDocument)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-xs text-slate-300 transition-colors"
                    >
                      <span className="flex items-center gap-2 font-mono">
                        <Code className="h-3.5 w-3.5 text-indigo-400" />
                        {showDidDocument ? 'Hide DID Document (W3C JSON)' : 'View DID Document (W3C JSON)'}
                      </span>
                      {showDidDocument ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {showDidDocument && (
                      <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-indigo-500/20 text-indigo-300 font-mono text-[11px] relative">
                        <button
                          onClick={() => copyToClipboard(
                            JSON.stringify(
                              selectedOfficer.did_identity?.didDocument || {
                                '@context': ['https://www.w3.org/ns/did/v1'],
                                id: selectedOfficer.did_identity?.did || selectedOfficer.did,
                                verificationMethod: [{
                                  id: `${selectedOfficer.did_identity?.did || selectedOfficer.did}#key-1`,
                                  type: 'Ed25519VerificationKey2020',
                                  controller: selectedOfficer.did_identity?.did || selectedOfficer.did,
                                  publicKeyMultibase: selectedOfficer.did_identity?.public_key || selectedOfficer.public_key
                                }],
                                authentication: [`${selectedOfficer.did_identity?.did || selectedOfficer.did}#key-1`],
                                status: selectedOfficer.did_identity?.status || selectedOfficer.status
                              },
                              null,
                              2
                            ),
                            'didDoc'
                          )}
                          className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-cyan-400 flex items-center gap-1"
                        >
                          {copiedField === 'didDoc' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copiedField === 'didDoc' ? 'Copied' : 'Copy JSON'}
                        </button>
                        <pre className="overflow-x-auto max-h-56">
                          {JSON.stringify(
                            selectedOfficer.did_identity?.didDocument || {
                              '@context': ['https://www.w3.org/ns/did/v1'],
                              id: selectedOfficer.did_identity?.did || selectedOfficer.did,
                              verificationMethod: [{
                                id: `${selectedOfficer.did_identity?.did || selectedOfficer.did}#key-1`,
                                type: 'Ed25519VerificationKey2020',
                                controller: selectedOfficer.did_identity?.did || selectedOfficer.did,
                                publicKeyMultibase: selectedOfficer.did_identity?.public_key || selectedOfficer.public_key
                              }],
                              authentication: [`${selectedOfficer.did_identity?.did || selectedOfficer.did}#key-1`],
                              status: selectedOfficer.did_identity?.status || selectedOfficer.status
                            },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* If DID has not been issued yet */
                <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-center space-y-3">
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    This officer does not have an issued Decentralized Identifier (DID). Minting a DID generates a unique cryptographic Ed25519 verification key and creates a verifiable digital identity.
                  </p>

                  {didIssueError && (
                    <div className="p-2.5 rounded bg-rose-950/60 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>{didIssueError}</span>
                    </div>
                  )}

                  {selectedOfficer.status === 'REVOKED' ? (
                    <div className="p-2.5 rounded bg-rose-950/40 border border-rose-500/20 text-rose-300 text-xs">
                      Notice: DIDs cannot be issued for revoked officers.
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={issuingDID}
                      onClick={() => handleIssueDID(selectedOfficer.id)}
                      className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 transition-all shadow-lg shadow-cyan-500/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {issuingDID ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                      ) : (
                        <Key className="h-3.5 w-3.5" />
                      )}
                      {issuingDID ? 'Generating Cryptographic Identity...' : 'Issue DID for Officer'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* Phase 4: Verifiable Credential (VC) Section              */}
            {/* ======================================================== */}
            <div className="rounded-xl border border-indigo-500/30 p-4 bg-slate-950/60 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-indigo-400" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      Verifiable Credential (VC) & Cryptographic Proof
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
                        Phase 4
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      W3C Standard Verifiable Credential digitally signed with Ed25519 by National Issuance Authority
                    </p>
                  </div>
                </div>

                <div>
                  {selectedOfficer.verifiable_credential ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      selectedOfficer.verifiable_credential.status === 'ACTIVE'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        : selectedOfficer.verifiable_credential.status === 'SUSPENDED'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                        : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                    }`}>
                      <Check className="h-3 w-3" /> {selectedOfficer.verifiable_credential.status}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
                      No Active Credential
                    </span>
                  )}
                </div>
              </div>

              {/* If Verifiable Credential exists */}
              {selectedOfficer.verifiable_credential ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Credential ID */}
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Credential Identifier
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedOfficer.verifiable_credential?.credentialId || '', 'credId')}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                          title="Copy Credential ID"
                        >
                          {copiedField === 'credId' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copiedField === 'credId' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs font-mono text-indigo-300 break-all select-all font-semibold">
                        {selectedOfficer.verifiable_credential.credentialId}
                      </p>
                    </div>

                    {/* Issuer DID */}
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Issuer Authority DID
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedOfficer.verifiable_credential?.issuerDid || '', 'issuerDid')}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                          title="Copy Issuer DID"
                        >
                          {copiedField === 'issuerDid' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copiedField === 'issuerDid' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs font-mono text-cyan-300 break-all select-all">
                        {selectedOfficer.verifiable_credential.issuerDid}
                      </p>
                    </div>
                  </div>

                  {/* Validity Window */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Valid From
                      </span>
                      <p className="text-xs font-mono text-slate-300">
                        {new Date(selectedOfficer.verifiable_credential.validFrom).toLocaleString()}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Valid Until (Expiration)
                      </span>
                      <p className="text-xs font-mono text-slate-300">
                        {new Date(selectedOfficer.verifiable_credential.validUntil).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons: Cryptographic Verify + Lifecycle Status Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900">
                    <button
                      type="button"
                      disabled={verifyingVc}
                      onClick={() => handleVerifyCredential(selectedOfficer.verifiable_credential!.credentialId)}
                      className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Cryptographically Verify Credential
                    </button>

                    {/* Status Management */}
                    <div className="flex items-center gap-2">
                      {selectedOfficer.verifiable_credential.status === 'ACTIVE' && (
                        <button
                          type="button"
                          disabled={updatingVcStatus}
                          onClick={() => handleUpdateCredentialStatus(selectedOfficer.verifiable_credential!.id, 'SUSPENDED')}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/30 hover:bg-amber-900/60 transition-colors cursor-pointer"
                        >
                          Suspend Credential
                        </button>
                      )}

                      {selectedOfficer.verifiable_credential.status === 'SUSPENDED' && (
                        <button
                          type="button"
                          disabled={updatingVcStatus || selectedOfficer.status !== 'ACTIVE'}
                          onClick={() => handleUpdateCredentialStatus(selectedOfficer.verifiable_credential!.id, 'ACTIVE')}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 hover:bg-emerald-900/60 transition-colors cursor-pointer disabled:opacity-50"
                          title={selectedOfficer.status !== 'ACTIVE' ? 'Cannot activate credential while officer is not ACTIVE' : 'Reactivate Credential'}
                        >
                          Reactivate Credential
                        </button>
                      )}

                      {selectedOfficer.verifiable_credential.status !== 'REVOKED' && (
                        <button
                          type="button"
                          disabled={updatingVcStatus}
                          onClick={() => handleUpdateCredentialStatus(selectedOfficer.verifiable_credential!.id, 'REVOKED')}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-rose-300 bg-rose-950/60 border border-rose-500/30 hover:bg-rose-900/60 transition-colors cursor-pointer"
                        >
                          Revoke Permanently
                        </button>
                      )}
                    </div>
                  </div>

                  {/* VC Document View Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowVcDocument(!showVcDocument)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-xs text-slate-300 transition-colors"
                    >
                      <span className="flex items-center gap-2 font-mono">
                        <Code className="h-3.5 w-3.5 text-indigo-400" />
                        {showVcDocument ? 'Hide Verifiable Credential (W3C JSON)' : 'View Verifiable Credential (W3C JSON)'}
                      </span>
                      {showVcDocument ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {showVcDocument && (
                      <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-indigo-500/20 text-indigo-300 font-mono text-[11px] relative">
                        <button
                          onClick={() => copyToClipboard(
                            JSON.stringify(selectedOfficer.verifiable_credential?.credential, null, 2),
                            'vcDoc'
                          )}
                          className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-cyan-400 flex items-center gap-1"
                        >
                          {copiedField === 'vcDoc' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copiedField === 'vcDoc' ? 'Copied' : 'Copy JSON'}
                        </button>
                        <pre className="overflow-x-auto max-h-56">
                          {JSON.stringify(selectedOfficer.verifiable_credential?.credential, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* If Verifiable Credential does not exist */
                <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-center space-y-3">
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    This officer does not have an active Verifiable Credential. Generating a credential creates an Ed25519 cryptographic attestation of the officer's authority signed by the TrustGov National Issuance Authority.
                  </p>

                  {vcIssueError && (
                    <div className="p-2.5 rounded bg-rose-950/60 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>{vcIssueError}</span>
                    </div>
                  )}

                  {selectedOfficer.status === 'REVOKED' ? (
                    <div className="p-2.5 rounded bg-rose-950/40 border border-rose-500/20 text-rose-300 text-xs">
                      Notice: Verifiable Credentials cannot be issued for revoked officers.
                    </div>
                  ) : !(selectedOfficer.did_identity?.did || selectedOfficer.did) ? (
                    <div className="p-2.5 rounded bg-amber-950/40 border border-amber-500/20 text-amber-300 text-xs">
                      Prerequisite Required: A Decentralized Identifier (DID) must be issued before generating a Verifiable Credential.
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-400 font-semibold uppercase">Validity:</label>
                        <select
                          value={vcValidityDays}
                          onChange={(e) => setVcValidityDays(Number(e.target.value))}
                          className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value={90}>90 Days</option>
                          <option value={180}>180 Days</option>
                          <option value={365}>1 Year (365 Days)</option>
                          <option value={730}>2 Years (730 Days)</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        disabled={issuingVC}
                        onClick={() => handleIssueVC(selectedOfficer.id)}
                        className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {issuingVC ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <FileCheck className="h-3.5 w-3.5" />
                        )}
                        {issuingVC ? 'Signing Verifiable Credential...' : 'Issue Verifiable Credential'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* Phase 5: Blockchain Registry & Integrity Anchoring       */}
            {/* ======================================================== */}
            <div className="rounded-xl border border-emerald-500/30 p-4 bg-slate-950/60 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      Blockchain Registry & Integrity Anchoring
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
                        Phase 5
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Immutable on-chain integrity anchor (TrustGovRegistry smart contract on local EVM network)
                    </p>
                  </div>
                </div>

                <div>
                  {selectedOfficer.blockchain_anchor ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                      <Check className="h-3 w-3" /> Anchored on Blockchain
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
                      Not Anchored
                    </span>
                  )}
                </div>
              </div>

              {selectedOfficer.blockchain_anchor ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Transaction Hash */}
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Transaction Hash
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedOfficer.blockchain_anchor!.txHash, 'txHash')}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                          title="Copy Tx Hash"
                        >
                          {copiedField === 'txHash' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copiedField === 'txHash' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs font-mono text-emerald-300 break-all select-all font-semibold">
                        {selectedOfficer.blockchain_anchor.txHash}
                      </p>
                    </div>

                    {/* Credential Hash */}
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          RFC 8785 Canonical SHA-256 Hash
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedOfficer.blockchain_anchor!.credentialHash, 'credHash')}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                          title="Copy Credential Hash"
                        >
                          {copiedField === 'credHash' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copiedField === 'credHash' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs font-mono text-cyan-300 break-all select-all">
                        {selectedOfficer.blockchain_anchor.credentialHash}
                      </p>
                    </div>
                  </div>

                  {/* On-Chain Metadata Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Block Number</span>
                      <span className="text-xs font-mono text-white font-semibold">#{selectedOfficer.blockchain_anchor.blockNumber}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Chain ID</span>
                      <span className="text-xs font-mono text-indigo-300 font-semibold">{selectedOfficer.blockchain_anchor.chainId} (Local)</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">On-Chain Status</span>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase mt-0.5 ${
                        selectedOfficer.blockchain_anchor.status === 'ACTIVE'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                          : selectedOfficer.blockchain_anchor.status === 'SUSPENDED'
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-950/60 text-rose-400 border border-rose-500/20'
                      }`}>
                        {selectedOfficer.blockchain_anchor.status}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Anchored At</span>
                      <span className="text-[10px] font-mono text-slate-300">{new Date(selectedOfficer.blockchain_anchor.anchoredAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Contract Address */}
                  <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Contract Address</span>
                      <span className="text-xs font-mono text-slate-300 select-all">{selectedOfficer.blockchain_anchor.contractAddress}</span>
                    </div>
                    <button
                      type="button"
                      disabled={verifyingBlockchain}
                      onClick={() => handleVerifyBlockchainIntegrity(selectedOfficer.verifiable_credential!.credentialId)}
                      className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Verify Blockchain Integrity
                    </button>
                  </div>
                </div>
              ) : (
                /* If not yet anchored to blockchain */
                <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-center space-y-3">
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Anchoring registers the RFC 8785 canonical cryptographic hash of this officer's Verifiable Credential on the TrustGovRegistry smart contract, providing tamper-proof mathematical evidence of legitimacy.
                  </p>

                  {blockchainAnchorError && (
                    <div className="p-2.5 rounded bg-rose-950/60 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>{blockchainAnchorError}</span>
                    </div>
                  )}

                  {!selectedOfficer.verifiable_credential ? (
                    <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
                      Prerequisite Required: A Verifiable Credential must be issued before anchoring to the blockchain.
                    </div>
                  ) : selectedOfficer.verifiable_credential.status === 'REVOKED' ? (
                    <div className="p-2.5 rounded bg-rose-950/40 border border-rose-500/20 text-rose-300 text-xs">
                      Notice: Revoked credentials cannot be newly anchored to the blockchain.
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={anchoringBlockchain}
                      onClick={() => handleAnchorToBlockchain(selectedOfficer.verifiable_credential!.credentialId)}
                      className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {anchoringBlockchain ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                      ) : (
                        <Database className="h-3.5 w-3.5" />
                      )}
                      {anchoringBlockchain ? 'Submitting to Blockchain...' : 'Anchor Credential to Blockchain'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. STATUS CHANGE CONFIRMATION DIALOG                     */}
      {/* ======================================================== */}
      {confirmDialog.isOpen && confirmDialog.officer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-800 space-y-5">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                confirmDialog.targetStatus === 'ACTIVE'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                  : confirmDialog.targetStatus === 'SUSPENDED'
                  ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-950 text-rose-400 border border-rose-500/30'
              }`}>
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirm {confirmDialog.actionLabel} Action
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Officer: {confirmDialog.officer.officer_code}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to change the status of{' '}
              <strong className="text-white">{confirmDialog.officer.full_name || confirmDialog.officer.officer_code}</strong> to{' '}
              <strong className={
                confirmDialog.targetStatus === 'ACTIVE'
                  ? 'text-emerald-400'
                  : confirmDialog.targetStatus === 'SUSPENDED'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }>
                {confirmDialog.targetStatus}
              </strong>?
              {confirmDialog.targetStatus !== 'ACTIVE' && (
                <span className="block mt-2 text-rose-300 bg-rose-950/30 p-2 rounded border border-rose-500/20">
                  Notice: The officer will be immediately barred from performing protected officer operations.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-900">
              <button
                type="button"
                onClick={() => setConfirmDialog({ isOpen: false, officer: null, targetStatus: null, actionLabel: '' })}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleExecuteStatusChange}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                  confirmDialog.targetStatus === 'ACTIVE'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : confirmDialog.targetStatus === 'SUSPENDED'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {submitting ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                Confirm {confirmDialog.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. VERIFIABLE CREDENTIAL CRYPTOGRAPHIC VERIFICATION MODAL */}
      {/* ======================================================== */}
      {isVcVerifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-indigo-500/30 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-950 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Cryptographic Credential Verification</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Ed25519 Signature & W3C Verifiable Credential Validation
                  </p>
                </div>
              </div>
              <button onClick={() => setIsVcVerifyModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {verifyingVc ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                <span className="text-xs text-slate-400 font-mono">Verifying Ed25519 signature & checking revocation registry...</span>
              </div>
            ) : vcVerificationResult ? (
              <div className="space-y-4">
                {/* Overall Status Banner */}
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                  vcVerificationResult.valid
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}>
                  {vcVerificationResult.valid ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold">
                      {vcVerificationResult.valid ? 'CREDENTIAL IS AUTHENTIC & VALID' : 'CREDENTIAL VERIFICATION FAILED'}
                    </h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      {vcVerificationResult.valid
                        ? 'Digital signature is intact. The credential was authentically issued by the National Issuance Authority and is currently active.'
                        : `Reason: ${vcVerificationResult.reason || 'Cryptographic signature mismatch or invalid status'}`}
                    </p>
                  </div>
                </div>

                {/* Validation Checklist Matrix */}
                <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-4 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Cryptographic Integrity Checklist
                  </span>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-900">
                      <span className="text-slate-300">Ed25519 Cryptographic Signature</span>
                      <span className={`font-mono font-bold flex items-center gap-1 ${vcVerificationResult.signatureValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {vcVerificationResult.signatureValid ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {vcVerificationResult.signatureValid ? 'VALID (UNALTERED)' : 'TAMPERED / INVALID'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-900">
                      <span className="text-slate-300">National Issuer Authority DID</span>
                      <span className={`font-mono font-bold flex items-center gap-1 ${vcVerificationResult.issuerValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {vcVerificationResult.issuerValid ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {vcVerificationResult.issuerValid ? 'AUTHENTIC' : 'UNAUTHORIZED'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-900">
                      <span className="text-slate-300">Subject Officer DID Match</span>
                      <span className={`font-mono font-bold flex items-center gap-1 ${vcVerificationResult.subjectValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {vcVerificationResult.subjectValid ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {vcVerificationResult.subjectValid ? 'MATCHES' : 'MISMATCH'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-900">
                      <span className="text-slate-300">Credential Lifecycle Status</span>
                      <span className={`font-mono font-bold uppercase ${
                        vcVerificationResult.status === 'ACTIVE'
                          ? 'text-emerald-400'
                          : vcVerificationResult.status === 'SUSPENDED'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {vcVerificationResult.status || 'UNKNOWN'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-900">
                      <span className="text-slate-300">Validity Period</span>
                      <span className={`font-mono font-bold ${vcVerificationResult.notExpired ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {vcVerificationResult.notExpired ? 'IN DATE' : 'EXPIRED'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-300">Linked Officer Duty Status</span>
                      <span className={`font-mono font-bold ${vcVerificationResult.officerStatusValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {vcVerificationResult.officerStatusValid ? 'ACTIVE DUTY' : 'SUSPENDED / REVOKED'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Verified Claims */}
                {vcVerificationResult.officer && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">
                      Attested Claims
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Officer Name</span>
                        <span className="text-white font-semibold">{vcVerificationResult.officer.fullName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Officer Code</span>
                        <span className="text-cyan-400 font-mono">{vcVerificationResult.officer.officerCode}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Department</span>
                        <span className="text-slate-300">{vcVerificationResult.officer.department}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Designation</span>
                        <span className="text-slate-300">{vcVerificationResult.officer.designation}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-slate-500 text-right font-mono">
                  Verified at: {vcVerificationResult.verifiedAt ? new Date(vcVerificationResult.verifiedAt).toLocaleString() : 'N/A'}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-slate-900">
              <button
                onClick={() => setIsVcVerifyModalOpen(false)}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
              >
                Close Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. BLOCKCHAIN INTEGRITY VERIFICATION MODAL                */}
      {/* ======================================================== */}
      {isBcVerifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-emerald-500/30 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Blockchain Integrity Verification</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    TrustGovRegistry Smart Contract On-Chain Anchor & Canonical RFC 8785 Hash Audit
                  </p>
                </div>
              </div>
              <button onClick={() => setIsBcVerifyModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {verifyingBlockchain ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <span className="text-xs text-slate-400 font-mono">Querying TrustGovRegistry smart contract on blockchain...</span>
              </div>
            ) : bcVerificationResult ? (
              <div className="space-y-4">
                {/* Overall Status Banner */}
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                  bcVerificationResult.valid && bcVerificationResult.anchored
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}>
                  {bcVerificationResult.valid && bcVerificationResult.anchored ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold">
                      {bcVerificationResult.valid && bcVerificationResult.anchored
                        ? 'BLOCKCHAIN INTEGRITY VERIFIED (TAMPER-PROOF)'
                        : 'BLOCKCHAIN INTEGRITY CHECK FAILED'}
                    </h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      {bcVerificationResult.valid && bcVerificationResult.anchored
                        ? 'The canonical RFC 8785 credential hash exactly matches the on-chain registry entry. No data alteration has occurred.'
                        : `Verification failed: ${bcVerificationResult.reason || 'Cryptographic hash mismatch or not anchored'}`}
                    </p>
                  </div>
                </div>

                {/* Validation Checklist Matrix */}
                <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-4 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Blockchain Security Checklist
                  </span>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-900">
                      <span className="text-slate-300">Smart Contract Anchor Status</span>
                      <span className={`font-mono font-bold flex items-center gap-1 ${bcVerificationResult.anchored ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {bcVerificationResult.anchored ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {bcVerificationResult.anchored ? 'ANCHORED ON-CHAIN' : 'NOT ANCHORED'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-900">
                      <span className="text-slate-300">RFC 8785 Canonical Hash Match</span>
                      <span className={`font-mono font-bold flex items-center gap-1 ${bcVerificationResult.hashMatch ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {bcVerificationResult.hashMatch ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {bcVerificationResult.hashMatch ? 'IDENTICAL (100% INTEGRITY)' : 'TAMPER DETECTED'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-900">
                      <span className="text-slate-300">On-Chain Status</span>
                      <span className={`font-mono font-bold uppercase ${
                        bcVerificationResult.onChainStatus === 'ACTIVE'
                          ? 'text-emerald-400'
                          : bcVerificationResult.onChainStatus === 'SUSPENDED'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {bcVerificationResult.onChainStatus || 'NONE'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-900">
                      <span className="text-slate-300">Smart Contract Address</span>
                      <span className="font-mono text-slate-300 text-[11px]">
                        {bcVerificationResult.contractAddress ? `${bcVerificationResult.contractAddress.slice(0, 10)}...${bcVerificationResult.contractAddress.slice(-8)}` : 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-300">Network & Chain ID</span>
                      <span className="font-mono text-indigo-300 font-bold">
                        {bcVerificationResult.chainId ? `Chain ID: ${bcVerificationResult.chainId} (Local Hardhat)` : 'Local EVM'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hashes Detail */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                    Cryptographic Hashes
                  </span>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Computed Credential Hash</span>
                      <span className="text-emerald-300 text-[11px] break-all select-all">{bcVerificationResult.computedHash}</span>
                    </div>
                    {bcVerificationResult.anchoredHash && (
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">On-Chain Registered Hash</span>
                        <span className="text-cyan-300 text-[11px] break-all select-all">{bcVerificationResult.anchoredHash}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 text-right font-mono">
                  Verified at: {bcVerificationResult.verifiedAt ? new Date(bcVerificationResult.verifiedAt).toLocaleString() : 'N/A'}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-slate-900">
              <button
                onClick={() => setIsBcVerifyModalOpen(false)}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
              >
                Close Verification
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OfficerManagement;
