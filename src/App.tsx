import { useState } from 'react';
import { PosProvider, usePos } from './context/PosContext';
import { LoginScreen } from './components/LoginScreen';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AdminDashboard } from './components/AdminDashboard';
import { BranchBillingScreen } from './components/BranchBillingScreen';
import { UserManagement } from './components/UserManagement';
import { BillTemplateSettings } from './components/BillTemplateSettings';
import { ProductManagement } from './components/ProductManagement';
import { BillsHistory } from './components/BillsHistory';
import { ReportsAnalytics } from './components/ReportsAnalytics';
import { DeductionSettingsModal } from './components/DeductionSettingsModal';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { Toasts } from './components/Toasts';
import { Bill } from './types';
import { LayoutDashboard, Calculator, Users, Package, FileText, Receipt, BarChart3, SlidersHorizontal } from 'lucide-react';

function MainAppContent() {
  const { user, loading } = usePos();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>(user?.role === 'admin' ? 'dashboard' : 'billing');

  // Modals state
  const [isDeductionModalOpen, setIsDeductionModalOpen] = useState(false);
  const [printBillModal, setPrintBillModal] = useState<Bill | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen text-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3 animate-pulse">
          <img
            src="/alona-logo.png"
            alt="Alona"
            className="w-14 h-14 object-contain rounded-2xl mx-auto"
          />
          <p className="text-sm font-semibold text-slate-500">Loading Alona POS System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen />
        <Toasts />
      </>
    );
  }

  return (
    <div className="min-h-screen text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar onOpenDeductionModal={() => setIsDeductionModalOpen(true)} />

      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Workspace Area */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          {activeTab === 'dashboard' && user.role === 'admin' && (
            <AdminDashboard
              setActiveTab={setActiveTab}
              onInspectBill={(bill) => setPrintBillModal(bill)}
            />
          )}

          {activeTab === 'billing' && (
            <BranchBillingScreen
              onOpenDeductionModal={() => setIsDeductionModalOpen(true)}
              onBillCreated={(bill) => setPrintBillModal(bill)}
            />
          )}

          {activeTab === 'users' && user.role === 'admin' && <UserManagement />}

          {activeTab === 'settings' && user.role === 'admin' && <BillTemplateSettings />}

          {activeTab === 'products' && <ProductManagement />}

          {activeTab === 'deductions' && user.role === 'admin' && (
            <div className="p-6">
              <button
                onClick={() => setIsDeductionModalOpen(true)}
                className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 shadow-md transition-colors"
              >
                Open Deduction Reasons Manager
              </button>
            </div>
          )}

          {activeTab === 'bills' && (
            <BillsHistory onReprintBill={(bill) => setPrintBillModal(bill)} />
          )}

          {activeTab === 'reports' && user.role === 'admin' && <ReportsAnalytics />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Visible on phones) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-emerald-900/10 flex items-center justify-around py-2 z-40">
        {user.role === 'admin' && (
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`p-2 flex flex-col items-center text-[10px] ${
              activeTab === 'dashboard' ? 'text-emerald-700 font-bold' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('billing')}
          className={`p-2 flex flex-col items-center text-[10px] ${
            activeTab === 'billing' ? 'text-emerald-700 font-bold' : 'text-slate-500'
          }`}
        >
          <Calculator className="w-5 h-5" />
          <span>Billing</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`p-2 flex flex-col items-center text-[10px] ${
            activeTab === 'products' ? 'text-emerald-700 font-bold' : 'text-slate-500'
          }`}
        >
          <Package className="w-5 h-5" />
          <span>Products</span>
        </button>

        <button
          onClick={() => setActiveTab('bills')}
          className={`p-2 flex flex-col items-center text-[10px] ${
            activeTab === 'bills' ? 'text-emerald-700 font-bold' : 'text-slate-500'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span>Bills</span>
        </button>

        {user.role === 'admin' && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`p-2 flex flex-col items-center text-[10px] ${
              activeTab === 'reports' ? 'text-emerald-700 font-bold' : 'text-slate-500'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Reports</span>
          </button>
        )}
      </div>

      {/* Modals */}
      {isDeductionModalOpen && (
        <DeductionSettingsModal onClose={() => setIsDeductionModalOpen(false)} />
      )}

      {printBillModal && (
        <PrintReceiptModal bill={printBillModal} onClose={() => setPrintBillModal(null)} />
      )}

      {/* Toast Stack */}
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <PosProvider>
      <MainAppContent />
    </PosProvider>
  );
}
