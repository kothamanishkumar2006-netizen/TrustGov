import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  AlertOctagon,
  Search,
  ShieldAlert,
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Paperclip,
  Eye,
  FileText,
  ArrowRight,
  Shield,
  MessageSquare,
  Plus,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';

interface ReportEvidenceItem {
  id: string;
  evidenceId: string;
  reportId: string;
  evidenceType: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  storageReference: string;
  description?: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface ReviewNoteItem {
  id: string;
  reportId: string;
  noteId: string;
  reviewerId: string;
  reviewerName: string;
  note: string;
  createdAt: string;
}

interface ReportItem {
  id: string;
  reportId: string;
  citizenId: string;
  officerReference?: string;
  officerName?: string;
  department?: string;
  verificationReference?: string;
  authorizationEvaluationReference?: string;
  reportCategory: string;
  description: string;
  reportedActionCode?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ADDITIONAL_INFORMATION_REQUIRED' | 'RESOLVED' | 'CLOSED';
  submittedAt: string;
  updatedAt: string;
  resolvedAt?: string;
  evidenceCount?: number;
  evidence?: ReportEvidenceItem[];
  reviewNotes?: ReviewNoteItem[];
}

const ReportManagement: React.FC = () => {
  const { token } = useAuth();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  // Selected report for review modal
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<ReportEvidenceItem[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<ReviewNoteItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Status transition state
  const [newStatus, setNewStatus] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // New review note state
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Evidence integrity check results: evidenceId -> { checking, valid, calculatedHash, error }
  const [integrityState, setIntegrityState] = useState<Record<string, { checking: boolean; valid?: boolean; hash?: string; mismatch?: boolean }>>({});
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (riskFilter) params.riskLevel = riskFilter;
      if (search.trim()) params.search = search.trim();

      const res = await axios.get('/api/admin/reports', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (res.data.success) {
        setReports(res.data.data.reports || []);
      }
    } catch (err: any) {
      console.error('Error fetching admin reports:', err);
      setError(err.response?.data?.error?.message || 'Failed to load scam reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchReports();
    }
  }, [token, statusFilter, categoryFilter, riskFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReports();
  };

  const openReportDetail = async (report: ReportItem) => {
    setSelectedReport(report);
    setNewStatus('');
    setNewNoteText('');
    setIntegrityState({});
    try {
      setDetailLoading(true);
      const res = await axios.get(`/api/admin/reports/${report.reportId || report.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        const fullReport = res.data.data.report;
        setSelectedReport(fullReport);
        setSelectedEvidence(fullReport.evidence || []);
        setSelectedNotes(fullReport.reviewNotes || []);
      }
    } catch (err: any) {
      console.error('Failed to load report detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedReport || !newStatus) return;
    try {
      setUpdatingStatus(true);
      const res = await axios.patch(
        `/api/admin/reports/${selectedReport.reportId || selectedReport.id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        const updated = res.data.data.report;
        setSelectedReport(prev => prev ? { ...prev, status: updated.status, updatedAt: updated.updatedAt, resolvedAt: updated.resolvedAt } : null);
        setReports(prev => prev.map(r => r.id === updated.id ? { ...r, status: updated.status, updatedAt: updated.updatedAt } : r));
        setSuccessMsg(`Report status updated to ${updated.status}`);
        setNewStatus('');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update report status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport || !newNoteText.trim()) return;
    try {
      setAddingNote(true);
      const res = await axios.post(
        `/api/admin/reports/${selectedReport.reportId || selectedReport.id}/notes`,
        { note: newNoteText.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        const note = res.data.data.note;
        setSelectedNotes(prev => [...prev, note]);
        setNewNoteText('');
        setSuccessMsg('Internal administrative note recorded.');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to record note.');
    } finally {
      setAddingNote(false);
    }
  };

  const verifyEvidenceFileIntegrity = async (evidenceId: string) => {
    if (!selectedReport) return;
    setIntegrityState(prev => ({
      ...prev,
      [evidenceId]: { checking: true }
    }));

    try {
      const res = await axios.get(
        `/api/admin/reports/${selectedReport.reportId || selectedReport.id}/evidence/${evidenceId}/integrity`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        const data = res.data.data;
        const valid = data.integrity === 'VALID';
        setIntegrityState(prev => ({
          ...prev,
          [evidenceId]: {
            checking: false,
            valid,
            hash: data.calculatedHash,
            mismatch: !valid
          }
        }));
      }
    } catch (err: any) {
      setIntegrityState(prev => ({
        ...prev,
        [evidenceId]: { checking: false, valid: false, mismatch: true }
      }));
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Metrics
  const totalCount = reports.length;
  const underReviewCount = reports.filter(r => r.status === 'UNDER_REVIEW').length;
  const highCriticalCount = reports.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;
  const resolvedCount = reports.filter(r => r.status === 'RESOLVED' || r.status === 'CLOSED').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Submitted</span>;
      case 'UNDER_REVIEW':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">Under Review</span>;
      case 'ADDITIONAL_INFORMATION_REQUIRED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">Info Required</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Resolved</span>;
      case 'CLOSED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">Closed</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-700 text-slate-300">{status}</span>;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Critical</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">High</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">Medium</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-500/20 text-slate-300 border border-slate-700">Low</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-400">Unknown</span>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Legal Notice */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Scam & Suspicious Interaction Reports</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized registry for citizen-reported suspicious demands, impersonations, and cryptographically verified evidence.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchReports}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-400 text-xs font-medium transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Registry
        </button>
      </div>

      {/* Legal & Prototype Disclaimer Banner */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
        <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">Demonstration Anti-Impersonation Incident Management</p>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            TrustGov records and preserves citizen-submitted reports and cryptographically validates attached evidence hashes. This system is a proof-of-concept identity assurance safeguard and does <strong className="text-slate-300">not</strong> replace an official police First Information Report (FIR) or statutory legal proceeding.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Reports</span>
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{totalCount}</p>
          <span className="text-[10px] text-slate-500">All registered incidents</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Under Review</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-sky-400 mt-2">{underReviewCount}</p>
          <span className="text-[10px] text-slate-500">Active investigations</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">High / Critical Risk</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-2">{highCriticalCount}</p>
          <span className="text-[10px] text-slate-500">Requires urgent attention</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Resolved / Closed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{resolvedCount}</p>
          <span className="text-[10px] text-slate-500">Concluded cases</span>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Report ID (TG-REPORT-...), Officer reference, or keywords..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="ADDITIONAL_INFORMATION_REQUIRED">Info Required</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">All Categories</option>
              <option value="PAYMENT_DEMAND">Payment Demand</option>
              <option value="OTP_REQUEST">OTP / 2FA</option>
              <option value="PIN_REQUEST">PIN Request</option>
              <option value="PASSWORD_REQUEST">Password Request</option>
              <option value="REMOTE_ACCESS_REQUEST">Remote Access</option>
              <option value="IMPERSONATION">Impersonation</option>
              <option value="THREAT_OR_COERCION">Threat / Coercion</option>
              <option value="SUSPICIOUS_DOCUMENT">Suspicious Document</option>
              <option value="SUSPICIOUS_COMMUNICATION">Suspicious Call/Msg</option>
              <option value="IDENTITY_MISMATCH">Identity Mismatch</option>
              <option value="UNAUTHORIZED_REQUEST">Unauthorized Request</option>
              <option value="OTHER">Other</option>
            </select>

            <select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">All Risk Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-cyan-900/20"
            >
              Apply Filter
            </button>

            {(search || statusFilter || riskFilter) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setStatusFilter(''); setRiskFilter(''); }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Reports Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Report Reference</th>
                <th className="py-3 px-4 font-semibold">Reported Entity</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Risk Level</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Evidence</th>
                <th className="py-3 px-4 font-semibold">Date Submitted</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Loading reports...</span>
                    </div>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No suspicious interaction reports found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                reports.map(report => (
                  <tr key={report.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-cyan-400">
                      {report.reportId}
                    </td>
                    <td className="py-3.5 px-4">
                      {report.officerReference ? (
                        <div>
                          <span className="font-semibold text-white">{report.officerName || report.officerReference}</span>
                          <span className="block text-[11px] text-slate-400 font-mono">{report.officerReference}</span>
                          {report.department && <span className="block text-[10px] text-slate-500">{report.department}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Unidentified / External Caller</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <span className="inline-block max-w-[150px] truncate" title={report.reportCategory}>
                        {report.reportCategory.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {getRiskBadge(report.riskLevel)}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Paperclip className="w-3 h-3" />
                        {report.evidenceCount !== undefined ? report.evidenceCount : (report.evidence?.length || 0)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(report.submittedAt || report.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openReportDetail(report)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-950 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/30 text-slate-300 text-xs font-medium transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Review & Investigation Drawer / Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-500/30 text-cyan-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white font-mono">{selectedReport.reportId}</h2>
                    {getStatusBadge(selectedReport.status)}
                    {getRiskBadge(selectedReport.riskLevel)}
                  </div>
                  <p className="text-xs text-slate-400">Submitted on {new Date(selectedReport.submittedAt).toLocaleString()}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {detailLoading ? (
                <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading full report data and evidence records...</span>
                </div>
              ) : (
                <>
                  {/* Status Lifecycle Controls */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <span className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
                      Administrative Status Lifecycle
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-slate-400 text-xs">Current State: <strong className="text-white">{selectedReport.status}</strong></span>
                      <ArrowRight className="w-4 h-4 text-slate-600" />

                      <select
                        value={newStatus}
                        onChange={e => setNewStatus(e.target.value)}
                        className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">Select Next Status...</option>
                        {selectedReport.status === 'SUBMITTED' && (
                          <option value="UNDER_REVIEW">Move to UNDER_REVIEW</option>
                        )}
                        {selectedReport.status === 'UNDER_REVIEW' && (
                          <>
                            <option value="ADDITIONAL_INFORMATION_REQUIRED">Request Additional Information</option>
                            <option value="RESOLVED">Mark as RESOLVED</option>
                            <option value="CLOSED">Mark as CLOSED</option>
                          </>
                        )}
                        {selectedReport.status === 'ADDITIONAL_INFORMATION_REQUIRED' && (
                          <option value="UNDER_REVIEW">Resume Review (UNDER_REVIEW)</option>
                        )}
                        {selectedReport.status === 'RESOLVED' && (
                          <option value="CLOSED">Close Incident Record (CLOSED)</option>
                        )}
                      </select>

                      <button
                        onClick={handleStatusUpdate}
                        disabled={!newStatus || updatingStatus}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all"
                      >
                        {updatingStatus ? 'Updating...' : 'Update Status'}
                      </button>
                    </div>
                  </div>

                  {/* Incident Summary Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <span className="text-slate-400 font-semibold block">Incident Categorization</span>
                      <div className="space-y-1 text-slate-300">
                        <p><span className="text-slate-500">Category:</span> <strong className="text-cyan-400">{selectedReport.reportCategory}</strong></p>
                        <p><span className="text-slate-500">Reported Action:</span> {selectedReport.reportedActionCode || 'None specified'}</p>
                        <p><span className="text-slate-500">Assessed Risk:</span> {selectedReport.riskLevel}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <span className="text-slate-400 font-semibold block">Claimed Identity & Verification Links</span>
                      <div className="space-y-1 text-slate-300">
                        <p><span className="text-slate-500">Officer Reference:</span> {selectedReport.officerReference || 'Unclaimed / Unknown'}</p>
                        <p><span className="text-slate-500">Linked Verification:</span> {selectedReport.verificationReference ? <span className="font-mono text-cyan-400">{selectedReport.verificationReference}</span> : 'None'}</p>
                        <p><span className="text-slate-500">Linked Safety Eval:</span> {selectedReport.authorizationEvaluationReference ? <span className="font-mono text-cyan-400">{selectedReport.authorizationEvaluationReference}</span> : 'None'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Citizen Description */}
                  <div className="space-y-2">
                    <span className="font-semibold text-slate-300 block">Citizen Description of Interaction:</span>
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs">
                      {selectedReport.description}
                    </div>
                  </div>

                  {/* Attached Evidence & Real-Time SHA-256 Integrity Engine */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300 flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-cyan-400" />
                        Cryptographic Evidence Files ({selectedEvidence.length})
                      </span>
                      <span className="text-[11px] text-slate-500">Stored Off-Chain with SHA-256 Digest</span>
                    </div>

                    {selectedEvidence.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-slate-500">
                        No supporting evidence files were submitted with this report.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedEvidence.map(ev => {
                          const state = integrityState[ev.evidenceId];
                          return (
                            <div key={ev.id || ev.evidenceId} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-cyan-400">{ev.evidenceId}</span>
                                  <span className="text-white font-medium truncate max-w-xs">{ev.originalFilename}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 uppercase">{ev.mimeType}</span>
                                  <span className="text-[11px] text-slate-500">({formatFileSize(ev.fileSize)})</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                  <span>SHA-256:</span>
                                  <span className="font-mono text-[10px] text-slate-500 truncate max-w-xs">{ev.sha256Hash}</span>
                                  <button
                                    onClick={() => copyToClipboard(ev.sha256Hash, ev.evidenceId)}
                                    className="text-slate-500 hover:text-cyan-400"
                                    title="Copy SHA-256 Digest"
                                  >
                                    {copiedHash === ev.evidenceId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {state?.checking ? (
                                  <span className="text-xs text-cyan-400 flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin" /> Verifying...
                                  </span>
                                ) : state?.valid ? (
                                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> SHA-256 Valid
                                  </span>
                                ) : state?.mismatch ? (
                                  <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Tamper Detected
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => verifyEvidenceFileIntegrity(ev.evidenceId)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-950 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/30 text-slate-300 text-xs font-semibold transition-all flex items-center gap-1"
                                  >
                                    <FileCheck2 className="w-3.5 h-3.5" /> Verify Integrity
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Internal Admin Review Notes */}
                  <div className="space-y-3 pt-2">
                    <span className="font-semibold text-slate-300 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-cyan-400" />
                      Internal Review Notes ({selectedNotes.length})
                    </span>

                    {/* Timeline of existing notes */}
                    <div className="space-y-2">
                      {selectedNotes.length === 0 ? (
                        <p className="text-slate-500 italic text-[11px]">No internal review notes recorded yet.</p>
                      ) : (
                        selectedNotes.map(n => (
                          <div key={n.id || n.noteId} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-cyan-400">{n.reviewerName || 'Admin Reviewer'}</span>
                              <span className="text-slate-500">{new Date(n.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-300 text-xs leading-relaxed">{n.note}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add new note form */}
                    <form onSubmit={handleAddNote} className="space-y-2 pt-2">
                      <textarea
                        rows={2}
                        placeholder="Add confidential internal administrative note..."
                        value={newNoteText}
                        onChange={e => setNewNoteText(e.target.value)}
                        className="w-full p-3 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!newNoteText.trim() || addingNote}
                          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {addingNote ? 'Saving...' : 'Add Note'}
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Tenant isolation guaranteed: Internal notes are strictly shielded from citizens.
              </span>
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportManagement;
