require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

/**
 * Hardhat configuration for deploying VCRegistry to Base Sepolia
 *
 * Environment Variables Required:
 * - PRIVATE_KEY: Your wallet private key (never commit this!)
 * - BASE_SEPOLIA_RPC_URL: RPC URL for Base Sepolia (default: https://sepolia.base.org)
 */

module.exports = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
      gasPrice: "auto"
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
