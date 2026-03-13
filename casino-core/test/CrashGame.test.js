const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrashGame (MVP)", function () {
  async function deployAll() {
    const [owner, player] = await ethers.getSigners();

    const RNG = await ethers.getContractFactory("CasinoRNG");
    const rng = await RNG.deploy();
    await rng.waitForDeployment();

    const Bankroll = await ethers.getContractFactory("Bankroll");
    const bankroll = await Bankroll.deploy();
    await bankroll.waitForDeployment();

    const RiskManager = await ethers.getContractFactory("RiskManager");
    const risk = await RiskManager.deploy();
    await risk.waitForDeployment();

    const Settlement = await ethers.getContractFactory("GameSettlement");
    const settlement = await Settlement.deploy(await rng.getAddress(), await bankroll.getAddress(), await risk.getAddress());
    await settlement.waitForDeployment();

    await risk.authorize(await settlement.getAddress());

    const Crash = await ethers.getContractFactory("CrashGame");
    const crash = await Crash.deploy(await settlement.getAddress());
    await crash.waitForDeployment();

    await bankroll.registerGame(await settlement.getAddress(), ethers.parseEther("1000"));
    await settlement.registerGame(await crash.getAddress());

    await bankroll.depositHouseFunds({ value: ethers.parseEther("10") });

    return { owner, player, rng, bankroll, risk, settlement, crash };
  }

  it("settles with 0 or target payout after reveal", async function () {
    const { player, settlement, crash } = await deployAll();

    const secret = ethers.keccak256(ethers.toUtf8Bytes("crash-secret-1"));
    const commit = ethers.keccak256(secret);

    const tx = await crash.connect(player).placeBet(commit, 150, { value: ethers.parseEther("1") });
    await tx.wait();

    const betId = 1n;

    await settlement.connect(player).revealBet(betId, secret);

    await crash.settle(betId);

    const bet = await settlement.getBet(betId);
    const payout = bet[5];

    expect(payout === 0n || payout === ethers.parseEther("1.5")).to.equal(true);
  });
});
