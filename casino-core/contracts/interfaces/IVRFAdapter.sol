// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IVRFAdapter — plug-in interface for external VRF providers
/// @notice Allows CasinoRNG to delegate randomness to Chainlink VRF,
///         Gelato VRF, or any on-chain VRF oracle without changing the
///         core contract.
interface IVRFAdapter {
    /// @notice Ask the VRF oracle for a random word.
    /// @return vrfRequestId  An opaque id the adapter uses internally.
    function requestRandomWord() external returns (uint256 vrfRequestId);

    /// @notice Called by the VRF oracle (callback pattern).
    ///         The adapter MUST forward the result to CasinoRNG via
    ///         `fulfillFromVRF(requestId, randomWord)`.
    function fulfillRandomWord(uint256 vrfRequestId, uint256 randomWord) external;

    /// @notice Whether a given VRF request has been fulfilled.
    function isVRFFulfilled(uint256 vrfRequestId) external view returns (bool);

    event VRFRequested(uint256 indexed vrfRequestId);
    event VRFFulfilled(uint256 indexed vrfRequestId, uint256 randomWord);
}
