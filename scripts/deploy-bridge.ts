import hre, { ethers, network } from "hardhat";

import { localChains } from '../helper-hardhat-config';
import { Bridge__factory } from "./../typechain-types";

export async function deployBridge(bridgeName: string) {
  try {
    const bridgeFactory: Bridge__factory = await ethers.getContractFactory("Bridge");
    const bridgeContract = await bridgeFactory.deploy(bridgeName);
    const bridgeDeployTx = await bridgeContract.deployed();
    console.log(`Bridge deployed on ${hre.network.name} to: ${bridgeContract.address}`);

    if (!localChains.includes(network.name)) {
      console.log('waiting for 5 confirmation blocks...');
      await bridgeDeployTx.deployTransaction.wait(5);
      console.log('5 confirmation blocks passed');

      try {
        await hre.run("verify:verify", {
          address: bridgeContract.address,
        });
      } catch (error) {
        console.error(error.reason);
      }
    }

    return bridgeContract;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
