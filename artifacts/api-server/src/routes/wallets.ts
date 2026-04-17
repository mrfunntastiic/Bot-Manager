import { Router, type IRouter } from "express";
import { db, walletsTable } from "@workspace/db";
import { desc, count, eq, inArray, like, or } from "drizzle-orm";
import {
  GetWalletsQueryParams,
  GetWalletsResponse,
  GetWalletStatsResponse,
  GetWalletParams,
  GetWalletResponse,
  DeleteWalletParams,
  DeleteWalletResponse,
  SearchWalletsQueryParams,
  SearchWalletsResponse,
  BulkDeleteWalletsBody,
  BulkDeleteWalletsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/wallets", async (req, res): Promise<void> => {
  const parsed = GetWalletsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = parsed.data.limit ?? 50;
  const offset = parsed.data.offset ?? 0;

  const [wallets, totalResult] = await Promise.all([
    db.select().from(walletsTable).orderBy(desc(walletsTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: count() }).from(walletsTable),
  ]);

  const total = totalResult[0]?.count ?? 0;

  res.json(GetWalletsResponse.parse({
    wallets: wallets.map((w) => ({
      id: w.id,
      address: w.address,
      privateKey: w.privateKey,
      mnemonic: w.mnemonic,
      referralCode: w.referralCode,
      checkedIn: w.checkedIn,
      taskSubmitted: w.taskSubmitted,
      createdAt: w.createdAt.toISOString(),
      runId: w.runId ?? undefined,
    })),
    total,
  }));
});

router.get("/wallets/stats", async (_req, res): Promise<void> => {
  const [rows, checkedInRows, taskRows] = await Promise.all([
    db.select({ count: count() }).from(walletsTable),
    db.select({ count: count() }).from(walletsTable).where(eq(walletsTable.checkedIn, true)),
    db.select({ count: count() }).from(walletsTable).where(eq(walletsTable.taskSubmitted, true)),
  ]);

  const lastWallet = await db.select().from(walletsTable).orderBy(desc(walletsTable.createdAt)).limit(1);

  const allWallets = await db.select({ runId: walletsTable.runId }).from(walletsTable);
  const uniqueRuns = new Set(allWallets.map((w) => w.runId).filter(Boolean)).size;

  res.json(GetWalletStatsResponse.parse({
    total: rows[0]?.count ?? 0,
    checkedIn: checkedInRows[0]?.count ?? 0,
    taskSubmitted: taskRows[0]?.count ?? 0,
    totalRuns: uniqueRuns,
    lastRunAt: lastWallet[0]?.createdAt.toISOString() ?? undefined,
  }));
});

router.get("/wallets/export", async (_req, res): Promise<void> => {
  const wallets = await db.select().from(walletsTable).orderBy(desc(walletsTable.createdAt));
  const lines = wallets.map((w) => `${w.address}|${w.privateKey}|${w.mnemonic}`).join("\n");
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", "attachment; filename=wallets.txt");
  res.send(lines);
});

router.get("/wallets/search", async (req, res): Promise<void> => {
  const parsed = SearchWalletsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const q = parsed.data.q;
  const limit = parsed.data.limit ?? 50;
  const offset = parsed.data.offset ?? 0;
  const searchPattern = `%${q}%`;

  const [wallets, totalResult] = await Promise.all([
    db.select().from(walletsTable)
      .where(or(
        like(walletsTable.address, searchPattern),
        like(walletsTable.referralCode, searchPattern)
      ))
      .orderBy(desc(walletsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(walletsTable)
      .where(or(
        like(walletsTable.address, searchPattern),
        like(walletsTable.referralCode, searchPattern)
      )),
  ]);

  const total = totalResult[0]?.count ?? 0;

  res.json(SearchWalletsResponse.parse({
    wallets: wallets.map((w) => ({
      id: w.id,
      address: w.address,
      privateKey: w.privateKey,
      mnemonic: w.mnemonic,
      referralCode: w.referralCode,
      checkedIn: w.checkedIn,
      taskSubmitted: w.taskSubmitted,
      createdAt: w.createdAt.toISOString(),
      runId: w.runId ?? undefined,
    })),
    total,
  }));
});

router.post("/wallets/bulk-delete", async (req, res): Promise<void> => {
  const parsed = BulkDeleteWalletsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ids } = parsed.data;
  if (ids.length === 0) {
    res.json(BulkDeleteWalletsResponse.parse({ success: true, deleted: 0, message: "No IDs provided" }));
    return;
  }

  const deleted = await db.delete(walletsTable).where(inArray(walletsTable.id, ids)).returning();

  res.json(BulkDeleteWalletsResponse.parse({
    success: true,
    deleted: deleted.length,
    message: `${deleted.length} wallet(s) deleted`,
  }));
});

router.get("/wallets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetWalletParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.id, params.data.id));
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  res.json(GetWalletResponse.parse({
    id: wallet.id,
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic,
    referralCode: wallet.referralCode,
    checkedIn: wallet.checkedIn,
    taskSubmitted: wallet.taskSubmitted,
    createdAt: wallet.createdAt.toISOString(),
    runId: wallet.runId ?? undefined,
  }));
});

router.delete("/wallets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteWalletParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(walletsTable).where(eq(walletsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  res.json(DeleteWalletResponse.parse({ success: true, message: "Wallet deleted" }));
});

export default router;
