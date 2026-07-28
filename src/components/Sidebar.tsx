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

  type NavItem = { id: string; label: string; icon: typeof LayoutDashboard; badge?: string };

  const adminNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'bills', label: 'Bill History', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'users', label: 'Branch Accounts', icon: Users },
    { id: 'settings', label: 'Template Settings', icon: FileText },
    { id: 'deductions', label: 'Deductions', icon: SlidersHorizontal },
  ];

  const branchNavItems: NavItem[] = [
    { id: 'billing', label: 'Billing Terminal', icon: Calculator, badge: 'POS' },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'bills', label: 'Bill History', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  const items = isAdmin ? adminNavItems : branchNavItems;

  const userInitials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'AP';

  return (
    <aside className="w-64 bg-[#132C1D] flex flex-col shrink-0 h-[calc(100vh-4rem)] sticky top-16 hidden md:flex border-r border-black/20">
      {/* Brand Header — fixed logo, set in code (public/alona-logo.png), independent of shop settings */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-3 border-b border-white/[0.06]">
        <img
          src={SIDEBAR_LOGO_PATH}
          alt="Alona"
          className="w-9 h-9 rounded-lg object-contain bg-white shrink-0 ring-1 ring-white/10"
          onError={(e) => {
            // Falls back to the "A" mark if alona-logo.png hasn't been added to /public yet
            (e.currentTarget as HTMLImageElement).style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className="w-9 h-9 bg-emerald-500 rounded-lg hidden items-center justify-center shrink-0">
          <span className="text-white font-bold text-base">A</span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-[15px] leading-tight tracking-tight truncate">{companyName}</p>
          <p className="text-emerald-200/45 text-[10.5px] font-medium tracking-wide truncate">Weighing &amp; Billing System</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 pt-5 space-y-0.5 overflow-y-auto">
        <p className="px-3.5 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/35">Menu</p>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative w-full flex items-center justify-between pl-3.5 pr-3 py-2.5 rounded-lg text-[13.5px] transition-colors ${
                isActive
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'text-emerald-100/60 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-emerald-400" />
              )}
              <div className="flex items-center gap-3">
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-emerald-400' : 'text-emerald-100/40'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wider ${
                  isActive ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/[0.06] text-emerald-100/40'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Software Vendor Branding — same Alona logo as the login form's "Powered by Alona IT" */}
      <div className="px-3 pt-2 pb-2">
        <div className="flex items-center justify-center gap-2 py-2 rounded-lg border border-white/[0.06]">
          <img
            src={SIDEBAR_LOGO_PATH}
            alt="Alona IT"
            className="w-4 h-4 rounded object-contain shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="w-4 h-4 rounded bg-emerald-500 hidden items-center justify-center shrink-0">
            <span className="text-white font-bold text-[9px]">A</span>
          </div>
          <span className="text-emerald-100/35 text-[9.5px] font-semibold uppercase tracking-widest">
            Powered by Alona IT
          </span>
        </div>
      </div>

      {/* User Footer Profile Card */}
      <div className="px-4 py-3.5 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-[11px] font-bold text-emerald-100">
              {userInitials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#132C1D]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate leading-tight">{user?.username || 'User'}</p>
            <p className="text-[11px] text-emerald-200/45 truncate">{user?.branchName || (isAdmin ? 'System Admin' : 'Cashier')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}