const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("RiskManager", function () {
  async function deployFixture() {
    const [owner, settlement, game, player, other] = await ethers.getSigners();
    const Risk = await ethers.getContractFactory("RiskManager");
    const risk = await Risk.deploy();

    // Authorize the settlement contract
    await risk.authorize(settlement.address);

    return { risk, owner, settlement, game, player, other };
  }

  describe("bet validation", function () {
    it("accepts valid bet within default limits", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1");
      const maxPayout = ethers.parseEther("5"); // 5x, within 10x default cap

      // validateBet returns bool — call it from authorized
      const result = await risk.connect(settlement).validateBet.staticCall(
        player.address, game.address, amount, maxPayout
      );
      expect(result).to.be.true;
    });

    it("rejects bet below minimum", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("0.0001"); // below 0.001 default min
      await expect(
        risk.connect(settlement).validateBet(player.address, game.address, amount, amount)
      ).to.emit(risk, "BetRejected");
    });

    it("rejects bet above maximum", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("11"); // above 10 default max
      await expect(
        risk.connect(settlement).validateBet(player.address, game.address, amount, amount)
      ).to.emit(risk, "BetRejected");
    });

    it("rejects payout exceeding multiplier cap", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1");
      const payout = ethers.parseEther("11"); // 11x, exceeds 10x cap
      await expect(
        risk.connect(settlement).validateBet(player.address, game.address, amount, payout)
      ).to.emit(risk, "BetRejected");
    });

    it("rejects unauthorized caller", async function () {
      const { risk, other, game, player } = await loadFixture(deployFixture);
      await expect(
        risk.connect(other).validateBet(
          player.address, game.address, ethers.parseEther("1"), ethers.parseEther("1")
        )
      ).to.be.revertedWith("Risk: not authorized");
    });
  });

  describe("circuit breaker", function () {
    it("pauses a specific game", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      await risk.pauseGame(game.address);
      expect(await risk.isGamePaused(game.address)).to.be.true;

      // Bet should be rejected
      const result = await risk.connect(settlement).validateBet.staticCall(
        player.address, game.address, ethers.parseEther("1"), ethers.parseEther("1")
      );
      expect(result).to.be.false;
    });

    it("global pause stops all games", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      await risk.pauseAll();
      expect(await risk.isGloballyPaused()).to.be.true;

      const result = await risk.connect(settlement).validateBet.staticCall(
        player.address, game.address, ethers.parseEther("1"), ethers.parseEther("1")
      );
      expect(result).to.be.false;
    });

    it("unpausing restores operation", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      await risk.pauseAll();
      await risk.unpauseAll();
      const result = await risk.connect(settlement).validateBet.staticCall(
        player.address, game.address, ethers.parseEther("1"), ethers.parseEther("1")
      );
      expect(result).to.be.true;
    });

    it("only owner can trigger circuit breaker", async function () {
      const { risk, other, game } = await loadFixture(deployFixture);
      await expect(
        risk.connect(other).pauseGame(game.address)
      ).to.be.revertedWith("Risk: not owner");
      await expect(
        risk.connect(other).pauseAll()
      ).to.be.revertedWith("Risk: not owner");
    });
  });

  describe("game-specific limits", function () {
    it("enforces custom per-game limits", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      // Set tight limits: min=0.5, max=2, payout=20000 (2x), dailyCap=10
      await risk.setGameLimits(
        game.address,
        ethers.parseEther("0.5"),
        ethers.parseEther("2"),
        20000, // 2x in basis points
        ethers.parseEther("10")
      );

      // Below min
      const r1 = await risk.connect(settlement).validateBet.staticCall(
        player.address, game.address, ethers.parseEther("0.1"), ethers.parseEther("0.1")
      );
      expect(r1).to.be.false;

      // Above max
      const r2 = await risk.connect(settlement).validateBet.staticCall(
        player.address, game.address, ethers.parseEther("3"), ethers.parseEther("3")
      );
      expect(r2).to.be.false;

      // Valid
      const r3 = await risk.connect(settlement).validateBet.staticCall(
        player.address, game.address, ethers.parseEther("1"), ethers.parseEther("2")
      );
      expect(r3).to.be.true;
    });

    it("enforces daily volume cap", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      await risk.setGameLimits(
        game.address,
        ethers.parseEther("0.001"),
        ethers.parseEther("5"),
        100000,
        ethers.parseEther("6") // daily cap 6 ETH
      );

      // First bet: 5 ETH (ok)
      await risk.connect(settlement).validateBet(
        player.address, game.address, ethers.parseEther("5"), ethers.parseEther("5")
      );

      // Second bet: 2 ETH (exceeds 6 cap)
      const result = await risk.connect(settlement).validateBet.staticCall(
        player.address, game.address, ethers.parseEther("2"), ethers.parseEther("2")
      );
      expect(result).to.be.false;
    });
  });

  describe("settlement accounting", function () {
    it("tracks daily losses", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      // Player lost 3 ETH (wagered 5, got 2)
      await risk.connect(settlement).recordSettlement(
        player.address, game.address, ethers.parseEther("5"), ethers.parseEther("2")
      );
      const loss = await risk.playerDailyLossToday(player.address);
      expect(loss).to.equal(ethers.parseEther("3"));
    });

    it("does not track wins as losses", async function () {
      const { risk, settlement, game, player } = await loadFixture(deployFixture);
      await risk.connect(settlement).recordSettlement(
        player.address, game.address, ethers.parseEther("1"), ethers.parseEther("5")
      );
      const loss = await risk.playerDailyLossToday(player.address);
      expect(loss).to.equal(0);
    });
  });
});
