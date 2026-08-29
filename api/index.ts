import 'dotenv/config';
import type { Express } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { connectDb } from '../src/server/db.js';
import { createApp } from '../src/server/app.js';

// Cached across warm serverless invocations (module scope survives between
// requests handled by the same lambda instance), so we don't reconnect to
// MongoDB or rebuild the Express app on every request.
let cachedApp: Express | null = null;
// [FIX: connect-race] Same "leapfrogging" race as connectDb() in db.ts could
// happen here too: two concurrent cold-start requests could both see
// `cachedApp` still null and both start building it. connectDb() itself is
// now race-safe, but without this guard we'd still needlessly run
// createApp() twice. Sharing one in-flight promise means every concurrent
// request waits for the same single setup instead of racing.
let appPromise: Promise<Express> | null = null;

async function getApp(): Promise<Express> {
  if (cachedApp) return cachedApp;
  if (!appPromise) {
    appPromise = (async () => {
      await connectDb();
      const app = await createApp();
      cachedApp = app;
      return app;
    })();
  }
  try {
    return await appPromise;
  } finally {
    appPromise = null;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    // Express apps are callable with the standard (req, res) signature,
    // which is exactly what Vercel's Node.js serverless functions expect.
    return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
  } catch (err: any) {
    // [FIX: json-error-crash] If connectDb()/createApp() throws — most
    // commonly because MONGODB_URI is missing/wrong in Vercel's env vars, or
    // MongoDB Atlas's Network Access list doesn't allow Vercel's IPs — this
    // used to be an *uncaught* exception. Vercel then returned its own
    // generic crash page ("A server error has occurred..."), which is HTML/
    // plain text, not JSON. The frontend always calls res.json() on API
    // responses, so that crash page produced the cryptic browser error
    // "Unexpected token 'A', "A server e"... is not valid JSON" on every
    // single request (including login) instead of a real error message.
    //
    // Catching it here and always answering with JSON turns that into a
    // clear, readable message in the browser — but it does NOT fix the
    // underlying cause. If you see this message, check in the Vercel
    // dashboard: Project → Settings → Environment Variables → MONGODB_URI
    // is set for Production, and in MongoDB Atlas → Network Access, that
    // 0.0.0.0/0 (or Vercel's IPs) is allowed to connect.
    console.error('Fatal error initializing server / database connection:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Server failed to start (database connection issue). Check MONGODB_URI and MongoDB Atlas Network Access in Vercel settings.',
      })
    );
  }
}