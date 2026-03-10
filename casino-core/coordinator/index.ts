/**
 * Casino Core — Minimal Off-Chain Coordinator
 *
 * This service is a STATELESS RELAY. It:
 *   1. Watches for BetCommitted events on GameSettlement
 *   2. Receives player secrets via HTTP
 *   3. Calls revealBet() on-chain
 *
 * It NEVER determines outcomes. If this service goes down, players can
 * call revealBet() directly, or refundBet() after timeout.
 */

import { ethers } from "ethers";

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

// --- State ---
// Pending reveals: betId → playerSecret (received from player, waiting for block delay)
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

  // Watch for BetCommitted events
  settlement.on("BetCommitted", (betId, player, game, wager, maxPayout, commit) => {
    console.log(`[BetCommitted] betId=${betId} player=${player} wager=${ethers.formatEther(wager)}`);
    // The coordinator waits for the player to submit their secret
    // via the HTTP endpoint (see submitSecret below)
  });

  // Simple HTTP endpoint for players to submit secrets
  const { createServer } = await import("http");

  const server = createServer(async (req, res) => {
    // POST /reveal { betId, secret }
    if (req.method === "POST" && req.url === "/reveal") {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const { betId, secret } = JSON.parse(body);
        console.log(`[reveal] betId=${betId} received secret`);

        // Submit reveal transaction
        const tx = await settlement.revealBet(BigInt(betId), secret);
        const receipt = await tx.wait();
        console.log(`[reveal] betId=${betId} revealed in block ${receipt.blockNumber}`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, txHash: receipt.hash }));
      } catch (err: any) {
        console.error(`[reveal] error:`, err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
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

    res.writeHead(404);
    res.end("not found");
  });

  const PORT = parseInt(process.env.PORT || "3250", 10);
  server.listen(PORT, () => {
    console.log(`HTTP listening on :${PORT}`);
    console.log(`  POST /reveal  { betId, secret }`);
    console.log(`  GET  /health`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
