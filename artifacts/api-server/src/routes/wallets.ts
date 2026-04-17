import { Router, type IRouter } from "express";
import { db, walletsTable } from "@workspace/db";
import { desc, count, eq } from "drizzle-orm";
import {
  GetWalletsQueryParams,
  GetWalletsResponse,
  GetWalletStatsResponse,
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

  // Count distinct runs
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

export default router;
