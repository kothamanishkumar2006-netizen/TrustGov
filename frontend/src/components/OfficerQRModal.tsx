import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Download, ShieldCheck, Copy, Check } from 'lucide-react';

interface OfficerQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentialId: string;
  officerCode: string;
  officerName: string;
  department: string;
}

export const OfficerQRModal: React.FC<OfficerQRModalProps> = ({
  isOpen,
  onClose,
  credentialId,
  officerCode,
  officerName,
  department
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = React.useState(false);

  const qrPayload = `TRUSTGOV://verify/${credentialId}`;

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        qrPayload,
        {
          width: 240,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#f8fafc'
          }
        },
        (error) => {
          if (error) console.error('Error generating QR code canvas:', error);
        }
      );
    }
  }, [isOpen, qrPayload]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `TrustGov-Officer-Badge-${officerCode}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl p-6 space-y-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Official Officer QR Badge</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Badge Card Container */}
        <div className="p-5 rounded-xl bg-slate-950 border border-emerald-500/30 flex flex-col items-center text-center space-y-3">
          <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-emerald-400">
            TrustGov Official Identification
          </span>

          {/* QR Code Canvas */}
          <div className="bg-white p-3 rounded-xl shadow-lg">
            <canvas ref={canvasRef} className="rounded-lg block" />
          </div>

          <div className="space-y-0.5">
            <span className="text-sm font-bold text-white block">{officerName}</span>
            <span className="text-xs text-cyan-400 font-mono font-semibold block">{officerCode}</span>
            <span className="text-[11px] text-slate-400 block">{department}</span>
          </div>

          <div className="w-full bg-slate-900/90 p-2 rounded border border-slate-800 flex items-center justify-between text-xs">
            <span className="font-mono text-indigo-300 text-[11px] truncate select-all">{qrPayload}</span>
            <button
              onClick={handleCopyPayload}
              className="text-slate-400 hover:text-white shrink-0 ml-2"
              title="Copy Reference"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Security Disclosure */}
        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          Citizens scan this QR to verify your identity. The QR contains only your public verification reference. Your signing private key remains in secure custody.
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleDownload}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors flex items-center justify-center gap-1.5"
          >
            <Download className="h-4 w-4" /> Download Badge
          </button>
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
