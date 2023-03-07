import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract, ContractInterface } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

import { Bridge, Bridge__factory, WrappedERC20Factory, WrappedERC20Factory__factory, PermitERC20, PermitERC20__factory } from "./../typechain-types";
import { IBridge } from "./../typechain-types/contracts/IBridge";
import { getContractAbi, permit, signClaimData } from "../utils";

describe("Bridge", function () {
  let bridge1: Bridge, bridge2: Bridge;
  let dogeCoin: PermitERC20, randomCoin: PermitERC20;
  let deployer: SignerWithAddress, userAccount1: SignerWithAddress, userAccount2: SignerWithAddress, coinDeployer: SignerWithAddress;
  let wrappedTokenAbi: ContractInterface, permitTokenAbi: ContractInterface;
  let wrappedDogeCoinToken: Contract;
  let depositData: IBridge.DepositDataStruct;

  before(async function() {
    // Bridges
    const bridgeFactory: Bridge__factory = await ethers.getContractFactory("Bridge");

    bridge1 = await bridgeFactory.deploy("Bridge1");
    await bridge1.deployed();

    bridge2 = await bridgeFactory.deploy("Bridge2");
    await bridge2.deployed();

    // Wrapped Token factories
    const wrappedTokenFactoryFactory: WrappedERC20Factory__factory = await ethers.getContractFactory("WrappedERC20Factory");

    const wrappedTokenFactory1: WrappedERC20Factory = await wrappedTokenFactoryFactory.deploy(bridge1.address);
    const wrappedFactoryDeployTx1 = await wrappedTokenFactory1.deployed();

    await bridge1.setWrapperTokenFactory(wrappedFactoryDeployTx1.address);

    const wrappedTokenFactory2: WrappedERC20Factory = await wrappedTokenFactoryFactory.deploy(bridge2.address);
    const wrappedFactoryDeployTx2 = await wrappedTokenFactory2.deployed();

    await bridge2.setWrapperTokenFactory(wrappedFactoryDeployTx2.address);

    // Accounts
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    userAccount1 = accounts[1];
    userAccount2 = accounts[2];
    coinDeployer = accounts[3];

    // Contract ABIs
    wrappedTokenAbi = getContractAbi("./../artifacts/contracts/WrappedERC20.sol/WrappedERC20.json");
    permitTokenAbi = getContractAbi("./../artifacts/contracts/PermitERC20.sol/PermitERC20.json");

    // Original ERC20 coins that implement EIP-2612
    const permitTokenFactory: PermitERC20__factory = await ethers.getContractFactory("PermitERC20");

    dogeCoin = await permitTokenFactory.connect(coinDeployer).deploy("DogeCoin", "DC");
    await dogeCoin.deployed();

    randomCoin = await permitTokenFactory.connect(coinDeployer).deploy("RandomCoin", "RC");
    await randomCoin.deployed();

    const dogeCoinTx = await dogeCoin.mint(userAccount1.address, 100);
    await dogeCoinTx.wait();

    const randomCoinTx = await randomCoin.mint(userAccount1.address, 100);
    await randomCoinTx.wait();

    expect((await dogeCoin.balanceOf(userAccount1.address)).toString()).to.be.equal("100", "UserAccount1 has incorrect balance of DogeCoin tokens");
    expect((await randomCoin.balanceOf(userAccount1.address)).toString()).to.be.equal("100", "UserAccount1 has incorrect balance of RandomCoin tokens");
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
    it("Funds are deposited to the bridge", async function() {
      expect(await dogeCoin.balanceOf(userAccount1.address)).to.be.equal(100, "Initial token balance of userAccount1 is incorect");
      expect(await dogeCoin.balanceOf(bridge1.address)).to.be.equal(0, "Initial token balance of bridge1 is incorect");
      const deadline = (await time.latest()) + 60 * 60;
      const value = 40;
      const approveSignature = await permit(dogeCoin, userAccount1, userAccount1.address, bridge1.address, value, deadline);

      depositData = {
        from: {
          _address: userAccount1.address,
          chainId: ethers.BigNumber.from(hre.network.config.chainId)
        },
        to: {
          _address: userAccount1.address,
          chainId: ethers.BigNumber.from(hre.network.config.chainId)
        },
        spender: bridge1.address,
        token: dogeCoin.address,
        value: value,
        deadline: deadline,
        approveTokenTransferSig: {
          v: approveSignature.v,
          r: approveSignature.r,
          s: approveSignature.s
        }
      };

      const depositTx = await bridge1.deposit(depositData);
      await depositTx.wait();

      expect(await dogeCoin.balanceOf(userAccount1.address)).to.be.equal(100 - value, "Token balance of userAccount1 is incorect");
      expect(await dogeCoin.balanceOf(bridge1.address)).to.be.equal(value, "Token balance of bridge1 is incorect");
    });

    it("Signature should expire after 1h", async function() {
      const deadline = (await time.latest()) + 60 * 60;
      const approveSignature = await permit(dogeCoin, userAccount1, userAccount1.address, bridge1.address, 20, deadline);

      depositData = {
        ...depositData,
        deadline: deadline,
        approveTokenTransferSig: {
          v: approveSignature.v,
          r: approveSignature.r,
          s: approveSignature.s
        }
      }

      await time.increase(3601);

      await expect(bridge1.deposit(depositData)).to.be.revertedWith("ERC20WithPermit: EXPIRED_SIGNATURE");
    });
  });

  describe("Claim WERC20 from Bridge 2 (Mint)", function() {
    let firstClaimData: IBridge.ClaimDataStruct, firstClaimSignatureSplit: IBridge.SignatureStruct;
    let firstWrappedDogeCoinTokenAddress: string;

    it("Deploy WrappedToken and mint tokens to the recepient", async function() {
      firstClaimData = {
        from: {
          _address: userAccount1.address,
          chainId: ethers.BigNumber.from(hre.network.config.chainId)
        },
        to: {
          _address: userAccount1.address,
          chainId: ethers.BigNumber.from(hre.network.config.chainId)
        },
        value: 20,
        originalToken: dogeCoin.address,
        targetTokenAddress: '0x0000000000000000000000000000000000000000',
        originalTokenName: await dogeCoin.name(),
        originalTokenSymbol: await dogeCoin.symbol(),
        deadline: ethers.constants.MaxUint256,
        approveTokenTransferSig: {
          v: 0,
          r: ethers.constants.HashZero,
          s: ethers.constants.HashZero
        }
      };

      const claimSignature = await signClaimData(bridge2, deployer, firstClaimData);

      firstClaimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }

      const claimTx = await bridge2.claim(firstClaimData, firstClaimSignatureSplit);
      await claimTx.wait();


      firstWrappedDogeCoinTokenAddress = await bridge2.wrappedTokenByOriginalTokenByChainId(
        ethers.BigNumber.from(hre.network.config.chainId),
        dogeCoin.address
      );
      wrappedDogeCoinToken = new ethers.Contract(
        firstWrappedDogeCoinTokenAddress,
        wrappedTokenAbi,
        deployer
      );

      expect(
        (await wrappedDogeCoinToken.balanceOf(userAccount1.address)).toString()
      ).to.be.equal("20", "Wrapped token balance of userAccount1 is incorrect");
    });

    it("Should revert when trying to use the signature twice", async function() {
      await expect(
        bridge2.claim(firstClaimData, firstClaimSignatureSplit)
      ).to.be.revertedWithCustomError(bridge2, "RecoveredAddressIsNotTheOwner");
    });

    it("Should not deploy new WrappedToken and mint from the old one", async function() {
      const claimSignature = await signClaimData(bridge2, deployer, firstClaimData);
      const claimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }
      const claimTx = await bridge2.claim(firstClaimData, claimSignatureSplit);
      await claimTx.wait();

      const wrappedDogeCoinTokenAddress = await bridge2.wrappedTokenByOriginalTokenByChainId(ethers.BigNumber.from(hre.network.config.chainId), dogeCoin.address);
      const wrappedToken = new ethers.Contract(wrappedDogeCoinTokenAddress, getContractAbi("./../artifacts/contracts/WrappedERC20.sol/WrappedERC20.json"), deployer);

      expect(firstWrappedDogeCoinTokenAddress).to.be.equal(wrappedDogeCoinTokenAddress, "Bridge deployed Wrapped token contract instead of using the existing one");
      expect(
        (await wrappedToken.balanceOf(userAccount1.address)).toString()
      ).to.be.equal("40", "Wrapped token balance of userAccount1 is incorrect");
    });
  });

  describe("Deposit WERC20 to Bridge 2 (Burn)", function() {
    it("Burn the deployed token instead of holding them", async function() {
      expect(await wrappedDogeCoinToken.balanceOf(userAccount1.address)).to.be.equal(40, "Initial WrappedDogeCoin token balance of userAccount1 is incorect");

      const deadline = (await time.latest()) + 60 * 60;
      const approveSignature = await permit(wrappedDogeCoinToken, userAccount1, userAccount1.address, bridge2.address, 40, deadline);

      depositData = {
        from: {
          _address: userAccount1.address,
          chainId: ethers.BigNumber.from(hre.network.config.chainId)
        },
        to: {
          _address: userAccount1.address,
          chainId: ethers.BigNumber.from(hre.network.config.chainId)
        },
        spender: bridge2.address,
        token: wrappedDogeCoinToken.address,
        value: 40,
        deadline: deadline,
        approveTokenTransferSig: {
          v: approveSignature.v,
          r: approveSignature.r,
          s: approveSignature.s
        }
      };

      const initialTotalSupply: BigNumber = await wrappedDogeCoinToken.totalSupply();

      const depositTx = await bridge2.deposit(depositData);
      await depositTx.wait();

      const totalSupplyAfterTx: BigNumber = await wrappedDogeCoinToken.totalSupply();

      expect(
        await wrappedDogeCoinToken.balanceOf(bridge2.address)
      ).to.be.equal(0, "The bridge have locked Wrapped tokens instead of burning them");
      expect(
        await wrappedDogeCoinToken.balanceOf(userAccount1.address)
      ).to.be.equal(0, "The bridge have locked Wrapped tokens instead of burning them");
      expect(totalSupplyAfterTx).to.be.equal(initialTotalSupply.sub(40), "WrappedDogeCoin totalSupply is incorrect");
    });
  });

  describe("Claim ERC20 from Bridge 1 (Release)", function() {
    it("Release original ERC20 token", async function() {
      const deadline = ethers.constants.MaxUint256.toString();
      const targetTokenAddress = (await bridge2.originalTokenByWrappedToken(depositData.token)).tokenAddress; // Should be the original, initially deployed ERC20 token (DogeCoin)

      const claimData: IBridge.ClaimDataStruct = {
        from: {
          _address: userAccount1.address,
          chainId: ethers.BigNumber.from(hre.network.config.chainId)
        },
        to: {
          _address: userAccount1.address,
          chainId: ethers.BigNumber.from(hre.network.config.chainId)
        },
        value: 40,
        originalToken: depositData.token,
        targetTokenAddress: targetTokenAddress,
        originalTokenName: "",
        originalTokenSymbol: "",
        deadline: deadline
      };

      const claimSignature = await signClaimData(bridge1, deployer, claimData);

      expect(dogeCoin.address).to.be.equal(
        targetTokenAddress,
        "Bridge2 suggests incorrect original token for the WrappedDogeCoin"
      );
      expect(
        (await dogeCoin.balanceOf(bridge1.address)).toString()
      ).to.be.equal("40", "Before claim: Bridge1 has incorrect DogeCoin balance");
      expect(
        (await dogeCoin.balanceOf(userAccount1.address)).toString()
      ).to.be.equal("60", "Before claim: userAccount1 has incorrect DogeCoin balance");

      await bridge1.connect(userAccount1).claim(claimData, claimSignature);

      expect(
        (await dogeCoin.balanceOf(bridge1.address)).toString()
      ).to.be.equal("0", "After claim: Bridge1 has incorrect DogeCoin balance");
      expect(
        (await dogeCoin.balanceOf(userAccount1.address)).toString()
      ).to.be.equal("100", "After claim: userAccount1 has incorrect DogeCoin balance");
    });
  });
})
