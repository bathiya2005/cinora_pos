export type Role = 'admin' | 'branch';

export interface User {
  id: string;
  username: string;
  role: Role;
  branchName: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface BillSettings {
  companyName: string;
  tagline: string;
  logoUrl: string;
  phoneNumbers: string[];
  address: string;
  footerNote: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface DeductionReason {
  id: string;
  name: string;
  defaultAmount?: number;
  status: 'active' | 'inactive';
}

export interface Deduction {
  reason: string;
  amount: number;
}

export interface BillItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  rate: number; // per kg
  grossWeight: number; // kg
  deductions: Deduction[];
  netWeight: number; // gross - deductions
  lineTotal: number; // netWeight * rate
}

export interface ExtraPayment {
  reason: string;
  amount: number;
}

export interface Bill {
  id: string;
  billNumber: string;
  branchId: string;
  branchName: string;
  customerName?: string;
  customerContact?: string;
  items: BillItem[];
  extraPayments: ExtraPayment[];
  totalAmount: number;
  totalNetWeight: number;
  createdBy: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalBills: number;
  totalRevenue: number;
  totalWeight: number; // in kg
  topCategories: { category: string; weight: number; revenue: number }[];
  salesByDate: { date: string; revenue: number; weight: number; bills: number }[];
  branchPerformance: { branchName: string; revenue: number; weight: number; billsCount: number }[];
}
