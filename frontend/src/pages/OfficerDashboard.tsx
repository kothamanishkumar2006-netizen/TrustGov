import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, CheckCircle2, XCircle, AlertCircle, Clock, Key, Copy, Check, Fingerprint } from 'lucide-react';

const OfficerDashboard: React.FC = () => {
  const { user, officerDetails } = useAuth();
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="h-6 w-6 text-emerald-400" />
          Officer Cryptographic Control Panel
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Verify pending verification requests, sign challenges, and manage your digital identity credential.
        </p>
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

        </div>

        {/* Right Side: Pending Requests Queue & Actions Matrix */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Verification Requests Queue */}
          <div className="glass-panel border-emerald-950/80 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase border-b border-slate-900 pb-3 flex items-center justify-between">
              <span>Citizen Verification Gateway</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </h3>

            {/* Verification Request Container (Inactive state for Phase 1) */}
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl bg-slate-950/60 border border-slate-900/60 space-y-2">
              <Clock className="h-8 w-8 text-slate-600 animate-spin-slow" />
              <p className="text-sm font-semibold text-slate-400">Waiting for Citizen Requests...</p>
              <p className="text-xs text-slate-600 max-w-sm">
                When a citizen requests your digital verification by inputting your Officer ID, challenge credentials will populate here for your sign off.
              </p>
            </div>
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
    </div>
  );
};

export default OfficerDashboard;
