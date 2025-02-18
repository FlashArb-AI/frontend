"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IUniswapV3PoolABI = void 0;
const IUniswapV3Pool_json_1 = __importDefault(require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"));
// Export Uniswap V3 ABI (reused for Shadow and Wagmi)
exports.IUniswapV3PoolABI = IUniswapV3Pool_json_1.default.abi;
