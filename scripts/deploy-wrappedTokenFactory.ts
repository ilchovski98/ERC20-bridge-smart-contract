import hre, { ethers, network } from "hardhat";
import { Contract, ContractInterface } from "ethers";

import { localChains } from '../helper-hardhat-config';
import { WrappedERC20Factory, WrappedERC20Factory__factory } from "./../typechain-types";
import { getContractAbi } from "../utils";

export async function deployWrappedTokenFactory(bridgeAddress: string) {
  try {
    const bridgeAbi: ContractInterface = getContractAbi("./../artifacts/contracts/Bridge.sol/Bridge.json");
    const signers = await ethers.getSigners();

    const bridgeContract: Contract = new ethers.Contract(bridgeAddress, bridgeAbi, signers[0]);

    const wrappedTokenFactoryFactory: WrappedERC20Factory__factory = await ethers.getContractFactory("WrappedERC20Factory");
    const wrappedTokenFactoryContract: WrappedERC20Factory = await wrappedTokenFactoryFactory.deploy(bridgeContract.address);
    const wrappedTokenFactoryDeployTx = await wrappedTokenFactoryContract.deployed();
    console.log(`Wrapped Token Factory deployed on ${hre.network.name} to: ${wrappedTokenFactoryContract.address}`);

    if (!localChains.includes(network.name)) {
      console.log('waiting for 5 confirmation blocks...');
      await wrappedTokenFactoryDeployTx.deployTransaction.wait(5);
      console.log('5 confirmation blocks passed');

      try {
        await hre.run("verify:verify", {
          address: wrappedTokenFactoryContract.address,
          constructorArguments: [bridgeContract.address]
        });
      } catch (error) {
        if (error.message.toLowerCase().includes('already verified')) {
          console.log('Already verified!');
        } else {
          console.log(error);
        }
      }
    }

    return wrappedTokenFactoryContract;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
