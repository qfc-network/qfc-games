// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../GameSettlement.sol";

/// @title RouletteGame — provably-fair European Roulette (0-36)
/// @notice Supports: straight (35:1), color (1:1), odd-even (1:1), high-low (1:1),
///         dozen (2:1), column (2:1).
contract RouletteGame {
    GameSettlement public settlement;

    enum BetType { Straight, Red, Black, Odd, Even, High, Low, Dozen1, Dozen2, Dozen3, Column1, Column2, Column3 }

    struct RouletteBet {
        BetType betType;
        uint8 number;     // only used for Straight bets (0-36)
        bool settled;
    }

    mapping(uint256 => RouletteBet) public rouletteBets;

    // Red numbers on a European wheel
    uint256 private constant RED_MASK =
        (1 << 1) | (1 << 3) | (1 << 5) | (1 << 7) | (1 << 9) |
        (1 << 12) | (1 << 14) | (1 << 16) | (1 << 18) | (1 << 19) |
        (1 << 21) | (1 << 23) | (1 << 25) | (1 << 27) | (1 << 30) |
        (1 << 32) | (1 << 34) | (1 << 36);

    event RouletteBetPlaced(uint256 indexed betId, address indexed player, uint256 wager, BetType betType, uint8 number);
    event RouletteBetResolved(uint256 indexed betId, uint8 spin, uint256 payout, bool won);

    constructor(address _settlement) {
        settlement = GameSettlement(_settlement);
    }

    /// @notice Place a roulette bet.
    function placeBet(bytes32 commit, BetType betType, uint8 number) external payable returns (uint256 betId) {
        if (betType == BetType.Straight) {
            require(number <= 36, "Roulette: invalid number");
        }

        uint256 maxPayout = _maxPayout(msg.value, betType);

        betId = settlement.commitBet{value: msg.value}(msg.sender, address(this), maxPayout, commit);
        rouletteBets[betId] = RouletteBet({betType: betType, number: number, settled: false});

        emit RouletteBetPlaced(betId, msg.sender, msg.value, betType, number);
    }

    /// @notice Settle a roulette bet after reveal.
    function settle(uint256 betId) external {
        RouletteBet storage b = rouletteBets[betId];
        require(!b.settled, "Roulette: already settled");

        (, , uint256 wager, , , , GameSettlement.BetStatus status) = settlement.getBet(betId);
        require(status == GameSettlement.BetStatus.Revealed, "Roulette: bet not revealed");

        uint256 seed = settlement.getBetSeed(betId);
        uint8 spin = uint8(seed % 37); // 0-36

        bool won = _evaluateBet(b.betType, b.number, spin);
        uint256 payout = won ? _maxPayout(wager, b.betType) : 0;

        b.settled = true;
        settlement.settleBet(betId, payout);

        emit RouletteBetResolved(betId, spin, payout, won);
    }

    function _evaluateBet(BetType betType, uint8 number, uint8 spin) internal pure returns (bool) {
        if (spin == 0) return betType == BetType.Straight && number == 0;

        if (betType == BetType.Straight) return spin == number;
        if (betType == BetType.Red) return (RED_MASK >> spin) & 1 == 1;
        if (betType == BetType.Black) return (RED_MASK >> spin) & 1 == 0;
        if (betType == BetType.Odd) return spin % 2 == 1;
        if (betType == BetType.Even) return spin % 2 == 0;
        if (betType == BetType.Low) return spin >= 1 && spin <= 18;
        if (betType == BetType.High) return spin >= 19 && spin <= 36;
        if (betType == BetType.Dozen1) return spin >= 1 && spin <= 12;
        if (betType == BetType.Dozen2) return spin >= 13 && spin <= 24;
        if (betType == BetType.Dozen3) return spin >= 25 && spin <= 36;
        if (betType == BetType.Column1) return spin % 3 == 1;
        if (betType == BetType.Column2) return spin % 3 == 2;
        if (betType == BetType.Column3) return spin % 3 == 0;
        return false;
    }

    function _maxPayout(uint256 wager, BetType betType) internal pure returns (uint256) {
        if (betType == BetType.Straight) return wager * 36; // 35:1 + original
        if (betType == BetType.Dozen1 || betType == BetType.Dozen2 || betType == BetType.Dozen3) return wager * 3;
        if (betType == BetType.Column1 || betType == BetType.Column2 || betType == BetType.Column3) return wager * 3;
        return wager * 2; // Red/Black/Odd/Even/High/Low
    }
}
