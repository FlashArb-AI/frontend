"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.arbitrage = exports.wagmi = exports.shadow = exports.provider = void 0;
// helpers/initialization.ts
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const config_json_1 = __importDefault(require("../config.json"));
const IUniswapV3Factory_json_1 = __importDefault(require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json"));
const IQuoterV2_json_1 = __importDefault(require("@uniswap/v3-periphery/artifacts/contracts/interfaces/IQuoterV2.sol/IQuoterV2.json"));
const ISwapRouter_json_1 = __importDefault(require("@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json"));
const Arbitrage_json_1 = __importDefault(require("../artifacts/contracts/Arbitrage.sol/Arbitrage.json"));
dotenv_1.default.config();
let provider;
if (config_json_1.default.PROJECT_SETTINGS.isLocal) {
    exports.provider = provider = new ethers_1.ethers.WebSocketProvider("ws://127.0.0.1:8545/");
}
else {
    exports.provider = provider = new ethers_1.ethers.WebSocketProvider(`wss://sonic-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
}
// Helper function to create typed contracts
function createSwapRouter(address) {
    return new ethers_1.ethers.Contract(address, ISwapRouter_json_1.default.abi, provider);
}
// Define Shadow exchange
const shadow = {
    name: "Shadow V3",
    factory: new ethers_1.ethers.Contract(config_json_1.default.SHADOW.FACTORY_V3, IUniswapV3Factory_json_1.default.abi, provider),
    quoter: new ethers_1.ethers.Contract(config_json_1.default.SHADOW.QUOTER_V3, IQuoterV2_json_1.default.abi, provider),
    router: createSwapRouter(config_json_1.default.SHADOW.ROUTER_V3),
};
exports.shadow = shadow;
// Define Wagmi exchange
const wagmi = {
    name: "Wagmi V3",
    factory: new ethers_1.ethers.Contract(config_json_1.default.WAGMI.FACTORY_V3, IUniswapV3Factory_json_1.default.abi, provider),
    quoter: new ethers_1.ethers.Contract(config_json_1.default.WAGMI.QUOTER_V3, IQuoterV2_json_1.default.abi, provider),
    router: createSwapRouter(config_json_1.default.WAGMI.ROUTER_V3),
};
exports.wagmi = wagmi;
// Arbitrage contract
const arbitrage = new ethers_1.ethers.Contract(config_json_1.default.PROJECT_SETTINGS.ARBITRAGE_ADDRESS, Arbitrage_json_1.default.abi, provider);
exports.arbitrage = arbitrage;
