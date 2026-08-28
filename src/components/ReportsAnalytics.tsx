import { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { BarChart3, Download, Scale, DollarSign, Receipt, Filter, TrendingUp, Store, CheckSquare, Square, Package, FileText, CalendarDays } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bill } from '../types';
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
  const { user, products } = usePos();
  const isAdmin = user?.role === 'admin';

  // [FIX: bill-report-tab] Page-level tab: the original scrolling dashboard
  // (charts, PDF-downloadable Daily Bill Summary, etc.) vs the new on-screen
  // "Bill Report" — pick a date, tick specific products, click Generate,
  // and see a plain line-item table (no PDF) with a totals row.
  const [pageTab, setPageTab] = useState<'dashboard' | 'billReport'>('dashboard');

  const [reportMode, setReportMode] = useState<'daily' | 'monthly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branches, setBranches] = useState<string[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // [FIX: bill-report-tab] State for the new "Bill Report" tab, kept fully
  // separate from the Daily Bill Summary state above so the two features
  // never interfere with each other.
  const [billReportDate, setBillReportDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [billReportBranch, setBillReportBranch] = useState<string>('all');
  const [billReportSelectedProducts, setBillReportSelectedProducts] = useState<string[]>([]);
  const [billReportBills, setBillReportBills] = useState<Bill[]>([]);
  const [billReportLoading, setBillReportLoading] = useState(false);
  const [billReportGenerated, setBillReportGenerated] = useState(false);

  const fetchBillReportBills = async (date: string, branch: string) => {
    if (!date) return;
    setBillReportLoading(true);
    try {
      const params = new URLSearchParams({ startDate: date, endDate: date });
      if (isAdmin && branch !== 'all') params.append('branchName', branch);
      const res = await fetch(`/api/bills?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('alona_token')}` },
      });
      setBillReportBills(res.ok ? await res.json() : []);
    } catch {
      setBillReportBills([]);
    } finally {
      setBillReportLoading(false);
    }
  };

  // Once a report has been generated, keep it live if the date or branch changes.
  useEffect(() => {
    if (billReportGenerated) fetchBillReportBills(billReportDate, billReportBranch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billReportDate, billReportBranch]);

  const toggleBillReportProduct = (name: string) => {
    setBillReportSelectedProducts((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
  };

  const handleGenerateBillReport = () => {
    if (!billReportDate || billReportSelectedProducts.length === 0) return;
    setBillReportGenerated(true);
    fetchBillReportBills(billReportDate, billReportBranch);
  };

  // One row per matching product line-item, sorted chronologically, with
  // Tare/Wet weight split out from that line's named deductions.
  const billReportRows = billReportBills
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .flatMap((bill) =>
      bill.items
        .filter((item) => billReportSelectedProducts.includes(item.productName))
        .map((item) => ({
          bill,
          item,
          dateLabel: new Date(bill.createdAt).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          tareWeight: item.deductions.filter((d) => d.reason.toLowerCase().includes('tare')).reduce((s, d) => s + d.amount, 0),
          wetWeight: item.deductions.filter((d) => d.reason.toLowerCase().includes('wet')).reduce((s, d) => s + d.amount, 0),
        }))
    );

  const billReportTotals = billReportRows.reduce(
    (acc, r) => ({
      grossWeight: acc.grossWeight + r.item.grossWeight,
      tareWeight: acc.tareWeight + r.tareWeight,
      wetWeight: acc.wetWeight + r.wetWeight,
      netWeight: acc.netWeight + r.item.netWeight,
      total: acc.total + r.item.lineTotal,
    }),
    { grossWeight: 0, tareWeight: 0, wetWeight: 0, netWeight: 0, total: 0 }
  );

  // [FIX: daily-bill-summary-report] Day Summary — one line-item row per
  // product sold that day, independent of the aggregated report/date-range
  // filters above (this always looks at a single calendar day). Fetches
  // full bills (with items) directly rather than reusing the shared
  // `bills` context state, so it doesn't clash with what Bills History or
  // anything else has loaded there.
  const [summaryDate, setSummaryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [summaryBranch, setSummaryBranch] = useState<string>('all');
  const [summaryBills, setSummaryBills] = useState<Bill[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchDailySummary = async () => {
    if (!summaryDate) return;
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({ startDate: summaryDate, endDate: summaryDate });
      if (isAdmin && summaryBranch !== 'all') params.append('branchName', summaryBranch);
      const res = await fetch(`/api/bills?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('alona_token')}` },
      });
      setSummaryBills(res.ok ? await res.json() : []);
    } catch {
      setSummaryBills([]);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchDailySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryDate, summaryBranch]);

  // Flatten every bill into one row per product line for the day
  const summaryRows = summaryBills
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .flatMap((bill) =>
      bill.items.map((item) => ({
        bill,
        item,
        dateTime: new Date(bill.createdAt).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        deductionText:
          item.deductions.length > 0
            ? item.deductions.map((d) => `${d.reason}: ${d.amount.toFixed(2)}kg`).join(', ')
            : '-',
        deductionKg: item.deductions.reduce((s, d) => s + d.amount, 0),
      }))
    );

  const summaryShopName = isAdmin
    ? summaryBranch === 'all'
      ? 'All Branches'
      : summaryBranch
    : summaryBills[0]?.branchName || summaryBills[0]?.companyName || 'My Branch';

  const summaryDateLabel = summaryDate
    ? new Date(summaryDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const summaryTotals = summaryRows.reduce(
    (acc, r) => ({
      grossWeight: acc.grossWeight + r.item.grossWeight,
      deductionKg: acc.deductionKg + r.deductionKg,
      netWeight: acc.netWeight + r.item.netWeight,
      total: acc.total + r.item.lineTotal,
    }),
    { grossWeight: 0, deductionKg: 0, netWeight: 0, total: 0 }
  );

  const handleDownloadDailySummaryPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(summaryShopName, pageWidth / 2, 40, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Daily Bill Summary — ${summaryDateLabel}`, pageWidth / 2, 58, { align: 'center' });

    autoTable(doc, {
      startY: 78,
      head: [[
        'Date & Time',
        'Bill No',
        'Products in Bill',
        'Product (Price / kg)',
        'Gross (kg)',
        'Deduction (Reason: kg)',
        'Net Weight (kg)',
        'Total (Rs.)',
      ]],
      body: summaryRows.map((r) => [
        r.dateTime,
        r.bill.billNumber,
        String(r.bill.items.length),
        `${r.item.productName} (Rs. ${r.item.rate.toFixed(2)}/kg)`,
        r.item.grossWeight.toFixed(2),
        r.deductionText,
        r.item.netWeight.toFixed(2),
        r.item.lineTotal.toFixed(2),
      ]),
      foot: [[
        '', '', '', 'DAY TOTAL',
        summaryTotals.grossWeight.toFixed(2),
        summaryTotals.deductionKg.toFixed(2) + ' kg',
        summaryTotals.netWeight.toFixed(2),
        summaryTotals.total.toFixed(2),
      ]],
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [238, 242, 255], textColor: [30, 27, 75], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`Daily_Bill_Summary_${summaryShopName.replace(/\s+/g, '_')}_${summaryDate}.pdf`);
  };

  const toggleProduct = (cat: string) => {
    setSelectedProducts((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

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
  const productAnalysis: any[] = report?.productAnalysis || [];

  const avgPerBill = report?.totalBills > 0 ? (report.totalRevenue / report.totalBills) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-md">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> {isAdmin ? 'Business Reports & Branch Analytics' : 'My Branch Sales Report'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
            {isAdmin
              ? 'Daily & monthly sales, product-wise weight trends, and branch-by-branch performance.'
              : 'Your daily and monthly sales, and product-wise weight volumes.'}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50 flex items-center gap-1.5 transition-all shrink-0"
        >
          <Download className="w-4 h-4" /> Export Report to CSV
        </button>
      </div>

      {/* [FIX: bill-report-tab] Page-level tabs */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-1 gap-1 w-fit">
        <button
          onClick={() => setPageTab('dashboard')}
          className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors ${
            pageTab === 'dashboard'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setPageTab('billReport')}
          className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors ${
            pageTab === 'billReport'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          Bill Report
        </button>
      </div>

      {pageTab === 'billReport' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
            <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Bill Report
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                  Select a date, tick the products you want, then click Generate to view the line items on screen.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <label className="text-slate-600 dark:text-slate-500">Date:</label>
                  <input
                    type="date"
                    value={billReportDate}
                    onChange={(e) => setBillReportDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <label className="text-slate-600 dark:text-slate-500">Branch:</label>
                    <select
                      value={billReportBranch}
                      onChange={(e) => setBillReportBranch(e.target.value)}
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

                <button
                  onClick={handleGenerateBillReport}
                  disabled={billReportSelectedProducts.length === 0 || !billReportDate}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50 flex items-center gap-1.5 transition-all shrink-0"
                >
                  <BarChart3 className="w-4 h-4" /> Generate
                </button>
              </div>
            </div>

            {/* Product tick-list */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Products</span>
                {billReportSelectedProducts.length > 0 && (
                  <button
                    onClick={() => setBillReportSelectedProducts([])}
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                  >
                    Clear Selection ({billReportSelectedProducts.length})
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {products
                  .filter((p) => p.status === 'active')
                  .map((p) => {
                    const isSelected = billReportSelectedProducts.includes(p.name);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleBillReportProduct(p.name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                        )}
                        {p.name}
                      </button>
                    );
                  })}

                {products.filter((p) => p.status === 'active').length === 0 && (
                  <p className="text-xs text-slate-500">No active products found.</p>
                )}
              </div>
            </div>

            {/* On-screen report — only shown once Generate has been clicked */}
            {billReportGenerated ? (
              <div className="p-6 pt-4 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-500 uppercase font-bold border-b border-slate-300 dark:border-slate-800">
                      <th className="p-3">Date</th>
                      <th className="p-3">Bill Number</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Gross Weight</th>
                      <th className="p-3 text-right">Tare Weight</th>
                      <th className="p-3 text-right">Wet Weight</th>
                      <th className="p-3 text-right">Net Weight</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {billReportRows.map((r, idx) => (
                      <tr key={`${r.bill.id}-${r.item.id}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{r.dateLabel}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{r.bill.billNumber}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{r.item.productName}</td>
                        <td className="p-3 text-right text-slate-700 dark:text-slate-300">{r.item.grossWeight.toFixed(2)}</td>
                        <td className="p-3 text-right text-slate-700 dark:text-slate-300">{r.tareWeight.toFixed(2)}</td>
                        <td className="p-3 text-right text-slate-700 dark:text-slate-300">{r.wetWeight.toFixed(2)}</td>
                        <td className="p-3 text-right font-semibold text-amber-600 dark:text-amber-400">{r.item.netWeight.toFixed(2)}</td>
                        <td className="p-3 text-right text-slate-700 dark:text-slate-300">{r.item.rate.toFixed(2)}</td>
                        <td className="p-3 text-right font-black text-indigo-600 dark:text-indigo-400">{r.item.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))}

                    {billReportRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-500 text-xs">
                          {billReportLoading ? 'Loading…' : 'No matching bills for the selected date and products.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {billReportRows.length > 0 && (
                    <tfoot>
                      <tr className="bg-indigo-50/60 dark:bg-indigo-950/30 font-bold border-t-2 border-indigo-200 dark:border-indigo-900">
                        <td className="p-3" colSpan={3}>
                          TOTAL
                        </td>
                        <td className="p-3 text-right text-slate-900 dark:text-slate-100">{billReportTotals.grossWeight.toFixed(2)}</td>
                        <td className="p-3 text-right text-slate-900 dark:text-slate-100">{billReportTotals.tareWeight.toFixed(2)}</td>
                        <td className="p-3 text-right text-slate-900 dark:text-slate-100">{billReportTotals.wetWeight.toFixed(2)}</td>
                        <td className="p-3 text-right text-amber-700 dark:text-amber-400">{billReportTotals.netWeight.toFixed(2)}</td>
                        <td className="p-3"></td>
                        <td className="p-3 text-right text-indigo-700 dark:text-indigo-400">{billReportTotals.total.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                Tick one or more products above and click Generate to view the report.
              </div>
            )}
          </div>
        </div>
      )}

      {pageTab === 'dashboard' && (
      <>
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

      {/* Daily Bill Summary — line-item-level report for a single day, downloadable as PDF */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
        <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Daily Bill Summary
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
              Every product line from every bill on a single day, with gross weight, deductions, net weight and total.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-slate-600 dark:text-slate-500">Date:</label>
              <input
                type="date"
                value={summaryDate}
                onChange={(e) => setSummaryDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <label className="text-slate-600 dark:text-slate-500">Branch:</label>
                <select
                  value={summaryBranch}
                  onChange={(e) => setSummaryBranch(e.target.value)}
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

            <button
              onClick={handleDownloadDailySummaryPDF}
              disabled={summaryRows.length === 0}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50 flex items-center gap-1.5 transition-all shrink-0"
            >
              <FileText className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </div>

        {/* Nicely styled header shown on-screen too — shop name + date */}
        <div className="px-6 pt-4 text-center">
          <h4 className="text-lg font-black text-slate-900 dark:text-white">{summaryShopName}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{summaryDateLabel}</p>
        </div>

        <div className="p-6 pt-3 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-500 uppercase font-bold border-b border-slate-300 dark:border-slate-800">
                <th className="p-3">Date &amp; Time</th>
                <th className="p-3">Bill No</th>
                <th className="p-3 text-right">Products in Bill</th>
                <th className="p-3">Product (Price / kg)</th>
                <th className="p-3 text-right">Gross (kg)</th>
                <th className="p-3">Deduction (Reason: kg)</th>
                <th className="p-3 text-right">Net Weight (kg)</th>
                <th className="p-3 text-right">Total (Rs.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {summaryRows.map((r, idx) => (
                <tr key={`${r.bill.id}-${r.item.id}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{r.dateTime}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{r.bill.billNumber}</td>
                  <td className="p-3 text-right text-slate-700 dark:text-slate-300">{r.bill.items.length}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">
                    {r.item.productName} <span className="text-slate-400">(Rs. {r.item.rate.toFixed(2)}/kg)</span>
                  </td>
                  <td className="p-3 text-right text-slate-700 dark:text-slate-300">{r.item.grossWeight.toFixed(2)}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{r.deductionText}</td>
                  <td className="p-3 text-right font-semibold text-amber-600 dark:text-amber-400">{r.item.netWeight.toFixed(2)}</td>
                  <td className="p-3 text-right font-black text-indigo-600 dark:text-indigo-400">{r.item.lineTotal.toFixed(2)}</td>
                </tr>
              ))}

              {summaryRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                    {summaryLoading ? 'Loading…' : 'No bills for this day.'}
                  </td>
                </tr>
              )}
            </tbody>
            {summaryRows.length > 0 && (
              <tfoot>
                <tr className="bg-indigo-50/60 dark:bg-indigo-950/30 font-bold border-t-2 border-indigo-200 dark:border-indigo-900">
                  <td className="p-3" colSpan={4}>
                    DAY TOTAL
                  </td>
                  <td className="p-3 text-right text-slate-900 dark:text-slate-100">{summaryTotals.grossWeight.toFixed(2)}</td>
                  <td className="p-3 text-slate-900 dark:text-slate-100">{summaryTotals.deductionKg.toFixed(2)} kg</td>
                  <td className="p-3 text-right text-amber-700 dark:text-amber-400">{summaryTotals.netWeight.toFixed(2)}</td>
                  <td className="p-3 text-right text-indigo-700 dark:text-indigo-400">{summaryTotals.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase">Filtered Revenue</span>
            <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">Rs. {report?.totalRevenue?.toLocaleString() || 0}</h3>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase">Net Weight Processed</span>
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{report?.totalWeight?.toLocaleString() || 0} kg</h3>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 rounded-xl">
            <Scale className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase">Verified Bills</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{report?.totalBills || 0}</h3>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase">Avg. Revenue / Bill</span>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">Rs. {avgPerBill.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-xl">
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

      {/* Product-Wise Analysis — every product, day-wise & month-wise averages */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Product-Wise Analysis (All Products)
          </h3>
          {selectedProducts.length > 0 && (
            <button
              onClick={() => setSelectedProducts([])}
              className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
            >
              Clear Selection ({selectedProducts.length})
            </button>
          )}
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-500 -mt-2">
          Click a product to select it — click more than one to see their combined performance below. Daily average = total ÷ days the product actually sold in the selected range. Monthly average = total ÷ active months in the last 12 months.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-500 uppercase font-bold border-b border-slate-300 dark:border-slate-800">
                <th className="p-3 w-8"></th>
                <th className="p-3">Product</th>
                <th className="p-3 text-right">Total Wt (kg)</th>
                <th className="p-3 text-right">Total Revenue</th>
                <th className="p-3 text-right">Avg Price / kg</th>
                <th className="p-3 text-right">Daily Avg (kg)</th>
                <th className="p-3 text-right">Monthly Avg (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {productAnalysis.map((p) => {
                const isSelected = selectedProducts.includes(p.category);
                return (
                  <tr
                    key={p.category}
                    onClick={() => toggleProduct(p.category)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}
                  >
                    <td className="p-3">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                      )}
                    </td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorForCategory(p.category) }} />
                      {p.category}
                    </td>
                    <td className="p-3 text-right font-bold text-amber-600 dark:text-amber-400">{p.totalWeight.toFixed(2)} kg</td>
                    <td className="p-3 text-right font-black text-indigo-600 dark:text-indigo-400">Rs. {p.totalRevenue.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-700 dark:text-slate-300">Rs. {p.avgPricePerKg.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-700 dark:text-slate-300">{p.dailyAvgWeight.toFixed(2)} kg</td>
                    <td className="p-3 text-right text-slate-700 dark:text-slate-300">{p.monthlyAvgWeight.toFixed(2)} kg</td>
                  </tr>
                );
              })}

              {productAnalysis.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 text-xs">
                    No product sales data available for selected filter range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Combined performance of selected products */}
        {selectedProducts.length > 0 && (() => {
          const selected = productAnalysis.filter((p) => selectedProducts.includes(p.category));
          const sumWeight = selected.reduce((s, p) => s + p.totalWeight, 0);
          const sumRevenue = selected.reduce((s, p) => s + p.totalRevenue, 0);
          const combinedAvgPrice = sumWeight > 0 ? sumRevenue / sumWeight : 0;
          // [FIX: product-wise-averages] Daily/Monthly averages are no longer
          // added together across the selected products — adding one
          // product's average to another's isn't a meaningful number. Each
          // product's own average is shown only in the per-product table
          // below.

          return (
            <div className="mt-2 p-5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-2xl space-y-4">
              <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-xs uppercase tracking-wide">
                Combined Performance — {selected.length} Product{selected.length > 1 ? 's' : ''} Selected
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/60">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Weight</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{sumWeight.toFixed(2)} kg</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/60">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Revenue</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white mt-1">Rs. {sumRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/60">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Avg Price / kg</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white mt-1">Rs. {combinedAvgPrice.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 -mt-1">
                Daily &amp; Monthly averages are shown per product only (see table below) — they aren't meaningful added together.
              </p>

              {/* Per-product detail breakdown within the selection */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="text-indigo-800/70 dark:text-indigo-300/70 uppercase font-bold border-b border-indigo-200 dark:border-indigo-900">
                      <th className="py-2">Product</th>
                      <th className="py-2 text-right">Daily Avg (kg)</th>
                      <th className="py-2 text-right">Daily Avg (Rs.)</th>
                      <th className="py-2 text-right">Monthly Avg (kg)</th>
                      <th className="py-2 text-right">Monthly Avg (Rs.)</th>
                      <th className="py-2 text-right">Active Days</th>
                      <th className="py-2 text-right">Active Months</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-100 dark:divide-indigo-900/50">
                    {selected.map((p) => (
                      <tr key={p.category}>
                        <td className="py-2 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorForCategory(p.category) }} />
                          {p.category}
                        </td>
                        <td className="py-2 text-right text-slate-700 dark:text-slate-300">{p.dailyAvgWeight.toFixed(2)} kg</td>
                        <td className="py-2 text-right text-slate-700 dark:text-slate-300">Rs. {p.dailyAvgRevenue.toFixed(2)}</td>
                        <td className="py-2 text-right text-slate-700 dark:text-slate-300">{p.monthlyAvgWeight.toFixed(2)} kg</td>
                        <td className="py-2 text-right text-slate-700 dark:text-slate-300">Rs. {p.monthlyAvgRevenue.toFixed(2)}</td>
                        <td className="py-2 text-right text-slate-500">{p.activeDays}</td>
                        <td className="py-2 text-right text-slate-500">{p.activeMonths}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

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
      </>
      )}
    </div>
  );
}
