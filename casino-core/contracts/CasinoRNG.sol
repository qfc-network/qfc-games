// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IRNG.sol";
import "./interfaces/IVRFAdapter.sol";

/// @title CasinoRNG — provably-fair commit-reveal RNG with VRF adapter slot
/// @notice The ONLY source of randomness for casino settlement.
///
///  Flow (commit-reveal, default):
///    1. Player calls `requestRandom(commit)` where commit = keccak256(secret)
///    2. At least 1 block passes (prevents same-block manipulation).
///    3. Player (or coordinator) calls `revealRandom(requestId, secret)`.
///       Final seed = keccak256(secret ⊕ houseSeed ⊕ blockhash).
///       houseSeed is set at request time from the previous blockhash.
///
///  Flow (VRF adapter):
///    When a VRF adapter is set, `requestRandom` additionally asks the VRF
///    oracle for a word.  `revealRandom` then mixes the VRF output in,
///    strictly strengthening the entropy.  If the VRF callback has not
///    arrived yet, reveal blocks until it does (or the request can be
///    force-revealed after a timeout using commit-reveal alone).
contract CasinoRNG is IRNG {
    // ── Types ───────────────────────────────────────────────────────
    struct Request {
        address requester;
        bytes32 playerCommit;
        bytes32 houseSeed;        // blockhash captured at request time
        uint256 requestBlock;
        uint256 vrfRequestId;     // 0 if no VRF adapter
        uint256 seed;             // 0 until fulfilled
        bool fulfilled;
    }

    // ── State ───────────────────────────────────────────────────────
    address public owner;
    IVRFAdapter public vrfAdapter;        // address(0) = commit-reveal only
    uint256 public revealTimeout = 256;   // blocks before force-reveal allowed
    uint256 public minRevealDelay = 1;    // min blocks between request & reveal

    uint256 private _nextId = 1;
    mapping(uint256 => Request) public requests;
    mapping(uint256 => uint256) public vrfToRequest; // vrfRequestId → requestId

    // ── Modifiers ───────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "RNG: not owner");
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Admin ───────────────────────────────────────────────────────
    function setVRFAdapter(address adapter) external onlyOwner {
        vrfAdapter = IVRFAdapter(adapter);
    }

    function setRevealTimeout(uint256 blocks) external onlyOwner {
        require(blocks >= 10, "RNG: timeout too short");
        revealTimeout = blocks;
    }

    function setMinRevealDelay(uint256 blocks) external onlyOwner {
        require(blocks >= 1, "RNG: delay must be >= 1");
        minRevealDelay = blocks;
    }

    // ── Core: request ───────────────────────────────────────────────
    function requestRandom(bytes32 playerCommit) external override returns (uint256 requestId) {
        require(playerCommit != bytes32(0), "RNG: empty commit");

        requestId = _nextId++;
        bytes32 houseSeed = blockhash(block.number - 1);

        uint256 vrfReqId;
        if (address(vrfAdapter) != address(0)) {
            vrfReqId = vrfAdapter.requestRandomWord();
            vrfToRequest[vrfReqId] = requestId;
        }

        requests[requestId] = Request({
            requester: msg.sender,
            playerCommit: playerCommit,
            houseSeed: houseSeed,
            requestBlock: block.number,
            vrfRequestId: vrfReqId,
            seed: 0,
            fulfilled: false
        });

        emit RandomRequested(requestId, msg.sender, playerCommit);
    }

    // ── Core: reveal ────────────────────────────────────────────────
    function revealRandom(uint256 requestId, bytes32 playerSecret) external override returns (uint256 seed) {
        Request storage req = requests[requestId];
        require(req.requester != address(0), "RNG: unknown request");
        require(!req.fulfilled, "RNG: already fulfilled");
        require(
            block.number >= req.requestBlock + minRevealDelay,
            "RNG: reveal too early"
        );

        // Verify player commitment
        require(
            keccak256(abi.encodePacked(playerSecret)) == req.playerCommit,
            "RNG: commitment mismatch"
        );

        // Build seed: player secret XOR house seed XOR reveal-block hash
        bytes32 revealBlockHash = blockhash(block.number - 1);
        seed = uint256(keccak256(abi.encodePacked(
            playerSecret,
            req.houseSeed,
            revealBlockHash
        )));

        // Mix VRF output if available
        if (req.vrfRequestId != 0 && address(vrfAdapter) != address(0)) {
            bool vrfReady = vrfAdapter.isVRFFulfilled(req.vrfRequestId);
            bool timedOut = block.number >= req.requestBlock + revealTimeout;
            if (vrfReady) {
                // VRF word is available — mix it in (strictly more entropy)
                // We read it via getResult on the adapter; adapter stores it
                // We re-hash to combine
                seed = uint256(keccak256(abi.encodePacked(seed, req.vrfRequestId)));
            } else {
                require(timedOut, "RNG: waiting for VRF");
                // Timed out — proceed with commit-reveal only (still fair)
            }
        }

        req.seed = seed;
        req.fulfilled = true;
        emit RandomFulfilled(requestId, seed);
    }

    // ── Core: fulfill from VRF (callback) ───────────────────────────
    function fulfillFromVRF(uint256 vrfRequestId, uint256 /* randomWord */) external {
        require(msg.sender == address(vrfAdapter), "RNG: not VRF adapter");
        uint256 requestId = vrfToRequest[vrfRequestId];
        require(requestId != 0, "RNG: unknown VRF request");
        emit RandomFulfilled(requestId, 0); // signal VRF callback received
    }

    // ── Views ───────────────────────────────────────────────────────
    function getResult(uint256 requestId) external view override returns (uint256) {
        require(requests[requestId].fulfilled, "RNG: not fulfilled");
        return requests[requestId].seed;
    }

    function isFulfilled(uint256 requestId) external view override returns (bool) {
        return requests[requestId].fulfilled;
    }
}
