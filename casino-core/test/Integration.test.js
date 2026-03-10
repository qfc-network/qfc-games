const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");

// Helper: parse BetCommitted betId from receipt using settlement interface
function parseBetId(receipt, settlementInterface) {
  for (const log of receipt.logs) {
    try {
      const parsed = settlementInterface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === "BetCommitted") return parsed.args[0];
    } catch (_) {}
  }
  throw new Error("BetCommitted event not found");
}

describe("Integration: full bet lifecycle", function () {
  async function deployFullStack() {
    const [owner, player, other] = await ethers.getSigners();

    // Deploy core contracts
    const RNG = await ethers.getContractFactory("CasinoRNG");
    const rng = await RNG.deploy();

    const BankrollFactory = await ethers.getContractFactory("Bankroll");
    const bankroll = await BankrollFactory.deploy();

    const RiskFactory = await ethers.getContractFactory("RiskManager");
    const risk = await RiskFactory.deploy();

    const SettlementFactory = await ethers.getContractFactory("GameSettlement");
    const settlement = await SettlementFactory.deploy(
      rng.target, bankroll.target, risk.target
    );

    // Wire up permissions:
    // 1. Settlement is a registered game in Bankroll
    await bankroll.registerGame(settlement.target, ethers.parseEther("1000"));
    // 2. Settlement is authorized in RiskManager
    await risk.authorize(settlement.target);

    // House deposits 100 ETH
    await bankroll.depositHouseFunds({ value: ethers.parseEther("100") });

    // Deploy a mock game contract that can call settleBet
    const MockGame = await ethers.getContractFactory("MockGame");
    const mockGame = await MockGame.deploy(settlement.target);

    // Register mock game in settlement
    await settlement.registerGame(mockGame.target);

    return { rng, bankroll, risk, settlement, mockGame, owner, player, other };
  }

  it("commit → reveal → settle (player wins)", async function () {
    const { bankroll, settlement, mockGame, player } = await loadFixture(deployFullStack);

    const secret = ethers.encodeBytes32String("my-secret");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));
    const wager = ethers.parseEther("1");
    const maxPayout = ethers.parseEther("2");

    // Step 1: Commit
    const tx = await mockGame.connect(player).placeBet(commit, maxPayout, { value: wager });
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    expect(await bankroll.lockedFunds()).to.equal(wager);

    // Step 2: Reveal (after 1 block)
    await mine(1);
    await settlement.revealBet(betId, secret);

    // Step 3: Settle (game decides player wins 2x)
    const balBefore = await ethers.provider.getBalance(player.address);
    await mockGame.settle(betId, maxPayout);
    const balAfter = await ethers.provider.getBalance(player.address);

    expect(balAfter - balBefore).to.equal(maxPayout);
    expect(await bankroll.lockedFunds()).to.equal(0);
  });

  it("commit → reveal → settle (player loses)", async function () {
    const { bankroll, settlement, mockGame, player } = await loadFixture(deployFullStack);

    const secret = ethers.encodeBytes32String("lose-secret");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));
    const wager = ethers.parseEther("1");

    const tx = await mockGame.connect(player).placeBet(commit, ethers.parseEther("2"), { value: wager });
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);

    const houseBefore = await bankroll.houseBalance();
    await mockGame.settle(betId, 0); // player loses
    const houseAfter = await bankroll.houseBalance();

    // House gains the wager
    expect(houseAfter - houseBefore).to.equal(wager);
  });

  it("refund after timeout", async function () {
    const { settlement, mockGame, player } = await loadFixture(deployFullStack);

    const secret = ethers.encodeBytes32String("timeout-test");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));
    const wager = ethers.parseEther("1");

    const tx = await mockGame.connect(player).placeBet(commit, ethers.parseEther("2"), { value: wager });
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    // Not enough blocks yet
    await expect(
      settlement.connect(player).refundBet(betId)
    ).to.be.revertedWith("Settlement: timeout not reached");

    // Mine past timeout (1000 blocks)
    await mine(1001);

    const balBefore = await ethers.provider.getBalance(player.address);
    const refundTx = await settlement.connect(player).refundBet(betId);
    const refundReceipt = await refundTx.wait();
    const gasCost = refundReceipt.gasUsed * refundReceipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(player.address);

    expect(balAfter + gasCost - balBefore).to.equal(wager);
  });

  it("risk manager blocks oversized bets", async function () {
    const { mockGame, player } = await loadFixture(deployFullStack);

    const secret = ethers.encodeBytes32String("big-bet");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));
    const wager = ethers.parseEther("11"); // exceeds 10 ETH default max

    await expect(
      mockGame.connect(player).placeBet(commit, wager, { value: wager })
    ).to.be.revertedWith("Settlement: bet rejected by risk manager");
  });

  it("circuit breaker blocks new bets", async function () {
    const { risk, mockGame, player } = await loadFixture(deployFullStack);

    await risk.pauseAll();

    const secret = ethers.encodeBytes32String("paused");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    await expect(
      mockGame.connect(player).placeBet(commit, ethers.parseEther("2"), {
        value: ethers.parseEther("1"),
      })
    ).to.be.revertedWith("Settlement: bet rejected by risk manager");
  });

  it("simulated abuse: rapid bets from same player", async function () {
    const { settlement, mockGame, player } = await loadFixture(deployFullStack);

    // Place 5 bets rapidly
    for (let i = 0; i < 5; i++) {
      const secret = ethers.encodeBytes32String(`rapid-${i}`);
      const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));
      await mockGame.connect(player).placeBet(commit, ethers.parseEther("2"), {
        value: ethers.parseEther("1"),
      });
    }

    // All should be committed (no replay, each has unique betId)
    // Verify by revealing them all
    await mine(1);
    for (let i = 0; i < 5; i++) {
      const secret = ethers.encodeBytes32String(`rapid-${i}`);
      await settlement.revealBet(i + 1, secret);
    }
  });
});
