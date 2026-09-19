import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Users, Award, Ban, ShieldAlert, AlertTriangle, Activity, Database, FileText } from 'lucide-react';

interface Metrics {
  totalUsers: number;
  totalOfficers: number;
  activeCredentials: number;
  revokedCredentials: number;
  verificationsToday: number;
  failedVerifications: number;
  scamReports: number;
  highRiskReports: number;
}

interface Officer {
  id: string;
  name: string;
  email: string;
  officer_code: string;
  department: string;
  designation: string;
  status: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  created_at: string;
}

interface ScamReport {
  id: string;
  caller_number: string;
  claimed_department: string;
  claimed_officer_name: string;
  payment_amount: string;
  risk_level: string;
  status: string;
  created_at: string;
}

interface Verification {
  id: string;
  session_id: string;
  officer_code: string;
  officer_name: string;
  citizen_name: string | null;
  status: string;
  created_at: string;
}

const AdminDashboard: React.FC = () => {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentOfficers, setRecentOfficers] = useState<Officer[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);
  const [recentScams, setRecentScams] = useState<ScamReport[]>([]);
  const [recentVerifications, setRecentVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        const { metrics, recentOfficers, recentAuditLogs, recentScams, recentVerifications } = res.data.data;
        setMetrics(metrics);
        setRecentOfficers(recentOfficers);
        setRecentAuditLogs(recentAuditLogs);
        setRecentScams(recentScams);
        setRecentVerifications(recentVerifications);
      }
    } catch (err: any) {
      console.error('Failed to load admin metrics:', err);
      setError(err.response?.data?.error?.message || 'Error fetching dashboard analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-cyan-400">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-800 border-t-cyan-500"></div>
          <span className="text-xs uppercase tracking-wider font-semibold">Loading Control Metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/20 text-rose-300">
        <p className="font-bold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> Analytics Load Error
        </p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={fetchDashboardData} className="mt-4 text-xs font-semibold px-3 py-1.5 bg-rose-500 text-slate-950 rounded hover:bg-rose-400 transition-colors">
          Retry Sync
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Database className="h-6 w-6 text-cyan-400" />
          System Control Center
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Monitor officer registrations, check credentials, view citizen scam reports, and query integrity logs.
        </p>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Officers */}
          <div className="glass-panel rounded-xl p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-950 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Demo Officers</span>
              <span className="text-2xl font-bold text-white block mt-0.5">{metrics.totalOfficers}</span>
            </div>
          </div>

          {/* Active Credentials */}
          <div className="glass-panel rounded-xl p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-emerald-950 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Active Credentials</span>
              <span className="text-2xl font-bold text-white block mt-0.5">{metrics.activeCredentials}</span>
            </div>
          </div>

          {/* Revoked Credentials */}
          <div className="glass-panel rounded-xl p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-rose-950 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Ban className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Revoked Credentials</span>
              <span className="text-2xl font-bold text-white block mt-0.5">{metrics.revokedCredentials}</span>
            </div>
          </div>

          {/* Verifications Today */}
          <div className="glass-panel rounded-xl p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-cyan-950 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Checks Today</span>
              <span className="text-2xl font-bold text-white block mt-0.5">{metrics.verificationsToday}</span>
            </div>
          </div>

          {/* Failed Verifications */}
          <div className="glass-panel rounded-xl p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-amber-950 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Auth Failures</span>
              <span className="text-2xl font-bold text-white block mt-0.5">{metrics.failedVerifications}</span>
            </div>
          </div>

          {/* Scam Reports */}
          <div className="glass-panel rounded-xl p-4 flex items-center gap-4 font-sans">
            <div className="h-12 w-12 rounded-lg bg-purple-950 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Total Scams</span>
              <span className="text-2xl font-bold text-white block mt-0.5">{metrics.scamReports}</span>
            </div>
          </div>

          {/* High Risk Reports */}
          <div className="glass-panel rounded-xl p-4 flex items-center gap-4 col-span-2">
            <div className="h-12 w-12 rounded-lg bg-rose-950 border border-rose-500/20 flex items-center justify-center text-rose-500 animate-pulse">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-rose-500 block uppercase tracking-wider">Critical Risk Alerts</span>
              <span className="text-2xl font-bold text-rose-400 block mt-0.5">{metrics.highRiskReports}</span>
            </div>
          </div>

        </div>
      )}

      {/* Main Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Recent Officers */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center justify-between border-b border-slate-900 pb-3">
            <span>Recent Demo Officers Registered</span>
            <Link to="/admin/officers" className="text-[11px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 hover:bg-cyan-950 border border-cyan-500/30 px-2.5 py-1 rounded transition-colors flex items-center gap-1 font-semibold normal-case">
              Manage All Officers &rarr;
            </Link>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-900 pb-2">
                  <th className="py-2 font-semibold">Officer Code</th>
                  <th className="py-2 font-semibold">Name</th>
                  <th className="py-2 font-semibold">Department</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {recentOfficers.map((o) => (
                  <tr key={o.id} className="text-slate-300">
                    <td className="py-3 font-mono text-cyan-400">{o.officer_code}</td>
                    <td className="py-3 font-medium">{o.name}</td>
                    <td className="py-3 text-slate-400">{o.department}</td>
                    <td className="py-3">
                      <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border ${
                        o.status === 'ACTIVE' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentOfficers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-slate-500">No officers found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Scam Reports */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center justify-between border-b border-slate-900 pb-3">
            <span>Scam Intelligence Reports</span>
            <span className="text-[10px] text-amber-500 bg-amber-950 border border-amber-500/30 px-2 py-0.5 rounded">Risk Engine Connected</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-900 pb-2">
                  <th className="py-2 font-semibold">Caller ID</th>
                  <th className="py-2 font-semibold">Claimed Officer</th>
                  <th className="py-2 font-semibold">Risk Level</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {recentScams.map((s) => (
                  <tr key={s.id} className="text-slate-300">
                    <td className="py-3 font-mono">{s.caller_number}</td>
                    <td className="py-3 text-slate-400">{s.claimed_officer_name || 'Anonymous'}</td>
                    <td className="py-3">
                      <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${
                        s.risk_level === 'CRITICAL' ? 'bg-rose-950 text-rose-400 border border-rose-500/30' :
                        s.risk_level === 'HIGH' ? 'bg-orange-950 text-orange-400 border border-orange-500/30' :
                        s.risk_level === 'MEDIUM' ? 'bg-amber-950 text-amber-400 border border-amber-500/30' :
                        'bg-slate-900 text-slate-400'
                      }`}>
                        {s.risk_level}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-slate-500">{s.status}</td>
                  </tr>
                ))}
                {recentScams.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-slate-500">No scam incidents reported</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Verification Attempts */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center justify-between border-b border-slate-900 pb-3">
            <span>Recent Verification Audits</span>
            <span className="text-[10px] text-indigo-400 bg-indigo-950 border border-indigo-500/30 px-2 py-0.5 rounded">Blockchain Enabled</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-900 pb-2">
                  <th className="py-2 font-semibold">Session ID</th>
                  <th className="py-2 font-semibold">Officer Name</th>
                  <th className="py-2 font-semibold">Citizen Name</th>
                  <th className="py-2 font-semibold">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {recentVerifications.map((v) => (
                  <tr key={v.id} className="text-slate-300">
                    <td className="py-3 font-mono text-[10px] text-slate-500">{v.session_id.slice(0, 8)}...</td>
                    <td className="py-3 font-medium">{v.officer_name}</td>
                    <td className="py-3 text-slate-400">{v.citizen_name || 'Anonymous Caller'}</td>
                    <td className="py-3">
                      <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border ${
                        v.status === 'AUTHENTICATED' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentVerifications.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-slate-500">No verifications conducted today</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log Trail */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center justify-between border-b border-slate-900 pb-3">
            <span>Security Audit Trail (Off-Chain DB)</span>
            <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">Immutable logs</span>
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {recentAuditLogs.map((log) => (
              <div key={log.id} className="text-xs p-2.5 rounded-lg border border-slate-900 bg-slate-950/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-cyan-400 text-[10px] tracking-widest uppercase">{log.action}</span>
                  <span className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-400 leading-normal">
                  Actor: <span className="text-slate-300 font-semibold">{log.actor_name || 'System Daemon'}</span> ({log.actor_email || 'daemon'}) 
                  <span className="text-[10px] text-slate-500 ml-1.5 uppercase font-bold bg-slate-900 px-1 py-0.2 border border-slate-800 rounded">{log.actor_role || 'SYSTEM'}</span>
                </div>
              </div>
            ))}
            {recentAuditLogs.length === 0 && (
              <p className="text-center text-slate-500 text-xs py-4">No security logs recorded</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
