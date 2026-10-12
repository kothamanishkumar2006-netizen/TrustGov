import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  X,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Paperclip,
  Copy,
  Check,
  RefreshCw,
  Shield
} from 'lucide-react';

export interface CitizenReportDetailItem {
  id: string;
  reportId: string;
  citizenId?: string;
  officerReference?: string;
  officerName?: string;
  department?: string;
  verificationReference?: string;
  authorizationEvaluationReference?: string;
  reportCategory: string;
  description: string;
  reportedActionCode?: string;
  riskLevel: string;
  status: string;
  submittedAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  evidence?: {
    id: string;
    evidenceId: string;
    evidenceType: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    sha256Hash: string;
    storageReference?: string;
    description?: string;
    uploadedAt: string;
  }[];
}

interface CitizenReportDetailModalProps {
  report: CitizenReportDetailItem | null;
  onClose: () => void;
}

export const CitizenReportDetailModal: React.FC<CitizenReportDetailModalProps> = ({
  report: initialReport,
  onClose
}) => {
  const { token } = useAuth();
  const [report, setReport] = useState<CitizenReportDetailItem | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const [integrityState, setIntegrityState] = useState<Record<string, { checking: boolean; valid?: boolean; mismatch?: boolean; hash?: string }>>({});
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedReportId, setCopiedReportId] = useState(false);

  useEffect(() => {
    setReport(initialReport);
    setIntegrityState({});
    if (initialReport && token) {
      // Fetch full details with evidence
      fetchFullReport(initialReport.reportId || initialReport.id);
    }
  }, [initialReport, token]);

  if (!initialReport) return null;

  const fetchFullReport = async (reportId: string) => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/citizen/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setReport(res.data.data.report);
      }
    } catch (err) {
      console.error('Failed to load full report details:', err);
    } finally {
      setLoading(false);
    }
  };

  const verifyIntegrity = async (evidenceId: string) => {
    if (!report) return;
    setIntegrityState(prev => ({
      ...prev,
      [evidenceId]: { checking: true }
    }));

    try {
      const res = await axios.get(
        `/api/citizen/reports/${report.reportId || report.id}/evidence/${evidenceId}/integrity`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        const valid = res.data.data.integrity === 'VALID';
        setIntegrityState(prev => ({
          ...prev,
          [evidenceId]: {
            checking: false,
            valid,
            mismatch: !valid,
            hash: res.data.data.calculatedHash
          }
        }));
      }
    } catch {
      setIntegrityState(prev => ({
        ...prev,
        [evidenceId]: { checking: false, valid: false, mismatch: true }
      }));
    }
  };

  const copyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const copyReportId = () => {
    if (report?.reportId) {
      navigator.clipboard.writeText(report.reportId);
      setCopiedReportId(true);
      setTimeout(() => setCopiedReportId(false), 2000);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

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
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  const currentReport = report || initialReport;
  const evidenceList = currentReport.evidence || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">{currentReport.reportId}</h3>
                {getStatusBadge(currentReport.status)}
              </div>
              <p className="text-[11px] text-slate-400">
                Submitted on {new Date(currentReport.submittedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 block uppercase text-[10px] font-bold">Category</span>
              <span className="font-semibold text-white block text-sm">{currentReport.reportCategory.replace(/_/g, ' ')}</span>
              {currentReport.reportedActionCode && (
                <span className="text-[10px] font-mono text-cyan-400 block">
                  Action: {currentReport.reportedActionCode}
                </span>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 block uppercase text-[10px] font-bold">Reported Officer / Code</span>
              <span className="font-semibold text-white block text-sm">
                {currentReport.officerName || currentReport.officerReference || 'Unclaimed / External Caller'}
              </span>
              {currentReport.officerReference && currentReport.officerName && (
                <span className="text-[10px] font-mono text-cyan-400 block">{currentReport.officerReference}</span>
              )}
            </div>
          </div>

          {/* Links to Verification / Authorization if present */}
          {(currentReport.verificationReference || currentReport.authorizationEvaluationReference) && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block font-semibold text-[11px]">Linked TrustGov References:</span>
              <div className="flex flex-wrap gap-2">
                {currentReport.verificationReference && (
                  <span className="px-2 py-1 rounded bg-slate-900 border border-cyan-500/30 text-cyan-300 font-mono text-[10px]">
                    Verification: {currentReport.verificationReference}
                  </span>
                )}
                {currentReport.authorizationEvaluationReference && (
                  <span className="px-2 py-1 rounded bg-slate-900 border border-teal-500/30 text-teal-300 font-mono text-[10px]">
                    Safety Eval: {currentReport.authorizationEvaluationReference}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Incident Description */}
          <div className="space-y-1.5">
            <span className="font-semibold text-slate-300 block">Report Description:</span>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed whitespace-pre-wrap text-xs">
              {currentReport.description}
            </div>
          </div>

          {/* Evidence Files & Real-Time Integrity Verification */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-cyan-400" />
                Submitted Evidence Files ({evidenceList.length})
              </span>
              <span className="text-[10px] text-slate-500">Live SHA-256 Tamper Verification</span>
            </div>

            {loading ? (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Loading attached evidence files...</span>
              </div>
            ) : evidenceList.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-slate-500">
                No supporting evidence files were attached to this report.
              </div>
            ) : (
              <div className="space-y-2">
                {evidenceList.map(ev => {
                  const state = integrityState[ev.evidenceId];
                  return (
                    <div
                      key={ev.id || ev.evidenceId}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-cyan-400 font-semibold">{ev.evidenceId}</span>
                          <span className="text-white font-medium truncate max-w-xs">{ev.originalFilename}</span>
                          <span className="text-[10px] text-slate-500">({formatFileSize(ev.fileSize)})</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>SHA-256:</span>
                          <span className="font-mono text-slate-500 truncate max-w-xs">{ev.sha256Hash}</span>
                          <button
                            type="button"
                            onClick={() => copyHash(ev.sha256Hash, ev.evidenceId)}
                            className="text-slate-500 hover:text-cyan-400 transition-colors"
                            title="Copy Hash"
                          >
                            {copiedHash === ev.evidenceId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {state?.checking ? (
                          <span className="text-xs text-cyan-400 flex items-center gap-1">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                          </span>
                        ) : state?.valid ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> SHA-256 Valid
                          </span>
                        ) : state?.mismatch ? (
                          <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Tamper Detected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => verifyIntegrity(ev.evidenceId)}
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

          {/* Privacy & Legal Footer Disclaimer */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[10px] text-slate-500 flex items-start gap-2">
            <Shield className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
            <p leading-relaxed>
              Privacy isolation active: Your reports and evidence are strictly confidential to your citizen account and authorized TrustGov administrators. Reported officers cannot view your reports.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={copyReportId}
            className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors font-mono"
          >
            {copiedReportId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedReportId ? 'Copied Reference!' : 'Copy Report ID'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
