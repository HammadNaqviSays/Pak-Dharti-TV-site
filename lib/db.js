import mongoose from "mongoose";

// One connection is reused for a short while. On Cloudflare Workers a connection kept for long goes stale
// (Atlas closes idle sockets) and then every query waits forever ("Worker threw exception", error 1101),
// so a connection older than MAX_AGE_MS, or one that is not open, is replaced by a fresh one.
const MAX_AGE_MS = 20000;
const cached = global._mongoose || (global._mongoose = { conn: null, at: 0, refresh: null });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1 && Date.now() - cached.at < MAX_AGE_MS) return cached.conn;
  // Another request is already connecting. Do NOT wait on ITS promise: on Workers a promise made by one request can leave
  // another request hanging for ever ("code had hung" -> error 1101). Look at the connection state with this request's own timer instead.
  if (cached.refresh && Date.now() - (cached.refreshAt || 0) < 10000) {
    for (let i = 0; i < 80 && mongoose.connection.readyState !== 1; i++) await sleep(50);
    if (mongoose.connection.readyState === 1) return cached.conn || mongoose;
    if (cached.refresh && Date.now() - (cached.refreshAt || 0) < 10000) cached.refresh = null;   // it did not finish in 4 s: this request connects for itself
  }
  if (!cached.refresh) cached.refreshAt = Date.now();
  cached.refresh ??= (async () => {
    const t0 = Date.now();
    try {
      if (mongoose.connection.readyState !== 0) await Promise.race([mongoose.disconnect().catch(() => {}), sleep(2000)]);
      // The database name is fixed here so a connection string without "/pakdharti" can never open an empty database.
      cached.conn = await mongoose.connect(process.env.MONGODB_URI, {
        maxPoolSize: 5, autoIndex: false, autoCreate: false, dbName: process.env.MONGODB_DB || "pakdharti",
        serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, socketTimeoutMS: 20000, maxIdleTimeMS: 15000,
      });
      cached.at = Date.now();
      if (Date.now() - t0 > 1500) console.log(`[db] connect ${Date.now() - t0}ms`);
      return cached.conn;
    } catch (e) {
      cached.conn = null;
      console.error("[db] connect failed:", e?.message);
      throw e;
    } finally { cached.refresh = null; }
  })();
  return cached.refresh;
}

/** Run a database step; when it fails (stale socket, "timed out") renew the connection and run it again (up to `tries` times). For long jobs. */
export async function withDB(fn, tries = 3) {
  for (let i = 0; ; i++) {
    await connectDB();
    try { return await fn(); }
    catch (e) {
      if (i >= tries - 1) throw e;
      console.error("[db] step failed, renewing the connection:", String(e?.message || e).slice(0, 120));
      cached.at = 0; await sleep(600);
    }
  }
}
