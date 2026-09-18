import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound, AlertTriangle, UserCheck, ShieldAlert } from 'lucide-react';

const Login: React.FC = () => {
  const { login, error, clearError, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    clearError();
    // Redirect if already logged in
    if (user) {
      redirectUser(user.role);
    }
  }, [user]);

  const redirectUser = (role: string) => {
    if (role === 'ADMIN') navigate('/admin');
    else if (role === 'OFFICER') navigate('/officer');
    else navigate('/citizen');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (success && user) {
      redirectUser(user.role);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setLoading(true);
    setEmail(demoEmail);
    setPassword('password123');
    const success = await login(demoEmail, 'password123');
    setLoading(false);
    if (success && user) {
      redirectUser(user.role);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-900/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-950/20 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md space-y-8 z-10">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)] mb-4">
            <Shield className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            TRUST<span className="text-cyan-400">GOV</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400 tracking-wider">
            "Verify Before You Trust."
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-8 shadow-2xl relative">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-cyan-400" />
            Security Gateway Login
          </h2>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-200 text-sm flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Official Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                placeholder="officer@agency.gov / citizen@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Security Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"></div>
              ) : (
                'Access Dashboard'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500">Citizen account? </span>
            <Link to="/register" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
              Create credentials
            </Link>
          </div>
        </div>

        {/* Quick Demo Access Section */}
        <div className="glass-panel border-cyan-950/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-cyan-500 uppercase">
            <ShieldAlert className="h-4 w-4" />
            Demonstration Accounts Quick Access
          </div>
          <p className="text-xs text-slate-500">
            For evaluation, click any demo account below to quickly auto-fill and authenticate. All demo credentials contain test records.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickLogin('admin@trustgov.demo')}
              className="py-2 px-1 text-[11px] font-medium border border-cyan-950 hover:bg-cyan-950/30 hover:border-cyan-500/40 text-cyan-300 rounded-lg transition-all cursor-pointer flex flex-col items-center gap-1"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Demo Admin
            </button>
            <button
              onClick={() => handleQuickLogin('officer@trustgov.demo')}
              className="py-2 px-1 text-[11px] font-medium border border-cyan-950 hover:bg-cyan-950/30 hover:border-cyan-500/40 text-cyan-300 rounded-lg transition-all cursor-pointer flex flex-col items-center gap-1"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Demo Officer
            </button>
            <button
              onClick={() => handleQuickLogin('citizen@trustgov.demo')}
              className="py-2 px-1 text-[11px] font-medium border border-cyan-950 hover:bg-cyan-950/30 hover:border-cyan-500/40 text-cyan-300 rounded-lg transition-all cursor-pointer flex flex-col items-center gap-1"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Demo Citizen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
