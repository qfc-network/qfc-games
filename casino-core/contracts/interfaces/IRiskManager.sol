// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IRiskManager — on-chain risk controls for casino games
/// @notice All limits are enforced at the contract layer.  No off-chain
///         service can override these checks.
interface IRiskManager {
    // ── Bet validation (called before every wager) ──────────────────
    function validateBet(
        address player,
        address game,
        uint256 amount,
        uint256 maxPayout
    ) external returns (bool);

    // ── Accounting hooks (called after settlement) ──────────────────
    function recordSettlement(
        address player,
        address game,
        uint256 wager,
        uint256 payout
    ) external;

    // ── Circuit breaker ─────────────────────────────────────────────
    function pauseGame(address game) external;
    function unpauseGame(address game) external;
    function pauseAll() external;
    function unpauseAll() external;
    function isGamePaused(address game) external view returns (bool);
    function isGloballyPaused() external view returns (bool);

    // ── Events ──────────────────────────────────────────────────────
    event BetValidated(address indexed player, address indexed game, uint256 amount);
    event BetRejected(address indexed player, address indexed game, uint256 amount, string reason);
    event GamePaused(address indexed game, address indexed triggeredBy);
    event GameUnpaused(address indexed game, address indexed triggeredBy);
    event GlobalPause(address indexed triggeredBy);
    event GlobalUnpause(address indexed triggeredBy);
    event RiskLimitUpdated(string limitType, uint256 oldValue, uint256 newValue);
}
