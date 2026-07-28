import { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { BarChart3, Download, Scale, DollarSign, Receipt, Filter, TrendingUp, Store } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// Consistent color per product/category name across every chart on this page
// (pie slices, stacked bars, per-branch mini-charts) — same category always
// gets the same color, so the dashboard reads at a glance.
const PALETTE = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];
const colorForCategory = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};
const BRANCH_COLORS = ['#4f46e5', '#059669', '#d97706', '#db2777', '#0891b2', '#7c3aed'];

const tooltipStyle = { backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' };

export function ReportsAnalytics() {
  const { user } = usePos();
  const isAdmin = user?.role === 'admin';

  const [reportMode, setReportMode] = useState<'daily' | 'monthly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branches, setBranches] = useState<string[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const toDateInput = (d: Date) => d.toISOString().split('T')[0];

  const applyReportMode = (mode: 'daily' | 'monthly' | 'custom') => {
    setReportMode(mode);
    const now = new Date();
    if (mode === 'daily') {
      const today = toDateInput(now);
      setStartDate(today);
      setEndDate(today);
    } else if (mode === 'monthly') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toDateInput(firstOfMonth));
      setEndDate(toDateInput(now));
    }
    // 'custom' leaves startDate/endDate as-is for manual editing
  };

  // Default to "This Month" on first load
  useEffect(() => {
    applyReportMode('monthly');
  }, []);

  // Load branch list for the filter dropdown (admin only)
  useEffect(() => {
    if (!isAdmin) return;
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
  }, [isAdmin]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedBranch && selectedBranch !== 'all') params.append('branchName', selectedBranch);

      const res = await fetch(`/api/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('alona_token')}` },
      });

      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, selectedBranch]);

  // Export CSV helper
  const handleExportCSV = () => {
    if (!report || !report.topCategories) return;

    let csvContent = 'data:text/csv;charset=utf-8,Category,Total Net Weight (kg),Total Revenue (Rs.)\n';

    report.topCategories.forEach((row: any) => {
      csvContent += `"${row.category}",${row.weight},${row.revenue}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Alona_POS_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const topCategories = report?.topCategories || [];
  const salesByDate = report?.salesByDate || [];
  const branchPerformance = report?.branchPerformance || [];
  const categoryNames: string[] = report?.categoryNames || [];
  const categoryDailyTrend = report?.categoryDailyTrend || [];
  const monthlyTrend = report?.monthlyTrend || [];
  const categoryMonthlyTrend = report?.categoryMonthlyTrend || [];
  const branchCategoryBreakdown = report?.branchCategoryBreakdown || [];

  const avgPerBill = report?.totalBills > 0 ? (report.totalRevenue / report.totalBills) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-6 rounded-2xl shadow-lg">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6" /> {isAdmin ? 'Business Reports & Branch Analytics' : 'My Branch Sales Report'}
          </h2>
          <p className="text-xs text-indigo-100 mt-1">
            {isAdmin
              ? 'Daily & monthly sales, product-wise weight trends, and branch-by-branch performance.'
              : 'Your daily and monthly sales, and product-wise weight volumes.'}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-white hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl text-xs shadow-lg flex items-center gap-1.5 transition-all shrink-0"
        >
          <Download className="w-4 h-4" /> Export Report to CSV
        </button>
      </div>

      {/* Date & Branch Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-md flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="font-bold text-slate-700 dark:text-slate-300">Report View:</span>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-1 gap-1">
          {(['daily', 'monthly', 'custom'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => applyReportMode(mode)}
              className={`px-3.5 py-1.5 rounded-lg font-bold capitalize transition-colors ${
                reportMode === mode
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-slate-600 dark:text-slate-500">From:</label>
          <input
            type="date"
            value={startDate}
            disabled={reportMode !== 'custom'}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-slate-600 dark:text-slate-500">To:</label>
          <input
            type="date"
            value={endDate}
            disabled={reportMode !== 'custom'}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <label className="text-slate-600 dark:text-slate-500">Branch:</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Branches (combined)</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        {(startDate || endDate || selectedBranch !== 'all') && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setSelectedBranch('all');
            }}
            className="text-amber-600 dark:text-amber-400 hover:underline font-semibold ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* KPI Cards — colorful gradient cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-between shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50">
          <div>
            <span className="text-[11px] font-bold text-indigo-100 uppercase">Filtered Revenue</span>
            <h3 className="text-2xl font-bold text-white mt-1">Rs. {report?.totalRevenue?.toLocaleString() || 0}</h3>
          </div>
          <div className="p-3 bg-white/15 text-white rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-between shadow-lg shadow-amber-200 dark:shadow-amber-950/50">
          <div>
            <span className="text-[11px] font-bold text-amber-100 uppercase">Net Weight Processed</span>
            <h3 className="text-2xl font-bold text-white mt-1">{report?.totalWeight?.toLocaleString() || 0} kg</h3>
          </div>
          <div className="p-3 bg-white/15 text-white rounded-xl">
            <Scale className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-200 dark:shadow-emerald-950/50">
          <div>
            <span className="text-[11px] font-bold text-emerald-100 uppercase">Verified Bills</span>
            <h3 className="text-2xl font-bold text-white mt-1">{report?.totalBills || 0}</h3>
          </div>
          <div className="p-3 bg-white/15 text-white rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-fuchsia-500 to-pink-600 rounded-2xl flex items-center justify-between shadow-lg shadow-fuchsia-200 dark:shadow-fuchsia-950/50">
          <div>
            <span className="text-[11px] font-bold text-fuchsia-100 uppercase">Avg. Revenue / Bill</span>
            <h3 className="text-2xl font-bold text-white mt-1">Rs. {avgPerBill.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="p-3 bg-white/15 text-white rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Daily Sales Trend (within selected filter range) */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
          Daily Sales Trend — Revenue &amp; Net Weight (Selected Range)
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={salesByDate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis yAxisId="left" stroke="#4f46e5" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar yAxisId="right" dataKey="weight" name="Net Weight (kg)" fill="#fbbf24" radius={[6, 6, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue (Rs.)" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Weight by Product (stacked, colored by product) */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
          Daily Net Weight (kg) by Product — Selected Range
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryDailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              {categoryNames.map((cat) => (
                <Bar key={cat} dataKey={cat} name={cat} stackId="products" fill={colorForCategory(cat)} radius={[0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Trend (last 12 months, independent of the date filter above) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
            Monthly Net Weight (kg) Trend — Last 12 Months
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="weight" name="Net Weight (kg)" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
            Monthly Revenue Trend — Last 12 Months
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="revenue" name="Revenue (Rs.)" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Weight by Product (stacked, colored by product) */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
          Monthly Net Weight (kg) by Product — Last 12 Months
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryMonthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              {categoryNames.map((cat) => (
                <Bar key={cat} dataKey={cat} name={cat} stackId="products" fill={colorForCategory(cat)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Share Pie + Weight Bar (aggregate totals for selected range) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
            Revenue Share by Product Category
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topCategories}
                  dataKey="revenue"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label={(entry) => `${entry.category}`}
                >
                  {topCategories.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={colorForCategory(entry.category)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
            Total Net Weight (kg) per Category
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCategories}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="category" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
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

      {/* Admin only: Branch Performance + per-branch product breakdown */}
      {isAdmin && (
        <>
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Branch Performance — Revenue &amp; Weight
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="branchName" stroke="#64748b" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#4f46e5" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue (Rs.)" radius={[6, 6, 0, 0]}>
                    {branchPerformance.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={BRANCH_COLORS[index % BRANCH_COLORS.length]} />
                    ))}
                  </Bar>
                  <Bar yAxisId="right" dataKey="weight" name="Net Weight (kg)" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {selectedBranch === 'all' && branchCategoryBreakdown.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm px-1 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Product Breakdown — Each Branch Separately
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {branchCategoryBreakdown.map((branch: any) => (
                  <div key={branch.branchName} className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md space-y-3">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                      {branch.branchName}
                    </h4>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={branch.categories}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="category" stroke="#64748b" fontSize={10} />
                          <YAxis stroke="#64748b" fontSize={10} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="weight" name="Net Weight (kg)" radius={[6, 6, 0, 0]}>
                            {branch.categories.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={colorForCategory(entry.category)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Aggregate Category Summary Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-base pb-3 border-b border-slate-100 dark:border-slate-800">
          Aggregated Category Summary Table
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-500 uppercase font-bold border-b border-slate-300 dark:border-slate-800">
                <th className="p-3">Category Name</th>
                <th className="p-3 text-right">Net Weight Processed (kg)</th>
                <th className="p-3 text-right">Total Revenue (Rs.)</th>
                <th className="p-3 text-right">Average Price / kg (Rs.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {topCategories.map((cat: any, idx: number) => {
                const avgPrice = cat.weight > 0 ? (cat.revenue / cat.weight).toFixed(2) : '0.00';
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorForCategory(cat.category) }} />
                      {cat.category}
                    </td>
                    <td className="p-3 text-right font-bold text-amber-600 dark:text-amber-400">{cat.weight.toFixed(2)} kg</td>
                    <td className="p-3 text-right font-black text-indigo-600 dark:text-indigo-400">Rs. {cat.revenue.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-600 dark:text-slate-300">Rs. {avgPrice} / kg</td>
                  </tr>
                );
              })}

              {topCategories.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 text-xs">
                    No sales data available for selected filter range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
