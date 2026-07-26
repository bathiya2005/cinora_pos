import { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { Scale, LogOut, ShieldAlert, Store, SlidersHorizontal, Bell, Clock } from 'lucide-react';

interface NavbarProps {
  onOpenDeductionModal: () => void;
}

export function Navbar({ onOpenDeductionModal }: NavbarProps) {
  const { user, logout, billSettings } = usePos();
  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');

  const companyName = billSettings?.companyName || 'Alona POS';
  // Navbar logo now follows whatever logo is set in Settings > Template Settings (billSettings.logoUrl)
  const navLogoUrl = billSettings?.logoUrl;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setDateString(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      setTimeString(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-emerald-900/10 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Left: Header Title & Branch Badge */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          {navLogoUrl ? (
            <img
              src={navLogoUrl}
              alt={companyName}
              className="w-9 h-9 rounded-lg object-contain bg-white border border-emerald-900/10 shadow-sm shrink-0"
              onError={(e) => {
                // Falls back to the Scale icon if the settings logo fails to load
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-9 h-9 bg-emerald-700 rounded-lg ${navLogoUrl ? 'hidden' : 'flex'} items-center justify-center text-white font-bold text-lg shadow-sm shrink-0`}>
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block min-w-0">
            <h1 className="font-bold text-slate-900 text-base leading-none truncate">
              {companyName}
            </h1>
            <p className="text-[11px] text-slate-600 leading-tight mt-0.5">Weighing & Billing Terminal</p>
          </div>
        </div>

        {user && (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shrink-0">
            {user.role === 'admin' ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>HQ ADMIN</span>
              </>
            ) : (
              <>
                <Store className="w-3.5 h-3.5" />
                <span>{user.branchName || 'Branch Terminal'}</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* Right: Date/Time, Quick Actions, Profile Logout */}
      <div className="flex items-center gap-2 md:gap-5">
        {/* Date & Time display */}
        <div className="hidden md:flex items-center gap-2 text-right">
          <Clock className="w-4 h-4 text-slate-500" />
          <div>
            <p className="text-[11px] text-slate-600 font-medium">{dateString}</p>
            <p className="text-xs font-bold text-slate-800 font-mono">{timeString}</p>
          </div>
        </div>

        {/* Quick Deduction Modal Trigger */}
        <button
          onClick={onOpenDeductionModal}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-900/10 transition-colors"
          title="Manage Deduction Reasons"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
          <span>Deductions</span>
        </button>

        {/* Notification Bell */}
        <button className="p-2 text-slate-600 hover:bg-emerald-50 rounded-full relative transition-colors" title="Notifications">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-600 rounded-full border-2 border-white"></span>
        </button>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden lg:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
