// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../GameSettlement.sol";

/// @title MockGame — test helper that wraps GameSettlement for integration tests
contract MockGame {
    GameSettlement public settlement;

    constructor(address _settlement) {
        settlement = GameSettlement(_settlement);
    }

    /// @notice Player places a bet through this game contract.
    function placeBet(bytes32 commit, uint256 maxPayout) external payable returns (uint256) {
        return settlement.commitBet{value: msg.value}(msg.sender, address(this), maxPayout, commit);
    }

    /// @notice Game settles the bet with a determined payout.
    function settle(uint256 betId, uint256 payout) external {
        settlement.settleBet(betId, payout);
    }
}
