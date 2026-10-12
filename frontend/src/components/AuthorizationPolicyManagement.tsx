import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Info,
  X,
  Lock,
  GitBranch,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface Policy {
  id: string;
  policyCode: string;
  version: number;
  department: string;
  role: string;
  actionCode: string;
  decision: 'ALLOW' | 'DENY' | 'REVIEW';
  constraints: any;
  description: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: string;
}

interface ActionDef {
  actionCode: string;
  displayName: string;
  description: string;
  category: string;
  safetyClassification: string;
}

interface ReasonDef {
  code: string;
  title: string;
  citizenMessage: string;
  technicalMessage: string;
  severity: string;
}

interface Props {
  token: string | null;
}

export const AuthorizationPolicyManagement: React.FC<Props> = ({ token }) => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [decisionFilter, setDecisionFilter] = useState('ALL');

  // Catalogs
  const [actionsCatalog, setActionsCatalog] = useState<ActionDef[]>([]);
  const [reasonsCatalog, setReasonsCatalog] = useState<ReasonDef[]>([]);
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  // Form states
  const [formPolicyCode, setFormPolicyCode] = useState('');
  const [formDepartment, setFormDepartment] = useState('Demo Central Investigation Bureau');
  const [formRole, setFormRole] = useState('ALL');
  const [formActionCode, setFormActionCode] = useState('REQUEST_DOCUMENT');
  const [formDecision, setFormDecision] = useState<'ALLOW' | 'DENY' | 'REVIEW'>('ALLOW');
  const [formDescription, setFormDescription] = useState('');
  const [formConstraints, setFormConstraints] = useState('{}');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/authorization-policies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setPolicies(res.data.data.policies || []);
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const [actRes, rsnRes] = await Promise.all([
        axios.get('/api/admin/authorization-actions', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/admin/authorization-reason-codes', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (actRes.data.success) setActionsCatalog(actRes.data.data.actions || []);
      if (rsnRes.data.success) setReasonsCatalog(rsnRes.data.data.reasons || []);
    } catch (err) {
      console.error('Failed to fetch catalogs:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPolicies();
      fetchCatalogs();
    }
  }, [token]);

  // Handle Toggle Status
  const handleToggleStatus = async (policy: Policy) => {
    const newStatus = policy.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await axios.patch(
        `/api/admin/authorization-policies/${policy.id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        fetchPolicies();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to toggle status');
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormPolicyCode(`TG-DEMO-${Date.now().toString().slice(-4)}`);
    setFormDepartment('Demo Central Investigation Bureau');
    setFormRole('ALL');
    setFormActionCode('REQUEST_DOCUMENT');
    setFormDecision('ALLOW');
    setFormDescription('TrustGov demo authorization policy');
    setFormConstraints(JSON.stringify({
      allowedChannels: ['OFFICIAL_PORTAL', 'OFFICIAL_OFFICE'],
      allowedDataCategories: ['DOCUMENTS'],
      paymentAllowed: false
    }, null, 2));
    setFormError(null);
    setShowCreateModal(true);
  };

  // Submit Create Policy
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      let parsedConstraints = {};
      try {
        parsedConstraints = JSON.parse(formConstraints);
      } catch {
        setFormError('Invalid JSON format in policy constraints.');
        return;
      }

      setSubmitting(true);
      const res = await axios.post(
        '/api/admin/authorization-policies',
        {
          policyCode: formPolicyCode.trim().toUpperCase(),
          department: formDepartment.trim(),
          role: formRole.trim(),
          actionCode: formActionCode,
          decision: formDecision,
          constraints: parsedConstraints,
          description: formDescription.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setShowCreateModal(false);
        fetchPolicies();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Failed to create policy');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Version Modal
  const openVersionModal = (policy: Policy) => {
    setSelectedPolicy(policy);
    setFormDecision(policy.decision);
    setFormDescription(`${policy.description} (v${policy.version + 1})`);
    setFormConstraints(JSON.stringify(policy.constraints || {}, null, 2));
    setFormError(null);
    setShowVersionModal(true);
  };

  // Submit Create Version
  const handleSubmitVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy) return;
    setFormError(null);

    try {
      let parsedConstraints = {};
      try {
        parsedConstraints = JSON.parse(formConstraints);
      } catch {
        setFormError('Invalid JSON format in policy constraints.');
        return;
      }

      setSubmitting(true);
      const res = await axios.post(
        `/api/admin/authorization-policies/${selectedPolicy.id}/version`,
        {
          decision: formDecision,
          description: formDescription.trim(),
          constraints: parsedConstraints
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setShowVersionModal(false);
        fetchPolicies();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Failed to create new version');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered policies
  const filteredPolicies = policies.filter(p => {
    const matchesSearch =
      p.policyCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.actionCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesDecision = decisionFilter === 'ALL' || p.decision === decisionFilter;

    return matchesSearch && matchesStatus && matchesDecision;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Lock className="h-3.5 w-3.5" />
            Phase 8 Authorization Engine
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Authorization Policy Management
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure declarative, versioned TrustGov demo authorization rules. Strict separation of officer identity vs. requested action safety.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCatalogModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 flex items-center gap-2 transition"
          >
            <Info className="h-4 w-4 text-cyan-400" />
            Catalog & Codes
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
          >
            <Plus className="h-4 w-4" />
            New Policy
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by code, department, role, or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            Status:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>

          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Decisions</option>
            <option value="ALLOW">ALLOW</option>
            <option value="DENY">DENY</option>
            <option value="REVIEW">REVIEW</option>
          </select>

          <button
            onClick={fetchPolicies}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh policies"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Policies Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Policy Code & Version</th>
                <th className="py-3.5 px-4 font-semibold">Scope (Dept / Role)</th>
                <th className="py-3.5 px-4 font-semibold">Action Code</th>
                <th className="py-3.5 px-4 font-semibold">Decision</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-cyan-400 mb-2" />
                    Loading authorization policies...
                  </td>
                </tr>
              ) : filteredPolicies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No authorization policies found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredPolicies.map((policy) => {
                  const isAllow = policy.decision === 'ALLOW';
                  const isDeny = policy.decision === 'DENY';
                  const isActive = policy.status === 'ACTIVE';

                  return (
                    <tr key={policy.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-xs">
                            {policy.policyCode}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                            v{policy.version}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {policy.description}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-200">{policy.department}</div>
                        <div className="text-slate-400">{policy.role}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-300">
                          {policy.actionCode}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isAllow
                              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                              : isDeny
                              ? 'bg-rose-950/70 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-950/70 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isAllow && <CheckCircle2 className="h-3 w-3" />}
                          {isDeny && <XCircle className="h-3 w-3" />}
                          {!isAllow && !isDeny && <AlertTriangle className="h-3 w-3" />}
                          {policy.decision}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            isActive
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {policy.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedPolicy(policy);
                              setShowDetailsModal(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="View Constraints & Details"
                          >
                            <FileText className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => openVersionModal(policy)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition"
                            title="Create New Version"
                          >
                            <GitBranch className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(policy)}
                            className={`p-1.5 rounded-lg transition ${
                              isActive
                                ? 'bg-emerald-950/50 text-emerald-400 hover:bg-emerald-900/50'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                            title={isActive ? 'Deactivate Policy' : 'Activate Policy'}
                          >
                            {isActive ? (
                              <ToggleRight className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-slate-500" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CREATE NEW POLICY MODAL (VERSION 1)                           */}
      {/* ------------------------------------------------------------- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-xl w-full rounded-2xl border border-slate-700 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Create Authorization Policy (v1)</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitCreate} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Policy Code</label>
                  <input
                    type="text"
                    required
                    value={formPolicyCode}
                    onChange={(e) => setFormPolicyCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
                    placeholder="TG-DEMO-XXXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Decision</label>
                  <select
                    value={formDecision}
                    onChange={(e) => setFormDecision(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="DENY">DENY</option>
                    <option value="REVIEW">REVIEW</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
                  <input
                    type="text"
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-cyan-500 focus:outline-none"
                    placeholder="e.g. ALL or Investigating Officer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Action Code</label>
                <select
                  value={formActionCode}
                  onChange={(e) => setFormActionCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
                >
                  {actionsCatalog.map((act) => (
                    <option key={act.actionCode} value={act.actionCode}>
                      {act.actionCode} ({act.displayName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Constraints (Declarative JSON)
                </label>
                <textarea
                  rows={4}
                  value={formConstraints}
                  onChange={(e) => setFormConstraints(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-cyan-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Policy (v1)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CREATE NEW VERSION MODAL (VERSION N+1)                         */}
      {/* ------------------------------------------------------------- */}
      {showVersionModal && selectedPolicy && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-xl w-full rounded-2xl border border-slate-700 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">
                  Create Version {selectedPolicy.version + 1} of {selectedPolicy.policyCode}
                </h3>
              </div>
              <button
                onClick={() => setShowVersionModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs text-cyan-300">
              Historical version {selectedPolicy.version} will be deactivated and remain strictly immutable for past evaluations.
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitVersion} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Decision</label>
                <select
                  value={formDecision}
                  onChange={(e) => setFormDecision(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-cyan-500 focus:outline-none"
                >
                  <option value="ALLOW">ALLOW</option>
                  <option value="DENY">DENY</option>
                  <option value="REVIEW">REVIEW</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Constraints (Declarative JSON)
                </label>
                <textarea
                  rows={4}
                  value={formConstraints}
                  onChange={(e) => setFormConstraints(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-cyan-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVersionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
                >
                  {submitting ? 'Creating Version...' : `Publish Version ${selectedPolicy.version + 1}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DETAILS / CONSTRAINTS MODAL                                    */}
      {/* ------------------------------------------------------------- */}
      {showDetailsModal && selectedPolicy && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-xl w-full rounded-2xl border border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">
                  {selectedPolicy.policyCode} (Version {selectedPolicy.version})
                </h3>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400">Department:</span>
                  <div className="font-semibold text-white">{selectedPolicy.department}</div>
                </div>
                <div>
                  <span className="text-slate-400">Role:</span>
                  <div className="font-semibold text-white">{selectedPolicy.role}</div>
                </div>
                <div>
                  <span className="text-slate-400">Action Code:</span>
                  <div className="font-mono text-cyan-300">{selectedPolicy.actionCode}</div>
                </div>
                <div>
                  <span className="text-slate-400">Decision:</span>
                  <div className="font-semibold text-white">{selectedPolicy.decision}</div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold mb-1 block">Description</span>
                <p className="text-slate-300 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  {selectedPolicy.description}
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-semibold mb-1 block">Policy Constraints</span>
                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-cyan-300 font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(selectedPolicy.constraints || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CATALOGS & REASON CODES MODAL                                  */}
      {/* ------------------------------------------------------------- */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-3xl w-full rounded-2xl border border-slate-700 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Action Catalog & Reason Codes</h3>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-6 flex-1 pr-2">
              {/* Actions */}
              <div>
                <h4 className="text-xs uppercase font-bold text-cyan-400 tracking-wider mb-2">
                  Centralized Action Catalog ({actionsCatalog.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {actionsCatalog.map((act) => (
                    <div
                      key={act.actionCode}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-white text-[11px]">{act.actionCode}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            act.safetyClassification === 'PROHIBITED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                              : act.safetyClassification === 'HIGH_RISK'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {act.safetyClassification}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px]">{act.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason Codes */}
              <div>
                <h4 className="text-xs uppercase font-bold text-cyan-400 tracking-wider mb-2">
                  Centralized Reason Codes ({reasonsCatalog.length})
                </h4>
                <div className="space-y-2 text-xs">
                  {reasonsCatalog.map((rsn) => (
                    <div
                      key={rsn.code}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{rsn.title}</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {rsn.code}
                        </span>
                      </div>
                      <p className="text-cyan-300/90 text-[11px]">{rsn.citizenMessage}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowCatalogModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
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
