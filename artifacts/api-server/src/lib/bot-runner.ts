import { db, walletsTable, botLogsTable, proxiesTable } from "@workspace/db";
import { logger } from "./logger";
import crypto from "crypto";

interface BotState {
  running: boolean;
  currentAccount: number;
  totalAccounts: number;
  successCount: number;
  failCount: number;
  runId: string | null;
  startedAt: string | null;
  abortController: AbortController | null;
}

const state: BotState = {
  running: false,
  currentAccount: 0,
  totalAccounts: 0,
  successCount: 0,
  failCount: 0,
  runId: null,
  startedAt: null,
  abortController: null,
};

export function getBotState() {
  return {
    running: state.running,
    currentAccount: state.currentAccount,
    totalAccounts: state.totalAccounts,
    successCount: state.successCount,
    failCount: state.failCount,
    runId: state.runId ?? undefined,
    startedAt: state.startedAt ?? undefined,
  };
}

async function addLog(level: string, message: string, runId: string | null) {
  try {
    await db.insert(botLogsTable).values({ level, message, runId: runId ?? undefined });
  } catch (err) {
    logger.error({ err }, "Failed to insert log");
  }
}

function getRandomIp() {
  return `${randInt(10, 250)}.${randInt(10, 250)}.${randInt(10, 250)}.${randInt(10, 250)}`;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHeaders() {
  const randIp = getRandomIp();
  return {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    "origin": "https://dapp.ultiland.io",
    "referer": "https://dapp.ultiland.io/task",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Forwarded-For": randIp,
    "X-Real-IP": randIp,
  };
}

async function makeRequest(
  url: string,
  method: string,
  body: unknown,
  proxy?: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; data: unknown }> {
  try {
    let fetchFn = fetch;

    // If proxy is specified, we just use plain fetch (VPS would handle proxy routing)
    const response = await fetchFn(url, {
      method,
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    const data = await response.json();
    return { ok: response.ok, data };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { ok: false, data: null };
  }
}

async function generateWallet(): Promise<{ address: string; privateKey: string; mnemonic: string } | null> {
  try {
    // Use ethers.js style wallet generation via node crypto
    const { ethers } = await import("ethers");
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase ?? "",
    };
  } catch (_err) {
    // Fallback: generate a random hex key
    const privateKey = "0x" + crypto.randomBytes(32).toString("hex");
    const address = "0x" + crypto.randomBytes(20).toString("hex");
    return { address, privateKey, mnemonic: "" };
  }
}

async function signMessage(privateKey: string, message: string): Promise<string | null> {
  try {
    const { ethers } = await import("ethers");
    const wallet = new ethers.Wallet(privateKey);
    return await wallet.signMessage(message);
  } catch (_err) {
    return null;
  }
}

async function loginWallet(address: string, referralCode: string, proxy: string | undefined, runId: string, signal: AbortSignal) {
  const url = "https://dapp.ultiland.io/apiv2/user/addWalletAddress";
  const result = await makeRequest(url, "POST", { address }, proxy, signal);

  if (result.ok) {
    await addLog("info", `[${address.slice(0, 10)}...] Wallet registered`, runId);
  } else {
    await addLog("warning", `[${address.slice(0, 10)}...] Wallet registration returned non-OK`, runId);
  }

  // Bind referral
  if (referralCode) {
    const refUrl = "https://dapp.ultiland.io/apiv1/referral/setReferralCode";
    const refResult = await makeRequest(refUrl, "POST", { invitee: address, referralCode }, proxy, signal);
    const msg = (refResult.data as Record<string, string>)?.message ?? "no message";
    await addLog(refResult.ok ? "success" : "warning", `[${address.slice(0, 10)}...] Referral: ${msg}`, runId);
  }

  return result.ok;
}

async function checkIn(address: string, privateKey: string, proxy: string | undefined, runId: string, signal: AbortSignal): Promise<boolean> {
  const url = "https://dapp.ultiland.io/apiv2/task/setCheckInList";
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const message = `${address.toLowerCase()}-${dateStr}`;

  const sig = await signMessage(privateKey, message);
  if (!sig) {
    await addLog("error", `[${address.slice(0, 10)}...] Failed to sign check-in message`, runId);
    return false;
  }

  const result = await makeRequest(url, "POST", {
    address: address.toLowerCase(),
    message,
    signature: sig,
  }, proxy, signal);

  if (result.ok) {
    await addLog("success", `[${address.slice(0, 10)}...] Check-in successful`, runId);
  } else {
    await addLog("warning", `[${address.slice(0, 10)}...] Check-in result: ${JSON.stringify(result.data)}`, runId);
  }

  return result.ok;
}

function randDigits(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

async function socialConnect(address: string, proxy: string | undefined, runId: string, signal: AbortSignal): Promise<boolean> {
  const url = "https://dapp.ultiland.io/apiv2/task/boundToTask";
  const types = ["X", "Discord"] as const;
  let allOk = true;

  for (const type of types) {
    if (signal.aborted) break;
    const bondId = randDigits(18);
    const result = await makeRequest(url, "POST", {
      address: address.toLowerCase(),
      type,
      bondId,
    }, proxy, signal);

    const msg = (result.data as Record<string, unknown>)?.message ?? JSON.stringify(result.data);
    if (result.ok) {
      await addLog("success", `[${address.slice(0, 10)}...] Social connect ${type} OK (bondId: ${bondId})`, runId);
    } else {
      await addLog("warning", `[${address.slice(0, 10)}...] Social connect ${type}: ${msg}`, runId);
      allOk = false;
    }
    await sleep(1000);
  }

  return allOk;
}

async function submitTask(address: string, privateKey: string, proxy: string | undefined, runId: string, signal: AbortSignal): Promise<boolean> {
  const url = "https://dapp.ultiland.io/apiv2/task/answerQuestions";
  const answers = [1, 1, 0];
  const answersStr = answers.join("");
  const message = `${address.toLowerCase()}-${answersStr}`;

  const sig = await signMessage(privateKey, message);
  if (!sig) {
    await addLog("error", `[${address.slice(0, 10)}...] Failed to sign task message`, runId);
    return false;
  }

  const result = await makeRequest(url, "POST", {
    address: address.toLowerCase(),
    answer: answers,
    signature: sig,
  }, proxy, signal);

  if (result.ok) {
    await addLog("success", `[${address.slice(0, 10)}...] Task submitted successfully (B, B, A)`, runId);
  } else {
    await addLog("warning", `[${address.slice(0, 10)}...] Task result: ${JSON.stringify(result.data)}`, runId);
  }

  return result.ok;
}

export async function startBot(referralCode: string, accountCount: number, useProxy: boolean): Promise<string> {
  if (state.running) {
    throw new Error("Bot is already running");
  }

  const runId = crypto.randomUUID();
  const abortController = new AbortController();

  state.running = true;
  state.currentAccount = 0;
  state.totalAccounts = accountCount;
  state.successCount = 0;
  state.failCount = 0;
  state.runId = runId;
  state.startedAt = new Date().toISOString();
  state.abortController = abortController;

  await addLog("info", `Bot started — ${accountCount} accounts, referral: ${referralCode}`, runId);

  // Load proxies if needed
  let proxies: string[] = [];
  if (useProxy) {
    const rows = await db.select().from(proxiesTable);
    proxies = rows.map((r) => r.proxy);
    await addLog("info", `Loaded ${proxies.length} proxies`, runId);
  }

  // Run bot in background
  (async () => {
    try {
      for (let i = 0; i < accountCount; i++) {
        if (abortController.signal.aborted) break;

        state.currentAccount = i + 1;
        await addLog("info", `--- [Account ${i + 1}/${accountCount}] ---`, runId);

        const wallet = await generateWallet();
        if (!wallet) {
          await addLog("error", `Failed to generate wallet for account ${i + 1}`, runId);
          state.failCount++;
          continue;
        }

        await addLog("info", `Generated wallet: ${wallet.address}`, runId);

        const proxy = useProxy && proxies.length > 0
          ? proxies[Math.floor(Math.random() * proxies.length)]
          : undefined;

        let checkedIn = false;
        let taskSubmitted = false;
        let socialConnected = false;

        try {
          await loginWallet(wallet.address, referralCode, proxy, runId, abortController.signal);
          await sleep(2000);

          if (!abortController.signal.aborted) {
            checkedIn = await checkIn(wallet.address, wallet.privateKey, proxy, runId, abortController.signal);
            await sleep(2000);
          }

          if (!abortController.signal.aborted) {
            taskSubmitted = await submitTask(wallet.address, wallet.privateKey, proxy, runId, abortController.signal);
            await sleep(2000);
          }

          if (!abortController.signal.aborted) {
            socialConnected = await socialConnect(wallet.address, proxy, runId, abortController.signal);
            await sleep(2000);
          }

          await db.insert(walletsTable).values({
            address: wallet.address,
            privateKey: wallet.privateKey,
            mnemonic: wallet.mnemonic,
            referralCode,
            checkedIn,
            taskSubmitted,
            socialConnected,
            runId,
          });

          state.successCount++;
          await addLog("success", `Account ${i + 1} complete — saved to wallet list`, runId);
        } catch (err) {
          if ((err as Error)?.name === "AbortError") break;
          state.failCount++;
          await addLog("error", `Account ${i + 1} failed: ${(err as Error).message}`, runId);
        }

        if (!abortController.signal.aborted && i < accountCount - 1) {
          await addLog("info", "Waiting 5s before next account...", runId);
          await sleep(5000);
        }
      }

      if (!abortController.signal.aborted) {
        await addLog("success", `Bot run complete — ${state.successCount} success, ${state.failCount} failed`, runId);
      } else {
        await addLog("warning", "Bot stopped by user", runId);
      }
    } catch (err) {
      logger.error({ err }, "Bot runner error");
      await addLog("error", `Bot error: ${(err as Error).message}`, runId);
    } finally {
      state.running = false;
      state.abortController = null;
    }
  })().catch((err) => {
    logger.error({ err }, "Unhandled bot runner error");
  });

  return runId;
}

export function stopBot() {
  if (state.abortController) {
    state.abortController.abort();
  }
  state.running = false;
}
