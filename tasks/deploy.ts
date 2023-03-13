import { task } from "hardhat/config";
import { lazyImport } from "../utils";

task("deploy-bridge", "Deploy Bridge")
  .addParam("bridgeName", "Name of the bridge")
  .setAction(async (args) => {
    const { deployBridge } = await lazyImport("./../scripts/deploy-bridge");
    await deployBridge(args.bridgeName);
  });

task("deploy-permitERC20", "Deploy PermitERC20")
  .addParam("tokenName", "Name of the token")
  .addParam("tokenSymbol", "Symbol of the token")
  .setAction(async (args) => {
    const { deployPermitERC20 } = await lazyImport("./../scripts/deploy-permitERC20");
    await deployPermitERC20(args.tokenName, args.tokenSymbol);
  });
