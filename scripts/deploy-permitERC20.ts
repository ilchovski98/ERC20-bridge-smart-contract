import hre, { ethers, network } from "hardhat";

import { localChains } from '../helper-hardhat-config';
import { PermitERC20__factory } from "./../typechain-types";

export async function deployPermitERC20(tokenName: string, tokenSymbol: string) {
  try {
    const tokenFactory: PermitERC20__factory = await ethers.getContractFactory('PermitERC20');
    const tokenContract = await tokenFactory.deploy(tokenName, tokenSymbol);
    const tokenDeployTx = await tokenContract.deployed();
    console.log(`Token deployed on ${hre.network.name} to: ${tokenContract.address}`);

    if (!localChains.includes(network.name)) {
      console.log('waiting for 5 confirmation blocks...');
      await tokenDeployTx.deployTransaction.wait(5);
      console.log('5 confirmation blocks passed');

      try {
        await hre.run("verify:verify", {
          address: tokenContract.address,
          constructorArguments: [tokenName, tokenSymbol]
        });

      } catch (error) {
        if (error.message.toLowerCase().includes('already verified')) {
          console.log('Already verified!');
        } else {
          console.log(error);
        }
      }
    }

    return tokenContract;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
