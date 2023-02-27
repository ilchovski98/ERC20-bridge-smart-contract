import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

import "./tasks/index";

dotenv.config();

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL || '';
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || '';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  defaultNetwork: "hardhat",
  networks: {
    goerli: {
      chainId: 5,
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY]
    },
    sepolia: {
      chainId: 11155111,
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  }
};

export default config;
