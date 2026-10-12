import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  AlertOctagon,
  Shield,
  X,
  Upload,
  Paperclip,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  Trash2,
  RefreshCw,
  Info
} from 'lucide-react';

export interface CitizenReportInitialData {
  officerReference?: string;
  officerName?: string;
  department?: string;
  verificationReference?: string;
  authorizationEvaluationReference?: string;
  reportedActionCode?: string;
  category?: string;
}

interface CitizenReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: CitizenReportInitialData | null;
  onReportSubmitted: (reportId: string) => void;
}

const CATEGORIES = [
  { code: 'PAYMENT_DEMAND', label: 'Payment Demand / Extortion', desc: 'Demanded funds to personal UPI or bank account' },
  { code: 'OTP_REQUEST', label: 'OTP or 2FA Request', desc: 'Demanded one-time password or security verification code' },
  { code: 'PIN_REQUEST', label: 'ATM / Banking PIN Request', desc: 'Demanded secret banking or card PIN' },
  { code: 'PASSWORD_REQUEST', label: 'Password Request', desc: 'Demanded online account password' },
  { code: 'REMOTE_ACCESS_REQUEST', label: 'Remote Access Software', desc: 'Instructed to install AnyDesk, TeamViewer, QuickSupport, etc.' },
  { code: 'IMPERSONATION', label: 'Officer Impersonation', desc: 'Fraudulently claimed official police or government identity' },
  { code: 'THREAT_OR_COERCION', label: 'Threat or Coercion', desc: 'Threatened immediate arrest, seizure, or physical harm' },
  { code: 'SUSPICIOUS_DOCUMENT', label: 'Suspicious Warrant / Summons', desc: 'Presented fake warrant, court order, or official notice' },
  { code: 'SUSPICIOUS_COMMUNICATION', label: 'Suspicious WhatsApp / Video Call', desc: 'Unusual call via WhatsApp, Skype, or unverified number' },
  { code: 'IDENTITY_MISMATCH', label: 'Identity / Badge Mismatch', desc: 'Officer photo or details do not match official record' },
  { code: 'UNAUTHORIZED_REQUEST', label: 'Unauthorized Activity Demand', desc: 'Demanded action beyond statutory officer mandate' },
  { code: 'OTHER', label: 'Other Suspicious Activity', desc: 'Other anomalous, extortionate, or suspicious conduct' }
];

export const CitizenReportModal: React.FC<CitizenReportModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onReportSubmitted
}) => {
  const { token } = useAuth();

  const [category, setCategory] = useState('PAYMENT_DEMAND');
  const [officerReference, setOfficerReference] = useState('');
  const [verificationReference, setVerificationReference] = useState('');
  const [authEvaluationReference, setAuthEvaluationReference] = useState('');
  const [reportedActionCode, setReportedActionCode] = useState('');
  const [description, setDescription] = useState('');

  // Attached files: { file, base64, preview }
  const [files, setFiles] = useState<{ file: File; base64: string; preview?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success screen
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [uploadedEvidenceCount, setUploadedEvidenceCount] = useState(0);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setOfficerReference(initialData.officerReference || '');
        setVerificationReference(initialData.verificationReference || '');
        setAuthEvaluationReference(initialData.authorizationEvaluationReference || '');
        setReportedActionCode(initialData.reportedActionCode || '');
        if (initialData.category) {
          setCategory(initialData.category);
        } else if (initialData.reportedActionCode?.includes('PAYMENT') || initialData.reportedActionCode?.includes('UPI')) {
          setCategory('PAYMENT_DEMAND');
        } else if (initialData.reportedActionCode?.includes('OTP')) {
          setCategory('OTP_REQUEST');
        } else if (initialData.reportedActionCode?.includes('PIN')) {
          setCategory('PIN_REQUEST');
        } else if (initialData.reportedActionCode?.includes('REMOTE')) {
          setCategory('REMOTE_ACCESS_REQUEST');
        } else {
          setCategory('PAYMENT_DEMAND');
        }
      } else {
        setOfficerReference('');
        setVerificationReference('');
        setAuthEvaluationReference('');
        setReportedActionCode('');
        setCategory('PAYMENT_DEMAND');
      }
      setDescription('');
      setFiles([]);
      setError(null);
      setSubmittedReportId(null);
      setUploadedEvidenceCount(0);
      setCopiedId(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const allowed = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'image/webp'];
    const newFiles: { file: File; base64: string; preview?: string }[] = [];

    Array.from(selected).forEach(file => {
      if (files.length + newFiles.length >= 10) {
        alert('Maximum 10 evidence files allowed per report.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 10MB limit.`);
        return;
      }
      if (!allowed.includes(file.type)) {
        alert(`File "${file.name}" has an unsupported format. Supported: JPG, PNG, PDF, TXT, WEBP.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const resultStr = reader.result as string;
        const base64Data = resultStr.split(',')[1] || resultStr;
        newFiles.push({
          file,
          base64: base64Data,
          preview: file.type.startsWith('image/') ? resultStr : undefined
        });
        if (newFiles.length === selected.length) {
          setFiles(prev => [...prev, ...newFiles]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('You must be logged in as a citizen to submit a report.');
      return;
    }
    const cleanDesc = description.trim();
    if (cleanDesc.length < 10) {
      setError('Description must be at least 10 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // 1. Submit report payload
      const payload: any = {
        reportCategory: category,
        description: cleanDesc
      };
      if (officerReference.trim()) payload.officerReference = officerReference.trim();
      if (verificationReference.trim()) payload.verificationReference = verificationReference.trim();
      if (authEvaluationReference.trim()) payload.authorizationEvaluationReference = authEvaluationReference.trim();
      if (reportedActionCode.trim()) payload.reportedActionCode = reportedActionCode.trim();

      const createRes = await axios.post('/api/citizen/reports', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!createRes.data.success) {
        throw new Error(createRes.data.error?.message || 'Failed to submit report');
      }

      const report = createRes.data.data.report;
      const reportId = report.reportId;
      let uploadedCount = 0;

      // 2. Attach evidence files
      for (const item of files) {
        try {
          let evType = 'OTHER';
          if (item.file.type.startsWith('image/')) evType = 'SCREENSHOT';
          else if (item.file.type === 'application/pdf') evType = 'DOCUMENT';
          else if (item.file.type === 'text/plain') evType = 'MESSAGE_EXPORT';

          await axios.post(
            `/api/citizen/reports/${reportId}/evidence`,
            {
              evidenceType: evType,
              originalFilename: item.file.name,
              mimeType: item.file.type,
              contentBase64: item.base64
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          uploadedCount++;
        } catch (evErr) {
          console.error('Evidence upload failed for file', item.file.name, evErr);
        }
      }

      setSubmittedReportId(reportId);
      setUploadedEvidenceCount(uploadedCount);
      onReportSubmitted(reportId);
    } catch (err: any) {
      console.error('Report submission error:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyReportId = () => {
    if (submittedReportId) {
      navigator.clipboard.writeText(submittedReportId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-rose-500/40 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Report Suspicious Interaction</h2>
              <p className="text-[11px] text-slate-400">Preserves cryptographic evidence and timestamps incidents.</p>
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

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {submittedReportId ? (
            /* SUCCESS CONFIRMATION SCREEN */
            <div className="py-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Report Successfully Registered</h3>
                <p className="text-slate-400 text-xs">
                  Your incident has been securely recorded with status <strong className="text-amber-400">SUBMITTED</strong>.
                </p>
              </div>

              {/* Reference Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 max-w-md mx-auto space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Official Incident Reference Code
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl font-bold text-cyan-400 select-all">
                    {submittedReportId}
                  </span>
                  <button
                    type="button"
                    onClick={copyReportId}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Copy Report Reference"
                  >
                    {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  {uploadedEvidenceCount} supporting evidence file(s) cryptographically hashed and attached off-chain.
                </p>
              </div>

              {/* Legal Notice */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed text-left">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    This report records your experience within the TrustGov platform. If you have suffered financial loss or physical threats, please contact your local law enforcement or cybercrime portal.
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-md shadow-cyan-900/20"
                >
                  Done & View in My Reports
                </button>
              </div>
            </div>
          ) : (
            /* SUBMISSION FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Disclaimer */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5 text-slate-400 text-[11px] leading-relaxed">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  TrustGov is a demonstration identity platform. Reporting helps preserve timestamps and SHA-256 evidence hashes. It does <strong className="text-slate-300">not</strong> constitute a police FIR or emergency dispatch.
                </span>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Category Dropdown */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Report Category *
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.code} value={cat.code}>
                      {cat.label} — {cat.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Claimed Officer Code & Pre-Linked References */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Claimed Officer Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TG-OFF-001 or caller badge"
                    value={officerReference}
                    onChange={e => setOfficerReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Linked Verification Ref (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TG-VFY-..."
                    value={verificationReference}
                    onChange={e => setVerificationReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-400 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Linked Authorization Evaluation Ref if triggered from Phase 8 */}
              {authEvaluationReference && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-teal-500/30 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Linked Safety Evaluation:</span>
                  <span className="font-mono text-teal-300 font-bold">{authEvaluationReference}</span>
                </div>
              )}

              {/* Detailed Description */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Description of Interaction *
                  </label>
                  <span className={`text-[10px] ${description.length < 10 ? 'text-rose-400' : 'text-slate-500'}`}>
                    {description.length} / 5000 chars (min 10)
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Describe exactly what happened: what the caller/officer demanded, any threats made, account numbers or UPI codes provided, phone numbers used..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>

              {/* Evidence File Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                    Attach Evidence ({files.length}/10 files)
                  </label>
                  <span className="text-[10px] text-slate-500">Max 10MB each (PNG, JPG, PDF, TXT, WEBP)</span>
                </div>

                <div className="p-4 border-2 border-dashed border-slate-800 hover:border-cyan-500/40 rounded-xl text-center cursor-pointer transition-colors bg-slate-950/40 relative">
                  <input
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf,.txt,.webp"
                    onChange={handleFileSelection}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center space-y-1 pointer-events-none">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-slate-300 font-semibold text-xs">Click or drag files here to attach</span>
                    <span className="text-[10px] text-slate-500">Screenshots, call logs, demand messages, or forged letters</span>
                  </div>
                </div>

                {/* File list preview */}
                {files.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {files.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="text-white text-xs font-medium truncate">{item.file.name}</span>
                          <span className="text-[10px] text-slate-500">({(item.file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || description.trim().length < 10}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-md shadow-rose-900/20 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting Report...</span>
                    </>
                  ) : (
                    <span>Submit Suspicious Incident Report</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
