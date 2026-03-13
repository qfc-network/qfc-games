const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Bankroll", function () {
  async function deployFixture() {
    const [owner, game, player, other] = await ethers.getSigners();
    const Bankroll = await ethers.getContractFactory("Bankroll");
    const bankroll = await Bankroll.deploy();

    // Register game with 100 ETH max exposure
    await bankroll.registerGame(game.address, ethers.parseEther("100"));

    return { bankroll, owner, game, player, other };
  }

  describe("house deposits / withdrawals", function () {
    it("accepts house deposits", async function () {
      const { bankroll, owner } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("10");
      await expect(bankroll.depositHouseFunds({ value: amount }))
        .to.emit(bankroll, "HouseDeposit")
        .withArgs(owner.address, amount, amount);
      expect(await bankroll.houseBalance()).to.equal(amount);
    });

    it("allows owner to withdraw", async function () {
      const { bankroll, owner } = await loadFixture(deployFixture);
      await bankroll.depositHouseFunds({ value: ethers.parseEther("10") });
      await expect(bankroll.withdrawHouseFunds(ethers.parseEther("5")))
        .to.emit(bankroll, "HouseWithdrawal")
        .withArgs(owner.address, ethers.parseEther("5"), ethers.parseEther("5"));
    });

    it("rejects non-owner withdrawal", async function () {
      const { bankroll, other } = await loadFixture(deployFixture);
      await bankroll.depositHouseFunds({ value: ethers.parseEther("10") });
      await expect(
        bankroll.connect(other).withdrawHouseFunds(ethers.parseEther("1"))
      ).to.be.revertedWith("Bankroll: not owner");
    });

    it("rejects over-withdrawal", async function () {
      const { bankroll } = await loadFixture(deployFixture);
      await bankroll.depositHouseFunds({ value: ethers.parseEther("1") });
      await expect(
        bankroll.withdrawHouseFunds(ethers.parseEther("2"))
      ).to.be.revertedWith("Bankroll: insufficient house balance");
    });

    it("rejects zero deposit", async function () {
      const { bankroll } = await loadFixture(deployFixture);
      await expect(
        bankroll.depositHouseFunds({ value: 0 })
      ).to.be.revertedWith("Bankroll: zero deposit");
    });

    it("rejects bare ether sends", async function () {
      const { bankroll, owner } = await loadFixture(deployFixture);
      await expect(
        owner.sendTransaction({ to: bankroll.target, value: ethers.parseEther("1") })
      ).to.be.revertedWith("Bankroll: use depositHouseFunds()");
    });
  });

  describe("wager lifecycle", function () {
    it("locks wager from registered game", async function () {
      const { bankroll, game, player } = await loadFixture(deployFixture);
      const wager = ethers.parseEther("1");
      await expect(
        bankroll.connect(game).lockWager(player.address, wager, { value: wager })
      )
        .to.emit(bankroll, "WagerLocked")
        .withArgs(player.address, game.address, wager);
      expect(await bankroll.lockedFunds()).to.equal(wager);
    });

    it("rejects wager from unregistered caller", async function () {
      const { bankroll, other, player } = await loadFixture(deployFixture);
      await expect(
        bankroll.connect(other).lockWager(player.address, ethers.parseEther("1"), {
          value: ethers.parseEther("1"),
        })
      ).to.be.revertedWith("Bankroll: not registered game");
    });

    it("rejects wager exceeding exposure limit", async function () {
      const { bankroll, game, player } = await loadFixture(deployFixture);
      const tooMuch = ethers.parseEther("101");
      await expect(
        bankroll.connect(game).lockWager(player.address, tooMuch, { value: tooMuch })
      ).to.be.revertedWith("Bankroll: exposure limit reached");
    });

    it("settles a win (player gets payout)", async function () {
      const { bankroll, game, player } = await loadFixture(deployFixture);
      // House deposits 10 ETH
      await bankroll.depositHouseFunds({ value: ethers.parseEther("10") });
      // Lock 1 ETH wager
      const wager = ethers.parseEther("1");
      await bankroll.connect(game).lockWager(player.address, wager, { value: wager });

      const payout = ethers.parseEther("2"); // 2x win
      const balBefore = await ethers.provider.getBalance(player.address);
      await expect(bankroll.connect(game).settleWin(player.address, payout))
        .to.emit(bankroll, "WinSettled")
        .withArgs(player.address, game.address, payout);

      const balAfter = await ethers.provider.getBalance(player.address);
      expect(balAfter - balBefore).to.equal(payout);

      // House lost 1 ETH (paid 2, got 1 from wager)
      expect(await bankroll.houseBalance()).to.equal(ethers.parseEther("9"));
    });

    it("settles a loss (wager moves to house)", async function () {
      const { bankroll, game, player } = await loadFixture(deployFixture);
      await bankroll.depositHouseFunds({ value: ethers.parseEther("10") });
      const wager = ethers.parseEther("1");
      await bankroll.connect(game).lockWager(player.address, wager, { value: wager });

      await expect(bankroll.connect(game).settleLoss(player.address, wager))
        .to.emit(bankroll, "LossSettled")
        .withArgs(player.address, game.address, wager);

      expect(await bankroll.houseBalance()).to.equal(ethers.parseEther("11"));
      expect(await bankroll.lockedFunds()).to.equal(0);
    });

    it("refunds a wager", async function () {
      const { bankroll, game, player } = await loadFixture(deployFixture);
      const wager = ethers.parseEther("1");
      await bankroll.connect(game).lockWager(player.address, wager, { value: wager });

      const balBefore = await ethers.provider.getBalance(player.address);
      await bankroll.connect(game).refundWager(player.address, wager);
      const balAfter = await ethers.provider.getBalance(player.address);
      expect(balAfter - balBefore).to.equal(wager);
      expect(await bankroll.lockedFunds()).to.equal(0);
    });
  });

  describe("accounting invariant", function () {
    it("balance == houseBalance + lockedFunds after operations", async function () {
      const { bankroll, game, player } = await loadFixture(deployFixture);
      await bankroll.depositHouseFunds({ value: ethers.parseEther("10") });
      const wager = ethers.parseEther("2");
      await bankroll.connect(game).lockWager(player.address, wager, { value: wager });

      expect(await bankroll.accountingValid()).to.be.true;

      // Settle loss
      await bankroll.connect(game).settleLoss(player.address, wager);
      expect(await bankroll.accountingValid()).to.be.true;
    });
  });

  describe("game registration", function () {
    it("owner can unregister a game with no in-flight wagers", async function () {
      const { bankroll, game } = await loadFixture(deployFixture);
      await bankroll.unregisterGame(game.address);
      await expect(
        bankroll.connect(game).lockWager(game.address, 1, { value: 1 })
      ).to.be.revertedWith("Bankroll: not registered game");
    });

    it("cannot unregister game with in-flight wagers", async function () {
      const { bankroll, game, player } = await loadFixture(deployFixture);
      await bankroll.connect(game).lockWager(player.address, ethers.parseEther("1"), {
        value: ethers.parseEther("1"),
      });
      await expect(bankroll.unregisterGame(game.address)).to.be.revertedWith(
        "Bankroll: game has in-flight wagers"
      );
    });
  });
});
