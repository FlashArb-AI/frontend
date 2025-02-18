"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenAndContract = getTokenAndContract;
exports.getPoolAddress = getPoolAddress;
exports.getPoolContract = getPoolContract;
exports.getPoolLiquidity = getPoolLiquidity;
exports.calculatePrice = calculatePrice;
exports.calculateDifference = calculateDifference;
const ethers_1 = require("ethers");
const big_js_1 = __importDefault(require("big.js"));
const abi_1 = require("./abi");
const ERC20_json_1 = __importDefault(require("@openzeppelin/contracts/build/contracts/ERC20.json"));
// Helper functions
async function getTokenAndContract(token0Address, token1Address, provider) {
    const token0Contract = new ethers_1.ethers.Contract(token0Address, ERC20_json_1.default.abi, provider);
    const token1Contract = new ethers_1.ethers.Contract(token1Address, ERC20_json_1.default.abi, provider);
    const token0 = {
        contract: token0Contract,
        address: token0Address,
        symbol: await token0Contract.symbol(),
        decimals: await token0Contract.decimals(),
    };
    const token1 = {
        contract: token1Contract,
        address: token1Address,
        symbol: await token1Contract.symbol(),
        decimals: await token1Contract.decimals(),
    };
    return { token0, token1 };
}
async function getPoolAddress(factory, token0, token1, fee) {
    return await factory.getPool(token0, token1, fee);
}
async function getPoolContract(exchange, token0, token1, fee, provider) {
    const poolAddress = await getPoolAddress(exchange.factory, token0, token1, fee);
    return new ethers_1.ethers.Contract(poolAddress, abi_1.IUniswapV3PoolABI, provider);
}
async function getPoolLiquidity(factory, token0, token1, fee, provider) {
    const poolAddress = await getPoolAddress(factory, token0.address, token1.address, fee);
    const token0Balance = await token0.contract.balanceOf(poolAddress);
    const token1Balance = await token1.contract.balanceOf(poolAddress);
    return [token0Balance, token1Balance];
}
async function calculatePrice(pool, token0, token1) {
    const [sqrtPriceX96] = await pool.slot0();
    const decimalDifference = Number((0, big_js_1.default)(token0.decimals - token1.decimals).abs());
    const conversion = (0, big_js_1.default)(10).pow(decimalDifference);
    const rate = (0, big_js_1.default)(((0, big_js_1.default)(sqrtPriceX96.toString()).div((0, big_js_1.default)(2 ** 96))).pow(2));
    const price = (0, big_js_1.default)(rate).div((0, big_js_1.default)(conversion)).toString();
    return price === "0" ? (0, big_js_1.default)(rate).mul((0, big_js_1.default)(conversion)).toString() : price;
}
async function calculateDifference(uPrice, sPrice) {
    return (((uPrice - sPrice) / sPrice) * 100).toFixed(2);
}
