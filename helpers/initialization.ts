import { ethers } from "ethers";
import dotenv from "dotenv";
import config from "../config.json";
import IUniswapV3Factory from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json";
import IQuoter from "@uniswap/v3-periphery/artifacts/contracts/interfaces/IQuoterV2.sol/IQuoterV2.json";
import ISwapRouter from "@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json";
import IArbitrage from "../artifacts/contracts/Arbitrage.sol/Arbitrage.json";

dotenv.config();

let provider: ethers.WebSocketProvider;

if (config.PROJECT_SETTINGS.isLocal) {
    provider = new ethers.WebSocketProvider("ws://127.0.0.1:8545/");
} else {
    provider = new ethers.WebSocketProvider(
        `wss://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    );
}

// Define Shadow exchange
const shadow = {
    name: "Shadow V3",
    factory: new ethers.Contract(config.SHADOW.FACTORY_V3, IUniswapV3Factory.abi, provider),
    quoter: new ethers.Contract(config.SHADOW.QUOTER_V3, IQuoter.abi, provider),
    router: new ethers.Contract(config.SHADOW.ROUTER_V3, ISwapRouter.abi, provider),
};

// Define Wagmi exchange
const wagmi = {
    name: "Wagmi V3",
    factory: new ethers.Contract(config.WAGMI.FACTORY_V3, IUniswapV3Factory.abi, provider),
    quoter: new ethers.Contract(config.WAGMI.QUOTER_V3, IQuoter.abi, provider),
    router: new ethers.Contract(config.WAGMI.ROUTER_V3, ISwapRouter.abi, provider),
};

// Arbitrage contract
const arbitrage = new ethers.Contract(config.PROJECT_SETTINGS.ARBITRAGE_ADDRESS, IArbitrage.abi, provider);

export { provider, shadow, wagmi, arbitrage };