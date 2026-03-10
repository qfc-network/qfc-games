# Casino Core — Chain-First Architecture

## Design Principles

1. **On-chain settlement is the source of truth.** Every bet outcome is determined
   and settled by smart contracts. No off-chain service can override results.
2. **Provably fair randomness.** Commit-reveal ensures neither player nor house
   can predict or manipulate outcomes. VRF adapter slot provides upgrade path
   to oracle-grade entropy.
3. **Contract-custodied bankroll.** Funds are held by `Bankroll.sol`, never by
   any EOA. The accounting invariant `balance == houseBalance + lockedFunds`
   is verifiable by anyone at any time.
4. **Risk controls at the contract layer.** Bet limits, payout caps, daily
   volume caps, and circuit breakers are enforced on-chain. They cannot be
   bypassed by any off-chain component.
5. **Minimal off-chain coordinator.** The coordinator relays transactions
   (commit, reveal) but never determines outcomes.

## Contract Architecture

```
┌─────────────────────────────────────────────┐
│                 Game Contract                │
│  (e.g. CoinFlip, Dice, Slots)               │
│  - defines payout rules from seed           │
│  - calls settlement.commitBet / settleBet   │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│            GameSettlement.sol                │
│  - bet lifecycle: commit → reveal → settle  │
│  - unified event schema for indexing        │
│  - refund timeout for stuck bets            │
├─────────┬──────────┬────────────────────────┤
│         │          │                        │
│  ┌──────▼───┐ ┌────▼──────┐ ┌──────────────▼─┐
│  │CasinoRNG │ │ Bankroll  │ │  RiskManager   │
│  │          │ │           │ │                │
│  │commit-   │ │contract-  │ │min/max bet     │
│  │reveal +  │ │custodied  │ │payout cap      │
│  │VRF slot  │ │treasury   │ │daily caps      │
│  └──────────┘ └───────────┘ │circuit breaker │
│                             └────────────────┘
└─────────────────────────────────────────────┘
```

## Bet Lifecycle

```
Player                    Game Contract         GameSettlement      CasinoRNG       Bankroll
  │                            │                      │                │              │
  │─── placeBet(commit) ──────►│                      │                │              │
  │                            │── commitBet(player,  │                │              │
  │                            │   game, maxPay,      │                │              │
  │                            │   commit) {value} ──►│                │              │
  │                            │                      │─ validateBet ──────────────►RiskManager
  │                            │                      │─ lockWager ───────────────────►│
  │                            │                      │─ requestRandom ►│              │
  │                            │                      │◄── requestId ──│              │
  │                            │◄────── betId ────────│                │              │
  │                            │                      │                │              │
  │  (wait ≥ 1 block)         │                      │                │              │
  │                            │                      │                │              │
  │─── revealBet(betId, secret) ─────────────────────►│                │              │
  │                            │                      │─ revealRandom ►│              │
  │                            │                      │◄──── seed ────│              │
  │                            │                      │                │              │
  │                            │◄── getBetSeed(betId) │                │              │
  │                            │── settleBet(betId,   │                │              │
  │                            │   payout) ──────────►│                │              │
  │                            │                      │─ settleWin ────────────────────►│
  │                            │                      │  or settleLoss                 │
  │◄────────────────── payout (native token) ──────────────────────────────────────────│
```

## Provably Fair RNG (Commit-Reveal)

1. **Commit**: Player sends `commit = keccak256(secret)` with their bet.
   At this point, the house seed is captured from `blockhash(block.number - 1)`.
2. **Reveal** (after ≥1 block): Player reveals `secret`. Contract verifies
   `keccak256(secret) == commit`. Final seed:
   ```
   seed = keccak256(secret ⊕ houseSeed ⊕ blockhash(revealBlock - 1))
   ```
   Neither party can predict or manipulate the seed because:
   - Player committed before seeing houseSeed
   - House seed was fixed before reveal
   - Reveal-block hash adds additional entropy
3. **VRF upgrade**: When `vrfAdapter` is set, VRF output is mixed into the
   seed, strictly strengthening entropy. If VRF times out, commit-reveal
   alone is used as fallback.

## Bankroll Accounting

All native tokens are held in `Bankroll.sol`. The invariant:

```
address(this).balance == _houseBalance + _lockedFunds
```

is enforced and publicly verifiable via `accountingValid()`.

- **House deposits** → `_houseBalance` increases
- **Wager locked** → player's tokens arrive, `_lockedFunds` increases
- **Player wins** → payout from locked + house, both decrease
- **Player loses** → wager moves from `_lockedFunds` to `_houseBalance`
- **Refund** → wager returns from `_lockedFunds` to player

Per-game exposure caps prevent a single game from draining the bankroll.

## Risk Controls

All enforced at the contract layer:

| Control | Description | Configurable |
|---------|-------------|--------------|
| Min bet | Floor per wager | Per-game or default |
| Max bet | Ceiling per wager | Per-game or default |
| Max payout multiplier | Cap on win/wager ratio | Per-game or default |
| Daily volume cap | Max total volume per game per day | Per-game |
| Player daily loss cap | Max loss per player per day | Global |
| Circuit breaker (game) | Pause a single game | Owner |
| Circuit breaker (global) | Pause all games | Owner |

## Event Schema (Explorer Indexing)

All events follow a consistent pattern for the QFC explorer:

```
BetCommitted(betId, player, game, wager, maxPayout, commit)
BetRevealed(betId, player, seed)
BetSettled(betId, player, game, wager, payout, won)
BetRefunded(betId, player, amount)
HouseDeposit(depositor, amount, newBalance)
HouseWithdrawal(recipient, amount, newBalance)
GamePaused(game, triggeredBy)
GlobalPause(triggeredBy)
```

## Off-Chain Coordinator

The coordinator (`coordinator/index.ts`) is a **stateless relay** that:

1. Watches for `BetCommitted` events
2. Calls `revealBet()` with the player's secret (received off-chain)
3. Never determines outcomes — only relays transactions

If the coordinator goes down, players can call `revealBet` and `refundBet`
directly. The coordinator is a convenience, not a dependency.

## Deployment (QFC Testnet)

```
Chain:    QFC Testnet (chain_id: 9000)
RPC:      https://rpc.testnet.qfc.network
Compiler: solc 0.8.24, optimizer 200 runs
Deploy:   npx hardhat run scripts/deploy.mjs --network qfcTestnet
```
