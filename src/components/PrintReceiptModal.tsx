import { useRef, useState } from 'react';
import { Bill } from '../types';
import { Printer, X, Check, Receipt } from 'lucide-react';

interface PrintReceiptModalProps {
  bill: Bill;
  onClose: () => void;
}

export function PrintReceiptModal({ bill, onClose }: PrintReceiptModalProps) {
  const [printed, setPrinted] = useState(false);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  // [FIX: ayu-logo-not-printing] A previous attempt fixed this by waiting
  // for the image's 'load' event before calling window.print(), but that
  // still isn't reliable: 'load' fires once the browser has fetched/decoded
  // the bytes, not once it has actually painted the pixels — and for cached
  // images the event may not fire again at all. window.print() can still run
  // a frame before the logo is actually rendered, producing a blank logo
  // area on the printed page (screen preview looks fine because there's more
  // time before the user notices). We now use img.decode() (which resolves
  // only once the image is fully decoded and ready to paint, and resolves
  // immediately for already-loaded/cached images) followed by two
  // requestAnimationFrame ticks to guarantee the browser has painted that
  // decoded frame before we open the print dialog, with a safety timeout in
  // case decode() is unsupported or never settles.
  const handlePrint = () => {
    setPrinted(true);
    let hasPrinted = false;
    const doPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      window.print();
    };
    const printAfterPaint = () => {
      requestAnimationFrame(() => requestAnimationFrame(doPrint));
    };

    const img = logoImgRef.current;
    if (img && img.src) {
      setTimeout(doPrint, 1200); // safety net
      if (typeof img.decode === 'function') {
        img.decode().then(printAfterPaint).catch(printAfterPaint);
      } else if (img.complete) {
        printAfterPaint();
      } else {
        img.addEventListener('load', printAfterPaint, { once: true });
        img.addEventListener('error', printAfterPaint, { once: true });
      }
    } else {
      setTimeout(doPrint, 150);
    }
  };

  // Everything is taken from the snapshot saved on the bill at billing time
  // (that branch's own name/logo override, plus its assigned Ayu/Cinora
  // template for tagline/address/phones/footer), so a bill always prints
  // the same way even if the template is edited later.
  const companyName = bill.companyName || 'Unique of Cinnamon';
  const tagline = bill.tagline || '';
  const logoUrl = bill.logoUrl;
  const phones = bill.phoneNumbers && bill.phoneNumbers.length > 0 ? bill.phoneNumbers : [];
  const address = bill.address || '';
  const footerNote = bill.footerNote || '';

  const billDate = new Date(bill.createdAt);
  const formattedDate = billDate.toLocaleDateString('en-CA').replace(/-/g, ':'); // YYYY:MM:DD
  const formattedTime = billDate.toLocaleTimeString('en-GB', { hour12: false }); // HH:MM:SS

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      {/* Container - hide during print outside the print layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Header toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Official Bill Receipt Preview</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt printable container */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100/50 dark:bg-slate-950/30">
          <div
            id="printable-receipt"
            className="bg-white text-slate-900 p-6 rounded-lg shadow-md max-w-md mx-auto font-sans [font-variant-numeric:tabular-nums] text-sm leading-relaxed border-2 border-slate-800"
          >
            {/* Business Header — logo top-left, name/details centered next to it */}
            <div className="pb-3 mb-3 border-b-2 border-slate-800 grid grid-cols-[5.25rem_1fr_5.25rem] print:grid-cols-[7.25rem_1fr_7.25rem] items-start gap-2">
              <div className="pt-0.5">
                {logoUrl ? (
                  <img
                    ref={logoImgRef}
                    src={logoUrl}
                    alt={companyName}
                    className="h-20 w-20 object-contain print:h-28 print:w-28"
                  />
                ) : (
                  <div className="w-20 h-20 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-3xl">
                    {companyName.trim().charAt(0).toUpperCase() || 'A'}
                  </div>
                )}
              </div>
              <div className="text-center">
                <h2 className="font-extrabold text-xl text-slate-900 uppercase tracking-wide">{companyName}</h2>
                {tagline && (
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mt-0.5">{tagline}</p>
                )}
                {address && (
                  <p className="text-xs text-slate-600 mt-1">{address}</p>
                )}
                {phones.length > 0 && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    {phones.join('  |  ')}
                  </p>
                )}
              </div>
              <div />
            </div>

            {/* Bill Info Metadata: BILL NO / DATE / TIME on one row */}
            <div className="text-xs mb-3 pb-3 border-b border-slate-300 space-y-1">
              <div className="flex justify-between gap-2">
                <span><span className="text-slate-600">BILL NO</span> <span className="font-bold">{bill.billNumber}</span></span>
                <span><span className="text-slate-600">DATE</span> <span className="font-medium">{formattedDate}</span></span>
                <span><span className="text-slate-600">TIME</span> <span className="font-medium">{formattedTime}</span></span>
              </div>
              <div>
                <span className="text-slate-600">CUSTOMER: </span>
                <span className="font-semibold">{bill.customerName || ''}</span>
              </div>
              <div>
                <span className="text-slate-600">CONTACT: </span>
                <span className="font-medium">{bill.customerContact || ''}</span>
              </div>
            </div>

            {/* Line items table */}
            <div className="mb-3">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-slate-800 uppercase font-bold text-xs">
                    <th className="py-1">Grade</th>
                    <th className="py-1 text-right">Qty</th>
                    <th className="py-1 text-right">Price</th>
                    <th className="py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bill.items.map((item, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="py-2 pr-2 font-bold text-slate-900 whitespace-nowrap">{item.productName}</td>
                      <td className="py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {item.netWeight.toFixed(2)}
                      </td>
                      <td className="py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {item.rate.toFixed(2)}
                      </td>
                      <td className="py-2 text-right font-bold text-slate-900 whitespace-nowrap">
                        {item.lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Extra Payments (if any) */}
            {bill.extraPayments && bill.extraPayments.length > 0 && (
              <div className="mb-3 pt-2 border-t border-slate-300">
                <p className="text-[11px] font-bold text-slate-700 uppercase mb-1">Extra Charges / Bonuses</p>
                {bill.extraPayments.map((extra, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-0.5 text-slate-700">
                    <span>+ {extra.reason}</span>
                    <span className="font-semibold text-slate-900">+Rs. {extra.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="pt-2 border-t-2 border-slate-800 mb-3">
              <div className="flex justify-between text-lg font-extrabold text-slate-900">
                <span>TOTAL:</span>
                <span className="text-xl">RS: {bill.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center border-t-2 border-slate-800 pt-3">
              <p className="font-extrabold text-sm tracking-wide text-slate-900">THANK YOU COME AGAIN</p>
              {footerNote && <p className="text-[10px] text-slate-600 mt-1">{footerNote}</p>}
              <p className="text-[10px] text-slate-500 mt-2">https://alona.lk/</p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-500">
            {printed ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="w-4 h-4" /> Sent to printer
              </span>
            ) : (
              <span>Ready to print 80mm/Standard Receipt</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
          </div>
        </div>
      </div>

      {/* Print-only CSS layout injection */}
      <style>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          html, body {
            width: 80mm;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            max-width: 80mm;
            padding: 10px;
            box-shadow: none;
            border: none;
          }
        }
      `}</style>
    </div>
  );
}
