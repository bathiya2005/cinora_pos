import { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { Bill } from '../types';
import { Receipt, Search, Printer, Eye, X, Filter, Trash2 } from 'lucide-react';

interface BillsHistoryProps {
  onReprintBill: (bill: Bill) => void;
}

export function BillsHistory({ onReprintBill }: BillsHistoryProps) {
  const { user, bills, fetchBills, deleteBill } = usePos();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const handleDelete = async (bill: Bill) => {
    if (!confirm(`Delete bill ${bill.billNumber}? This will permanently remove it from Bill History and Reports.`)) return;
    const ok = await deleteBill(bill.id);
    if (ok && selectedBill?.id === bill.id) setSelectedBill(null);
  };

  useEffect(() => {
    fetchBills({
      search,
      branchName: selectedBranch !== 'all' ? selectedBranch : '',
    });
  }, [search, selectedBranch]);

  const branchesList = Array.from(new Set(bills.map((b) => b.branchName)));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-md">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Bill Transaction History
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
            Search, inspect internal scale deductions, and reprint past receipts.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-md flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search by Bill #, Customer Name, or Product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
            >
              <option value="all">All Branches</option>
              {branchesList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bills Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-500 uppercase font-bold border-b border-slate-300 dark:border-slate-800">
                <th className="p-4">Bill #</th>
                <th className="p-4">Date & Time</th>
                <th className="p-4">Branch</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Net Weight</th>
                <th className="p-4 text-right">Grand Total</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{bill.billNumber}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    {new Date(bill.createdAt).toLocaleDateString()} {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-md font-semibold text-[11px]">
                      {bill.branchName}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-slate-700 dark:text-slate-200">{bill.customerName || 'Cash Customer'}</td>
                  <td className="p-4 font-bold text-amber-600 dark:text-amber-400">{bill.totalNetWeight.toFixed(2)} kg</td>
                  <td className="p-4 text-right font-black text-indigo-600 dark:text-indigo-400 text-sm">
                    Rs. {bill.totalAmount.toFixed(2)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setSelectedBill(bill)}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold flex items-center gap-1 transition-colors text-[11px]"
                        title="Inspect internal deductions"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Inspect
                      </button>
                      <button
                        onClick={() => onReprintBill(bill)}
                        className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg font-bold flex items-center gap-1 transition-colors text-[11px]"
                        title="Reprint official receipt"
                      >
                        <Printer className="w-3.5 h-3.5" /> Reprint
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(bill)}
                          className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg font-bold flex items-center gap-1 transition-colors text-[11px]"
                          title="Delete this bill record (Admin only)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {bills.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500 text-xs">
                    No bill transactions found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Bill Inspector Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4 text-slate-900 dark:text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Internal Bill Audit Record
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedBill.billNumber}</h3>
              </div>
              <button
                onClick={() => setSelectedBill(null)}
                className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bill Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-800 text-xs">
              <div>
                <p className="text-slate-500 text-[10px]">Branch:</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">{selectedBill.branchName}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px]">Created By:</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">{selectedBill.createdBy}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px]">Customer:</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">{selectedBill.customerName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px]">Date/Time:</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {new Date(selectedBill.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Line items with internal deduction breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider">
                Scale Item Lines & Internal Deductions
              </h4>
              <div className="space-y-2">
                {selectedBill.items.map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{item.productName}</span>
                        <span className="ml-2 text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 rounded">
                          {item.category}
                        </span>
                      </div>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">Rs. {item.lineTotal.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-500 pt-1 border-t border-slate-300 dark:border-slate-800/60">
                      <span>Gross Wt: <strong className="text-slate-800 dark:text-slate-200">{item.grossWeight} kg</strong></span>
                      <span>Rate: <strong className="text-slate-800 dark:text-slate-200">Rs. {item.rate.toFixed(2)}/kg</strong></span>
                      <span>Calculated Net: <strong className="text-amber-600 dark:text-amber-400">{item.netWeight.toFixed(2)} kg</strong></span>
                    </div>

                    {item.deductions.length > 0 && (
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-800 text-[11px]">
                        <p className="font-semibold text-rose-600 dark:text-rose-400 text-[10px] uppercase mb-1">
                          Internal Scale Deductions (Not printed on client receipt):
                        </p>
                        <div className="space-y-0.5">
                          {item.deductions.map((d, dIdx) => (
                            <div key={dIdx} className="flex justify-between text-slate-700 dark:text-slate-300">
                              <span>• {d.reason}</span>
                              <span className="font-bold text-rose-600 dark:text-rose-400">-{d.amount} kg</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs">
                <span className="text-slate-600 dark:text-slate-500">Bill Grand Total: </span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 text-base">Rs. {selectedBill.totalAmount.toFixed(2)}</span>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(selectedBill)}
                    className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Record
                  </button>
                )}
                <button
                  onClick={() => {
                    const b = selectedBill;
                    setSelectedBill(null);
                    onReprintBill(b);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Printer className="w-4 h-4" /> Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
