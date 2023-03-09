import { task } from "hardhat/config";
import { lazyImport } from "../utils";

task("deploy-bridge-and-factory", "Deploy Bridge, Wrapped Token Factory and connect them")
  .addParam("bridgeName", "Name of the bridge")
  .setAction(async (args) => {
    const { deployBridge } = await lazyImport("./../scripts/deploy-bridge");
    const bridgeContract =  await deployBridge(args.bridgeName);

    const { deployWrappedTokenFactory } = await lazyImport("./../scripts/deploy-wrappedTokenFactory");
    const wrappedTokenFactory = await deployWrappedTokenFactory(bridgeContract.address);

    const { connectBridgeAndWrappedTokenFactory } = await lazyImport("./../scripts/connect-bridge-wrappedTokenFactory");
    await connectBridgeAndWrappedTokenFactory(bridgeContract.address, wrappedTokenFactory.address);
  });

task("deploy-bridge", "Deploy Bridge")
  .addParam("bridgeName", "Name of the bridge")
  .setAction(async (args) => {
    const { deployBridge } = await lazyImport("./../scripts/deploy-bridge");
    await deployBridge(args.bridgeName);
  });

task("deploy-factory", "Deploy Wrapped Token Factory")
  .addParam("ownerAddress", "The address of the owner of the factory (The bridge)")
  .setAction(async (args) => {
    const { deployWrappedTokenFactory } = await lazyImport("./../scripts/deploy-wrappedTokenFactory");
    await deployWrappedTokenFactory(args.ownerAddress);
  });
