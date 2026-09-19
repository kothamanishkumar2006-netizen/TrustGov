import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LogOut, LayoutDashboard, Users } from 'lucide-react';

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-900/50 text-purple-300 border-purple-500/30';
      case 'OFFICER':
        return 'bg-emerald-900/50 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-cyan-900/50 text-cyan-300 border-cyan-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand/Logo */}
          <div className="flex items-center gap-6">
            <Link to={user?.role === 'ADMIN' ? '/admin' : (user?.role === 'OFFICER' ? '/officer' : '/citizen')} className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950 border border-cyan-500/30 text-cyan-400">
                <Shield className="h-5 w-5" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-white">
                TRUST<span className="text-cyan-400">GOV</span>
              </span>
              <span className="text-[10px] uppercase font-semibold text-slate-500 border border-slate-800 rounded px-1.5 ml-1 hidden sm:inline">
                Demo Platform
              </span>
            </Link>

            {/* Admin Nav Tabs */}
            {user?.role === 'ADMIN' && (
              <nav className="hidden md:flex items-center gap-1 border-l border-slate-900 pl-6">
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    location.pathname === '/admin'
                      ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Overview
                </Link>
                <Link
                  to="/admin/officers"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    location.pathname.startsWith('/admin/officers')
                      ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Officer Management
                </Link>
              </nav>
            )}
          </div>

          {/* User profile actions */}
          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end text-right">
                <span className="text-sm font-semibold text-slate-200">{user.name}</span>
                <span className="text-xs text-slate-500">{user.email}</span>
              </div>

              {/* Role Badge */}
              <span className={`text-[10px] font-bold uppercase tracking-widest border rounded-full px-2.5 py-0.5 ${getRoleBadgeColor(user.role)}`}>
                {user.role}
              </span>

              {/* Logout button */}
              <button
                onClick={logout}
                className="flex items-center justify-center p-2 rounded-lg border border-slate-800 hover:border-cyan-500/30 hover:bg-cyan-950/20 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
                title="Logout Securely"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/20 py-6 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 TrustGov Identity Registry Protocol. For Demonstration Purposes Only.</p>
          <p className="mt-1 text-[10px] text-amber-500/50">DEMONSTRATION SYSTEM — NOT AN OFFICIAL GOVERNMENT SERVICE</p>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout;
