import { useEffect, useState } from 'react';
import { usePos } from '../context/PosContext';
import { Bill } from '../types';
import {
  DollarSign,
  Scale,
  Receipt,
  Users,
  TrendingUp,
  Store,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  FileText,
  Filter,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Same per-category color mapping used on the Reports page, so a product
// shows the same color everywhere in the app.
const PALETTE = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];
const colorForCategory = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

interface AdminDashboardProps {
  setActiveTab: (tab: string) => void;
  onInspectBill: (bill: Bill) => void;
}

export function AdminDashboard({ setActiveTab, onInspectBill }: AdminDashboardProps) {
  const { bills } = usePos();
  const [reportsData, setReportsData] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branches, setBranches] = useState<string[]>([]);

  // Load branch list for the filter dropdown
  useEffect(() => {
    fetch('/api/users', {
      headers: { Authorization: `Bearer ${localStorage.getItem('alona_token')}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((users: any[]) => {
        const names = Array.from(
          new Set(users.filter((u) => u.role === 'branch' && u.branchName).map((u) => u.branchName))
        );
        setBranches(names);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedBranch !== 'all') params.append('branchName', selectedBranch);
    fetch(`/api/reports?${params.toString()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('alona_token')}` },
    })
      .then((res) => res.json())
      .then((data) => setReportsData(data))
      .catch(() => {});
  }, [bills, selectedBranch]);

  // Recent Transactions feed respects the same branch filter as the rest of the dashboard
  const visibleBills = selectedBranch === 'all' ? bills : bills.filter((b) => b.branchName === selectedBranch);

  const totalRevenue = reportsData?.totalRevenue || 0;
  const totalWeight = reportsData?.totalWeight || 0;
  const totalBills = reportsData?.totalBills || bills.length;

  const salesByDate = reportsData?.salesByDate || [];
  const topCategories = reportsData?.topCategories || [];
  const branchPerformance = reportsData?.branchPerformance || [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-md">
        <div>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 text-[11px] font-bold rounded-full inline-flex items-center gap-1 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> ADMIN CONTROL CENTER
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">System Dashboard & Business Overview</h2>
          <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
            Real-time branch telemetry, total weight processed, revenue analytics, and quick administration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('users')}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> + Branch Account
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50 flex items-center gap-1.5 transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" /> Full Reports
          </button>
        </div>
      </div>

      {/* Branch Filter — view each shop separately, or combined */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-md flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="font-bold text-slate-700 dark:text-slate-300">Viewing:</span>
        </div>
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-1 gap-1 flex-wrap">
          <button
            onClick={() => setSelectedBranch('all')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
              selectedBranch === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            All Branches (Combined)
          </button>
          {branches.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBranch(b)}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
                selectedBranch === b
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Rs. {totalRevenue.toLocaleString()}</h3>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-1 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" /> Live sales aggregation
            </p>
          </div>
        </div>

        {/* Weight Processed Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weight Processed</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{totalWeight.toLocaleString()} kg</h3>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1 font-semibold">
              Verified net scale weight
            </p>
          </div>
        </div>

        {/* Total Bills Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bills</span>
            <div className="p-2 bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{totalBills}</h3>
            <p className="text-[11px] text-sky-600 dark:text-sky-400 flex items-center gap-1 mt-1 font-semibold">
              Transactions recorded
            </p>
          </div>
        </div>

        {/* Active Branches Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Terminals</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{branchPerformance.length || 2}</h3>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-1 font-semibold">
              Operational weighing counters
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Revenue Trend Chart */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Revenue Sales Trend (Rs.)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-500">
                {selectedBranch === 'all' ? 'Daily gross revenue across all branches' : `Daily gross revenue — ${selectedBranch}`}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('reports')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
            >
              Full Reports <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByDate}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e1b4b', borderColor: '#4338ca', color: '#fff', borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" dot={{ r: 3, fill: '#7c3aed' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Weight Breakdown Chart */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Weight Processed by Category (kg)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-500">Net quantity distribution by product category</p>
            </div>
            <button
              onClick={() => setActiveTab('reports')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
            >
              Category Details <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCategories}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="category" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e1b4b', borderColor: '#4338ca', color: '#fff', borderRadius: '12px' }}
                />
                <Bar dataKey="weight" radius={[6, 6, 0, 0]}>
                  {topCategories.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={colorForCategory(entry.category)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Bills & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Bills (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Recent Transactions Feed</h3>
            <button
              onClick={() => setActiveTab('bills')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              View All Bills
            </button>
          </div>

          <div className="space-y-2">
            {visibleBills.slice(0, 5).map((bill) => (
              <div
                key={bill.id}
                onClick={() => onInspectBill(bill)}
                className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 hover:border-indigo-500 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all hover:translate-x-1"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{bill.billNumber}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md font-semibold">
                      {bill.branchName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-500 mt-0.5">
                    {bill.customerName || 'Cash Customer'} • {bill.items.length} line items ({bill.totalNetWeight} kg)
                  </p>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">Rs. {bill.totalAmount.toFixed(2)}</span>
                  <p className="text-[10px] text-slate-500">{new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Administration Shortcuts (1 col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 shadow-md space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">Admin Control Panel</h3>

          <button
            onClick={() => setActiveTab('settings')}
            className="w-full p-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 rounded-xl text-left flex items-center gap-3 transition-colors group"
          >
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Bill Template Settings</p>
              <p className="text-[10px] text-slate-600 dark:text-slate-500">Edit company logo, phones & footer</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className="w-full p-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 rounded-xl text-left flex items-center gap-3 transition-colors group"
          >
            <div className="p-2 bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 rounded-lg group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Branch User Accounts</p>
              <p className="text-[10px] text-slate-600 dark:text-slate-500">Add/deactivate branch cashier accounts</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className="w-full p-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 rounded-xl text-left flex items-center gap-3 transition-colors group"
          >
            <div className="p-2 bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-105 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Manage Products</p>
              <p className="text-[10px] text-slate-600 dark:text-slate-500">Add raw materials & goods categories</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
