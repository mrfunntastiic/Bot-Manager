import { Router, type IRouter } from "express";
import { db, botLogsTable, proxiesTable } from "@workspace/db";
import { desc, count } from "drizzle-orm";
import {
  RunBotBody,
  RunBotResponse,
  GetBotStatusResponse,
  StopBotResponse,
  GetBotLogsQueryParams,
  GetBotLogsResponse,
  UploadProxiesBody,
  UploadProxiesResponse,
} from "@workspace/api-zod";
import { startBot, stopBot, getBotState } from "../lib/bot-runner";

const router: IRouter = Router();

router.post("/bot/run", async (req, res): Promise<void> => {
  const parsed = RunBotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { referralCode, accountCount, useProxy } = parsed.data;

  try {
    const runId = await startBot(referralCode, accountCount, useProxy);
    res.json(RunBotResponse.parse({ success: true, message: "Bot started", runId }));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/bot/status", async (_req, res): Promise<void> => {
  const state = getBotState();
  res.json(GetBotStatusResponse.parse(state));
});

router.post("/bot/stop", async (_req, res): Promise<void> => {
  stopBot();
  const state = getBotState();
  res.json(StopBotResponse.parse(state));
});

router.get("/bot/logs", async (req, res): Promise<void> => {
  const parsed = GetBotLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = parsed.data.limit ?? 100;
  const offset = parsed.data.offset ?? 0;

  const [logs, totalResult] = await Promise.all([
    db.select().from(botLogsTable).orderBy(desc(botLogsTable.id)).limit(limit).offset(offset),
    db.select({ count: count() }).from(botLogsTable),
  ]);

  const total = totalResult[0]?.count ?? 0;

  res.json(GetBotLogsResponse.parse({
    logs: logs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp.toISOString(),
      level: l.level,
      message: l.message,
      runId: l.runId ?? undefined,
    })),
    total,
  }));
});

router.post("/bot/proxies", async (req, res): Promise<void> => {
  const parsed = UploadProxiesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { proxies } = parsed.data;

  // Clear existing proxies and insert new ones
  await db.delete(proxiesTable);
  if (proxies.length > 0) {
    await db.insert(proxiesTable).values(proxies.map((p) => ({ proxy: p })));
  }

  res.json(UploadProxiesResponse.parse({
    success: true,
    count: proxies.length,
    message: `${proxies.length} proxies saved`,
  }));
});

export default router;
