export type Role = 'admin' | 'branch';

// The two bill/receipt template groups. Each branch account belongs to
// exactly one group, and editing a group's template in the admin panel only
// affects branches assigned to that group.
export type TemplateGroup = 'ayu' | 'cinora';

export interface User {
  id: string;
  username: string;
  role: Role;
  branchName: string;
  status: 'active' | 'inactive';
  createdAt: string;
  // Per-branch identity shown in that branch's Navbar and printed on that
  // branch's bills — independent of the global BillSettings template.
  logoUrl?: string;
  companyName?: string;
  // Which bill template group (Ayu / Cinora) this branch prints receipts
  // from. Defaults to 'ayu' when absent (older accounts).
  templateGroup?: TemplateGroup;
}

export interface BillSettings {
  group: TemplateGroup;
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
  // Which template group (Ayu / Cinora) this bill's number was counted
  // under. Ayu bills are numbered A000001, A000002... and Cinora bills
  // C000001, C000002... independently — the two sequences never share or
  // affect each other's count. Older bills created before this change may
  // not have this field.
  billGroup?: TemplateGroup;
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
  // Snapshot of the creating branch's own identity + bill template group at
  // the time of billing, so the receipt always prints the same way even if
  // the branch identity or the group's template is changed later.
  // companyName/logoUrl fall back to the branch's own override when set,
  // the rest come from that branch's assigned template group.
  companyName?: string;
  logoUrl?: string;
  tagline?: string;
  address?: string;
  phoneNumbers?: string[];
  footerNote?: string;
}

export interface AnalyticsSummary {
  totalBills: number;
  totalRevenue: number;
  totalWeight: number; // in kg
  topCategories: { category: string; weight: number; revenue: number }[];
  salesByDate: { date: string; revenue: number; weight: number; bills: number }[];
  branchPerformance: { branchName: string; revenue: number; weight: number; billsCount: number }[];
}
