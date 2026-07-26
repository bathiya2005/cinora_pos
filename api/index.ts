import 'dotenv/config';
import type { Express } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { connectDb } from '../src/server/db.js';
import { createApp } from '../src/server/app.js';

// Cached across warm serverless invocations (module scope survives between
// requests handled by the same lambda instance), so we don't reconnect to
// MongoDB or rebuild the Express app on every request.
let cachedApp: Express | null = null;

async function getApp(): Promise<Express> {
  if (!cachedApp) {
    await connectDb();
    cachedApp = await createApp();
  }
  return cachedApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  // Express apps are callable with the standard (req, res) signature,
  // which is exactly what Vercel's Node.js serverless functions expect.
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
