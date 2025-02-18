// hardhat.config.ts
require("hardhat/config");
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey = process.env.PRIVATE_KEY || "";

const config = {
  solidity: "0.8.18",
  networks: {
    hardhat: {
      forking: {
        url: `https://sonic-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber: 8368000,
      },
    },
  },
};

module.exports = config;