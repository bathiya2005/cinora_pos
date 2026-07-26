import { usePos } from '../context/PosContext';
import {
  LayoutDashboard,
  Calculator,
  Users,
  Package,
  Receipt,
  FileText,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';

// Sidebar logo is fixed via code — place the image file at /public/alona-logo.png
// (Vite serves anything in /public from the site root, so it resolves to this path)
const SIDEBAR_LOGO_PATH = '/alona-logo.png';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { user } = usePos();
  const isAdmin = user?.role === 'admin';

  // Sidebar brand name is fixed to "Alona POS" — independent of Settings > companyName
  const companyName = 'Alona POS';

  const adminNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'Billing Terminal', icon: Calculator, badge: 'POS' },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'bills', label: 'Bill History', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'users', label: 'Branch Accounts', icon: Users },
    { id: 'settings', label: 'Template Settings', icon: FileText },
    { id: 'deductions', label: 'Deductions', icon: SlidersHorizontal },
  ];

  const branchNavItems = [
    { id: 'billing', label: 'Billing Terminal', icon: Calculator, badge: 'POS' },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'bills', label: 'Bill History', icon: Receipt },
  ];

  const items = isAdmin ? adminNavItems : branchNavItems;

  const userInitials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'AP';

  return (
    <aside className="w-64 bg-gradient-to-b from-[#1F4429] to-[#173821] flex flex-col shrink-0 h-[calc(100vh-4rem)] sticky top-16 hidden md:flex border-r border-black/10">
      {/* Brand Header — fixed logo, set in code (public/alona-logo.png), independent of shop settings */}
      <div className="p-6 flex items-center gap-3">
        <img
          src={SIDEBAR_LOGO_PATH}
          alt="Alona"
          className="w-10 h-10 rounded-lg object-contain bg-white/95 shrink-0 shadow-sm"
          onError={(e) => {
            // Falls back to the "A" mark if alona-logo.png hasn't been added to /public yet
            (e.currentTarget as HTMLImageElement).style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className="w-10 h-10 bg-emerald-500 rounded-lg hidden items-center justify-center shrink-0">
          <span className="text-white font-bold text-xl">A</span>
        </div>
        <span className="text-white font-bold text-xl tracking-tight truncate">{companyName}</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-emerald-500 text-white font-semibold shadow-sm'
                  : 'text-emerald-100/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded uppercase tracking-wider ${
                  isActive ? 'bg-white/20 text-white' : 'bg-emerald-400/20 text-emerald-300'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Software Vendor Branding — same Alona logo as the login form's "Powered by Alona IT" */}
      <div className="px-4 pb-3 pt-1">
        <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <img
            src={SIDEBAR_LOGO_PATH}
            alt="Alona IT"
            className="w-5 h-5 rounded-md object-contain shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="w-5 h-5 rounded-md bg-emerald-500 hidden items-center justify-center shrink-0">
            <span className="text-white font-bold text-[10px]">A</span>
          </div>
          <span className="text-emerald-100/60 text-[10px] font-semibold uppercase tracking-widest">
            Powered by Alona IT
          </span>
        </div>
      </div>

      {/* User Footer Profile Card */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-xs font-medium text-emerald-100 shrink-0">
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username || 'User'}</p>
            <p className="text-xs text-emerald-200/60 truncate">{user?.branchName || (isAdmin ? 'System Admin' : 'Cashier')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}