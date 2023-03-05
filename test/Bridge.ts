import { Bridge, Bridge__factory, WrappedERC20Factory, WrappedERC20Factory__factory } from "./../typechain-types";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bridge", function () {
  let bridge1: Bridge, bridge2: Bridge;
  let deployer, userAccount1, userAccount2;

  before(async function() {
    const bridgeFactory: Bridge__factory = await ethers.getContractFactory("Bridge");
    bridge1 = await bridgeFactory.deploy();
    await bridge1.deployed();

    bridge2 = await bridgeFactory.deploy();
    await bridge2.deployed();

    const wrappedTokenFactoryFactory: WrappedERC20Factory__factory = await ethers.getContractFactory("WrappedERC20Factory");
    const wrappedTokenFactory1: WrappedERC20Factory = await wrappedTokenFactoryFactory.deploy(bridge1.address);
    await wrappedTokenFactory1.deployed();

    const wrappedTokenFactory2: WrappedERC20Factory = await wrappedTokenFactoryFactory.deploy(bridge2.address);
    await wrappedTokenFactory2.deployed();
  });

  describe("Contract pausing", function() {

    it("Contract should be paused after deployment", async function() {
      const bridge1IsPaused = await bridge1.paused();
      const bridge2IsPaused = await bridge2.paused();

      expect(bridge1IsPaused).to.be.equal(true, "Bridge1 is not paused");
      expect(bridge2IsPaused).to.be.equal(true, "Bridge2 is not paused");
    });

    // it("Should revert on deposit call while paused", async function() {
    //   await expect(bridge1.deposit()).to.be.revertedWith("Pausable: paused");
    //   await expect(bridge2.deposit()).to.be.revertedWith("Pausable: paused");
    // });

    // it("Should revert on claim call while paused", async function() {

    // });

    it("Contract should unpause", async function() {
      const bridge1Tx = await bridge1.unpause();
      await bridge1Tx.wait();

      const bridge2Tx = await bridge2.unpause();
      await bridge2Tx.wait();

      const bridge1IsPaused = await bridge1.paused();
      const bridge2IsPaused = await bridge2.paused();

      expect(bridge1IsPaused).to.be.equal(false, "Bridge1 is paused");
      expect(bridge2IsPaused).to.be.equal(false, "Bridge2 is paused");
    });
  });

  describe("Deposit ERC20 to Bridge 1 (Lock)", function() {

  });

  describe("Claim WERC20 from Bridge 2 (Mint)", function() {

  });

  describe("Deposit WERC20 to Bridge 2 (Burn)", function() {

  });

  describe("Claim ERC20 from Bridge 1 (Release)", function() {

  });
})
