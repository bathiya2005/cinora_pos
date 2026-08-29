import { MongoClient, Db as MongoDatabase } from 'mongodb';
import bcrypt from 'bcryptjs';
import { User, BillSettings, Product, DeductionReason, Bill, TemplateGroup } from '../types.js';
import { AYU_LOGO_DATA_URL, CINORA_LOGO_DATA_URL } from './assets/defaultLogos.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'alona_pos';
// Single document that stores the whole app state (users, products, deduction
// reasons, templates, counters). Bills are NOT stored here — see
// BILLS_COLLECTION below and [FIX: bills-own-collection].
const STORE_COLLECTION = 'pos_store';
const STORE_DOC_ID = 'main';
// [FIX: bills-own-collection] Each bill is its own document in its own
// collection, instead of living inside one giant `bills` array embedded in
// the `pos_store` main document. Previously every single request — even
// ones that never touched bills, like loading the dashboard or checking
// login — ran refreshDb(), which read the ENTIRE main document (including
// every bill ever created) off MongoDB, and every write (saveDb()) rewrote
// that entire document back. As the bills array grew throughout a business
// day, every request got progressively slower, and the whole store document
// was creeping toward MongoDB's 16MB single-document limit. Storing bills as
// individual documents means the main document stays small and constant-size
// forever, and bill reads/writes only touch the bills that are actually
// relevant to that request (a single bill lookup, or filtered by branch).
const BILLS_COLLECTION = 'bills';

interface DatabaseSchema {
  users: User[];
  passwords: Record<string, string>; // userId -> passwordHash
  // One full bill/receipt template per group (Ayu / Cinora). Editing one
  // group's template only affects branches assigned to that group.
  billTemplates: Record<TemplateGroup, BillSettings>;
  products: Product[];
  deductionReasons: DeductionReason[];
  // [FIX: bills-own-collection] No longer stored here — bills live in their
  // own MongoDB collection (BILLS_COLLECTION). Use listBills()/getBillById()/
  // insertBill()/deleteBillById()/bulkUpdateBillNumbers() below instead of
  // reading/writing a `bills` field on this object. `bills?: Bill[]` is kept
  // ONLY as an optional legacy field so a pre-migration document (which still
  // has the old embedded array) can be read once and migrated; new code must
  // never write to it.
  bills?: Bill[];
  // Independent per-group bill counters. Ayu bills print as A000001,
  // A000002... and Cinora bills as C000001, C000002... — each group counts
  // only its own bills, never the other's. Replaces the old single global
  // `billCounter` (see migrateLegacyBillCounter below).
  billCounters: Record<TemplateGroup, number>;
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
      logoUrl: AYU_LOGO_DATA_URL,
      phoneNumbers: ['0723807879'],
      address: 'Akurassa Road, Yakkalamulla',
      footerNote: '',
      updatedAt: new Date().toISOString(),
    },
    cinora: {
      group: 'cinora',
      companyName: 'CINORA',
      tagline: 'SPICE EXPORTS (PVT)',
      logoUrl: CINORA_LOGO_DATA_URL,
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
    // [FIX: bills-own-collection] Seed bills are inserted into their own
    // collection separately (see connectDb()'s "no existing document" branch)
    // — kept here too so buildSeedData() stays a single source of truth for
    // what a fresh install's demo bills look like.
    seedBills: initialBills,
    billCounters: { ayu: 0, cinora: 0 },
  } as DatabaseSchema & { seedBills: Bill[] };
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
 * [FIX: ayu-logo-not-printing] Backfills the Ayu/Cinora default logos (see
 * assets/defaultLogos.ts) into an existing install where the template's
 * logoUrl is still empty. Only fills in a blank — if an admin has already
 * uploaded a logo for a group (via Settings), that logo is left exactly as
 * it is. Runs once; after a group has any logoUrl (default or custom) this
 * is a no-op for it.
 */
function migrateDefaultLogos(data: any): boolean {
  let migrated = false;
  if (data.billTemplates?.ayu && !data.billTemplates.ayu.logoUrl) {
    data.billTemplates.ayu.logoUrl = AYU_LOGO_DATA_URL;
    migrated = true;
  }
  if (data.billTemplates?.cinora && !data.billTemplates.cinora.logoUrl) {
    data.billTemplates.cinora.logoUrl = CINORA_LOGO_DATA_URL;
    migrated = true;
  }
  return migrated;
}

/**
 * [FIX: ayu-cinora-bill-counter-split] Migrates the old single global
 * `billCounter` (shared by both Ayu and Cinora bills, causing one group's
 * bills to consume numbers from the other's sequence) to independent
 * per-group `billCounters`. Per explicit instruction, this is a clean reset:
 * existing bills and their billNumber values are left untouched (no
 * renumbering of bill history), but going forward Ayu and Cinora each start
 * counting fresh from A000001 / C000001 with their own independent counter.
 * Returns true if it changed anything (caller should persist the result).
 */
function migrateLegacyBillCounter(data: any): boolean {
  if (data.billCounters && typeof data.billCounters.ayu === 'number' && typeof data.billCounters.cinora === 'number') {
    return false;
  }
  data.billCounters = { ayu: 0, cinora: 0 };
  delete data.billCounter;
  return true;
}

/**
 * [FIX: bills-own-collection] One-time migration for installs created before
 * bills got their own collection: if the main document still has its old
 * embedded `bills` array, copy every one of those bills into the new
 * `bills` collection (upsert by id, so re-running this is always safe and
 * never duplicates or overwrites a bill that's already there), then strip
 * the array off the in-memory copy of the main document. The caller is
 * responsible for both persisting the now-bills-free main document (via
 * saveDb()) AND physically removing the old field from MongoDB — see the
 * explicit $unset in connectDb()/refreshDb() below, because saveDb()'s
 * $set alone would leave the old (large) `bills` field sitting untouched
 * in the database. No bill data is ever deleted by this — every bill that
 * was in the old array ends up in the new collection before the old array
 * is dropped.
 */
async function migrateBillsToOwnCollection(data: any): Promise<boolean> {
  if (!Array.isArray(data.bills) || data.bills.length === 0) {
    if (Array.isArray(data.bills)) delete data.bills; // empty array, nothing to move
    return false;
  }
  if (!mongoDb) return false;

  const billsCollection = mongoDb.collection(BILLS_COLLECTION);
  const ops = data.bills.map((b: Bill) => ({
    updateOne: { filter: { _id: b.id } as any, update: { $setOnInsert: { _id: b.id, ...b } }, upsert: true },
  }));
  await billsCollection.bulkWrite(ops);

  const movedCount = data.bills.length;
  delete data.bills;
  console.log(`MongoDB: migrated ${movedCount} bill(s) from the main document into their own collection.`);
  return true;
}

// [FIX: connect-race] Tracks an in-progress connectDb() call so that
// concurrent requests hitting a cold serverless instance at the same time
// all await the SAME connection attempt, instead of each one racing ahead
// independently.
let connectPromise: Promise<void> | null = null;

/**
 * Connects to MongoDB (once per warm process/instance), loads the persisted
 * store document into memory, or seeds and inserts default data if the
 * database is empty. Must be awaited once before the Express server starts
 * handling requests.
 */
export async function connectDb(): Promise<void> {
  // Fully initialized already (both the client AND the in-memory data are
  // ready) — safe to reuse immediately.
  if (mongoDb && dbMemory) return;

  // [FIX: connect-race] A connection is already being set up (e.g. by a
  // concurrent request that arrived a moment earlier on the same cold-
  // starting lambda). Previously, the old guard here was only `if (mongoDb)
  // return;`, checked *before* `dbMemory` was actually populated below. On
  // Vercel, two requests can land on the same fresh instance close enough
  // together that: request A starts connecting and sets `mongoDb`, but is
  // still awaiting the database read that populates `dbMemory`; request B
  // then calls connectDb(), sees `mongoDb` already set, returns immediately
  // thinking setup is done, and moves on to call getDb() — which still
  // throws "Database not initialized" because `dbMemory` genuinely isn't
  // ready yet. Waiting on the shared in-flight promise instead means every
  // caller only proceeds once the whole connect-and-load sequence has
  // actually finished.
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGODB_DB_NAME);

    const collection = mongoDb.collection<{ _id: string } & DatabaseSchema>(STORE_COLLECTION);
    const existing = await collection.findOne({ _id: STORE_DOC_ID });

    if (existing) {
      const { _id, ...rest } = existing;
      dbMemory = rest as DatabaseSchema;
      console.log('MongoDB: loaded existing Alona POS data store.');

      const templatesMigrated = migrateLegacyBillTemplates(dbMemory);
      if (templatesMigrated) {
        console.log('MongoDB: migrated legacy billSettings document to billTemplates (ayu/cinora).');
      }
      const counterMigrated = migrateLegacyBillCounter(dbMemory);
      if (counterMigrated) {
        console.log('MongoDB: migrated legacy billCounter to independent ayu/cinora billCounters.');
      }
      const logosMigrated = migrateDefaultLogos(dbMemory);
      if (logosMigrated) {
        console.log('MongoDB: backfilled default Ayu/Cinora logos.');
      }
      const billsMigrated = await migrateBillsToOwnCollection(dbMemory);
      if (templatesMigrated || counterMigrated || logosMigrated || billsMigrated) {
        await saveDb();
      }
      if (billsMigrated) {
        // $set (inside saveDb()) never removes a field that's simply absent
        // from the object being set — the old, large `bills` array would
        // otherwise stay sitting in MongoDB forever. Explicitly drop it now
        // that every bill it contained has been confirmed copied into the
        // new collection above.
        await collection.updateOne({ _id: STORE_DOC_ID }, { $unset: { bills: '' } });
      }
    } else {
      const seed = buildSeedData() as DatabaseSchema & { seedBills: Bill[] };
      const { seedBills, ...storeData } = seed;
      dbMemory = storeData;
      await collection.insertOne({ _id: STORE_DOC_ID, ...dbMemory });
      // [FIX: bills-own-collection] Seed bills go straight into their own
      // collection, never into the main store document.
      if (seedBills.length > 0) {
        await mongoDb
          .collection(BILLS_COLLECTION)
          .insertMany(seedBills.map((b) => ({ _id: b.id, ...b })) as any);
      }
      console.log('MongoDB: no existing data found, seeded default Alona POS data.');
    }

    console.log(`MongoDB: connected to database "${MONGODB_DB_NAME}".`);
  })();

  try {
    await connectPromise;
  } catch (err) {
    // A failed attempt must not be remembered as "in progress" forever —
    // clear the client/db state too so the next call retries cleanly.
    mongoClient = null;
    mongoDb = null;
    throw err;
  } finally {
    connectPromise = null;
  }
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

    const templatesMigrated = migrateLegacyBillTemplates(dbMemory);
    if (templatesMigrated) {
      console.log('MongoDB: migrated legacy billSettings document to billTemplates (ayu/cinora).');
    }
    const counterMigrated = migrateLegacyBillCounter(dbMemory);
    if (counterMigrated) {
      console.log('MongoDB: migrated legacy billCounter to independent ayu/cinora billCounters.');
    }
    const logosMigrated = migrateDefaultLogos(dbMemory);
    if (logosMigrated) {
      console.log('MongoDB: backfilled default Ayu/Cinora logos.');
    }
    const billsMigrated = await migrateBillsToOwnCollection(dbMemory);
    if (templatesMigrated || counterMigrated || logosMigrated || billsMigrated) {
      await saveDb();
    }
    if (billsMigrated) {
      await collection.updateOne({ _id: STORE_DOC_ID }, { $unset: { bills: '' } });
    }
  }
}

// ---------------------------------------------------------------------------
// [FIX: bills-own-collection] Bill accessors — bills live in their own
// MongoDB collection, one document per bill (_id = bill.id), NOT inside the
// main pos_store document. All bill reads/writes go through these functions.
// ---------------------------------------------------------------------------

function billsCollection() {
  if (!mongoDb) throw new Error('Database not initialized. Call connectDb() before accessing bills.');
  return mongoDb.collection(BILLS_COLLECTION);
}

function stripMongoId<T>(doc: any): T {
  const { _id, ...rest } = doc;
  return rest as T;
}

/**
 * Lists bills, optionally scoped at the database level to one branch (by
 * branchId or branchName) so branch users never even transfer other
 * branches' bills over the network. Sorted newest first, matching the old
 * array's unshift() ordering. Any remaining filters (search text, date
 * range) are still applied by the caller in app.ts, same as before.
 */
export async function listBills(scope: { branchId?: string; branchName?: string } = {}): Promise<Bill[]> {
  const filter: any = {};
  const nameRegex = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (scope.branchId) {
    filter.$or = [{ branchId: scope.branchId }, ...(scope.branchName ? [{ branchName: nameRegex(scope.branchName) }] : [])];
  } else if (scope.branchName) {
    filter.branchName = nameRegex(scope.branchName);
  }
  const docs = await billsCollection().find(filter).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => stripMongoId<Bill>(d));
}

export async function getBillById(id: string): Promise<Bill | null> {
  const doc = await billsCollection().findOne({ $or: [{ id }, { billNumber: id }] } as any);
  return doc ? stripMongoId<Bill>(doc) : null;
}

export async function insertBill(bill: Bill): Promise<void> {
  await billsCollection().insertOne({ _id: bill.id, ...bill } as any);
}

export async function deleteBillById(id: string): Promise<Bill | null> {
  const doc = await billsCollection().findOneAndDelete({ id } as any);
  return doc ? stripMongoId<Bill>(doc) : null;
}

/** Bulk-renumbers bills (used by the delete route's resequencing logic). */
export async function bulkUpdateBillNumbers(updates: { id: string; billNumber: string }[]): Promise<void> {
  if (updates.length === 0) return;
  await billsCollection().bulkWrite(
    updates.map((u) => ({ updateOne: { filter: { id: u.id } as any, update: { $set: { billNumber: u.billNumber } } } }))
  );
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