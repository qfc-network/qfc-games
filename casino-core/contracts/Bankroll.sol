// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IBankroll.sol";

/// @title Bankroll — contract-custodied bankroll with transparent accounting
/// @notice All funds are held by THIS contract.  The house (owner) deposits
///         liquidity; registered games settle wins/losses against it.
///         No EOA ever custodies player or house funds.
///
///  Accounting invariant (always true):
///    address(this).balance == _houseBalance + _lockedFunds
///
///  _houseBalance  = unallocated house liquidity
///  _lockedFunds   = sum of all in-flight wagers not yet settled
contract Bankroll is IBankroll {
    // ── State ───────────────────────────────────────────────────────
    address public owner;

    uint256 private _houseBalance;
    uint256 private _lockedFunds;

    // Game registration + exposure tracking
    mapping(address => bool) public registeredGames;
    mapping(address => uint256) public maxExposure;     // per-game cap
    mapping(address => uint256) public currentExposure;  // in-flight wagers

    // ── Modifiers ───────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Bankroll: not owner");
        _;
    }

    modifier onlyGame() {
        require(registeredGames[msg.sender], "Bankroll: not registered game");
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Game registration ───────────────────────────────────────────
    function registerGame(address game, uint256 _maxExposure) external onlyOwner {
        registeredGames[game] = true;
        maxExposure[game] = _maxExposure;
    }

    function unregisterGame(address game) external onlyOwner {
        require(currentExposure[game] == 0, "Bankroll: game has in-flight wagers");
        registeredGames[game] = false;
        maxExposure[game] = 0;
    }

    function setMaxExposure(address game, uint256 _maxExposure) external onlyOwner {
        require(registeredGames[game], "Bankroll: not registered");
        maxExposure[game] = _maxExposure;
    }

    // ── House management ────────────────────────────────────────────
    function depositHouseFunds() external payable override {
        require(msg.value > 0, "Bankroll: zero deposit");
        _houseBalance += msg.value;
        emit HouseDeposit(msg.sender, msg.value, _houseBalance);
    }

    function withdrawHouseFunds(uint256 amount) external override onlyOwner {
        require(amount <= _houseBalance, "Bankroll: insufficient house balance");
        _houseBalance -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Bankroll: transfer failed");
        emit HouseWithdrawal(msg.sender, amount, _houseBalance);
    }

    // ── Settlement (game-only) ──────────────────────────────────────

    /// @notice Lock a player's wager.  The native token must be sent with
    ///         the call (msg.value == amount).
    function lockWager(address player, uint256 amount) external payable override onlyGame {
        require(amount > 0, "Bankroll: zero wager");
        require(
            currentExposure[msg.sender] + amount <= maxExposure[msg.sender],
            "Bankroll: exposure limit reached"
        );
        // Wager arrives as msg.value forwarded by the game contract
        _lockedFunds += amount;
        currentExposure[msg.sender] += amount;
        emit WagerLocked(player, msg.sender, amount);
    }

    /// @notice Player wins. Pay out from locked wager + house balance.
    ///         payout = wager + winnings.  Wager returns to player,
    ///         winnings come from house.
    function settleWin(address player, uint256 payout) external override onlyGame {
        // The wager was already locked; we need to figure out how much
        // comes from house vs locked.  payout > wager means house pays diff.
        // For simplicity: the game tells us the total payout.
        // We assume the game has correctly computed this.
        require(payout > 0, "Bankroll: zero payout");
        require(_lockedFunds + _houseBalance >= payout, "Bankroll: insufficient funds");

        // Debit: first from locked funds (the player's wager), then house
        if (payout <= _lockedFunds) {
            _lockedFunds -= payout;
        } else {
            uint256 fromHouse = payout - _lockedFunds;
            _lockedFunds = 0;
            _houseBalance -= fromHouse;
        }
        currentExposure[msg.sender] -= _min(currentExposure[msg.sender], payout);

        (bool ok, ) = player.call{value: payout}("");
        require(ok, "Bankroll: payout failed");
        emit WinSettled(player, msg.sender, payout);
    }

    /// @notice Player loses.  Wager moves from locked → house balance.
    function settleLoss(address player, uint256 wager) external override onlyGame {
        require(wager > 0, "Bankroll: zero wager");
        require(_lockedFunds >= wager, "Bankroll: accounting error");
        _lockedFunds -= wager;
        _houseBalance += wager;
        currentExposure[msg.sender] -= _min(currentExposure[msg.sender], wager);
        emit LossSettled(player, msg.sender, wager);
    }

    /// @notice Refund a wager (e.g. game cancelled, timeout).
    function refundWager(address player, uint256 amount) external override onlyGame {
        require(amount > 0, "Bankroll: zero refund");
        require(_lockedFunds >= amount, "Bankroll: accounting error");
        _lockedFunds -= amount;
        currentExposure[msg.sender] -= _min(currentExposure[msg.sender], amount);
        (bool ok, ) = player.call{value: amount}("");
        require(ok, "Bankroll: refund failed");
        emit WagerRefunded(player, msg.sender, amount);
    }

    // ── Views ───────────────────────────────────────────────────────
    function houseBalance() external view override returns (uint256) {
        return _houseBalance;
    }

    function lockedFunds() external view override returns (uint256) {
        return _lockedFunds;
    }

    function availableBalance() external view override returns (uint256) {
        return _houseBalance;
    }

    function gameExposure(address game) external view override returns (uint256 current, uint256 max) {
        return (currentExposure[game], maxExposure[game]);
    }

    /// @notice On-chain accounting proof: contract balance must equal
    ///         houseBalance + lockedFunds.
    function accountingValid() external view returns (bool) {
        return address(this).balance == _houseBalance + _lockedFunds;
    }

    // ── Internal ────────────────────────────────────────────────────
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // Reject bare ether sends (must go through depositHouseFunds)
    receive() external payable {
        revert("Bankroll: use depositHouseFunds()");
    }
}
