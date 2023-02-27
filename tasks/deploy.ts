import { task, subtask } from "hardhat/config";
import lazyImport from "../utils/lazyImport";

// Examples
// task("deploy", "Deploys Library contract").setAction(async (taskArgs, hre) => {
//   const { main } = await lazyImport("./../scripts/deploy-library");
//   const { library } = await main();
//   await hre.run('print-deployment-details', {
//     contractAddress: library.address,
//     networkName: hre.network.name,
//     deployerAddress: await library.signer.getAddress()
//   });
// });

// subtask("print-deployment-details", "Prints a message")
//   .addParam("contractAddress", "Contract's address")
//   .addParam("networkName", "The name of the network the contract is deployed to")
//   .addParam("deployerAddress", "Deployer's address")
//   .setAction(async ({ contractAddress, networkName, deployerAddress }) => {
//     console.log(`The Library contract is deployed to ${contractAddress} on the ${networkName} network by ${deployerAddress}`);
//   });
