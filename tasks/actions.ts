import { task } from "hardhat/config";
import { lazyImport } from "../utils";

task("connect-bridge-factory", "Connect the bridge and the wrapped token factory")
  .addParam("bridgeAddress", "Address of the bridge contract")
  .addParam("wrappedTokenFactoryAddress", "Address of the wrappedTokenFactory contract")
  .setAction(async (args) => {
    const { connectBridgeAndWrappedTokenFactory } = await lazyImport("./../scripts/connect-bridge-wrappedTokenFactory");
    await connectBridgeAndWrappedTokenFactory(args.bridgeContract, args.wrappedTokenFactoryAddress);
  });
