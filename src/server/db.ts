import { MongoClient, Db as MongoDatabase } from 'mongodb';
import bcrypt from 'bcryptjs';
import { User, BillSettings, Product, DeductionReason, Bill, TemplateGroup } from '../types.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'alona_pos';
// Single document that stores the whole app state (users, products, bills, etc.)
const STORE_COLLECTION = 'pos_store';
const STORE_DOC_ID = 'main';

interface DatabaseSchema {
  users: User[];
  passwords: Record<string, string>; // userId -> passwordHash
  // One full bill/receipt template per group (Ayu / Cinora). Editing one
  // group's template only affects branches assigned to that group.
  billTemplates: Record<TemplateGroup, BillSettings>;
  products: Product[];
  deductionReasons: DeductionReason[];
  bills: Bill[];
  billCounter: number;
}

let dbMemory: DatabaseSchema | null = null;
let mongoClient: MongoClient | null = null;
let mongoDb: MongoDatabase | null = null;

function buildSeedData(): DatabaseSchema {
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  const branch1PasswordHash = bcrypt.hashSync('branch123', 10);
  const branch2PasswordHash = bcrypt.hashSync('branch222', 10);

  const initialUsers: User[] = [
    {
      id: 'user-admin',
      username: 'admin',
      role: 'admin',
      branchName: 'Headquarters',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: 'user-branch-1',
      username: 'branch1',
      role: 'branch',
      branchName: 'North Station',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
      templateGroup: 'ayu',
    },
    {
      id: 'user-branch-2',
      username: 'branch2',
      role: 'branch',
      branchName: 'South Market',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      templateGroup: 'cinora',
    },
  ];

  const passwords: Record<string, string> = {
    'user-admin': adminPasswordHash,
    'user-branch-1': branch1PasswordHash,
    'user-branch-2': branch2PasswordHash,
  };

  const initialBillTemplates: Record<TemplateGroup, BillSettings> = {
    ayu: {
      group: 'ayu',
      companyName: 'Ayu Cinnamon',
      tagline: '',
      logoUrl: '',
      phoneNumbers: ['0723807879'],
      address: 'Akurassa Road, Yakkalamulla',
      footerNote: '',
      updatedAt: new Date().toISOString(),
    },
    cinora: {
      group: 'cinora',
      companyName: 'CINORA',
      tagline: 'SPICE EXPORTS (PVT)',
      logoUrl: '',
      phoneNumbers: ['0707998799'],
      address: 'Malidawa Collecting Center',
      footerNote: '',
      updatedAt: new Date().toISOString(),
    },
  };

  const initialProducts: Product[] = [
    {
      id: 'prod-1',
      name: 'Raw Cotton Grade A',
      category: 'Raw Materials',
      unit: 'kg',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 25).toISOString(),
    },
    {
      id: 'prod-2',
      name: 'Organic Sweet Potatoes',
      category: 'Fresh Produce',
      unit: 'kg',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 24).toISOString(),
    },
    {
      id: 'prod-3',
      name: 'Red Onions Bulk',
      category: 'Fresh Produce',
      unit: 'kg',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 22).toISOString(),
    },
    {
      id: 'prod-4',
      name: 'Whole Grain Wheat',
      category: 'Grains & Pulses',
      unit: 'kg',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 18).toISOString(),
    },
    {
      id: 'prod-5',
      name: 'Heavy Scrap Metal',
      category: 'Recyclables',
      unit: 'kg',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    },
    {
      id: 'prod-6',
      name: 'Cardboard Bales',
      category: 'Recyclables',
      unit: 'kg',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    },
    {
      id: 'prod-7',
      name: 'Yellow Corn Feed',
      category: 'Grains & Pulses',
      unit: 'kg',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
  ];

  const initialDeductions: DeductionReason[] = [
    { id: 'ded-1', name: 'Tare Weight', defaultAmount: 0.5, status: 'active' },
    { id: 'ded-2', name: 'Water Content', defaultAmount: 1.0, status: 'active' },
    { id: 'ded-3', name: 'Damaged Goods', defaultAmount: 0.8, status: 'active' },
    { id: 'ded-4', name: 'Bag / Sack Weight', defaultAmount: 0.3, status: 'active' },
    { id: 'ded-5', name: 'Impurity Deduction', defaultAmount: 0.4, status: 'active' },
  ];

  // Seed initial bills for realistic reports
  const now = Date.now();
  const dayMs = 86400000;
  const initialBills: Bill[] = [
    {
      id: 'bill-1001',
      billNumber: 'BILL-1001',
      branchId: 'user-branch-1',
      branchName: 'North Station',
      customerName: 'Green Farm Logistics',
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Raw Cotton Grade A',
          category: 'Raw Materials',
          rate: 4.5,
          grossWeight: 520,
          deductions: [
            { reason: 'Tare Weight', amount: 5 },
            { reason: 'Water Content', amount: 15 },
          ],
          netWeight: 500,
          lineTotal: 2250,
        },
        {
          id: 'item-2',
          productId: 'prod-2',
          productName: 'Organic Sweet Potatoes',
          category: 'Fresh Produce',
          rate: 2.2,
          grossWeight: 310,
          deductions: [{ reason: 'Bag / Sack Weight', amount: 10 }],
          netWeight: 300,
          lineTotal: 660,
        },
      ],
      extraPayments: [{ reason: 'Transport Incentive', amount: 50 }],
      totalNetWeight: 800,
      totalAmount: 2960,
      createdBy: 'branch1',
      createdAt: new Date(now - dayMs * 3).toISOString(),
    },
    {
      id: 'bill-1002',
      billNumber: 'BILL-1002',
      branchId: 'user-branch-2',
      branchName: 'South Market',
      customerName: 'Valley Agro Buyers',
      items: [
        {
          id: 'item-3',
          productId: 'prod-4',
          productName: 'Whole Grain Wheat',
          category: 'Grains & Pulses',
          rate: 1.8,
          grossWeight: 1250,
          deductions: [
            { reason: 'Tare Weight', amount: 20 },
            { reason: 'Impurity Deduction', amount: 30 },
          ],
          netWeight: 1200,
          lineTotal: 2160,
        },
      ],
      extraPayments: [],
      totalNetWeight: 1200,
      totalAmount: 2160,
      createdBy: 'branch2',
      createdAt: new Date(now - dayMs * 2).toISOString(),
    },
    {
      id: 'bill-1003',
      billNumber: 'BILL-1003',
      branchId: 'user-branch-1',
      branchName: 'North Station',
      customerName: 'Eco Recycle Corp',
      items: [
        {
          id: 'item-4',
          productId: 'prod-5',
          productName: 'Heavy Scrap Metal',
          category: 'Recyclables',
          rate: 0.85,
          grossWeight: 840,
          deductions: [{ reason: 'Tare Weight', amount: 40 }],
          netWeight: 800,
          lineTotal: 680,
        },
        {
          id: 'item-5',
          productId: 'prod-6',
          productName: 'Cardboard Bales',
          category: 'Recyclables',
          rate: 0.45,
          grossWeight: 620,
          deductions: [{ reason: 'Water Content', amount: 20 }],
          netWeight: 600,
          lineTotal: 270,
        },
      ],
      extraPayments: [{ reason: 'Unloading Bonus', amount: 25 }],
      totalNetWeight: 1400,
      totalAmount: 975,
      createdBy: 'branch1',
      createdAt: new Date(now - dayMs * 1).toISOString(),
    },
    {
      id: 'bill-1004',
      billNumber: 'BILL-1004',
      branchId: 'user-branch-1',
      branchName: 'North Station',
      customerName: 'Sunrise Harvest Co.',
      items: [
        {
          id: 'item-6',
          productId: 'prod-3',
          productName: 'Red Onions Bulk',
          category: 'Fresh Produce',
          rate: 1.95,
          grossWeight: 460,
          deductions: [{ reason: 'Damaged Goods', amount: 10 }],
          netWeight: 450,
          lineTotal: 877.5,
        },
      ],
      extraPayments: [],
      totalNetWeight: 450,
      totalAmount: 877.5,
      createdBy: 'branch1',
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    users: initialUsers,
    passwords,
    billTemplates: initialBillTemplates,
    products: initialProducts,
    deductionReasons: initialDeductions,
    bills: initialBills,
    billCounter: 1005,
  };
}

/**
 * Backfills documents that were saved before the Ayu/Cinora bill-template
 * migration (commit "bill template change"). Older documents have a single
 * `billSettings` object (or may be missing billTemplates/templateGroup
 * entirely) instead of the current `billTemplates: { ayu, cinora }` shape.
 * Without this, any route touching `db.billTemplates[group]` (saving the
 * template, or finalizing a bill) throws on an undefined object and fails
 * silently from the UI's point of view. Returns true if it changed anything
 * (caller should persist the result).
 */
function migrateLegacyBillTemplates(data: any): boolean {
  let migrated = false;

  if (!data.billTemplates || !data.billTemplates.ayu || !data.billTemplates.cinora) {
    const seedTemplates = buildSeedData().billTemplates;
    const legacy = data.billSettings; // pre-migration single global template, if present

    data.billTemplates = {
      ayu: legacy ? { ...seedTemplates.ayu, ...legacy, group: 'ayu' } : seedTemplates.ayu,
      cinora: seedTemplates.cinora,
    };
    delete data.billSettings;
    migrated = true;
  }

  if (Array.isArray(data.users)) {
    for (const u of data.users) {
      if (u.role === 'branch' && !u.templateGroup) {
        u.templateGroup = 'ayu';
        migrated = true;
      }
    }
  }

  return migrated;
}

/**
 * Connects to MongoDB (once per warm process/instance), loads the persisted
 * store document into memory, or seeds and inserts default data if the
 * database is empty. Must be awaited once before the Express server starts
 * handling requests.
 */
export async function connectDb(): Promise<void> {
  if (mongoDb) return; // client already connected, reuse it

  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  mongoDb = mongoClient.db(MONGODB_DB_NAME);

  const collection = mongoDb.collection<{ _id: string } & DatabaseSchema>(STORE_COLLECTION);
  const existing = await collection.findOne({ _id: STORE_DOC_ID });

  if (existing) {
    const { _id, ...rest } = existing;
    dbMemory = rest as DatabaseSchema;
    console.log('MongoDB: loaded existing Alona POS data store.');

    if (migrateLegacyBillTemplates(dbMemory)) {
      console.log('MongoDB: migrated legacy billSettings document to billTemplates (ayu/cinora).');
      await saveDb();
    }
  } else {
    dbMemory = buildSeedData();
    await collection.insertOne({ _id: STORE_DOC_ID, ...dbMemory });
    console.log('MongoDB: no existing data found, seeded default Alona POS data.');
  }

  console.log(`MongoDB: connected to database "${MONGODB_DB_NAME}".`);
}

/**
 * Re-reads the latest store document from MongoDB into memory, reusing the
 * existing connection. This matters on serverless platforms (Vercel): each
 * warm function instance keeps its own in-memory copy of dbMemory, so a
 * write made on one instance is invisible to another instance's cached copy
 * until it refreshes. Called at the start of every request (see app.ts) so
 * every request always sees the latest data instead of a stale snapshot.
 */
export async function refreshDb(): Promise<void> {
  if (!mongoDb) {
    await connectDb();
    return;
  }
  const collection = mongoDb.collection<{ _id: string } & DatabaseSchema>(STORE_COLLECTION);
  const existing = await collection.findOne({ _id: STORE_DOC_ID });
  if (existing) {
    const { _id, ...rest } = existing;
    dbMemory = rest as DatabaseSchema;

    if (migrateLegacyBillTemplates(dbMemory)) {
      console.log('MongoDB: migrated legacy billSettings document to billTemplates (ayu/cinora).');
      await saveDb();
    }
  }
}

/** Synchronous access to the in-memory store. connectDb() must run first. */
export function getDb(): DatabaseSchema {
  if (!dbMemory) {
    throw new Error('Database not initialized. Call connectDb() before getDb().');
  }
  return dbMemory;
}

/**
 * Persists the current in-memory store back to MongoDB. Returns the write
 * promise — callers should `await saveDb()` before sending their response,
 * otherwise on serverless platforms the function can freeze/terminate right
 * after the response is sent, before the write actually reaches MongoDB
 * (data would then look like it "reverted" a moment later).
 *
 * Returns true on a confirmed write, false if it failed (e.g. MongoDB
 * unreachable). Previously this only logged failures to the server console,
 * so a failed save could still return a 200/201 "success" response to the
 * browser — the UI would show "saved!" for a change that never persisted,
 * and it would look reverted the next time the page loaded fresh data.
 */
export async function saveDb(): Promise<boolean> {
  if (!dbMemory || !mongoDb) return false;
  const snapshot = dbMemory;
  try {
    await mongoDb.collection(STORE_COLLECTION).updateOne({ _id: STORE_DOC_ID }, { $set: snapshot }, { upsert: true });
    return true;
  } catch (e) {
    console.error('MongoDB: error saving data store:', e);
    return false;
  }
}
