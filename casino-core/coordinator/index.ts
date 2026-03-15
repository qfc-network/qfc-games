/**
 * Casino Core — Off-Chain Coordinator
 *
 * This service is a STATELESS RELAY. It:
 *   1. Watches for BetCommitted events on GameSettlement
 *   2. Receives player secrets via HTTP
 *   3. Calls revealBet() on-chain
 *   4. Exposes /verify/:betId for fairness verification
 *   5. Tracks telemetry metrics (bets, volume, latency)
 *   6. Enforces anti-abuse rate limits
 *
 * It NEVER determines outcomes. If this service goes down, players can
 * call revealBet() directly, or refundBet() after timeout.
 */

import { ethers } from "ethers";
import { verifyBet } from "./verify.js";

// --- Config (from environment) ---
const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.qfc.network";
const COORDINATOR_KEY = process.env.COORDINATOR_KEY || "";
const SETTLEMENT_ADDRESS = process.env.SETTLEMENT_ADDRESS || "";

const SETTLEMENT_ABI = [
  "event BetCommitted(uint256 indexed betId, address indexed player, address indexed game, uint256 wager, uint256 maxPayout, bytes32 playerCommit)",
  "event BetRevealed(uint256 indexed betId, address indexed player, uint256 seed)",
  "function revealBet(uint256 betId, bytes32 playerSecret) external",
  "function getBet(uint256 betId) external view returns (address player, address game, uint256 wager, uint256 maxPayout, uint256 seed, uint256 payout, uint8 status)",
];

// --- Anti-abuse: per-IP rate limiter ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "30", 10);

interface RateEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateEntry>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimits.set(ip, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(ip);
  }
}, 300_000);

// --- Telemetry ---
const metrics = {
  betsCommitted: 0,
  betsRevealed: 0,
  revealErrors: 0,
  totalWagerWei: 0n,
  verifyRequests: 0,
  rateLimitHits: 0,
  startedAt: Date.now(),
  lastBetAt: 0,
  revealLatencyMs: [] as number[],
};

function avgLatency(): number {
  if (metrics.revealLatencyMs.length === 0) return 0;
  const sum = metrics.revealLatencyMs.reduce((a, b) => a + b, 0);
  return Math.round(sum / metrics.revealLatencyMs.length);
}

// --- State ---
const pendingReveals = new Map<bigint, string>();

async function main() {
  if (!COORDINATOR_KEY) {
    console.error("COORDINATOR_KEY not set");
    process.exit(1);
  }
  if (!SETTLEMENT_ADDRESS) {
    console.error("SETTLEMENT_ADDRESS not set");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(COORDINATOR_KEY, provider);
  const settlement = new ethers.Contract(SETTLEMENT_ADDRESS, SETTLEMENT_ABI, wallet);

  console.log(`Coordinator started`);
  console.log(`  RPC: ${RPC_URL}`);
  console.log(`  Settlement: ${SETTLEMENT_ADDRESS}`);
  console.log(`  Coordinator address: ${wallet.address}`);
  console.log(`  Rate limit: ${RATE_LIMIT_MAX} req/min`);

  // Watch for BetCommitted events
  settlement.on("BetCommitted", (betId: bigint, player: string, _game: string, wager: bigint) => {
    metrics.betsCommitted++;
    metrics.totalWagerWei += wager;
    metrics.lastBetAt = Date.now();
    console.log(`[BetCommitted] betId=${betId} player=${player} wager=${ethers.formatEther(wager)}`);
  });

  // Simple HTTP server
  const { createServer } = await import("http");

  const server = createServer(async (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress || "unknown";

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /reveal { betId, secret }
    if (req.method === "POST" && req.url === "/reveal") {
      if (!checkRateLimit(ip)) {
        metrics.rateLimitHits++;
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "rate limited" }));
        return;
      }

      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const { betId, secret } = JSON.parse(body);
        console.log(`[reveal] betId=${betId} from ${ip}`);

        const startMs = Date.now();
        const tx = await settlement.revealBet(BigInt(betId), secret);
        const receipt = await tx.wait();
        const latency = Date.now() - startMs;

        metrics.betsRevealed++;
        metrics.revealLatencyMs.push(latency);
        // Keep only last 100 latency samples
        if (metrics.revealLatencyMs.length > 100) metrics.revealLatencyMs.shift();

        console.log(`[reveal] betId=${betId} revealed in block ${receipt.blockNumber} (${latency}ms)`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, txHash: receipt.hash, latencyMs: latency }));
      } catch (err: any) {
        metrics.revealErrors++;
        console.error(`[reveal] error:`, err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    // GET /verify/:betId
    if (req.method === "GET" && req.url?.startsWith("/verify/")) {
      if (!checkRateLimit(ip)) {
        metrics.rateLimitHits++;
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "rate limited" }));
        return;
      }

      const betId = parseInt(req.url.split("/")[2]);
      if (isNaN(betId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "invalid betId" }));
        return;
      }

      try {
        metrics.verifyRequests++;
        const result = await verifyBet(betId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, data: result }));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    // GET /health
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", pending: pendingReveals.size }));
      return;
    }

    // GET /metrics — Prometheus-style telemetry
    if (req.method === "GET" && req.url === "/metrics") {
      const uptimeS = Math.round((Date.now() - metrics.startedAt) / 1000);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        uptime_seconds: uptimeS,
        bets_committed: metrics.betsCommitted,
        bets_revealed: metrics.betsRevealed,
        reveal_errors: metrics.revealErrors,
        total_wager_qfc: ethers.formatEther(metrics.totalWagerWei),
        verify_requests: metrics.verifyRequests,
        rate_limit_hits: metrics.rateLimitHits,
        avg_reveal_latency_ms: avgLatency(),
        last_bet_at: metrics.lastBetAt ? new Date(metrics.lastBetAt).toISOString() : null,
      }));
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  const PORT = parseInt(process.env.PORT || "3250", 10);
  server.listen(PORT, () => {
    console.log(`HTTP listening on :${PORT}`);
    console.log(`  POST /reveal       { betId, secret }`);
    console.log(`  GET  /verify/:id   fairness proof`);
    console.log(`  GET  /metrics      telemetry`);
    console.log(`  GET  /health`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
