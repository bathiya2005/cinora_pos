import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb, saveDb, refreshDb } from './db.js';
import { User, Bill, BillItem, ExtraPayment } from '../types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'alona-pos-secret-jwt-key-2026';

interface AuthRequest extends Request {
  user?: User;
}

// Authentication Middleware
function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as User;
    const db = getDb();
    const existingUser = db.users.find((u) => u.id === decoded.id);

    if (!existingUser || existingUser.status !== 'active') {
      return res.status(403).json({ error: 'User is inactive or deleted.' });
    }

    req.user = existingUser;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// Role Authorization Middleware
function requireRole(roles: ('admin' | 'branch')[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. Higher privilege required.' });
    }
    next();
  };
}


export async function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Helper cookie parser
  app.use((req, _res, next) => {
    const cookieHeader = req.headers.cookie;
    req.cookies = {};
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        req.cookies[parts[0].trim()] = decodeURIComponent(parts[1] || '');
      });
    }
    next();
  });

  // Refresh in-memory data from MongoDB on every request. Needed on
  // serverless platforms (Vercel): each warm function instance can hold its
  // own stale in-memory copy, so without this a write made on one instance
  // would not show up on requests served by a different instance.
  app.use(async (_req, _res, next) => {
    try {
      await refreshDb();
    } catch (e) {
      console.error('MongoDB: error refreshing data store:', e);
    }
    next();
  });

  // Ensure database is initialized
  getDb();

  // -------------------------------------------------------------------
  // API ROUTES
  // -------------------------------------------------------------------

  // Auth: Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const db = getDb();
    const user = db.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is deactivated. Please contact administrator.' });
    }

    const passwordHash = db.passwords[user.id];
    if (!passwordHash || !bcrypt.compareSync(password, passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, branchName: user.branchName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        branchName: user.branchName,
        status: user.status,
        createdAt: user.createdAt,
        logoUrl: user.logoUrl,
        companyName: user.companyName,
      },
    });
  });

  // Auth: Get Current User
  app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res: Response) => {
    return res.json({ user: req.user });
  });

  // Auth: Logout
  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie('token');
    return res.json({ success: true });
  });

  // Update MY OWN branch identity (Navbar logo + display name shown on my
  // own bills). Any logged-in user (admin or branch) can set their own.
  app.put('/api/users/me/branding', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { logoUrl, companyName, templateGroup } = req.body;

    const db = getDb();
    const user = db.users.find((u) => u.id === req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (logoUrl !== undefined) user.logoUrl = logoUrl || undefined;
    if (companyName !== undefined) user.companyName = companyName ? String(companyName).trim() : undefined;
    if (templateGroup === 'ayu' || templateGroup === 'cinora') user.templateGroup = templateGroup;

    await saveDb();
    return res.json(user);
  });

  // Change MY OWN password (used by admin to set their own password too,
  // since admin accounts can't be edited via the branch-account endpoints).
  app.put('/api/auth/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || String(newPassword).trim().length < 4) {
      return res.status(400).json({ error: 'Current password and a new password (min 4 characters) are required.' });
    }

    const db = getDb();
    const currentHash = db.passwords[req.user!.id];
    if (!currentHash || !bcrypt.compareSync(currentPassword, currentHash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    db.passwords[req.user!.id] = bcrypt.hashSync(String(newPassword).trim(), 10);
    await saveDb();

    return res.json({ success: true });
  });

  // User Management Routes (Admin only)
  app.get('/api/users', authenticateToken, requireRole(['admin']), (_req: Request, res: Response) => {
    const db = getDb();
    return res.json(db.users);
  });

  app.post('/api/users', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
    const { username, password, branchName, status } = req.body;

    if (!username || !password || !branchName) {
      return res.status(400).json({ error: 'Username, password, and branch name are required.' });
    }

    const db = getDb();
    if (db.users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const newId = `user-${Date.now()}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    const newUser: User = {
      id: newId,
      username: username.trim(),
      role: 'branch',
      branchName: branchName.trim(),
      status: status === 'inactive' ? 'inactive' : 'active',
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    db.passwords[newId] = passwordHash;
    await saveDb();

    return res.status(201).json(newUser);
  });

  app.put('/api/users/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { username, password, branchName, status } = req.body;

    const db = getDb();
    const user = db.users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (username && username.trim().toLowerCase() !== user.username.toLowerCase()) {
      if (db.users.some((u) => u.id !== id && u.username.toLowerCase() === username.trim().toLowerCase())) {
        return res.status(400).json({ error: 'Username already taken.' });
      }
      user.username = username.trim();
    }

    if (branchName) user.branchName = branchName.trim();
    if (status) user.status = status;

    if (password && password.trim().length > 0) {
      db.passwords[id] = bcrypt.hashSync(password.trim(), 10);
    }

    await saveDb();
    return res.json(user);
  });

  // Admin: edit a specific branch's own bill/Navbar identity (name + logo)
  // from the Template Settings page. Same fields the branch itself can set
  // from its own Navbar, but editable centrally by the admin too.
  app.put('/api/users/:id/branding', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { logoUrl, companyName, templateGroup } = req.body;

    const db = getDb();
    const user = db.users.find((u) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (logoUrl !== undefined) user.logoUrl = logoUrl || undefined;
    if (companyName !== undefined) user.companyName = companyName ? String(companyName).trim() : undefined;
    if (templateGroup === 'ayu' || templateGroup === 'cinora') user.templateGroup = templateGroup;

    await saveDb();
    return res.json(user);
  });

  app.delete('/api/users/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete logged in admin account.' });
    }

    const db = getDb();
    db.users = db.users.filter((u) => u.id !== id);
    delete db.passwords[id];
    await saveDb();

    return res.json({ success: true });
  });

  // Bill Settings Routes — one full template per group (Ayu / Cinora)
  app.get('/api/bill-settings', authenticateToken, (_req: Request, res: Response) => {
    const db = getDb();
    return res.json(db.billTemplates);
  });

  app.post('/api/bill-settings', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
    const { group, companyName, tagline, logoUrl, phoneNumbers, address, footerNote } = req.body;

    if (group !== 'ayu' && group !== 'cinora') {
      return res.status(400).json({ error: 'A valid template group (ayu or cinora) is required.' });
    }

    const db = getDb();
    const current = db.billTemplates[group as 'ayu' | 'cinora'];

    db.billTemplates[group as 'ayu' | 'cinora'] = {
      group,
      companyName: companyName ?? current.companyName,
      tagline: tagline ?? current.tagline,
      logoUrl: logoUrl ?? current.logoUrl,
      phoneNumbers: Array.isArray(phoneNumbers) ? phoneNumbers : current.phoneNumbers,
      address: address ?? current.address,
      footerNote: footerNote ?? current.footerNote,
      updatedAt: new Date().toISOString(),
    };

    await saveDb();
    return res.json(db.billTemplates);
  });

  // Product Management Routes
  app.get('/api/products', authenticateToken, (_req: Request, res: Response) => {
    const db = getDb();
    return res.json(db.products);
  });

  app.post('/api/products', authenticateToken, async (req: Request, res: Response) => {
    const { name, category, unit, status } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Product name and category are required.' });
    }

    const db = getDb();
    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: name.trim(),
      category: category.trim(),
      unit: unit ? unit.trim() : 'kg',
      status: status === 'inactive' ? 'inactive' : 'active',
      createdAt: new Date().toISOString(),
    };

    db.products.push(newProd);
    await saveDb();
    return res.status(201).json(newProd);
  });

  app.put('/api/products/:id', authenticateToken, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, category, unit, status } = req.body;

    const db = getDb();
    const prod = db.products.find((p) => p.id === id);

    if (!prod) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (name) prod.name = name.trim();
    if (category) prod.category = category.trim();
    if (unit) prod.unit = unit.trim();
    if (status) prod.status = status;

    await saveDb();
    return res.json(prod);
  });

  app.delete('/api/products/:id', authenticateToken, async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDb();
    db.products = db.products.filter((p) => p.id !== id);
    await saveDb();
    return res.json({ success: true });
  });

  // Deduction Reasons Routes
  app.get('/api/deduction-reasons', authenticateToken, (_req: Request, res: Response) => {
    const db = getDb();
    return res.json(db.deductionReasons);
  });

  app.post('/api/deduction-reasons', authenticateToken, async (req: Request, res: Response) => {
    const { name, defaultAmount, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Reason name is required.' });
    }

    const db = getDb();
    const newReason = {
      id: `ded-${Date.now()}`,
      name: name.trim(),
      defaultAmount: defaultAmount ? Number(defaultAmount) : 0,
      status: status === 'inactive' ? 'inactive' : 'active',
    };

    db.deductionReasons.push(newReason);
    await saveDb();
    return res.status(201).json(newReason);
  });

  app.put('/api/deduction-reasons/:id', authenticateToken, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, defaultAmount, status } = req.body;

    const db = getDb();
    const reason = db.deductionReasons.find((r) => r.id === id);

    if (!reason) {
      return res.status(404).json({ error: 'Reason not found.' });
    }

    if (name) reason.name = name.trim();
    if (defaultAmount !== undefined) reason.defaultAmount = Number(defaultAmount);
    if (status) reason.status = status;

    await saveDb();
    return res.json(reason);
  });

  app.delete('/api/deduction-reasons/:id', authenticateToken, async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDb();
    db.deductionReasons = db.deductionReasons.filter((r) => r.id !== id);
    await saveDb();
    return res.json({ success: true });
  });

  // Bill Creation Route
  app.post('/api/bills', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { customerName, customerContact, items, extraPayments } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one line item is required.' });
    }

    const db = getDb();
    // [FIX: bill-number-resequencing] billCounter tracks the last number
    // handed out (not the next one), so pre-increment here — this keeps it
    // consistent with the delete route's resequencing/reset-to-0 logic.
    db.billCounter += 1;
    const billNum = String(db.billCounter).padStart(6, '0');

    let totalNetWeight = 0;
    let totalItemsPrice = 0;

    const processedItems: BillItem[] = items.map((item: any, idx: number) => {
      const grossWeight = Number(item.grossWeight) || 0;
      const rate = Number(item.rate) || 0;

      const deductions = Array.isArray(item.deductions)
        ? item.deductions.map((d: any) => ({
            reason: String(d.reason || 'Deduction'),
            amount: Number(d.amount) || 0,
          }))
        : [];

      const sumDeductions = deductions.reduce((acc, d) => acc + d.amount, 0);
      const netWeight = Math.max(0, grossWeight - sumDeductions);
      const lineTotal = Number((netWeight * rate).toFixed(2));

      totalNetWeight += netWeight;
      totalItemsPrice += lineTotal;

      return {
        id: `item-${Date.now()}-${idx}`,
        productId: item.productId || 'custom',
        productName: item.productName || 'Unspecified Product',
        category: item.category || 'General',
        rate,
        grossWeight,
        deductions,
        netWeight,
        lineTotal,
      };
    });

    const processedExtra: ExtraPayment[] = Array.isArray(extraPayments)
      ? extraPayments.map((e: any) => ({
          reason: String(e.reason || 'Extra Payment'),
          amount: Number(e.amount) || 0,
        }))
      : [];

    const extraTotal = processedExtra.reduce((acc, e) => acc + e.amount, 0);
    const grandTotal = Number((totalItemsPrice + extraTotal).toFixed(2));

    const templateGroup = req.user!.templateGroup || 'ayu';
    const template = db.billTemplates[templateGroup] || db.billTemplates.ayu;

    const newBill: Bill = {
      id: `bill-${Date.now()}`,
      billNumber: billNum,
      branchId: req.user!.id,
      branchName: req.user!.branchName || 'Main Station',
      customerName: customerName ? customerName.trim() : 'Counter Cash Sale',
      customerContact: customerContact ? String(customerContact).trim() : undefined,
      items: processedItems,
      extraPayments: processedExtra,
      totalNetWeight,
      totalAmount: grandTotal,
      createdBy: req.user!.username,
      createdAt: new Date().toISOString(),
      // Branch's own name/logo override wins when set, else falls back to
      // its assigned template group's defaults. Everything else (tagline,
      // address, phone, footer) always comes from the template group.
      companyName: req.user!.companyName || template.companyName || undefined,
      logoUrl: req.user!.logoUrl || template.logoUrl || undefined,
      tagline: template.tagline || undefined,
      address: template.address || undefined,
      phoneNumbers: template.phoneNumbers && template.phoneNumbers.length > 0 ? template.phoneNumbers : undefined,
      footerNote: template.footerNote || undefined,
    };

    db.bills.unshift(newBill);
    await saveDb();

    return res.status(201).json(newBill);
  });

  // Get Bills List (Filterable)
  app.get('/api/bills', authenticateToken, (req: AuthRequest, res: Response) => {
    const db = getDb();
    let bills = [...db.bills];

    // Branch users can only see their own branch bills
    if (req.user?.role === 'branch') {
      bills = bills.filter((b) => b.branchId === req.user?.id || b.branchName === req.user?.branchName);
    } else if (req.query.branchName) {
      const bName = String(req.query.branchName);
      if (bName !== 'all') {
        bills = bills.filter((b) => b.branchName.toLowerCase() === bName.toLowerCase());
      }
    }

    if (req.query.search) {
      const q = String(req.query.search).toLowerCase();
      bills = bills.filter(
        (b) =>
          b.billNumber.toLowerCase().includes(q) ||
          (b.customerName && b.customerName.toLowerCase().includes(q)) ||
          b.items.some((i) => i.productName.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      );
    }

    if (req.query.startDate) {
      const start = new Date(String(req.query.startDate)).getTime();
      bills = bills.filter((b) => new Date(b.createdAt).getTime() >= start);
    }

    if (req.query.endDate) {
      const end = new Date(String(req.query.endDate)).getTime() + 86400000;
      bills = bills.filter((b) => new Date(b.createdAt).getTime() <= end);
    }

    return res.json(bills);
  });

  // Get Single Bill
  app.get('/api/bills/:id', authenticateToken, (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const db = getDb();
    const bill = db.bills.find((b) => b.id === id || b.billNumber === id);

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found.' });
    }

    // Permission check for branch
    if (req.user?.role === 'branch' && bill.branchId !== req.user.id && bill.branchName !== req.user.branchName) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    return res.json(bill);
  });

  // Delete Bill (Admin only) — removes the transaction record from bill history & reports.
  // [FIX: bill-number-resequencing] After removal, every remaining bill with a
  // higher sequential number shifts down by one so the numbers stay
  // contiguous (e.g. deleting bill #8 of 10 makes the old #9 become #8), and
  // the counter that hands out the next number shifts down to match. When
  // the last bill is removed the counter resets to 0, so the next bill
  // created starts the sequence over from 1.
  app.delete('/api/bills/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const db = getDb();
    const deletedBill = db.bills.find((b) => b.id === id);

    if (!deletedBill) {
      return res.status(404).json({ error: 'Bill not found.' });
    }

    db.bills = db.bills.filter((b) => b.id !== id);

    const deletedNum = parseInt(deletedBill.billNumber, 10);
    if (!isNaN(deletedNum)) {
      const padLength = deletedBill.billNumber.length;
      for (const b of db.bills) {
        const n = parseInt(b.billNumber, 10);
        if (!isNaN(n) && n > deletedNum) {
          b.billNumber = String(n - 1).padStart(padLength, '0');
        }
      }
      db.billCounter = Math.max(0, db.billCounter - 1);
    }

    if (db.bills.length === 0) {
      db.billCounter = 0;
    }

    await saveDb();
    return res.json({ success: true });
  });

  // Reports & Analytics Route
  app.get('/api/reports', authenticateToken, requireRole(['admin', 'branch']), (req: AuthRequest, res: Response) => {
    const db = getDb();
    let bills = [...db.bills];

    const isBranchUser = req.user?.role === 'branch';
    if (isBranchUser) {
      bills = bills.filter((b) => b.branchId === req.user?.id || b.branchName === req.user?.branchName);
    } else if (req.query.branchName && req.query.branchName !== 'all') {
      bills = bills.filter((b) => b.branchName.toLowerCase() === String(req.query.branchName).toLowerCase());
    }

    // Bills scoped by role/branch, but BEFORE the date filter — used for the
    // "monthly trend" charts, which always show the last 12 months
    // regardless of the daily/custom date range picked above.
    const scopedBills = bills;

    if (req.query.startDate) {
      const start = new Date(String(req.query.startDate)).getTime();
      bills = bills.filter((b) => new Date(b.createdAt).getTime() >= start);
    }

    if (req.query.endDate) {
      const end = new Date(String(req.query.endDate)).getTime() + 86400000;
      bills = bills.filter((b) => new Date(b.createdAt).getTime() <= end);
    }

    const totalBills = bills.length;
    let totalRevenue = 0;
    let totalWeight = 0;

    const categoryMap: Record<string, { category: string; weight: number; revenue: number }> = {};
    const salesByDateMap: Record<string, { date: string; revenue: number; weight: number; bills: number }> = {};
    const branchMap: Record<string, { branchName: string; revenue: number; weight: number; billsCount: number }> = {};
    // date -> category -> weight, for the "daily weight by product" stacked chart
    const categoryByDateMap: Record<string, Record<string, number>> = {};
    // branchName -> category -> { weight, revenue }, for admin's per-branch product breakdown
    const branchCategoryMap: Record<string, Record<string, { weight: number; revenue: number }>> = {};
    // category -> set of dates it had a sale on (within the filtered range) — used for "daily average"
    const categoryActiveDays: Record<string, Set<string>> = {};

    bills.forEach((b) => {
      totalRevenue += b.totalAmount;
      totalWeight += b.totalNetWeight;

      const dateStr = new Date(b.createdAt).toISOString().split('T')[0];
      if (!salesByDateMap[dateStr]) {
        salesByDateMap[dateStr] = { date: dateStr, revenue: 0, weight: 0, bills: 0 };
      }
      salesByDateMap[dateStr].revenue += b.totalAmount;
      salesByDateMap[dateStr].weight += b.totalNetWeight;
      salesByDateMap[dateStr].bills += 1;

      if (!branchMap[b.branchName]) {
        branchMap[b.branchName] = { branchName: b.branchName, revenue: 0, weight: 0, billsCount: 0 };
      }
      branchMap[b.branchName].revenue += b.totalAmount;
      branchMap[b.branchName].weight += b.totalNetWeight;
      branchMap[b.branchName].billsCount += 1;

      if (!categoryByDateMap[dateStr]) categoryByDateMap[dateStr] = {};
      if (!branchCategoryMap[b.branchName]) branchCategoryMap[b.branchName] = {};

      b.items.forEach((item) => {
        const cat = item.category || 'General';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { category: cat, weight: 0, revenue: 0 };
        }
        categoryMap[cat].weight += item.netWeight;
        categoryMap[cat].revenue += item.lineTotal;

        categoryByDateMap[dateStr][cat] = (categoryByDateMap[dateStr][cat] || 0) + item.netWeight;

        if (!categoryActiveDays[cat]) categoryActiveDays[cat] = new Set();
        categoryActiveDays[cat].add(dateStr);

        if (!branchCategoryMap[b.branchName][cat]) {
          branchCategoryMap[b.branchName][cat] = { weight: 0, revenue: 0 };
        }
        branchCategoryMap[b.branchName][cat].weight += item.netWeight;
        branchCategoryMap[b.branchName][cat].revenue += item.lineTotal;
      });
    });

    const topCategories = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue);
    const salesByDate = Object.values(salesByDateMap).sort((a, b) => a.date.localeCompare(b.date));
    const branchPerformance = Object.values(branchMap).sort((a, b) => b.revenue - a.revenue);

    // Top 6 categories (by weight) drive the stacked-chart series/colors,
    // everything else is rolled into "Other" so charts stay readable.
    const topCategoryNames = [...topCategories]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6)
      .map((c) => c.category);

    const buildPivotRow = (label: string, catWeights: Record<string, number>) => {
      const row: Record<string, string | number> = { period: label };
      let other = 0;
      Object.entries(catWeights).forEach(([cat, w]) => {
        if (topCategoryNames.includes(cat)) {
          row[cat] = Number((((row[cat] as number) || 0) + w).toFixed(2));
        } else {
          other += w;
        }
      });
      if (other > 0) row['Other'] = Number(other.toFixed(2));
      return row;
    };

    const categoryDailyTrend = Object.keys(categoryByDateMap)
      .sort()
      .map((d) => buildPivotRow(d, categoryByDateMap[d]));

    // Monthly trend (last 12 months) — always computed from the full
    // role/branch-scoped bill set, independent of the daily date filter.
    const monthlyMap: Record<string, { month: string; revenue: number; weight: number }> = {};
    const monthlyCategoryMap: Record<string, Record<string, number>> = {};
    // category -> total weight/revenue across the last 12 months, and the
    // set of months it had at least one sale in — used for "monthly average"
    const categoryMonthlyTotals: Record<string, { weight: number; revenue: number }> = {};
    const categoryActiveMonths: Record<string, Set<string>> = {};
    scopedBills.forEach((b) => {
      const d = new Date(b.createdAt);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { month: monthKey, revenue: 0, weight: 0 };
      monthlyMap[monthKey].revenue += b.totalAmount;
      monthlyMap[monthKey].weight += b.totalNetWeight;

      if (!monthlyCategoryMap[monthKey]) monthlyCategoryMap[monthKey] = {};
      b.items.forEach((item) => {
        const cat = item.category || 'General';
        monthlyCategoryMap[monthKey][cat] = (monthlyCategoryMap[monthKey][cat] || 0) + item.netWeight;

        if (!categoryMonthlyTotals[cat]) categoryMonthlyTotals[cat] = { weight: 0, revenue: 0 };
        categoryMonthlyTotals[cat].weight += item.netWeight;
        categoryMonthlyTotals[cat].revenue += item.lineTotal;

        if (!categoryActiveMonths[cat]) categoryActiveMonths[cat] = new Set();
        categoryActiveMonths[cat].add(monthKey);
      });
    });

    const last12Months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last12Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const monthLabel = (key: string) => {
      const [y, m] = key.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    };

    const monthlyTrend = last12Months.map((key) => ({
      month: monthLabel(key),
      revenue: Number((monthlyMap[key]?.revenue || 0).toFixed(2)),
      weight: Number((monthlyMap[key]?.weight || 0).toFixed(2)),
    }));

    const categoryMonthlyTrend = last12Months.map((key) =>
      buildPivotRow(monthLabel(key), monthlyCategoryMap[key] || {})
    );

    // Admin-only: one product breakdown per branch, for side-by-side
    // "each branch separately, colored by product" charts.
    const branchCategoryBreakdown = isBranchUser
      ? []
      : Object.entries(branchCategoryMap).map(([branchName, cats]) => ({
          branchName,
          categories: Object.entries(cats)
            .map(([category, v]) => ({ category, weight: Number(v.weight.toFixed(2)), revenue: Number(v.revenue.toFixed(2)) }))
            .sort((a, b) => b.weight - a.weight),
        }));

    // Full product-wise analysis — EVERY product (not just the top 6 used
    // for chart legends), with day-wise and month-wise averages and the
    // true average price/kg (total revenue ÷ total weight for that product).
    const allProductNames = new Set<string>([
      ...Object.keys(categoryMap),
      ...Object.keys(categoryMonthlyTotals),
    ]);

    const productAnalysis = Array.from(allProductNames)
      .map((cat) => {
        const filteredWeight = categoryMap[cat]?.weight || 0;
        const filteredRevenue = categoryMap[cat]?.revenue || 0;
        const activeDays = categoryActiveDays[cat]?.size || 0;

        const monthWeight = categoryMonthlyTotals[cat]?.weight || 0;
        const monthRevenue = categoryMonthlyTotals[cat]?.revenue || 0;
        const activeMonths = categoryActiveMonths[cat]?.size || 0;

        return {
          category: cat,
          totalWeight: Number(filteredWeight.toFixed(2)),
          totalRevenue: Number(filteredRevenue.toFixed(2)),
          avgPricePerKg: filteredWeight > 0 ? Number((filteredRevenue / filteredWeight).toFixed(2)) : 0,
          activeDays,
          dailyAvgWeight: activeDays > 0 ? Number((filteredWeight / activeDays).toFixed(2)) : 0,
          dailyAvgRevenue: activeDays > 0 ? Number((filteredRevenue / activeDays).toFixed(2)) : 0,
          activeMonths,
          monthlyAvgWeight: activeMonths > 0 ? Number((monthWeight / activeMonths).toFixed(2)) : 0,
          monthlyAvgRevenue: activeMonths > 0 ? Number((monthRevenue / activeMonths).toFixed(2)) : 0,
        };
      })
      .sort((a, b) => b.totalWeight - a.totalWeight);

    return res.json({
      totalBills,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalWeight: Number(totalWeight.toFixed(2)),
      topCategories,
      salesByDate,
      branchPerformance,
      categoryNames: [...topCategoryNames, 'Other'],
      categoryDailyTrend,
      monthlyTrend,
      categoryMonthlyTrend,
      branchCategoryBreakdown,
      productAnalysis,
    });
  });

  return app;
}
