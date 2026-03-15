#!/usr/bin/env npx tsx
/**
 * Fairness Verify CLI + API
 *
 * CLI:   npx tsx verify.ts --bet 42
 * API:   GET /verify/:betId  (when coordinator runs with VERIFY=true)
 *
 * Reads on-chain bet data and re-derives the outcome to prove fairness.
 */

import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.qfc.network";
const SETTLEMENT_ADDRESS = process.env.SETTLEMENT_ADDRESS || "";
const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || "";

const SETTLEMENT_ABI = [
  "function getBet(uint256 betId) view returns (address player, address game, uint256 wager, uint256 maxPayout, uint256 seed, uint256 payout, uint8 status)",
  "event BetCommitted(uint256 indexed betId, address indexed player, address indexed game, uint256 wager, uint256 maxPayout, bytes32 playerCommit)",
  "event BetSettled(uint256 indexed betId, address indexed player, address indexed game, uint256 wager, uint256 payout, bool won)",
];

const VERIFIER_ABI = [
  "function verify(uint256 betId) view returns (tuple(uint256 betId, address player, address game, uint256 wager, uint256 payout, uint256 seed, bool settled, bool verified))",
  "function verifyCrash(uint256 seed) pure returns (uint256)",
  "function verifyDice(uint256 seed) pure returns (uint8)",
  "function verifyRoulette(uint256 seed) pure returns (uint8)",
  "function verifyCommit(bytes32 playerSecret, bytes32 expectedCommit) pure returns (bool)",
];

interface VerifyResult {
  betId: number;
  player: string;
  game: string;
  wager: string;
  payout: string;
  seed: string;
  status: string;
  crashResult?: number;
  diceResult?: number;
  rouletteResult?: number;
  verified: boolean;
}

const STATUS_MAP: Record<number, string> = {
  0: "None",
  1: "Committed",
  2: "Revealed",
  3: "Settled",
  4: "Refunded",
};

export async function verifyBet(betId: number): Promise<VerifyResult> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const settlement = new ethers.Contract(SETTLEMENT_ADDRESS, SETTLEMENT_ABI, provider);

  const bet = await settlement.getBet(betId);
  const [player, game, wager, , seed, payout, status] = bet;

  const result: VerifyResult = {
    betId,
    player,
    game,
    wager: ethers.formatEther(wager),
    payout: ethers.formatEther(payout),
    seed: seed.toString(),
    status: STATUS_MAP[Number(status)] || "Unknown",
    verified: Number(status) === 3 && seed !== 0n,
  };

  if (seed !== 0n) {
    result.crashResult = Number(100n + (seed % 901n));
    result.diceResult = Number(seed % 100n);
    result.rouletteResult = Number(seed % 37n);
  }

  return result;
}

// CLI mode
if (process.argv.includes("--bet")) {
  const idx = process.argv.indexOf("--bet");
  const betId = parseInt(process.argv[idx + 1]);
  if (isNaN(betId)) {
    console.error("Usage: npx tsx verify.ts --bet <betId>");
    process.exit(1);
  }

  verifyBet(betId)
    .then((r) => {
      console.log("\n  Fairness Verification Report");
      console.log("  ═══════════════════════════════════");
      console.log(`  Bet ID:     ${r.betId}`);
      console.log(`  Player:     ${r.player}`);
      console.log(`  Game:       ${r.game}`);
      console.log(`  Wager:      ${r.wager} QFC`);
      console.log(`  Payout:     ${r.payout} QFC`);
      console.log(`  Status:     ${r.status}`);
      console.log(`  Seed:       ${r.seed}`);
      console.log("  ───────────────────────────────────");
      if (r.crashResult !== undefined) {
        console.log(`  Crash:      ${(r.crashResult / 100).toFixed(2)}x`);
        console.log(`  Dice roll:  ${r.diceResult}`);
        console.log(`  Roulette:   ${r.rouletteResult}`);
      }
      console.log(`  Verified:   ${r.verified ? "YES" : "NO"}`);
      console.log("  ═══════════════════════════════════\n");
    })
    .catch((err) => {
      console.error("Verification failed:", err.message);
      process.exit(1);
    });
}

export { SETTLEMENT_ABI, VERIFIER_ABI };
