// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IRNG — provably-fair random number generation interface
/// @notice Every game references this interface; implementations may use
///         commit-reveal, VRF, or any combination.
interface IRNG {
    /// @notice Request a random seed. Returns a requestId the caller can
    ///         use to retrieve the result after reveal / callback.
    function requestRandom(bytes32 playerCommit) external returns (uint256 requestId);

    /// @notice Reveal phase (commit-reveal path). Caller supplies the
    ///         pre-image; contract derives the final seed.
    /// @return seed  The combined random seed.
    function revealRandom(uint256 requestId, bytes32 playerSecret) external returns (uint256 seed);

    /// @notice Read a fulfilled seed (view).  Reverts if not yet revealed.
    function getResult(uint256 requestId) external view returns (uint256 seed);

    /// @notice Whether a given request has been fulfilled.
    function isFulfilled(uint256 requestId) external view returns (bool);

    event RandomRequested(uint256 indexed requestId, address indexed requester, bytes32 playerCommit);
    event RandomFulfilled(uint256 indexed requestId, uint256 seed);
}
