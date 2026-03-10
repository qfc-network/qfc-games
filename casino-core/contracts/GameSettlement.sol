// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IRNG.sol";
import "./interfaces/IBankroll.sol";
import "./interfaces/IRiskManager.sol";

/// @title GameSettlement — unified bet lifecycle & on-chain settlement
/// @notice Orchestrates: commit → reveal → settle.  This is the contract
///         that game frontends interact with.  All outcomes are determined
///         and settled on-chain; the off-chain coordinator only relays
///         transactions.
///
///  Architecture:
///   GameSettlement → IRNG        (randomness)
///                  → IBankroll   (funds)
///                  → IRiskManager (limits)
///
///  Event schema is designed for explorer indexing.
contract GameSettlement {
    // ── Types ───────────────────────────────────────────────────────
    enum BetStatus { None, Committed, Revealed, Settled, Refunded }

    struct Bet {
        address player;
        address game;
        uint256 wager;
        uint256 maxPayout;
        uint256 rngRequestId;
        uint256 seed;
        uint256 payout;
        BetStatus status;
        uint256 committedBlock;
    }

    // ── State ───────────────────────────────────────────────────────
    address public owner;
    IRNG public rng;
    IBankroll public bankroll;
    IRiskManager public riskManager;

    uint256 private _nextBetId = 1;
    mapping(uint256 => Bet) public bets;
    mapping(address => bool) public registeredGames;

    uint256 public refundTimeout = 1000; // blocks before player can force-refund

    // ── Events (unified schema for explorer indexing) ───────────────
    event BetCommitted(
        uint256 indexed betId,
        address indexed player,
        address indexed game,
        uint256 wager,
        uint256 maxPayout,
        bytes32 playerCommit
    );

    event BetRevealed(
        uint256 indexed betId,
        address indexed player,
        uint256 seed
    );

    event BetSettled(
        uint256 indexed betId,
        address indexed player,
        address indexed game,
        uint256 wager,
        uint256 payout,
        bool won
    );

    event BetRefunded(
        uint256 indexed betId,
        address indexed player,
        uint256 amount
    );

    event GameRegistered(address indexed game);
    event GameUnregistered(address indexed game);

    // ── Modifiers ───────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Settlement: not owner");
        _;
    }

    modifier onlyRegisteredGame() {
        require(registeredGames[msg.sender], "Settlement: not registered game");
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────
    constructor(address _rng, address _bankroll, address _riskManager) {
        owner = msg.sender;
        rng = IRNG(_rng);
        bankroll = IBankroll(_bankroll);
        riskManager = IRiskManager(_riskManager);
    }

    // ── Admin ───────────────────────────────────────────────────────
    function registerGame(address game) external onlyOwner {
        registeredGames[game] = true;
        emit GameRegistered(game);
    }

    function unregisterGame(address game) external onlyOwner {
        registeredGames[game] = false;
        emit GameUnregistered(game);
    }

    function setRefundTimeout(uint256 blocks) external onlyOwner {
        require(blocks >= 100, "Settlement: timeout too short");
        refundTimeout = blocks;
    }

    // ── Bet lifecycle ───────────────────────────────────────────────

    /// @notice Step 1: Commit a bet on behalf of a player.
    ///         Called by the game contract.  Native token wager sent as msg.value.
    /// @param player     The player's EOA address (payout recipient).
    /// @param game       The game contract address determining payout rules.
    /// @param maxPayout  Maximum possible payout for this bet (game-specific).
    /// @param commit     keccak256(playerSecret) for commit-reveal RNG.
    function commitBet(
        address player,
        address game,
        uint256 maxPayout,
        bytes32 commit
    ) external payable returns (uint256 betId) {
        require(registeredGames[game], "Settlement: game not registered");
        require(msg.value > 0, "Settlement: zero wager");

        // Risk check (on-chain, not bypassable)
        bool allowed = riskManager.validateBet(player, game, msg.value, maxPayout);
        require(allowed, "Settlement: bet rejected by risk manager");

        // Lock wager in bankroll
        bankroll.lockWager{value: msg.value}(player, msg.value);

        // Request RNG
        uint256 rngReqId = rng.requestRandom(commit);

        betId = _nextBetId++;
        bets[betId] = Bet({
            player: player,
            game: game,
            wager: msg.value,
            maxPayout: maxPayout,
            rngRequestId: rngReqId,
            seed: 0,
            payout: 0,
            status: BetStatus.Committed,
            committedBlock: block.number
        });

        emit BetCommitted(betId, player, game, msg.value, maxPayout, commit);
    }

    /// @notice Step 2: Reveal the random seed.
    ///         Anyone can call this (player or coordinator).
    function revealBet(uint256 betId, bytes32 playerSecret) external {
        Bet storage bet = bets[betId];
        require(bet.status == BetStatus.Committed, "Settlement: not committed");

        uint256 seed = rng.revealRandom(bet.rngRequestId, playerSecret);
        bet.seed = seed;
        bet.status = BetStatus.Revealed;

        emit BetRevealed(betId, bet.player, seed);
    }

    /// @notice Step 3: Settle the bet.  Only the game contract can call
    ///         this, providing the payout it computed from the seed.
    ///         The game contract reads the seed via `getBetSeed(betId)`
    ///         and applies its own payout logic.
    function settleBet(uint256 betId, uint256 payout) external onlyRegisteredGame {
        Bet storage bet = bets[betId];
        require(bet.status == BetStatus.Revealed, "Settlement: not revealed");
        require(bet.game == msg.sender, "Settlement: wrong game");
        require(payout <= bet.maxPayout, "Settlement: payout exceeds max");

        bet.payout = payout;
        bet.status = BetStatus.Settled;

        // Settle via bankroll
        if (payout > 0) {
            bankroll.settleWin(bet.player, payout);
        } else {
            bankroll.settleLoss(bet.player, bet.wager);
        }

        // Record for risk tracking
        riskManager.recordSettlement(bet.player, bet.game, bet.wager, payout);

        emit BetSettled(betId, bet.player, bet.game, bet.wager, payout, payout > bet.wager);
    }

    /// @notice Emergency refund: if a bet is stuck (never revealed/settled)
    ///         the player can reclaim after timeout.
    function refundBet(uint256 betId) external {
        Bet storage bet = bets[betId];
        require(bet.player == msg.sender, "Settlement: not your bet");
        require(
            bet.status == BetStatus.Committed || bet.status == BetStatus.Revealed,
            "Settlement: already settled"
        );
        require(
            block.number >= bet.committedBlock + refundTimeout,
            "Settlement: timeout not reached"
        );

        bet.status = BetStatus.Refunded;
        bankroll.refundWager(bet.player, bet.wager);

        emit BetRefunded(betId, bet.player, bet.wager);
    }

    // ── Views (for game contracts) ──────────────────────────────────
    function getBetSeed(uint256 betId) external view returns (uint256) {
        require(bets[betId].status == BetStatus.Revealed, "Settlement: not revealed");
        return bets[betId].seed;
    }

    function getBet(uint256 betId) external view returns (
        address player,
        address game,
        uint256 wager,
        uint256 maxPayout,
        uint256 seed,
        uint256 payout,
        BetStatus status
    ) {
        Bet storage b = bets[betId];
        return (b.player, b.game, b.wager, b.maxPayout, b.seed, b.payout, b.status);
    }
}
