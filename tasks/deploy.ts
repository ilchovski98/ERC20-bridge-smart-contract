import { task } from "hardhat/config";
import { lazyImport } from "../utils";

task("deploy-bridge", "Deploy Bridge")
  .addParam("bridgeName", "Name of the bridge")
  .setAction(async (args) => {
    const { deployBridge } = await lazyImport("./../scripts/deploy-bridge");
    await deployBridge(args.bridgeName);
  });
