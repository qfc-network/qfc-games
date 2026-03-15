const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");

function parseBetId(receipt, settlementInterface) {
  for (const log of receipt.logs) {
    try {
      const parsed = settlementInterface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === "BetCommitted") return parsed.args[0];
    } catch (_) {}
  }
  throw new Error("BetCommitted event not found");
}

describe("FairnessVerifier", function () {
  async function deployVerifier() {
    const [owner, player] = await ethers.getSigners();

    const RNG = await ethers.getContractFactory("CasinoRNG");
    const rng = await RNG.deploy();

    const BankrollFactory = await ethers.getContractFactory("Bankroll");
    const bankroll = await BankrollFactory.deploy();

    const RiskFactory = await ethers.getContractFactory("RiskManager");
    const risk = await RiskFactory.deploy();

    const SettlementFactory = await ethers.getContractFactory("GameSettlement");
    const settlement = await SettlementFactory.deploy(rng.target, bankroll.target, risk.target);

    await bankroll.registerGame(settlement.target, ethers.parseEther("1000"));
    await risk.authorize(settlement.target);
    await bankroll.depositHouseFunds({ value: ethers.parseEther("100") });

    const MockGame = await ethers.getContractFactory("MockGame");
    const mockGame = await MockGame.deploy(settlement.target);
    await settlement.registerGame(mockGame.target);

    const VerifierFactory = await ethers.getContractFactory("FairnessVerifier");
    const verifier = await VerifierFactory.deploy(settlement.target);

    return { settlement, mockGame, verifier, owner, player };
  }

  it("should verify a settled bet", async function () {
    const { settlement, mockGame, verifier, player } = await loadFixture(deployVerifier);

    const secret = ethers.encodeBytes32String("verify-me");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await mockGame.connect(player).placeBet(commit, ethers.parseEther("2"), { value: ethers.parseEther("1") });
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);
    await mockGame.settle(betId, ethers.parseEther("2"));

    const result = await verifier.verify(betId);
    expect(result.settled).to.be.true;
    expect(result.verified).to.be.true;
    expect(result.player).to.equal(player.address);
    expect(result.seed).to.not.equal(0);
  });

  it("should show unsettled bet as unverified", async function () {
    const { settlement, mockGame, verifier, player } = await loadFixture(deployVerifier);

    const secret = ethers.encodeBytes32String("pending");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await mockGame.connect(player).placeBet(commit, ethers.parseEther("2"), { value: ethers.parseEther("1") });
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    const result = await verifier.verify(betId);
    expect(result.settled).to.be.false;
    expect(result.verified).to.be.false;
  });

  it("should compute crash result from seed", async function () {
    const { verifier } = await loadFixture(deployVerifier);

    const seed = 12345n;
    const crashBps = await verifier.verifyCrash(seed);
    expect(crashBps).to.equal(100n + (seed % 901n));
  });

  it("should compute dice result from seed", async function () {
    const { verifier } = await loadFixture(deployVerifier);

    const seed = 67890n;
    const roll = await verifier.verifyDice(seed);
    expect(roll).to.equal(Number(seed % 100n));
  });

  it("should compute roulette result from seed", async function () {
    const { verifier } = await loadFixture(deployVerifier);

    const seed = 99999n;
    const spin = await verifier.verifyRoulette(seed);
    expect(spin).to.equal(Number(seed % 37n));
  });

  it("should verify commit matches secret", async function () {
    const { verifier } = await loadFixture(deployVerifier);

    const secret = ethers.encodeBytes32String("my-secret");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    expect(await verifier.verifyCommit(secret, commit)).to.be.true;

    const wrongSecret = ethers.encodeBytes32String("wrong");
    expect(await verifier.verifyCommit(wrongSecret, commit)).to.be.false;
  });
});
