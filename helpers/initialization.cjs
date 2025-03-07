require("dotenv").config()
const ethers = require('ethers')

/**
 * This file could be used for initializing some
 * of the main contracts such as the V3 router & 
 * factory. This is also where we initialize the
 * main Arbitrage contract.
 */


const config = require('../config.json')
const IUniswapV3Factory = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json')
const IQuoter = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/IQuoterV2.sol/IQuoterV2.json')
const SpookySwapRouter = require('./IUniswapV3Router02.json')
const WagmiSwapRouter = require('./SwapRouter02.json')
const UniswapSwapRouter = require('./SwapRouter02.json')
const ShadowSwapRouter = require('./ShadowRouter.json')
const RamsesV3Factory = require('./RamsesV3Factory.json')
const WagmiSwapRouter0 = require('./SwapRouter.json')

let provider

if (config.PROJECT_SETTINGS.isLocal) {
    provider = new ethers.WebSocketProvider(`ws://127.0.0.1:8545/`)
} else {
    provider = new ethers.WebSocketProvider(`wss://sonic-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
}

// Define Uniswap exchange
const uniswap = {
    name: "Uniswap V3",
    factory: new ethers.Contract(config.UNISWAP.FACTORY_V3, IUniswapV3Factory.abi, provider),
    quoter: new ethers.Contract(config.UNISWAP.QUOTER_V3, IQuoter.abi, provider),
    router: new ethers.Contract(config.UNISWAP.ROUTER_V3, UniswapSwapRouter.abi, provider)
}
// Define Spooky exchange
const spooky = {
    name: "Spooky V3",
    factory: new ethers.Contract(config.SPOOKY.FACTORY_V3, IUniswapV3Factory.abi, provider),
    quoter: new ethers.Contract(config.SPOOKY.QUOTER_V3, IQuoter.abi, provider),
    router: new ethers.Contract(config.SPOOKY.ROUTER_V3, SpookySwapRouter.abi, provider)
};

// Define Wagmi exchange
const wagmi = {
    name: "Wagmi V3",
    factory: new ethers.Contract(config.WAGMI.FACTORY_V3, IUniswapV3Factory.abi, provider),
    quoter: new ethers.Contract(config.WAGMI.QUOTER_V3, IQuoter.abi, provider),
    router: new ethers.Contract(config.WAGMI.ROUTER_V3, WagmiSwapRouter.abi, provider)
};

// Define Shadow exchange
const shadow = {
    name: "Shadow V3",
    factory: new ethers.Contract(config.SHADOW.FACTORY_V3, RamsesV3Factory.abi, provider),
    quoter: new ethers.Contract(config.SHADOW.QUOTER_V3, IQuoter.abi, provider),
    router: new ethers.Contract(config.SHADOW.ROUTER_V3, ShadowSwapRouter.abi, provider)
};

const IArbitrage = require('../artifacts/contracts/Arbitrage.sol/Arbitrage.json')
const arbitrage = new ethers.Contract(config.PROJECT_SETTINGS.ARBITRAGE_ADDRESS, IArbitrage.abi, provider)

module.exports = {
    provider,
    uniswap,
    spooky,
    wagmi,
    shadow,
    arbitrage
}