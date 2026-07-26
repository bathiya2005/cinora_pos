import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { Product, Deduction, BillItem, ExtraPayment, Bill } from '../types';
import {
  Search,
  Plus,
  Trash2,
  SlidersHorizontal,
  Printer,
  Scale,
  Minus,
  CheckCircle,
  Tag,
  Package,
} from 'lucide-react';

interface BranchBillingScreenProps {
  onOpenDeductionModal: () => void;
  onBillCreated: (bill: Bill) => void;
}

export function BranchBillingScreen({ onOpenDeductionModal, onBillCreated }: BranchBillingScreenProps) {
  const { products, deductionReasons, createBill } = usePos();

  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Cart / Line items
  const [cartItems, setCartItems] = useState<BillItem[]>([]);
  const [extraPayments, setExtraPayments] = useState<ExtraPayment[]>([]);

  // Current item builder modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rateInput, setRateInput] = useState<string>('');
  const [grossWeightInput, setGrossWeightInput] = useState<string>('');
  
  // Deductions builder for current selected product
  const [currentDeductions, setCurrentDeductions] = useState<Deduction[]>([]);
  const [deductionReason, setDeductionReason] = useState<string>('Tare Weight');
  const [deductionAmount, setDeductionAmount] = useState<string>('');

  // Extra payment builder
  const [extraReason, setExtraReason] = useState('');
  const [extraAmount, setExtraAmount] = useState('');

  // Categories list
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    if (p.status !== 'active') return false;
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  // Open item builder when a product is clicked
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setRateInput('');
    setGrossWeightInput('');
    setCurrentDeductions([]);
    // Default reason from available list
    if (deductionReasons.length > 0) {
      setDeductionReason(deductionReasons[0].name);
      setDeductionAmount(deductionReasons[0].defaultAmount ? String(deductionReasons[0].defaultAmount) : '');
    }
  };

  // Add deduction entry to current item being built
  const handleAddDeductionEntry = () => {
    const amt = Number(deductionAmount);
    if (!deductionReason || isNaN(amt) || amt <= 0) return;

    setCurrentDeductions((prev) => [...prev, { reason: deductionReason, amount: amt }]);
    setDeductionAmount('');
  };

  const handleRemoveDeductionEntry = (index: number) => {
    setCurrentDeductions((prev) => prev.filter((_, i) => i !== index));
  };

  const applyPresetDeduction = (amount: number) => {
    setCurrentDeductions((prev) => [...prev, { reason: deductionReason || 'Tare Weight', amount }]);
  };

  // Add constructed item to main cart
  const handleAddItemToCart = () => {
    if (!selectedProduct) return;
    const rate = Number(rateInput);
    const grossWeight = Number(grossWeightInput);

    if (isNaN(rate) || rate <= 0) {
      alert('Please enter a valid rate per kg');
      return;
    }

    if (isNaN(grossWeight) || grossWeight <= 0) {
      alert('Please enter a valid gross weight in kg');
      return;
    }

    const totalDeductions = currentDeductions.reduce((acc, d) => acc + d.amount, 0);
    const netWeight = Math.max(0, grossWeight - totalDeductions);
    const lineTotal = Number((netWeight * rate).toFixed(2));

    const newItem: BillItem = {
      id: `cart-${Date.now()}-${Math.random()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      category: selectedProduct.category,
      rate,
      grossWeight,
      deductions: [...currentDeductions],
      netWeight,
      lineTotal,
    };

    setCartItems((prev) => [...prev, newItem]);
    setSelectedProduct(null);
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Extra payments handling
  const handleAddExtraPayment = () => {
    const amt = Number(extraAmount);
    if (!extraReason.trim() || isNaN(amt) || amt <= 0) return;

    setExtraPayments((prev) => [...prev, { reason: extraReason.trim(), amount: amt }]);
    setExtraReason('');
    setExtraAmount('');
  };

  const handleRemoveExtraPayment = (idx: number) => {
    setExtraPayments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calculations for running bill
  const totalNetWeight = cartItems.reduce((acc, item) => acc + item.netWeight, 0);
  const itemsTotal = cartItems.reduce((acc, item) => acc + item.lineTotal, 0);
  const extraTotal = extraPayments.reduce((acc, item) => acc + item.amount, 0);
  const grandTotal = Number((itemsTotal + extraTotal).toFixed(2));

  // Finalize Bill
  const handleFinalizeBill = async () => {
    if (cartItems.length === 0) return;

    const created = await createBill({
      customerName: customerName.trim() || undefined,
      customerContact: customerContact.trim() || undefined,
      items: cartItems,
      extraPayments,
    });

    if (created) {
      setCartItems([]);
      setExtraPayments([]);
      setCustomerName('');
      setCustomerContact('');
      onBillCreated(created);
    }
  };

  // Calculation previews for current modal item
  const currentGross = Number(grossWeightInput) || 0;
  const currentRate = Number(rateInput) || 0;
  const currentSumDeductions = currentDeductions.reduce((a, d) => a + d.amount, 0);
  const currentNet = Math.max(0, currentGross - currentSumDeductions);
  const currentLineTotal = Number((currentNet * currentRate).toFixed(2));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-full">
              WEIGHING TERMINAL
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">POS Weighing & Billing Counter</h2>
          <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">
            Select goods, input gross weight, apply tare deductions, and print client receipt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenDeductionModal}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 flex items-center gap-2 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Deduction Reasons</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Grid & Item Builder (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Search & Category Filter */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search products by name or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectProduct(p)}
                className="p-4 bg-white dark:bg-slate-900 hover:border-indigo-500 border border-slate-300 dark:border-slate-800 rounded-2xl text-left transition-all duration-200 group flex flex-col justify-between h-32 shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 rounded">
                      {p.category}
                    </span>
                    <Package className="w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm line-clamp-2 mt-1">{p.name}</h3>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                  <span>Unit: {p.unit}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                    + Weigh
                  </span>
                </div>
              </button>
            ))}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl text-slate-500 text-xs shadow-md">
                No active products found matching filter.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Bill Cart & Receipt Details (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full min-h-[550px]">
            <div>
              {/* Cart Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Current Transaction Bill</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-500">Cart Items & Total Calculation</p>
                </div>
                <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 text-xs font-bold rounded-lg">
                  {cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>

              {/* Customer Name & Contact Inputs */}
              <div className="mb-4 space-y-2">
                <input
                  type="text"
                  placeholder="Customer / Trader Name (Optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                />
                <input
                  type="text"
                  placeholder="Customer Contact Number (Optional)"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                />
              </div>

              {/* Cart Items List */}
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.productName}</div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Rate: Rs. {item.rate.toFixed(2)}/kg</span>
                        <span>•</span>
                        <span>Gross: {item.grossWeight}kg</span>
                        <span>•</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          Net: {item.netWeight.toFixed(2)}kg
                        </span>
                      </div>
                      {item.deductions.length > 0 && (
                        <div className="text-[10px] text-slate-600 mt-0.5 italic">
                          Deductions: {item.deductions.map((d) => `${d.reason} (-${d.amount}kg)`).join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">Rs. {item.lineTotal.toFixed(2)}</div>
                      <button
                        onClick={() => handleRemoveCartItem(item.id)}
                        className="text-slate-500 hover:text-rose-500 p-1 rounded transition-colors mt-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {cartItems.length === 0 && (
                  <div className="py-12 text-center text-slate-500 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-xs">
                    No items in current bill. Click "+ Weigh" on a product to add.
                  </div>
                )}
              </div>

              {/* Extra Payments (+) Section */}
              {cartItems.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Extra Charge / Payment (+)</span>
                    <span className="text-[10px] font-normal text-slate-500">(Transport, Bonus)</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Reason (e.g. Freight)"
                      value={extraReason}
                      onChange={(e) => setExtraReason(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="number"
                      placeholder="Amount (Rs.)"
                      value={extraAmount}
                      onChange={(e) => setExtraAmount(e.target.value)}
                      className="w-24 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                    />
                    <button
                      onClick={handleAddExtraPayment}
                      className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 rounded-lg text-xs font-bold transition-colors hover:bg-indigo-100"
                    >
                      + Add
                    </button>
                  </div>

                  {extraPayments.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {extraPayments.map((e, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded border border-slate-300 dark:border-slate-800">
                          <span>+ {e.reason}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">+Rs. {e.amount.toFixed(2)}</span>
                            <button onClick={() => handleRemoveExtraPayment(idx)} className="text-slate-500 hover:text-rose-500">
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Running Bill Totals & Finalize Action */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 mt-4">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Total Net Weight:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{totalNetWeight.toFixed(2)} kg</span>
                </div>
                {extraTotal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Extra Charges Total:</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">+Rs. {extraTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span>GRAND TOTAL:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 text-2xl font-extrabold">Rs. {grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleFinalizeBill}
                disabled={cartItems.length === 0}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50 flex items-center justify-center gap-2 transition-all active:scale-[0.99] text-sm"
              >
                <Printer className="w-5 h-5" />
                <span>Finalize & Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Item Weight & Rate Entry Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-5 text-slate-900 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/80 rounded">
                  {selectedProduct.category}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">{selectedProduct.name}</h3>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Inputs Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Rate per kg */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-300 dark:border-slate-800 shadow-md">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Rate per kg (Rs.) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 4.50"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                {/* Gross Weight */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-300 dark:border-slate-800 shadow-md">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Gross Weight (kg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 520"
                    value={grossWeightInput}
                    onChange={(e) => setGrossWeightInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Deductions Section */}
              <div className="bg-slate-50 dark:bg-slate-950/80 p-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Tare & Water Weight Deductions
                  </span>
                  <button
                    onClick={onOpenDeductionModal}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    + Manage Reasons
                  </button>
                </div>

                {/* Presets quick buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 mr-1">Quick Presets:</span>
                  {[0.5, 1.0, 2.0, 5.0, 10.0].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => applyPresetDeduction(amt)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:border-indigo-500 transition-colors shadow-md"
                    >
                      -{amt}kg
                    </button>
                  ))}
                </div>

                {/* Add Deduction Row */}
                <div className="flex gap-2">
                  <select
                    value={deductionReason}
                    onChange={(e) => setDeductionReason(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {deductionReasons.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="0.1"
                    placeholder="Deduct kg"
                    value={deductionAmount}
                    onChange={(e) => setDeductionAmount(e.target.value)}
                    className="w-28 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                  />

                  <button
                    type="button"
                    onClick={handleAddDeductionEntry}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md"
                  >
                    Add
                  </button>
                </div>

                {/* Active Deductions List */}
                {currentDeductions.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {currentDeductions.map((d, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        <span>{d.reason}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-rose-500">-{d.amount.toFixed(2)} kg</span>
                          <button
                            onClick={() => handleRemoveDeductionEntry(idx)}
                            className="text-slate-500 hover:text-rose-500 p-0.5"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Big Calculation Net Result Box */}
              <div className="bg-indigo-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-indigo-950/30">
                <div>
                  <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Calculated Net Weight</p>
                  <p className="text-3xl font-mono font-bold mt-0.5">{currentNet.toFixed(2)} kg</p>
                </div>
                <div className="text-right">
                  <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest">Line Item Total</p>
                  <p className="text-2xl font-mono font-bold text-white">Rs. {currentLineTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItemToCart}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50 flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle className="w-4 h-4" /> Add Item to Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
