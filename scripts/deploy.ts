import { ethers } from "hardhat";
import config from "../config.json";

async function main() {
    // Deploy the Arbitrage contract
    const Arbitrage = await ethers.getContractFactory("Arbitrage");
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