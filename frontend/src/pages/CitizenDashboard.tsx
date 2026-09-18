import React, { useState } from 'react';
import { Shield, Search, AlertTriangle, CheckCircle, Lock, BookOpen } from 'lucide-react';

const CitizenDashboard: React.FC = () => {
  const [officerCode, setOfficerCode] = useState('');
  const [claimedAction, setClaimedAction] = useState('DOCUMENT_REQUEST');

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="glass-panel-glow rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Shield className="h-40 w-40 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">TrustGov Citizen Protection Hub</h1>
        <p className="text-sm text-cyan-200 mt-1 max-w-2xl">
          Impersonators claim to be government officials to scare citizens. Use this secure portal to verify whether an officer is authentic and authorized to make demands.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Core Actions Box: Verify Officer */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Action 1: Verify Officer Form */}
          <div className="glass-panel rounded-xl p-6 space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-900 pb-3">
              <Search className="h-5 w-5 text-cyan-400" /> 1. Verify Government Officer
            </h2>
            
            <p className="text-xs text-slate-400 leading-normal">
              Enter the Officer ID or DID provided by the caller/official. The platform will challenge their digital keys to prove their identity on-chain.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Officer Code / DID</label>
                <input
                  type="text"
                  value={officerCode}
                  onChange={(e) => setOfficerCode(e.target.value)}
                  placeholder="e.g. TG-OFF-001 or did:trustgov:..."
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">What is the officer asking you to do?</label>
                <select
                  value={claimedAction}
                  onChange={(e) => setClaimedAction(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2.5 px-4 text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                >
                  <option value="DOCUMENT_REQUEST">Request Identity Documents or Records</option>
                  <option value="OFFICIAL_NOTICE">Serve a Notice or Summons</option>
                  <option value="INVESTIGATION_ACTION">Require cooperation in an active investigation</option>
                  <option value="PERSONAL_UPI_PAYMENT">Transfer funds to a personal account/UPI</option>
                  <option value="OTP_REQUEST">Provide a Mobile OTP or authentication code</option>
                  <option value="PASSWORD_REQUEST">Provide account passwords</option>
                  <option value="PIN_REQUEST">Provide card PINs or banking PINs</option>
                </select>
              </div>

              <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-lg text-xs text-amber-300/90 leading-relaxed flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>Phase 1 Note:</strong> Cryptographic challenge-response and blockchain lookup will be fully activated in subsequent deployment phases.
                </span>
              </div>

              <button
                disabled
                className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-400 bg-slate-800 border border-slate-700 cursor-not-allowed flex items-center justify-center gap-2"
              >
                Verify Identity & Authority
              </button>
            </div>
          </div>

          {/* Action 2: Report Scam */}
          <div className="glass-panel rounded-xl p-6 space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-900 pb-3">
              <AlertTriangle className="h-5 w-5 text-rose-500" /> 2. Report Suspected Scam
            </h2>
            
            <p className="text-xs text-slate-400">
              Did you receive a suspicious call? Report caller numbers, payment links, and claim details. Files/screenshots can be uploaded securely.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Caller Phone Number</label>
                <input
                  type="text"
                  disabled
                  placeholder="e.g. +91 98765 43210"
                  className="w-full bg-slate-900/30 border border-slate-900 rounded-lg py-2 px-3 text-slate-500 text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Claimed Agency</label>
                <input
                  type="text"
                  disabled
                  placeholder="e.g. Income Tax Office"
                  className="w-full bg-slate-900/30 border border-slate-900 rounded-lg py-2 px-3 text-slate-500 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <button
              disabled
              className="w-full py-2 px-4 rounded-lg text-xs font-semibold text-slate-400 bg-slate-800 border border-slate-700 cursor-not-allowed"
            >
              Open Scam Intelligence Form (Phase 9)
            </button>
          </div>

        </div>

        {/* Right Side: Safety guidelines & tips */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quick Safety Checker */}
          <div className="glass-panel rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center gap-2">
              <Lock className="h-4 w-4 text-cyan-400" /> Instant Safety Guidelines
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-rose-300 bg-rose-950/20 border border-rose-500/25 p-3 rounded-lg">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="block text-rose-200">Never Transfer Money</strong>
                  No government officer will EVER ask for funds to be transferred to personal accounts or UPI IDs.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-amber-300 bg-amber-950/20 border border-amber-500/25 p-3 rounded-lg">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="block text-amber-200">Keep OTPs Confidential</strong>
                  Officials never ask you to read out or enter OTPs, bank card numbers, or passwords.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-500/25 p-3 rounded-lg">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <strong className="block text-emerald-200">Demand their Officer ID</strong>
                  Always ask for the official's identity card code. You can enter it on TrustGov to challenge their active DID.
                </div>
              </div>
            </div>
          </div>

          {/* Education panel */}
          <div className="glass-panel rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-400" /> How TrustGov Protects You
            </h3>

            <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
              <p>
                <strong>1. Cryptographic Challenge-Response:</strong> When you run verification, our backend generates a unique secure puzzle. The officer must sign it on their dedicated app using their private cryptographic key.
              </p>
              <p>
                <strong>2. Blockchain Registry Verification:</strong> Officer statuses, credential hash validation, and status updates are recorded on an immutable ledger. Imprisonment threats or expired credentials show up immediately.
              </p>
              <p>
                <strong>3. Authorization Check:</strong> Even if a caller proves they are a real officer, they might request an action they are not allowed to perform. TrustGov checks their permissions and issues alerts.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default CitizenDashboard;
