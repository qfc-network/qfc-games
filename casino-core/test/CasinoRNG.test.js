const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("CasinoRNG", function () {
  async function deployFixture() {
    const [owner, player, other] = await ethers.getSigners();
    const RNG = await ethers.getContractFactory("CasinoRNG");
    const rng = await RNG.deploy();
    return { rng, owner, player, other };
  }

  const SECRET = ethers.encodeBytes32String("player-secret-42");
  const COMMIT = ethers.keccak256(ethers.solidityPacked(["bytes32"], [SECRET]));

  describe("requestRandom", function () {
    it("creates a request and emits event", async function () {
      const { rng, player } = await loadFixture(deployFixture);
      await expect(rng.connect(player).requestRandom(COMMIT))
        .to.emit(rng, "RandomRequested")
        .withArgs(1, player.address, COMMIT);
    });

    it("rejects empty commit", async function () {
      const { rng, player } = await loadFixture(deployFixture);
      await expect(
        rng.connect(player).requestRandom(ethers.ZeroHash)
      ).to.be.revertedWith("RNG: empty commit");
    });

    it("increments request IDs", async function () {
      const { rng, player } = await loadFixture(deployFixture);
      const commit2 = ethers.keccak256(ethers.toUtf8Bytes("other"));
      await rng.connect(player).requestRandom(COMMIT);
      await expect(rng.connect(player).requestRandom(commit2))
        .to.emit(rng, "RandomRequested")
        .withArgs(2, player.address, commit2);
    });
  });

  describe("revealRandom", function () {
    it("reveals with correct secret after delay", async function () {
      const { rng, player } = await loadFixture(deployFixture);
      await rng.connect(player).requestRandom(COMMIT);
      await mine(1); // satisfy minRevealDelay

      const tx = await rng.connect(player).revealRandom(1, SECRET);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "RandomFulfilled"
      );
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(1); // requestId

      // Seed should be non-zero
      const seed = await rng.getResult(1);
      expect(seed).to.not.equal(0);
    });

    it("rejects wrong secret", async function () {
      const { rng, player } = await loadFixture(deployFixture);
      await rng.connect(player).requestRandom(COMMIT);
      await mine(1);

      const wrongSecret = ethers.encodeBytes32String("wrong");
      await expect(
        rng.connect(player).revealRandom(1, wrongSecret)
      ).to.be.revertedWith("RNG: commitment mismatch");
    });

    it("rejects reveal in same block (too early)", async function () {
      const { rng, player } = await loadFixture(deployFixture);
      // We can't actually do same-block in Hardhat easily, but
      // we can test by setting minRevealDelay higher
      await rng.setMinRevealDelay(5);
      await rng.connect(player).requestRandom(COMMIT);
      // Only mine 2 blocks (need 5)
      await mine(2);
      await expect(
        rng.connect(player).revealRandom(1, SECRET)
      ).to.be.revertedWith("RNG: reveal too early");
    });

    it("rejects double reveal", async function () {
      const { rng, player } = await loadFixture(deployFixture);
      await rng.connect(player).requestRandom(COMMIT);
      await mine(1);
      await rng.connect(player).revealRandom(1, SECRET);

      await expect(
        rng.connect(player).revealRandom(1, SECRET)
      ).to.be.revertedWith("RNG: already fulfilled");
    });

    it("different secrets produce different seeds", async function () {
      const { rng, player, other } = await loadFixture(deployFixture);

      const secret1 = ethers.encodeBytes32String("alpha");
      const commit1 = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret1]));
      const secret2 = ethers.encodeBytes32String("beta");
      const commit2 = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret2]));

      await rng.connect(player).requestRandom(commit1);
      await rng.connect(other).requestRandom(commit2);
      await mine(1);

      await rng.connect(player).revealRandom(1, secret1);
      await rng.connect(other).revealRandom(2, secret2);

      const seed1 = await rng.getResult(1);
      const seed2 = await rng.getResult(2);
      expect(seed1).to.not.equal(seed2);
    });
  });

  describe("isFulfilled / getResult", function () {
    it("isFulfilled returns false before reveal", async function () {
      const { rng, player } = await loadFixture(deployFixture);
      await rng.connect(player).requestRandom(COMMIT);
      expect(await rng.isFulfilled(1)).to.be.false;
    });

    it("getResult reverts before reveal", async function () {
      const { rng, player } = await loadFixture(deployFixture);
      await rng.connect(player).requestRandom(COMMIT);
      await expect(rng.getResult(1)).to.be.revertedWith("RNG: not fulfilled");
    });
  });

  describe("admin", function () {
    it("only owner can set parameters", async function () {
      const { rng, other } = await loadFixture(deployFixture);
      await expect(
        rng.connect(other).setRevealTimeout(50)
      ).to.be.revertedWith("RNG: not owner");
    });

    it("rejects timeout below 10", async function () {
      const { rng } = await loadFixture(deployFixture);
      await expect(rng.setRevealTimeout(5)).to.be.revertedWith("RNG: timeout too short");
    });
  });
});
