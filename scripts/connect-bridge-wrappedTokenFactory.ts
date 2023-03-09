import { ethers, network } from "hardhat";
import { Contract, ContractInterface } from "ethers";

import { localChains } from '../helper-hardhat-config';
import { getContractAbi } from "../utils";

export async function connectBridgeAndWrappedTokenFactory(bridgeAddress: string, wrappedTokenFactoryAddress: string) {
  try {
    const bridgeAbi: ContractInterface = getContractAbi("./../artifacts/contracts/Bridge.sol/Bridge.json");
    const signers = await ethers.getSigners();

    const bridgeContract: Contract = new ethers.Contract(bridgeAddress, bridgeAbi, signers[0]);
    const tx = await bridgeContract.setWrapperTokenFactory(wrappedTokenFactoryAddress);

    if (!localChains.includes(network.name)) {
      console.log('waiting for 5 confirmation blocks...');
      await tx.wait(5);
      console.log('5 confirmation blocks passed');
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
