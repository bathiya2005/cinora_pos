import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { connectDb } from './src/server/db.js';
import { createApp } from './src/server/app.js';

const PORT = 3000;

async function startServer() {
  await connectDb();
  const app = await createApp();

  // -------------------------------------------------------------------
  // VITE / STATIC SERVING
  // -------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Alona POS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
