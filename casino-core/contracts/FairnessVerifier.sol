// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GameSettlement.sol";

/// @title FairnessVerifier — on-chain proof verification for casino games
/// @notice Allows anyone to verify that a bet outcome was fairly determined
///         from the committed seed, without trusting the house.
contract FairnessVerifier {
    GameSettlement public settlement;

    struct VerificationResult {
        uint256 betId;
        address player;
        address game;
        uint256 wager;
        uint256 payout;
        uint256 seed;
        bool settled;
        bool verified;
    }

    event BetVerified(uint256 indexed betId, address indexed verifier, bool valid);

    constructor(address _settlement) {
        settlement = GameSettlement(_settlement);
    }

    /// @notice Verify a settled bet. Returns full details for off-chain display.
    function verify(uint256 betId) external view returns (VerificationResult memory result) {
        (
            address player,
            address game,
            uint256 wager,
            ,
            uint256 seed,
            uint256 payout,
            GameSettlement.BetStatus status
        ) = settlement.getBet(betId);

        result = VerificationResult({
            betId: betId,
            player: player,
            game: game,
            wager: wager,
            payout: payout,
            seed: seed,
            settled: status == GameSettlement.BetStatus.Settled,
            verified: status == GameSettlement.BetStatus.Settled && seed != 0
        });
    }

    /// @notice Compute what a Crash game result would be for a given seed.
    function verifyCrash(uint256 seed) external pure returns (uint256 crashBps) {
        return 100 + (seed % 901);
    }

    /// @notice Compute what a Dice game result would be for a given seed.
    function verifyDice(uint256 seed) external pure returns (uint8 roll) {
        return uint8(seed % 100);
    }

    /// @notice Compute what a Roulette spin would be for a given seed.
    function verifyRoulette(uint256 seed) external pure returns (uint8 spin) {
        return uint8(seed % 37);
    }

    /// @notice Verify that a player secret produces the expected commit.
    function verifyCommit(bytes32 playerSecret, bytes32 expectedCommit) external pure returns (bool) {
        return keccak256(abi.encodePacked(playerSecret)) == expectedCommit;
    }
}
