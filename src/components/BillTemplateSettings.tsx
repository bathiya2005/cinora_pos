import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { FileText, Image as ImageIcon, Phone, MapPin, Plus, Trash2, Save, Map, ShieldCheck } from 'lucide-react';

export function BillTemplateSettings() {
  const { billSettings, updateSettings } = usePos();

  const [companyName, setCompanyName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>(['']);
  const [address, setAddress] = useState('');
  const [footerNote, setFooterNote] = useState('');

  useEffect(() => {
    if (billSettings) {
      setCompanyName(billSettings.companyName || '');
      setTagline(billSettings.tagline || '');
      setLogoUrl(billSettings.logoUrl || '');
      setPhoneNumbers(billSettings.phoneNumbers?.length ? billSettings.phoneNumbers : ['']);
      setAddress(billSettings.address || '');
      setFooterNote(billSettings.footerNote || '');
    }
  }, [billSettings]);

  const handleAddPhone = () => {
    setPhoneNumbers((prev) => [...prev, '']);
  };

  const handlePhoneChange = (index: number, val: string) => {
    setPhoneNumbers((prev) => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  const handleRemovePhone = (index: number) => {
    setPhoneNumbers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setLogoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhones = phoneNumbers.map((p) => p.trim()).filter((p) => p.length > 0);

    await updateSettings({
      companyName: companyName.trim(),
      tagline: tagline.trim(),
      logoUrl: logoUrl.trim(),
      phoneNumbers: cleanPhones,
      address: address.trim(),
      footerNote: footerNote.trim(),
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-md">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Bill Receipt Template Customization
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
            Global receipt header, logo, phone numbers, and footer branding across all branch printed bills.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Form (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-md space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Receipt Metadata Fields</h3>
            <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/80 rounded-full border border-indigo-100 dark:border-indigo-900">
              Global Admin Configuration
            </span>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Business Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Unique of Cinnamon"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Business Tagline */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Business Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Spice Exports (PVT) Ltd"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Logo Upload & URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Logo</label>
            <div className="space-y-2">
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Image URL (e.g. https://... or base64)"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="flex items-center gap-2">
                <label className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1.5 transition-colors">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Upload Local Image File</span>
                  <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Remove Logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Multiple Phone Numbers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Contact Phone Numbers</label>
              <button
                type="button"
                onClick={handleAddPhone}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Phone Line
              </button>
            </div>

            <div className="space-y-2">
              {phoneNumbers.map((phone, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => handlePhoneChange(idx, e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {phoneNumbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhone(idx)}
                      className="p-2 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Address / Location</label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="100 Harvest Avenue, Industrial Zone"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Footer Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Footer Note</label>
            <textarea
              rows={3}
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              placeholder="Thank you for trading with Alona POS! All weights scale-verified."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50 flex items-center justify-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" /> Save Receipt Template Settings
          </button>
        </form>

        {/* Live Receipt Preview (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Live Bill Preview</h3>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Real-time render</span>
          </div>

          <div className="bg-slate-50 dark:bg-white text-slate-900 p-5 rounded-2xl shadow-sm font-mono text-xs space-y-3 border border-slate-300">
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-10 mx-auto object-contain mb-1 max-w-[140px]" />
              ) : (
                <div className="w-10 h-10 bg-indigo-600 text-white font-bold text-lg rounded-full flex items-center justify-center mx-auto mb-1">
                  A
                </div>
              )}
              <h4 className="font-bold text-sm uppercase text-slate-900">{companyName || 'BUSINESS NAME'}</h4>
              {address && <p className="text-[10px] text-slate-600">{address}</p>}
              <p className="text-[10px] text-slate-600">{phoneNumbers.filter(Boolean).join(' | ') || 'PHONE NUMBERS'}</p>
            </div>

            {/* Dummy Item Lines */}
            <div className="space-y-1 text-[11px] py-1">
              <div className="flex justify-between font-bold border-b border-slate-300 pb-1">
                <span>ITEM / CAT</span>
                <span>NET WT</span>
                <span>RATE</span>
                <span>TOTAL</span>
              </div>
              <div className="flex justify-between text-slate-800 py-1">
                <span>Raw Cotton A</span>
                <span>500.00kg</span>
                <span>Rs. 4.50</span>
                <span className="font-bold">Rs. 2,250.00</span>
              </div>
              <div className="flex justify-between text-slate-800 py-1">
                <span>Sweet Potatoes</span>
                <span>300.00kg</span>
                <span>Rs. 2.20</span>
                <span className="font-bold">Rs. 660.00</span>
              </div>
            </div>

            {/* Totals */}
            <div className="pt-2 border-t-2 border-slate-800 space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Net Weight:</span>
                <span className="font-semibold text-slate-900">800.00 kg</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-dashed border-slate-300">
                <span>GRAND TOTAL:</span>
                <span className="text-indigo-700 font-bold">Rs. 2,910.00</span>
              </div>
            </div>

            {/* Footer note */}
            <div className="text-center text-[9px] text-slate-600 pt-2 border-t border-dashed border-slate-300">
              <p className="italic">{footerNote || 'Thank you for your business!'}</p>
              <div className="mt-1 flex items-center justify-center gap-1 text-[8px] text-slate-500">
                <ShieldCheck className="w-2.5 h-2.5 text-indigo-600" />
                <span>Verified Scale Transaction • Alona POS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
