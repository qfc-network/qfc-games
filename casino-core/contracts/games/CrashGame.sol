// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../GameSettlement.sol";

/// @title CrashGame (MVP)
/// @notice Minimal provably-fair Crash game wired to GameSettlement.
/// Player picks autoCashoutBps (e.g. 150 = 1.50x). If round crashes at/after target, player wins.
contract CrashGame {
    GameSettlement public settlement;

    struct CrashBet {
        uint256 autoCashoutBps; // 100 = 1.00x
        bool settled;
    }

    mapping(uint256 => CrashBet) public crashBets;

    event CrashBetPlaced(uint256 indexed betId, address indexed player, uint256 wager, uint256 autoCashoutBps);
    event CrashBetResolved(uint256 indexed betId, uint256 crashBps, uint256 payout);

    constructor(address _settlement) {
        settlement = GameSettlement(_settlement);
    }

    function placeBet(bytes32 commit, uint256 autoCashoutBps) external payable returns (uint256 betId) {
        require(autoCashoutBps >= 101, "Crash: invalid target");

        uint256 maxPayout = (msg.value * autoCashoutBps) / 100;
        betId = settlement.commitBet{value: msg.value}(msg.sender, address(this), maxPayout, commit);
        crashBets[betId] = CrashBet({autoCashoutBps: autoCashoutBps, settled: false});

        emit CrashBetPlaced(betId, msg.sender, msg.value, autoCashoutBps);
    }

    function settle(uint256 betId) external {
        CrashBet storage b = crashBets[betId];
        require(!b.settled, "Crash: already settled");

        (, , uint256 wager, , , , GameSettlement.BetStatus status) = settlement.getBet(betId);
        require(status == GameSettlement.BetStatus.Revealed, "Crash: bet not revealed");

        uint256 seed = settlement.getBetSeed(betId);
        uint256 crashBps = _computeCrashBps(seed);

        uint256 payout = 0;
        if (crashBps >= b.autoCashoutBps) {
            payout = (wager * b.autoCashoutBps) / 100;
        }

        b.settled = true;
        settlement.settleBet(betId, payout);

        emit CrashBetResolved(betId, crashBps, payout);
    }

    /// @dev Simple bounded multiplier for MVP: [100..1000] bps == [1.00x..10.00x]
    function _computeCrashBps(uint256 seed) internal pure returns (uint256) {
        return 100 + (seed % 901);
    }
}
