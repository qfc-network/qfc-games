// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IBankroll — contract-custodied bankroll for casino games
/// @notice Funds are ALWAYS held by the contract, never by an EOA.
///         The house deposits liquidity; games settle wins/losses
///         against the bankroll.
interface IBankroll {
    // ── House management ────────────────────────────────────────────
    function depositHouseFunds() external payable;
    function withdrawHouseFunds(uint256 amount) external;

    // ── Game settlement (only callable by registered games) ─────────
    function lockWager(address player, uint256 amount) external payable;
    function settleWin(address player, uint256 payout) external;
    function settleLoss(address player, uint256 wager) external;
    function refundWager(address player, uint256 amount) external;

    // ── Views ───────────────────────────────────────────────────────
    function houseBalance() external view returns (uint256);
    function lockedFunds() external view returns (uint256);
    function availableBalance() external view returns (uint256);
    function gameExposure(address game) external view returns (uint256 current, uint256 max);

    // ── Events ──────────────────────────────────────────────────────
    event HouseDeposit(address indexed depositor, uint256 amount, uint256 newBalance);
    event HouseWithdrawal(address indexed recipient, uint256 amount, uint256 newBalance);
    event WagerLocked(address indexed player, address indexed game, uint256 amount);
    event WinSettled(address indexed player, address indexed game, uint256 payout);
    event LossSettled(address indexed player, address indexed game, uint256 wager);
    event WagerRefunded(address indexed player, address indexed game, uint256 amount);
}
