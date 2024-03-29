import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract, ContractInterface, ContractReceipt } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

import {
  Bridge,
  Bridge__factory,
  PermitERC20,
  PermitERC20__factory,
  MaliciousPermitERC20,
  MaliciousPermitERC20__factory
} from "./../typechain-types";
import { IBridge } from "./../typechain-types/contracts/IBridge";
import { getContractAbi } from "../utils";

describe("Bridge", function () {
  // Bridges
  let bridge1: Bridge, bridge2: Bridge, bridge3: Bridge;
  // Coins
  let dogeCoin: PermitERC20, randomCoin: PermitERC20, wrappedDogeCoinToken: Contract, maliciousCoin: MaliciousPermitERC20;
  // Signers
  let deployer: SignerWithAddress, userAccount1: SignerWithAddress, userAccount2: SignerWithAddress, coinDeployer: SignerWithAddress;
  // ABIs
  let wrappedTokenAbi: ContractInterface, maliciousTokenAbi: ContractInterface;
  // Structs
  let depositData: IBridge.DepositDataStruct, claimData: IBridge.ClaimDataStruct, firstClaimSignatureSplit: IBridge.SignatureStruct;
  // addresses
  let firstWrappedDogeCoinTokenAddress: string;
  // Last TransactionData
  const depositReceipts: any = [];
  let dummyLogIndex: number = 0;

  const chainId = ethers.BigNumber.from(hre.network.config.chainId);

  before(async function() {
    // Bridges
    const bridgeFactory: Bridge__factory = await ethers.getContractFactory("Bridge");

    bridge1 = await bridgeFactory.deploy("Bridge1");
    await bridge1.deployed();

    bridge2 = await bridgeFactory.deploy("Bridge2");
    await bridge2.deployed();

    bridge3 = await bridgeFactory.deploy("Bridge3");
    await bridge3.deployed();

    // Accounts
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    userAccount1 = accounts[1];
    userAccount2 = accounts[2];
    coinDeployer = accounts[3];

    // Contract ABIs
    wrappedTokenAbi = getContractAbi("./../artifacts/contracts/PermitERC20.sol/PermitERC20.json");
    maliciousTokenAbi = getContractAbi("./../artifacts/contracts/MaliciousPermitERC20.sol/MaliciousPermitERC20.json");

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

    // Malicious Coins
    const maliciousPermitTokenFactory: MaliciousPermitERC20__factory = await ethers.getContractFactory("MaliciousPermitERC20");

    maliciousCoin = await maliciousPermitTokenFactory.connect(coinDeployer).deploy("MaliciousCoin", "MC");
    await maliciousCoin.deployed();

    const maliciousCoinTx = await maliciousCoin.mint(userAccount1.address, 100);
    await maliciousCoinTx.wait();

    expect(
      (await dogeCoin.balanceOf(userAccount1.address)).toString()
    ).to.be.equal("100", "UserAccount1 has incorrect balance of DogeCoin tokens");
    expect(
      (await randomCoin.balanceOf(userAccount1.address)).toString()
    ).to.be.equal("100", "UserAccount1 has incorrect balance of RandomCoin tokens");

    expect(
      (await maliciousCoin.balanceOf(userAccount1.address)).toString()
    ).to.be.equal("100", "UserAccount1 has incorrect balance of MaliciousCoin tokens");
  });

  describe("Contract pausing", function() {
    it("Contract should be paused after deployment", async function() {
      const bridge1IsPaused = await bridge1.paused();
      const bridge2IsPaused = await bridge2.paused();
      const bridge3IsPaused = await bridge3.paused();

      expect(bridge1IsPaused).to.be.equal(true, "Bridge1 is not paused");
      expect(bridge2IsPaused).to.be.equal(true, "Bridge2 is not paused");
      expect(bridge3IsPaused).to.be.equal(true, "Bridge3 is not paused");
    });

    it("Contract should unpause", async function() {
      const bridge1Tx = await bridge1.unpause();
      await bridge1Tx.wait();

      const bridge2Tx = await bridge2.unpause();
      await bridge2Tx.wait();

      const bridge3Tx = await bridge3.unpause();
      await bridge3Tx.wait();

      const bridge1IsPaused = await bridge1.paused();
      const bridge2IsPaused = await bridge2.paused();
      const bridge3IsPaused = await bridge3.paused();

      expect(bridge1IsPaused).to.be.equal(false, "Bridge1 is paused");
      expect(bridge2IsPaused).to.be.equal(false, "Bridge2 is paused");
      expect(bridge3IsPaused).to.be.equal(false, "Bridge3 is paused");
    });

    it("Contract should pause", async function() {
      const pauseTx = await bridge1.pause();
      await pauseTx.wait();
      const bridge1IsPaused = await bridge1.paused();

      expect(bridge1IsPaused).to.be.equal(true, "Bridge1 is not paused");
    });

    it("Should revert on depositWithPermit calls while paused", async function() {
      const deadline = (await time.latest()) + 60 * 60;
      const value = 40;
      const approveSignature = await permit(
        randomCoin,
        userAccount1,
        userAccount1.address,
        bridge1.address,
        value,
        deadline
      );

      depositData = {
        from: {
          _address: userAccount1.address,
          chainId: chainId
        },
        to: {
          _address: userAccount1.address,
          chainId: chainId
        },
        spender: bridge1.address,
        token: randomCoin.address,
        value: value,
        deadline: deadline,
        approveTokenTransferSig: {
          v: approveSignature.v,
          r: approveSignature.r,
          s: approveSignature.s
        }
      };

      await expect(bridge1.connect(userAccount1).depositWithPermit(depositData)).to.be.revertedWith("Pausable: paused");
    });

    it("Should revert on deposit calls while paused", async function() {
      const value = 40;

      depositData = {
        ...depositData,
        token: randomCoin.address,
        value: value,
        approveTokenTransferSig: {
          v: 0,
          r: ethers.constants.HashZero,
          s: ethers.constants.HashZero
        }
      };

      await expect(bridge1.connect(userAccount1).deposit(depositData)).to.be.revertedWith("Pausable: paused");
    });

    it("Should revert on claim call while paused", async function() {
      claimData = {
        from: {
          _address: userAccount1.address,
          chainId: chainId
        },
        to: {
          _address: userAccount1.address,
          chainId: chainId
        },
        value: 20,
        token: {
          tokenAddress: randomCoin.address,
          originChainId: chainId
        },
        depositTxSourceToken: randomCoin.address,
        targetTokenAddress: ethers.constants.AddressZero,
        targetTokenName: "Wrapped " + (await randomCoin.name()),
        targetTokenSymbol: "W" + (await randomCoin.symbol()),
        deadline: ethers.constants.MaxUint256,
        sourceTxData: {
          transactionHash: ethers.constants.HashZero,
          blockHash: ethers.constants.HashZero,
          logIndex: dummyLogIndex++
        }
      };

      const claimSignature = await signClaimData(bridge1, deployer, claimData);

      const claimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }

      await expect(
        bridge1.claim(claimData, claimSignatureSplit)
      ).to.be.revertedWith("Pausable: paused");

      await bridge1.unpause();
    });

    it("Should revert on attempt to pause contract if not owner", async function() {
      await expect(
        bridge1.connect(userAccount2).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert on attempt to unpause contract if not owner", async function() {
      await expect(
        bridge1.connect(userAccount2).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Reentrancy and success checks", function() {
    it("Should revert when malicious contract calls depositWithPermit second time", async function() {
      const deadline = (await time.latest()) + 60 * 60;
      const value = 19; // value < 20 = depositWithPermit()
      const approveSignature = await permit(
        maliciousCoin,
        userAccount1,
        userAccount1.address,
        bridge1.address,
        value,
        deadline
      );

      depositData = {
        from: {
          _address: userAccount1.address,
          chainId: chainId
        },
        to: {
          _address: userAccount1.address,
          chainId: chainId
        },
        spender: bridge1.address,
        token: maliciousCoin.address,
        value: value,
        deadline: deadline,
        approveTokenTransferSig: {
          v: approveSignature.v,
          r: approveSignature.r,
          s: approveSignature.s
        }
      };

      await expect(
        bridge1.connect(userAccount1).depositWithPermit(depositData)
      ).to.be.revertedWith("ReentrancyGuard: reentrant call");
    });

    it("Should revert when malicious contract calls deposit second time", async function() {
      const value = 9; // value < 10 = deposit()

      depositData = {
        ...depositData,
        value: value
      };

      await expect(
        bridge1.connect(userAccount1).deposit(depositData)
      ).to.be.revertedWith("ReentrancyGuard: reentrant call");
    });

    it("Should revert when deposit transfer is unsuccessful", async function() {
      const value = 39; // value < 39 = returns false

      depositData = {
        ...depositData,
        value: value
      };

      await expect(
        bridge1.connect(userAccount1).deposit(depositData)
      ).to.be.revertedWithCustomError(bridge1, "TransferFromIsUnsuccessful");
    });

    it("Should revert when malicious contract calls claim second time", async function() {
      claimData = {
        ...claimData,
        value: 19,
        token: {
          tokenAddress: maliciousCoin.address,
          originChainId: chainId
        },
        depositTxSourceToken: maliciousCoin.address,
        targetTokenAddress: maliciousCoin.address
      };

      const claimSignature = await signClaimData(bridge1, deployer, claimData);

      const claimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }

      await expect(
        bridge1.claim(claimData, claimSignatureSplit)
      ).to.be.revertedWith("ReentrancyGuard: reentrant call");
    });

    it("Should revert when malicious contract calls claim and transfer fails", async function() {
      claimData = {
        ...claimData,
        value: 39
      };

      const claimSignature = await signClaimData(bridge1, deployer, claimData);

      const claimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }

      await expect(
        bridge1.claim(claimData, claimSignatureSplit)
      ).to.be.revertedWithCustomError(bridge1, "TransferIsUnsuccessful");
    });
  });

  describe("Deposit ERC20 to Bridge 1 (Lock)", function() {
    describe("deposit", function() {
      it("Should revert when from address is address(0)", async function() {
        depositData = {
          ...depositData,
          from: {
            _address: ethers.constants.AddressZero,
            chainId: chainId
          }
        };

        await expect(
          bridge1.connect(userAccount1).deposit(depositData)
        ).to.be.revertedWithCustomError(bridge1, "InvalidAddress");
      });

      it("Should revert when from address is not msg.sender", async function() {
        depositData = {
          ...depositData,
          from: {
            _address: userAccount2.address,
            chainId: chainId
          }
        };

        await expect(
          bridge1.connect(userAccount1).deposit(depositData)
        ).to.be.revertedWithCustomError(bridge1, "FromAndSenderMustMatch");
      });

      it("Should revert when to address is address(0)", async function() {
        depositData = {
          ...depositData,
          from: {
            _address: userAccount1.address,
            chainId: chainId
          },
          to: {
            _address: ethers.constants.AddressZero,
            chainId: chainId
          }
        };

        await expect(
          bridge1.connect(userAccount1).deposit(depositData)
        ).to.be.revertedWithCustomError(bridge1, "InvalidAddress");
      });

      it("Should revert when to chainId is 0", async function() {
        depositData = {
          ...depositData,
          to: {
            _address: userAccount1.address,
            chainId: 0
          }
        };
        await expect(
          bridge1.connect(userAccount1).deposit(depositData)
        ).to.be.revertedWithCustomError(bridge1, "InvalidChainId");
      });

      it("Should revert when trying to deposit without approval", async function() {
        const value = 40;

        depositData = {
          ...depositData,
          to: {
            _address: userAccount1.address,
            chainId: chainId
          },
          token: randomCoin.address,
          value: value
        };

        await expect(
          bridge1.connect(userAccount1).deposit(depositData)
        ).to.be.revertedWith("ERC20: insufficient allowance");
      });

      it("Funds are deposited to the bridge - RandomCoin", async function() {
        expect(
          await randomCoin.balanceOf(userAccount1.address)
        ).to.be.equal(100, "Initial token balance of userAccount1 is incorect");
        expect(
          await randomCoin.balanceOf(bridge1.address)
        ).to.be.equal(0, "Initial token balance of bridge1 is incorect");

        const value = 40;

        const approveTx = await randomCoin.connect(userAccount1).approve(bridge1.address, value);
        await approveTx.wait();

        const depositTx = await bridge1.connect(userAccount1).deposit(depositData);
        const receipt = await depositTx.wait();
        depositReceipts.push({ transactionHash: receipt.transactionHash, blockHash: receipt.blockHash, logIndex: dummyLogIndex++}); // 1

        expect(
          await randomCoin.balanceOf(userAccount1.address)
        ).to.be.equal(100 - value, "Token balance of userAccount1 is incorect");
        expect(
          await randomCoin.balanceOf(bridge1.address)
        ).to.be.equal(value, "Token balance of bridge1 is incorect");
      });
    });

    describe("depositWithPermit", function() {
      it("Funds are deposited to the bridge - DogeCoin", async function() {
        expect(
          await dogeCoin.balanceOf(userAccount1.address)
        ).to.be.equal(100, "Initial token balance of userAccount1 is incorect");
        expect(
          await dogeCoin.balanceOf(bridge1.address)
        ).to.be.equal(0, "Initial token balance of bridge1 is incorect");

        const deadline = (await time.latest()) + 60 * 60;
        const value = 40;
        const approveSignature = await permit(
          dogeCoin,
          userAccount1,
          userAccount1.address,
          bridge1.address,
          value,
          deadline
        );

        depositData = {
          from: {
            _address: userAccount1.address,
            chainId: chainId
          },
          to: {
            _address: userAccount1.address,
            chainId: chainId
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

        const depositTx = await bridge1.connect(userAccount1).depositWithPermit(depositData);
        const receipt = await depositTx.wait();
        depositReceipts.push({ transactionHash: receipt.transactionHash, blockHash: receipt.blockHash, logIndex: dummyLogIndex++}); // 2

        expect(
          await dogeCoin.balanceOf(userAccount1.address)
        ).to.be.equal(100 - value, "Token balance of userAccount1 is incorect");
        expect(
          await dogeCoin.balanceOf(bridge1.address)
        ).to.be.equal(value, "Token balance of bridge1 is incorect");
      });

      it("Signature should expire after 1h", async function() {
        const deadline = (await time.latest()) + 60 * 60;
        const approveSignature = await permit(
          dogeCoin,
          userAccount1,
          userAccount1.address,
          bridge1.address,
          20,
          deadline
        );

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

        await expect(
          bridge1.connect(userAccount1).depositWithPermit(depositData)
        ).to.be.revertedWith("ERC20WithPermit: EXPIRED_SIGNATURE");
      });

      it("Should revert when value is 0", async function() {
        depositData = {
          ...depositData,
          value: 0
        }

        await expect(
          bridge1.connect(userAccount1).depositWithPermit(depositData)
        ).to.be.revertedWithCustomError(bridge1, "InvalidTokenAmount");
      });

      it("Should revert when spender is address(0)", async function() {
        depositData = {
          ...depositData,
          value: 20,
          spender: ethers.constants.AddressZero
        }

        await expect(
          bridge1.connect(userAccount1).depositWithPermit(depositData)
        ).to.be.revertedWithCustomError(bridge1, "InvalidAddress");
      });

      it("Should revert when destination chainId is 0", async function() {
        depositData = {
          ...depositData,
          to: {
            _address: userAccount1.address,
            chainId: 0
          },
          spender: bridge1.address,
        }

        await expect(
          bridge1.connect(userAccount1).depositWithPermit(depositData)
        ).to.be.revertedWithCustomError(bridge1, "InvalidChainId");
      });

      it("Should revert when provided with invalid signature.v", async function() {
        const deadline = (await time.latest()) + 60 * 60;
        const approveSignature = await permit(
          dogeCoin,
          userAccount1,
          userAccount1.address,
          bridge1.address,
          20,
          deadline
        );

        depositData = {
          ...depositData,
          to: {
            _address: userAccount1.address,
            chainId: chainId
          },
          deadline: deadline,
          value: 20,
          approveTokenTransferSig: {
            v: 17,
            r: approveSignature.r,
            s: approveSignature.s
          }
        }

        await expect(
          bridge1.connect(userAccount1).depositWithPermit(depositData)
        ).to.be.revertedWith("ERC20WithPermit: INVALID_SIGNATURE");
      });

      it("Should revert on attempt to change WrapperTokenFactory address if not owner", async function() {
        const deadline = (await time.latest()) + 60 * 60;
        const approveSignature = await permit(
          dogeCoin,
          userAccount1,
          userAccount1.address,
          ethers.constants.AddressZero,
          20,
          deadline
        );

        depositData = {
          ...depositData,
          to: {
            _address: ethers.constants.AddressZero,
            chainId: chainId
          },
          deadline: deadline,
          approveTokenTransferSig: {
            v: approveSignature.v,
            r: approveSignature.r,
            s: approveSignature.s
          }
        }

        await expect(bridge1.connect(userAccount1).depositWithPermit(depositData)).to.be.revertedWithCustomError(bridge1, "InvalidAddress");
      });

      it("Should revert on attempt to change WrapperTokenFactory address if not owner", async function() {

        depositData = {
          ...depositData,
          to: {
            _address: userAccount1.address,
            chainId: chainId
          },
          token: ethers.constants.AddressZero
        }

        await expect(
          bridge1.connect(userAccount1).depositWithPermit(depositData)
        ).to.be.revertedWithCustomError(bridge1, "InvalidAddress");
      });
    });
  });

  describe("Claim WERC20 from Bridge 2 (Mint)", function() {
    it("Should revert if from chain is 0", async function() {
      claimData = {
        ...claimData,
        from: {
          _address: userAccount1.address,
          chainId: 0
        },
        value: 20,
        token: {
          tokenAddress: dogeCoin.address,
          originChainId: chainId
        },
        depositTxSourceToken: dogeCoin.address,
        targetTokenAddress: ethers.constants.AddressZero,
        targetTokenName: "Wrapped " + (await dogeCoin.name()),
        targetTokenSymbol: "W" + (await dogeCoin.symbol())
      };

      const claimSignature = await signClaimData(bridge2, deployer, claimData);

      const claimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }

      await expect(
        bridge2.claim(claimData, claimSignatureSplit)
      ).to.be.revertedWithCustomError(bridge2, "InvalidChainId");
    });

    it("Deploy WrappedToken and mint tokens to the recepient - DogeCoin", async function() {
      claimData = {
        ...claimData,
        from: {
          _address: userAccount1.address,
          chainId: chainId
        },
        sourceTxData: {
          transactionHash: depositReceipts[1].transactionHash,
          blockHash: depositReceipts[1].blockHash,
          logIndex: depositReceipts[1].logIndex
        }
      };

      const claimSignature = await signClaimData(bridge2, deployer, claimData);

      firstClaimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }

      const claimTx = await bridge2.claim(claimData, firstClaimSignatureSplit);
      await claimTx.wait();


      firstWrappedDogeCoinTokenAddress = await bridge2.wrappedTokenByOriginalTokenByChainId(
        chainId,
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

    it("TransactionDataHash is stored correctly", async function () {
      const transactionDataHash = ethers.utils.solidityKeccak256(["bytes32", "bytes32", "uint256"], [depositReceipts[1].transactionHash, depositReceipts[1].blockHash, depositReceipts[1].logIndex]);
      expect(
        await bridge2.isClaimed(transactionDataHash)
      ).to.be.equal(true, "TransactionDataHash is not stored correctly");
    });

    it("Should revert when trying to claim with the same transactionData", async function() {
      const claimSignature = await signClaimData(bridge2, deployer, claimData);

      const claimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }
      await expect(
        bridge2.claim(claimData, claimSignatureSplit)
      ).to.be.revertedWithCustomError(bridge2, "AlreadyClaimed");
    });

    it("Number of deployed WERC20 from a bridge are stored correctly", async function() {
      expect(
        await bridge2.getNumberOfWrappedTokens()
      ).to.be.equal(1, "Number of WERC20 are not stored correctly");
    });

    it("Should revert when trying to use the signature twice", async function() {
      await expect(
        bridge2.claim(claimData, firstClaimSignatureSplit)
      ).to.be.revertedWithCustomError(bridge2, "AddressIsNotTheOwner");
    });

    it("Should not deploy new WrappedToken and mint from the old one", async function() {
      claimData = {
        ...claimData,
        sourceTxData: {
          transactionHash: depositReceipts[1].transactionHash,
          blockHash: depositReceipts[1].blockHash,
          logIndex: depositReceipts[1].logIndex + 10000 // Random one in order to pass the test
        }
      }
      const claimSignature = await signClaimData(bridge2, deployer, claimData);
      const claimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }
      const claimTx = await bridge2.claim(claimData, claimSignatureSplit);
      await claimTx.wait();

      const wrappedDogeCoinTokenAddress = await bridge2.wrappedTokenByOriginalTokenByChainId(
        chainId,
        dogeCoin.address
      );

      const wrappedToken = new ethers.Contract(
        wrappedDogeCoinTokenAddress,
        getContractAbi("./../artifacts/contracts/PermitERC20.sol/PermitERC20.json"),
        deployer
      );

      expect(firstWrappedDogeCoinTokenAddress).to.be.equal(
        wrappedDogeCoinTokenAddress,
        "Bridge deployed Wrapped token contract instead of using the existing one"
      );
      expect(
        (await wrappedToken.balanceOf(userAccount1.address)).toString()
      ).to.be.equal("40", "Wrapped token balance of userAccount1 is incorrect");
    });
  });

  describe("Deposit WERC20 to Bridge 2 (Burn)", function() {
    it("Burn the deployed token instead of holding them - DogeCoin", async function() {
      expect(
        await wrappedDogeCoinToken.balanceOf(userAccount1.address)
      ).to.be.equal(40, "Initial WrappedDogeCoin token balance of userAccount1 is incorect");

      const deadline = (await time.latest()) + 60 * 60;
      const approveSignature = await permit(
        wrappedDogeCoinToken,
        userAccount1,
        userAccount1.address,
        bridge2.address,
        40,
        deadline
      );

      depositData = {
        from: {
          _address: userAccount1.address,
          chainId: chainId
        },
        to: {
          _address: userAccount1.address,
          chainId: chainId
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

      const depositTx = await bridge2.connect(userAccount1).depositWithPermit(depositData);
      const receipt = await depositTx.wait();
      depositReceipts.push({ transactionHash: receipt.transactionHash, blockHash: receipt.blockHash, logIndex: dummyLogIndex++}); // 3

      const totalSupplyAfterTx: BigNumber = await wrappedDogeCoinToken.totalSupply();

      expect(
        await wrappedDogeCoinToken.balanceOf(bridge2.address)
      ).to.be.equal(0, "The bridge have locked Wrapped tokens instead of burning them");
      expect(
        await wrappedDogeCoinToken.balanceOf(userAccount1.address)
      ).to.be.equal(0, "The bridge have locked Wrapped tokens instead of burning them");
      expect(totalSupplyAfterTx).to.be.equal(
        initialTotalSupply.sub(40),
        "WrappedDogeCoin totalSupply is incorrect"
      );
    });
  });

  describe("Claim ERC20 from Bridge 1 (Release)", function() {
    it("Should revert if destination chain is different from current one", async function() {
      const deadline = ethers.constants.MaxUint256.toString();
      const targetTokenAddress = (await bridge2.originalTokenByWrappedToken(depositData.token)).tokenAddress; // Should be the original, initially deployed ERC20 token (DogeCoin)

      claimData = {
        from: {
          _address: userAccount1.address,
          chainId: chainId
        },
        to: {
          _address: userAccount1.address,
          chainId: 999999
        },
        value: 40,
        token: {
          tokenAddress: dogeCoin.address,
          originChainId: chainId
        },
        depositTxSourceToken: dogeCoin.address,
        targetTokenAddress: targetTokenAddress,
        targetTokenName: "",
        targetTokenSymbol: "",
        deadline: deadline,
        sourceTxData: {
          transactionHash: depositReceipts[2].transactionHash,
          blockHash: depositReceipts[2].blockHash,
          logIndex: depositReceipts[2].logIndex
        }
      };

      const claimSignature = await signClaimData(bridge1, deployer, claimData);

      await expect(
        bridge1.connect(userAccount1).claim(claimData, claimSignature)
      ).to.be.revertedWithCustomError(bridge1, "CurrentAndProvidedChainsDoNotMatch");
    });

    it("Should revert if destination address is address(0)", async function() {
      claimData = {
        ...claimData,
        to: {
          _address: ethers.constants.AddressZero,
          chainId: chainId
        }
      };

      const claimSignature = await signClaimData(bridge1, deployer, claimData);

      await expect(
        bridge1.connect(userAccount1).claim(claimData, claimSignature)
      ).to.be.revertedWithCustomError(bridge1, "InvalidAddress");
    });

    it("Should revert if source address is address(0)", async function() {
      claimData = {
        ...claimData,
        from: {
          _address: ethers.constants.AddressZero,
          chainId: chainId
        },
        to: {
          _address: userAccount1.address,
          chainId: chainId
        }
      };

      const claimSignature = await signClaimData(bridge1, deployer, claimData);

      await expect(
        bridge1.connect(userAccount1).claim(claimData, claimSignature)
      ).to.be.revertedWithCustomError(bridge1, "InvalidAddress");
    });

    it("Should revert if invalid signature.v is provided", async function() {
      claimData = {
        ...claimData,
        from: {
          _address: userAccount1.address,
          chainId: chainId
        }
      };

      const claimSignature = await signClaimData(bridge1, deployer, claimData);
      const customSignature = {
        ...claimSignature,
        v: 17
      }

      await expect(
        bridge1.connect(userAccount1).claim(claimData, customSignature)
      ).to.be.revertedWithCustomError(bridge1, "InvalidAddress");
    });

    it("Release original ERC20 token - DogeCoin", async function() {
      const claimSignature = await signClaimData(bridge1, deployer, claimData);

      expect(dogeCoin.address).to.be.equal(
        claimData.targetTokenAddress,
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

  describe("Send WERC20 from Bridge 2 to Bridge 3, then to Bridge 1 and release original ERC20 (3 way Bridge)", function() {
    it("Claim WERC20 on Bridge 2 (mint) - RandomCoin", async function() {
      claimData = {
        from: {
          _address: userAccount1.address,
          chainId: chainId
        },
        to: {
          _address: userAccount1.address,
          chainId: chainId
        },
        value: 40,
        token: {
          tokenAddress: randomCoin.address,
          originChainId: chainId
        },
        depositTxSourceToken: randomCoin.address,
        targetTokenAddress: ethers.constants.AddressZero,
        targetTokenName: "Wrapped " + (await randomCoin.name()),
        targetTokenSymbol: "W" + (await randomCoin.symbol()),
        deadline: ethers.constants.MaxUint256,
        sourceTxData: {
          transactionHash: depositReceipts[0].transactionHash,
          blockHash: depositReceipts[0].blockHash,
          logIndex: depositReceipts[0].logIndex
        }
      };

      const claimSignature = await signClaimData(bridge2, deployer, claimData);

      const claimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }

      const claimTx = await bridge2.claim(claimData, claimSignatureSplit);
      await claimTx.wait();

      const wrappedRandomCoinBridge2Address = await bridge2.wrappedTokenByOriginalTokenByChainId(chainId, randomCoin.address);
      const wrappedRandomCoinBridge2: Contract = new ethers.Contract(wrappedRandomCoinBridge2Address, wrappedTokenAbi, userAccount1);

      expect(
        (await wrappedRandomCoinBridge2.balanceOf(userAccount1.address)).toString()
      ).to.be.equal("40", "WrappedRandomCoin wasn't claimed correctly");
    });

    it("Deposit WERC20 on Bridge 2 in Bridge 3 direction - RandomCoin", async function() {
      const deadline = (await time.latest()) + 60 * 60;

      const wrappedRandomCoinBridge2Address = await bridge2.wrappedTokenByOriginalTokenByChainId(chainId, randomCoin.address);
      const wrappedRandomCoinBridge2: Contract = new ethers.Contract(wrappedRandomCoinBridge2Address, wrappedTokenAbi, userAccount1);

      const approveSignature = await permit(
        wrappedRandomCoinBridge2,
        userAccount1,
        userAccount1.address,
        bridge2.address,
        40,
        deadline
      );

      depositData = {
        from: {
          _address: userAccount1.address,
          chainId: chainId
        },
        to: {
          _address: bridge2.address,
          chainId: chainId
        },
        spender: bridge2.address,
        token: wrappedRandomCoinBridge2.address,
        value: 40,
        deadline: deadline,
        approveTokenTransferSig: {
          v: approveSignature.v,
          r: approveSignature.r,
          s: approveSignature.s
        }
      };

      const initialTotalSupply: BigNumber = await wrappedRandomCoinBridge2.totalSupply();

      const depositTx = await bridge2.connect(userAccount1).depositWithPermit(depositData);
      const receipt = await depositTx.wait();
      depositReceipts.push({ transactionHash: receipt.transactionHash, blockHash: receipt.blockHash, logIndex: dummyLogIndex++}); // 4

      const totalSupplyAfterTx: BigNumber = await wrappedRandomCoinBridge2.totalSupply();

      expect(
        await wrappedRandomCoinBridge2.balanceOf(bridge2.address)
      ).to.be.equal(0, "The bridge have locked Wrapped tokens instead of burning them");
      expect(
        await wrappedRandomCoinBridge2.balanceOf(userAccount1.address)
      ).to.be.equal(0, "The bridge have locked Wrapped tokens instead of burning them");
      expect(totalSupplyAfterTx).to.be.equal(
        initialTotalSupply.sub(40),
        "WrappedDogeCoin totalSupply is incorrect"
      );
    });

    it("Claim WERC20 on Bridge 3 - RandomCoin", async function() {
      const wrappedRandomCoinBridge2Address = await bridge2.wrappedTokenByOriginalTokenByChainId(chainId, randomCoin.address);
      const wrappedRandomCoinBridge2: Contract = new ethers.Contract(wrappedRandomCoinBridge2Address, wrappedTokenAbi, userAccount1);

      claimData = {
        ...claimData,
        depositTxSourceToken: wrappedRandomCoinBridge2.address,
        sourceTxData: {
          transactionHash: depositReceipts[3].transactionHash,
          blockHash: depositReceipts[3].blockHash,
          logIndex: depositReceipts[3].logIndex
        }
      };

      const claimSignature = await signClaimData(bridge3, deployer, claimData);

      const claimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }

      const claimTx = await bridge3.claim(claimData, claimSignatureSplit);
      await claimTx.wait();

      const wrappedRandomCoinBridge3Address = await bridge3.wrappedTokenByOriginalTokenByChainId(chainId, randomCoin.address);
      const wrappedRandomCoinBridge3: Contract = new ethers.Contract(wrappedRandomCoinBridge3Address, wrappedTokenAbi, userAccount1);

      expect(
        (await wrappedRandomCoinBridge3.balanceOf(userAccount1.address)).toString()
      ).to.be.equal("40", "WrappedRandomCoin wasn't claimed correctly");
    });

    it("Deposit WERC20 on Bridge 3 in Bridge 1 direction - RandomCoin", async function() {
      const deadline = (await time.latest()) + 60 * 60;

      const wrappedRandomCoinBridge3Address = await bridge3.wrappedTokenByOriginalTokenByChainId(chainId, randomCoin.address);
      const wrappedRandomCoinBridge3: Contract = new ethers.Contract(wrappedRandomCoinBridge3Address, wrappedTokenAbi, userAccount1);

      const approveSignature = await permit(
        wrappedRandomCoinBridge3,
        userAccount1,
        userAccount1.address,
        bridge3.address,
        40,
        deadline
      );

      depositData = {
        from: {
          _address: userAccount1.address,
          chainId: chainId
        },
        to: {
          _address: bridge3.address,
          chainId: chainId
        },
        spender: bridge3.address,
        token: wrappedRandomCoinBridge3.address,
        value: 40,
        deadline: deadline,
        approveTokenTransferSig: {
          v: approveSignature.v,
          r: approveSignature.r,
          s: approveSignature.s
        }
      };

      const initialTotalSupply: BigNumber = await wrappedRandomCoinBridge3.totalSupply();

      const depositTx = await bridge3.connect(userAccount1).depositWithPermit(depositData);
      const receipt = await depositTx.wait();
      depositReceipts.push({ transactionHash: receipt.transactionHash, blockHash: receipt.blockHash, logIndex: dummyLogIndex++}); // 5

      const totalSupplyAfterTx: BigNumber = await wrappedRandomCoinBridge3.totalSupply();

      expect(
        await wrappedRandomCoinBridge3.balanceOf(bridge3.address)
      ).to.be.equal(0, "The bridge have locked Wrapped tokens instead of burning them");
      expect(
        await wrappedRandomCoinBridge3.balanceOf(userAccount1.address)
      ).to.be.equal(0, "The bridge have locked Wrapped tokens instead of burning them");
      expect(totalSupplyAfterTx).to.be.equal(
        initialTotalSupply.sub(40),
        "WrappedDogeCoin totalSupply is incorrect"
      );
    });

    it("Claim WERC20 on Bridge 3 - RandomCoin", async function() {
      claimData = {
        ...claimData,
        sourceTxData: {
          transactionHash: depositReceipts[4].transactionHash,
          blockHash: depositReceipts[4].blockHash,
          logIndex: depositReceipts[4].logIndex
        }
      }
      const claimSignature = await signClaimData(bridge3, deployer, claimData);
      const claimSignatureSplit = {
        v: claimSignature.v,
        r: claimSignature.r,
        s: claimSignature.s
      }

      const claimTx = await bridge3.claim(claimData, claimSignatureSplit);
      await claimTx.wait();

      const wrappedRandomCoinBridge3Address = await bridge3.wrappedTokenByOriginalTokenByChainId(chainId, randomCoin.address);
      const wrappedRandomCoinBridge3: Contract = new ethers.Contract(wrappedRandomCoinBridge3Address, wrappedTokenAbi, userAccount1);

      expect(
        (await wrappedRandomCoinBridge3.balanceOf(userAccount1.address)).toString()
      ).to.be.equal("40", "WrappedRandomCoin wasn't claimed correctly");
    });
  });
});

async function permit(
  token: PermitERC20,
  account: SignerWithAddress,
  owner: string,
  spender: string,
  value: number | string,
  deadline: number | string
) {
  const nonce = await token.nonces(owner);

  const domain = {
    name: await token.name(),
    version: '1',
    chainId: hre.network.config.chainId,
    verifyingContract: token.address
  };

  const Permit = [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ];

  const message = {
    owner: owner,
    spender: spender,
    value: value,
    nonce: nonce.toHexString(),
    deadline
  };

  const signatureLike = await account._signTypedData(domain, { Permit }, message);
  const signature = ethers.utils.splitSignature(signatureLike);

  return signature;
};

async function signClaimData(
  bridge: Bridge,
  signer: SignerWithAddress,
  claimData: IBridge.ClaimDataStruct
) {
  const domain = {
    name: await bridge.name(),
    version: '1',
    chainId: hre.network.config.chainId,
    verifyingContract: bridge.address
  };

  const types = {
    User: [
      { name: '_address', type: 'address' },
      { name: 'chainId', type: 'uint256' }
    ],
    SourceTxData: [
      { name: 'transactionHash', type: 'bytes32' },
      { name: 'blockHash', type: 'bytes32' },
      { name: 'logIndex', type: 'uint256' }
    ],
    OriginalToken: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'originChainId', type: 'uint256' }
    ],
    ClaimData: [
      { name: 'from', type: 'User' },
      { name: 'to', type: 'User' },
      { name: 'value', type: 'uint256' },
      { name: 'token', type: 'OriginalToken' },
      { name: 'depositTxSourceToken', type: 'address' },
      { name: 'targetTokenAddress', type: 'address' },
      { name: 'targetTokenName', type: 'string' },
      { name: 'targetTokenSymbol', type: 'string' },
      { name: 'deadline', type: 'uint256' },
      { name: 'sourceTxData', type: 'SourceTxData' }
    ],
    Claim: [
      { name: '_claimData', type: 'ClaimData' },
      { name: 'nonce', type: 'uint256' }
    ]
  };

  const nonce = (await bridge.nonce(claimData.from._address)).toHexString();

  const value = {
    _claimData: claimData,
    nonce: nonce
  };

  const signatureLike = await signer._signTypedData(domain, types, value);
  const signature = ethers.utils.splitSignature(signatureLike);

  return signature;
};
