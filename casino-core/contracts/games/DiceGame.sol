// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../GameSettlement.sol";

/// @title DiceGame — provably-fair over/under dice
/// @notice Player picks a target (2-98) and direction (over/under).
///         Roll is 0-99 derived from the seed.
///         Payout = wager × (100 / winChance), where winChance depends on target + direction.
contract DiceGame {
    GameSettlement public settlement;

    struct DiceBet {
        uint8 target;     // 2-98
        bool rollOver;    // true = over, false = under
        bool settled;
    }

    mapping(uint256 => DiceBet) public diceBets;

    event DiceBetPlaced(uint256 indexed betId, address indexed player, uint256 wager, uint8 target, bool rollOver);
    event DiceBetResolved(uint256 indexed betId, uint8 roll, uint256 payout, bool won);

    constructor(address _settlement) {
        settlement = GameSettlement(_settlement);
    }

    /// @notice Place a dice bet.
    /// @param commit   keccak256(playerSecret)
    /// @param target   The target number (2-98)
    /// @param rollOver true = bet that roll > target, false = bet that roll < target
    function placeBet(bytes32 commit, uint8 target, bool rollOver) external payable returns (uint256 betId) {
        require(target >= 2 && target <= 98, "Dice: target out of range");

        uint256 winChance = rollOver ? (99 - target) : target;
        // maxPayout = wager * 99 / winChance (house edge ~1%)
        uint256 maxPayout = (msg.value * 99) / winChance;

        betId = settlement.commitBet{value: msg.value}(msg.sender, address(this), maxPayout, commit);
        diceBets[betId] = DiceBet({target: target, rollOver: rollOver, settled: false});

        emit DiceBetPlaced(betId, msg.sender, msg.value, target, rollOver);
    }

    /// @notice Settle a dice bet after reveal.
    function settle(uint256 betId) external {
        DiceBet storage b = diceBets[betId];
        require(!b.settled, "Dice: already settled");

        (, , uint256 wager, , , , GameSettlement.BetStatus status) = settlement.getBet(betId);
        require(status == GameSettlement.BetStatus.Revealed, "Dice: bet not revealed");

        uint256 seed = settlement.getBetSeed(betId);
        uint8 roll = uint8(seed % 100); // 0-99

        bool won;
        if (b.rollOver) {
            won = roll > b.target;
        } else {
            won = roll < b.target;
        }

        uint256 payout = 0;
        if (won) {
            uint256 winChance = b.rollOver ? (99 - b.target) : b.target;
            payout = (wager * 99) / winChance;
        }

        b.settled = true;
        settlement.settleBet(betId, payout);

        emit DiceBetResolved(betId, roll, payout, won);
    }
}
