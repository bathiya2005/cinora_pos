import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { SlidersHorizontal, Plus, Trash2, Edit2, Check, X } from 'lucide-react';

interface DeductionSettingsModalProps {
  onClose: () => void;
}

export function DeductionSettingsModal({ onClose }: DeductionSettingsModalProps) {
  const { deductionReasons, addDeductionReason, updateDeductionReason, deleteDeductionReason } = usePos();

  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState<string>('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    await addDeductionReason({
      name: newName.trim(),
      defaultAmount: newAmount ? Number(newAmount) : 0,
      status: 'active',
    });

    setNewName('');
    setNewAmount('');
  };

  const startEdit = (id: string, name: string, defaultAmount?: number) => {
    setEditingId(id);
    setEditName(name);
    setEditAmount(defaultAmount !== undefined ? String(defaultAmount) : '0');
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await updateDeductionReason(id, {
      name: editName.trim(),
      defaultAmount: Number(editAmount) || 0,
    });
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Manage Deduction Reasons</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Add New Reason Form */}
          <form onSubmit={handleCreate} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Add New Deduction Reason
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="e.g. Moisture Deduction"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Def. kg"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Save Reason
            </button>
          </form>

          {/* List of existing reasons */}
          <div>
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-2">Existing Deduction Types</h4>
            <div className="space-y-2">
              {deductionReasons.map((reason) => (
                <div
                  key={reason.id}
                  className="p-3 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-2"
                >
                  {editingId === reason.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-indigo-500 rounded text-xs text-slate-900 dark:text-slate-100"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-16 px-2 py-1 bg-white dark:bg-slate-900 border border-indigo-500 rounded text-xs text-slate-900 dark:text-slate-100 text-right"
                      />
                      <button
                        onClick={() => saveEdit(reason.id)}
                        className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{reason.name}</p>
                        <p className="text-[10px] text-slate-600 dark:text-slate-500">
                          Default Preset Deduction: {reason.defaultAmount ?? 0} kg
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(reason.id, reason.name, reason.defaultAmount)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteDeductionReason(reason.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-xl text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
