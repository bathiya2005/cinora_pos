import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, BillSettings, Product, DeductionReason, Bill } from '../types.js';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface PosContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (u: string, p: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  
  // Data
  billSettings: BillSettings | null;
  products: Product[];
  deductionReasons: DeductionReason[];
  bills: Bill[];
  toasts: ToastMessage[];

  // Actions
  addToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<BillSettings>) => Promise<boolean>;
  fetchProducts: () => Promise<void>;
  addProduct: (p: Omit<Product, 'id' | 'createdAt'>) => Promise<boolean>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  fetchDeductionReasons: () => Promise<void>;
  addDeductionReason: (r: Omit<DeductionReason, 'id'>) => Promise<boolean>;
  updateDeductionReason: (id: string, r: Partial<DeductionReason>) => Promise<boolean>;
  deleteDeductionReason: (id: string) => Promise<boolean>;
  fetchBills: (params?: Record<string, string>) => Promise<Bill[]>;
  createBill: (data: { customerName?: string; customerContact?: string; items: any[]; extraPayments: any[] }) => Promise<Bill | null>;
  deleteBill: (id: string) => Promise<boolean>;
}

const PosContext = createContext<PosContextType | undefined>(undefined);

export function PosProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('alona_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [billSettings, setBillSettings] = useState<BillSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [deductionReasons, setDeductionReasons] = useState<DeductionReason[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Auth helper with token
  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // Check current session
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('alona_token');
          setToken(null);
          setUser(null);
        }
      } catch {
        // error
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [token]);

  // Load baseline data once logged in
  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchProducts();
      fetchDeductionReasons();
      fetchBills();
    }
  }, [user]);

  const login = async (username: string, p: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      localStorage.setItem('alona_token', data.token);
      setToken(data.token);
      setUser(data.user);
      addToast(`Welcome back, ${data.user.username}!`, 'success');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server error' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: getHeaders() });
    } catch {
      // ignore
    }
    localStorage.removeItem('alona_token');
    setToken(null);
    setUser(null);
    addToast('Logged out successfully', 'info');
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/bill-settings', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBillSettings(data);
      }
    } catch {
      // ignore
    }
  };

  const updateSettings = async (newSettings: Partial<BillSettings>) => {
    try {
      const res = await fetch('/api/bill-settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const updated = await res.json();
        setBillSettings(updated);
        addToast('Bill template settings saved!', 'success');
        return true;
      } else {
        const err = await res.json();
        addToast(err.error || 'Failed to update settings', 'error');
        return false;
      }
    } catch {
      addToast('Error saving settings', 'error');
      return false;
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch {
      // ignore
    }
  };

  const addProduct = async (p: Omit<Product, 'id' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(p),
      });
      if (res.ok) {
        addToast('Product added successfully', 'success');
        await fetchProducts();
        return true;
      } else {
        const err = await res.json();
        addToast(err.error || 'Error adding product', 'error');
        return false;
      }
    } catch {
      addToast('Failed to add product', 'error');
      return false;
    }
  };

  const updateProduct = async (id: string, p: Partial<Product>) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(p),
      });
      if (res.ok) {
        addToast('Product updated', 'success');
        await fetchProducts();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        addToast('Product deleted', 'info');
        await fetchProducts();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const fetchDeductionReasons = async () => {
    try {
      const res = await fetch('/api/deduction-reasons', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDeductionReasons(data);
      }
    } catch {
      // ignore
    }
  };

  const addDeductionReason = async (r: Omit<DeductionReason, 'id'>) => {
    try {
      const res = await fetch('/api/deduction-reasons', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(r),
      });
      if (res.ok) {
        addToast('Deduction reason added', 'success');
        await fetchDeductionReasons();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const updateDeductionReason = async (id: string, r: Partial<DeductionReason>) => {
    try {
      const res = await fetch(`/api/deduction-reasons/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(r),
      });
      if (res.ok) {
        addToast('Reason updated', 'success');
        await fetchDeductionReasons();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const deleteDeductionReason = async (id: string) => {
    try {
      const res = await fetch(`/api/deduction-reasons/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        addToast('Reason deleted', 'info');
        await fetchDeductionReasons();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const fetchBills = async (params?: Record<string, string>) => {
    try {
      const query = new URLSearchParams(params).toString();
      const res = await fetch(`/api/bills?${query}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBills(data);
        return data;
      }
      return [];
    } catch {
      return [];
    }
  };

  const createBill = async (data: { customerName?: string; customerContact?: string; items: any[]; extraPayments: any[] }) => {
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const newBill = await res.json();
        addToast(`Bill ${newBill.billNumber} created!`, 'success');
        await fetchBills();
        return newBill;
      } else {
        const err = await res.json();
        addToast(err.error || 'Failed to create bill', 'error');
        return null;
      }
    } catch {
      addToast('Error saving bill', 'error');
      return null;
    }
  };

  const deleteBill = async (id: string) => {
    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        addToast('Bill record deleted', 'success');
        setBills((prev) => prev.filter((b) => b.id !== id));
        return true;
      } else {
        const err = await res.json();
        addToast(err.error || 'Failed to delete bill', 'error');
        return false;
      }
    } catch {
      addToast('Error deleting bill', 'error');
      return false;
    }
  };

  return (
    <PosContext.Provider
      value={{
        user,
        token,
        loading,
        theme,
        toggleTheme,
        login,
        logout,
        billSettings,
        products,
        deductionReasons,
        bills,
        toasts,
        addToast,
        removeToast,
        fetchSettings,
        updateSettings,
        fetchProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        fetchDeductionReasons,
        addDeductionReason,
        updateDeductionReason,
        deleteDeductionReason,
        fetchBills,
        createBill,
        deleteBill,
      }}
    >
      <div>{children}</div>
    </PosContext.Provider>
  );
}

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error('usePos must be used within PosProvider');
  return ctx;
}
