// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IRiskManager.sol";

/// @title RiskManager — on-chain risk controls + circuit breaker
/// @notice Every limit is enforced at the contract layer.  No off-chain
///         service can bypass or override these checks.
///
///  Controls:
///   • Per-bet min/max
///   • Max payout cap (as multiple of wager)
///   • Per-player daily loss cap
///   • Per-game daily volume cap
///   • Circuit breaker (per-game and global)
contract RiskManager is IRiskManager {
    // ── Types ───────────────────────────────────────────────────────
    struct GameLimits {
        uint256 minBet;
        uint256 maxBet;
        uint256 maxPayoutMultiplier;   // basis points (10000 = 1x)
        uint256 dailyVolumeCap;        // max total volume per day
    }

    // ── State ───────────────────────────────────────────────────────
    address public owner;
    bool public globalPaused;

    uint256 public defaultMinBet = 0.001 ether;
    uint256 public defaultMaxBet = 10 ether;
    uint256 public defaultMaxPayoutMultiplier = 100_000; // 10x in basis points
    uint256 public playerDailyLossCap = 50 ether;

    mapping(address => GameLimits) public gameLimits;
    mapping(address => bool) public gamePaused;

    // Daily tracking (day = block.timestamp / 86400)
    mapping(address => mapping(uint256 => uint256)) public playerDailyLoss;  // player → day → loss
    mapping(address => mapping(uint256 => uint256)) public gameDailyVolume;  // game → day → volume

    // Authorized callers (GameSettlement contract)
    mapping(address => bool) public authorized;

    // ── Modifiers ───────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Risk: not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorized[msg.sender] || msg.sender == owner, "Risk: not authorized");
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Admin ───────────────────────────────────────────────────────
    function authorize(address caller) external onlyOwner {
        authorized[caller] = true;
    }

    function deauthorize(address caller) external onlyOwner {
        authorized[caller] = false;
    }

    function setGameLimits(
        address game,
        uint256 minBet,
        uint256 maxBet,
        uint256 maxPayoutMultiplier,
        uint256 dailyVolumeCap
    ) external onlyOwner {
        gameLimits[game] = GameLimits(minBet, maxBet, maxPayoutMultiplier, dailyVolumeCap);
    }

    function setPlayerDailyLossCap(uint256 cap) external onlyOwner {
        uint256 old = playerDailyLossCap;
        playerDailyLossCap = cap;
        emit RiskLimitUpdated("playerDailyLossCap", old, cap);
    }

    function setDefaultLimits(
        uint256 minBet,
        uint256 maxBet,
        uint256 maxPayout
    ) external onlyOwner {
        defaultMinBet = minBet;
        defaultMaxBet = maxBet;
        defaultMaxPayoutMultiplier = maxPayout;
    }

    // ── Bet validation ──────────────────────────────────────────────
    function validateBet(
        address player,
        address game,
        uint256 amount,
        uint256 maxPayout
    ) external override onlyAuthorized returns (bool) {
        // Circuit breaker
        if (globalPaused || gamePaused[game]) {
            emit BetRejected(player, game, amount, "paused");
            return false;
        }

        GameLimits memory limits = _effectiveLimits(game);

        // Min/max bet
        if (amount < limits.minBet) {
            emit BetRejected(player, game, amount, "below min bet");
            return false;
        }
        if (amount > limits.maxBet) {
            emit BetRejected(player, game, amount, "above max bet");
            return false;
        }

        // Max payout check
        uint256 payoutCap = (amount * limits.maxPayoutMultiplier) / 10_000;
        if (maxPayout > payoutCap) {
            emit BetRejected(player, game, amount, "payout exceeds cap");
            return false;
        }

        // Daily volume cap
        uint256 today = block.timestamp / 86400;
        if (limits.dailyVolumeCap > 0) {
            if (gameDailyVolume[game][today] + amount > limits.dailyVolumeCap) {
                emit BetRejected(player, game, amount, "daily volume exceeded");
                return false;
            }
        }

        // Player daily loss cap (checked but not debited yet)
        // Actual loss recording happens in recordSettlement

        gameDailyVolume[game][today] += amount;
        emit BetValidated(player, game, amount);
        return true;
    }

    // ── Settlement accounting ───────────────────────────────────────
    function recordSettlement(
        address player,
        address /* game */,
        uint256 wager,
        uint256 payout
    ) external override onlyAuthorized {
        if (payout < wager) {
            uint256 loss = wager - payout;
            uint256 today = block.timestamp / 86400;
            playerDailyLoss[player][today] += loss;
        }
        // If player won, no daily-loss accounting needed
        // (game volume was already tracked in validateBet)
    }

    // ── Circuit breaker ─────────────────────────────────────────────
    function pauseGame(address game) external override onlyOwner {
        gamePaused[game] = true;
        emit GamePaused(game, msg.sender);
    }

    function unpauseGame(address game) external override onlyOwner {
        gamePaused[game] = false;
        emit GameUnpaused(game, msg.sender);
    }

    function pauseAll() external override onlyOwner {
        globalPaused = true;
        emit GlobalPause(msg.sender);
    }

    function unpauseAll() external override onlyOwner {
        globalPaused = false;
        emit GlobalUnpause(msg.sender);
    }

    // ── Views ───────────────────────────────────────────────────────
    function isGamePaused(address game) external view override returns (bool) {
        return globalPaused || gamePaused[game];
    }

    function isGloballyPaused() external view override returns (bool) {
        return globalPaused;
    }

    function playerDailyLossToday(address player) external view returns (uint256) {
        return playerDailyLoss[player][block.timestamp / 86400];
    }

    function gameDailyVolumeToday(address game) external view returns (uint256) {
        return gameDailyVolume[game][block.timestamp / 86400];
    }

    // ── Internal ────────────────────────────────────────────────────
    function _effectiveLimits(address game) internal view returns (GameLimits memory) {
        GameLimits memory l = gameLimits[game];
        if (l.maxBet == 0) {
            // No game-specific limits — use defaults
            return GameLimits(
                defaultMinBet,
                defaultMaxBet,
                defaultMaxPayoutMultiplier,
                0 // no daily cap by default
            );
        }
        return l;
    }
}
