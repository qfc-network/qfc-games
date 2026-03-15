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

describe("RouletteGame", function () {
  async function deployRoulette() {
    const [owner, player] = await ethers.getSigners();

    const RNG = await ethers.getContractFactory("CasinoRNG");
    const rng = await RNG.deploy();

    const BankrollFactory = await ethers.getContractFactory("Bankroll");
    const bankroll = await BankrollFactory.deploy();

    const RiskFactory = await ethers.getContractFactory("RiskManager");
    const risk = await RiskFactory.deploy();

    const SettlementFactory = await ethers.getContractFactory("GameSettlement");
    const settlement = await SettlementFactory.deploy(rng.target, bankroll.target, risk.target);

    await bankroll.registerGame(settlement.target, ethers.parseEther("10000"));
    await risk.authorize(settlement.target);
    // Increase max payout multiplier to 40x (400000 bps) for straight bets (36:1)
    await risk.setDefaultLimits(ethers.parseEther("0.001"), ethers.parseEther("10"), 400_000);
    await bankroll.depositHouseFunds({ value: ethers.parseEther("1000") });

    const RouletteFactory = await ethers.getContractFactory("RouletteGame");
    const roulette = await RouletteFactory.deploy(settlement.target);
    await settlement.registerGame(roulette.target);

    return { settlement, roulette, owner, player };
  }

  it("should place and settle a straight bet", async function () {
    const { settlement, roulette, player } = await loadFixture(deployRoulette);

    const secret = ethers.encodeBytes32String("straight-17");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await roulette.connect(player).placeBet(commit, 0, 17, { value: ethers.parseEther("1") }); // BetType.Straight = 0
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);
    await roulette.settle(betId);

    const bet = await roulette.rouletteBets(betId);
    expect(bet.settled).to.be.true;
  });

  it("should place and settle a red bet", async function () {
    const { settlement, roulette, player } = await loadFixture(deployRoulette);

    const secret = ethers.encodeBytes32String("red-bet");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await roulette.connect(player).placeBet(commit, 1, 0, { value: ethers.parseEther("1") }); // BetType.Red = 1
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);
    await roulette.settle(betId);

    const bet = await roulette.rouletteBets(betId);
    expect(bet.settled).to.be.true;
  });

  it("should place and settle odd/even bets", async function () {
    const { settlement, roulette, player } = await loadFixture(deployRoulette);

    const secret = ethers.encodeBytes32String("odd-bet");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await roulette.connect(player).placeBet(commit, 3, 0, { value: ethers.parseEther("1") }); // BetType.Odd = 3
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);
    await roulette.settle(betId);

    const bet = await roulette.rouletteBets(betId);
    expect(bet.settled).to.be.true;
  });

  it("should place and settle dozen bet", async function () {
    const { settlement, roulette, player } = await loadFixture(deployRoulette);

    const secret = ethers.encodeBytes32String("dozen2");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await roulette.connect(player).placeBet(commit, 8, 0, { value: ethers.parseEther("1") }); // BetType.Dozen2 = 8
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);
    await roulette.settle(betId);

    const bet = await roulette.rouletteBets(betId);
    expect(bet.settled).to.be.true;
  });

  it("should reject invalid straight number", async function () {
    const { roulette, player } = await loadFixture(deployRoulette);

    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [ethers.encodeBytes32String("x")]));

    await expect(
      roulette.connect(player).placeBet(commit, 0, 37, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("Roulette: invalid number");
  });

  it("should reject double settle", async function () {
    const { settlement, roulette, player } = await loadFixture(deployRoulette);

    const secret = ethers.encodeBytes32String("no-double");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await roulette.connect(player).placeBet(commit, 1, 0, { value: ethers.parseEther("1") });
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);
    await roulette.settle(betId);

    await expect(roulette.settle(betId)).to.be.revertedWith("Roulette: already settled");
  });

  it("should emit correct events", async function () {
    const { settlement, roulette, player } = await loadFixture(deployRoulette);

    const secret = ethers.encodeBytes32String("events-r");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await roulette.connect(player).placeBet(commit, 5, 0, { value: ethers.parseEther("1") }); // High
    await expect(tx).to.emit(roulette, "RouletteBetPlaced");

    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);

    await expect(roulette.settle(betId)).to.emit(roulette, "RouletteBetResolved");
  });
});
