// Helpers for exporting ABIs

// Uniswap V3
const IUniswapV3Pool = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")
const RamsesV3Factory = require("./RamsesV3Factory.json")

module.exports = {
    IUniswapV3Pool: IUniswapV3Pool.abi,
    RamsesV3Factory: RamsesV3Factory.abi
}