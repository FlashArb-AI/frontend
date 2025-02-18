"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
async function main() {
    // Deploy the Arbitrage contract
    const Arbitrage = await hardhat_1.ethers.getContractFactory("Arbitrage");
    const arbitrage = await Arbitrage.deploy();
    // Wait for the contract to be deployed
    await arbitrage.waitForDeployment();
    // Get the contract address
    const arbitrageAddress = await arbitrage.getAddress();
    console.log(`Arbitrage contract deployed to ${arbitrageAddress}`);
}
// Run the deployment script
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
