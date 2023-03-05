import { Bridge, Bridge__factory } from "./../typechain-types";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bridge", function () {
  let bridge1: Bridge, bridge2: Bridge;
  let deployer, userAccount1, userAccount2;

  before(async function() {
    const bridgeFactory = await ethers.getContractFactory("Bridge");
    bridge1 = await bridgeFactory.deploy();
    await bridge1.deployed();

    bridge2 = await bridgeFactory.deploy();
    await bridge2.deployed();
  });

  describe("Deposit ERC20 to Bridge 1 (Lock)", function() {
    it("Should log", async function() {
      console.log(bridge1.address);
      console.log(bridge2.address);
    });
  });

  describe("Claim WERC20 from Bridge 2 (Mint)", function() {

  });

  describe("Deposit WERC20 to Bridge 2 (Burn)", function() {

  });

  describe("Claim ERC20 from Bridge 1 (Release)", function() {

  });
})
