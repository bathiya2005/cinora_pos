import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { Lock, User as UserIcon, ArrowRight, ShieldCheck } from 'lucide-react';

// Login screen logo is fixed via code — place the image file at /public/login-logo.png
// This is intentionally independent of Settings > Bill Template logoUrl, so updating the
// logo from Settings will NOT change this login screen logo.
const LOGIN_LOGO_PATH = '/login-logo.png';

// Same Alona brand logo used in the Sidebar (public/alona-logo.png), shown next to "Powered by Alona IT"
const ALONA_BRAND_LOGO_PATH = '/alona-logo.png';

export function LoginScreen() {
  const { login } = usePos();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Login page brand name is fixed to "CINORA" — independent of Settings > companyName
  const shopName = 'CINORA';
  const logoUrl = LOGIN_LOGO_PATH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter username and password');
      return;
    }

    setError(null);
    setSubmitting(true);

    const res = await login(username.trim(), password);
    setSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-stretch bg-white">
      {/* Left Panel: Cinnamon Brand Showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#6B3B22]">
        {/* Decorative cinnamon-toned wallpaper */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `
              repeating-radial-gradient(circle at 20% 30%, #D9A066 0px, #D9A066 6px, transparent 7px, transparent 46px),
              repeating-radial-gradient(circle at 70% 60%, #C97B3D 0px, #C97B3D 8px, transparent 9px, transparent 60px),
              repeating-radial-gradient(circle at 45% 85%, #E8C39E 0px, #E8C39E 5px, transparent 6px, transparent 50px)
            `,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#6B3B22]/70 via-[#5A2F1B]/85 to-[#3E1E10]/95" />

        {/* Content over wallpaper */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-10 w-full">
          <img
            src={logoUrl}
            alt={shopName}
            className="w-28 h-28 object-contain rounded-2xl bg-black p-3 shadow-2xl mb-6"
          />

          <h1 className="text-4xl font-extrabold text-white tracking-wide leading-tight">
            {shopName}
          </h1>
          <p className="text-amber-100/80 text-sm mt-3 max-w-xs leading-relaxed">
            Premium Cinnamon &amp; Spice Trading — Weighing, Billing &amp; Business Management
          </p>

          <div className="mt-10 flex items-center gap-2 text-amber-100/60 text-xs font-semibold uppercase tracking-widest">
            <span className="h-px w-8 bg-amber-100/30" />
            <img
              src={ALONA_BRAND_LOGO_PATH}
              alt="Alona IT"
              className="w-4 h-4 object-contain rounded-sm"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <span>Powered by Alona IT</span>
            <span className="h-px w-8 bg-amber-100/30" />
          </div>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 relative bg-gradient-to-br from-[#EAF6EC] via-white to-[#FCF3E8]">
        <div className="w-full max-w-md">
          {/* Mobile-only brand header */}
          <div className="lg:hidden text-center mb-8">
            <img
              src={logoUrl}
              alt={shopName}
              className="w-16 h-16 object-contain rounded-xl bg-black shadow-md mx-auto mb-3 p-1.5"
            />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{shopName}</h1>
            <p className="text-slate-600 text-xs mt-1">Weighing &amp; Billing System</p>
          </div>

          {/* Login Form Card */}
          <div className="bg-white/90 backdrop-blur border border-emerald-900/10 rounded-2xl p-8 shadow-xl shadow-emerald-900/5">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Welcome Back</h2>
                <p className="text-xs text-slate-600">Sign in with Admin or Branch credentials</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Secure
              </span>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-fadeIn">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin or branch1"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 text-sm"
              >
                {submitting ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign In to POS</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer info */}
          <p className="text-center text-xs text-slate-500 mt-6">
            © {new Date().getFullYear()} {shopName} • System by Alona IT
          </p>
        </div>
      </div>
    </div>
  );
}
