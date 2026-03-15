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

describe("DiceGame", function () {
  async function deployDice() {
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

    const DiceFactory = await ethers.getContractFactory("DiceGame");
    const dice = await DiceFactory.deploy(settlement.target);
    await settlement.registerGame(dice.target);

    return { settlement, dice, owner, player };
  }

  it("should place and settle a roll-over bet", async function () {
    const { settlement, dice, player } = await loadFixture(deployDice);

    const secret = ethers.encodeBytes32String("dice-over");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));
    const wager = ethers.parseEther("1");

    const tx = await dice.connect(player).placeBet(commit, 50, true, { value: wager });
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);
    await dice.settle(betId);

    const bet = await dice.diceBets(betId);
    expect(bet.settled).to.be.true;
  });

  it("should place and settle a roll-under bet", async function () {
    const { settlement, dice, player } = await loadFixture(deployDice);

    const secret = ethers.encodeBytes32String("dice-under");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await dice.connect(player).placeBet(commit, 50, false, { value: ethers.parseEther("1") });
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);
    await dice.settle(betId);

    const bet = await dice.diceBets(betId);
    expect(bet.settled).to.be.true;
  });

  it("should reject target out of range", async function () {
    const { dice, player } = await loadFixture(deployDice);

    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [ethers.encodeBytes32String("x")]));

    await expect(
      dice.connect(player).placeBet(commit, 0, true, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("Dice: target out of range");

    await expect(
      dice.connect(player).placeBet(commit, 99, true, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("Dice: target out of range");
  });

  it("should reject double settle", async function () {
    const { settlement, dice, player } = await loadFixture(deployDice);

    const secret = ethers.encodeBytes32String("double");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await dice.connect(player).placeBet(commit, 50, true, { value: ethers.parseEther("1") });
    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);
    await dice.settle(betId);

    await expect(dice.settle(betId)).to.be.revertedWith("Dice: already settled");
  });

  it("should emit correct events", async function () {
    const { settlement, dice, player } = await loadFixture(deployDice);

    const secret = ethers.encodeBytes32String("events");
    const commit = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));

    const tx = await dice.connect(player).placeBet(commit, 50, true, { value: ethers.parseEther("1") });
    await expect(tx).to.emit(dice, "DiceBetPlaced");

    const receipt = await tx.wait();
    const betId = parseBetId(receipt, settlement.interface);

    await mine(1);
    await settlement.revealBet(betId, secret);

    await expect(dice.settle(betId)).to.emit(dice, "DiceBetResolved");
  });
});
