const { ethers } = require("ethers");
const { Big } = require("big.js");

const { IUniswapV3Pool } = require("./abi.cjs");
const IERC20 = require("@openzeppelin/contracts/build/contracts/ERC20.json");

async function getTokenAndContract(_token0Address, _token1Address, _provider) {
  try {
    const token0Contract = new ethers.Contract(_token0Address, IERC20.abi, _provider);
    const token1Contract = new ethers.Contract(_token1Address, IERC20.abi, _provider);

    const [symbol0, decimals0, symbol1, decimals1] = await Promise.all([
      token0Contract.symbol(),
      token0Contract.decimals(),
      token1Contract.symbol(),
      token1Contract.decimals(),
    ]);

    return {
      token0: {
        contract: token0Contract,
        address: _token0Address,
        symbol: symbol0,
        decimals: decimals0,
      },
      token1: {
        contract: token1Contract,
        address: _token1Address,
        symbol: symbol1,
        decimals: decimals1,
      },
    };
  } catch (error) {
    console.error("Error fetching token contracts:", error);
    throw error;
  }
}

async function getPoolAddress(_factory, _token0, _token1, _fee) {
  try {
    return await _factory.getPool(_token0, _token1, _fee);
  } catch (error) {
    console.error("Error getting pool address:", error);
    throw error;
  }
}

async function getPoolContract(_exchange, _token0, _token1, _fee, _provider) {
  try {
    const poolAddress = await getPoolAddress(_exchange.factory, _token0, _token1, _fee);
    if (!poolAddress || poolAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("Pool not found.");
    }

    return new ethers.Contract(poolAddress, IUniswapV3Pool, _provider);
  } catch (error) {
    console.error("Error getting pool contract:", error);
    throw error;
  }
}

async function getPoolLiquidity(_factory, _token0, _token1, _fee, _provider) {
  try {
    const poolAddress = await getPoolAddress(_factory, _token0.address, _token1.address, _fee);
    const [token0Balance, token1Balance] = await Promise.all([
      _token0.contract.balanceOf(poolAddress),
      _token1.contract.balanceOf(poolAddress),
    ]);

    return [token0Balance, token1Balance];
  } catch (error) {
    console.error("Error getting pool liquidity:", error);
    throw error;
  }
}

async function calculatePrice(_pool, _token0, _token1) {
  try {
    const [sqrtPriceX96] = await _pool.slot0();

    if (!sqrtPriceX96 || isNaN(Number(sqrtPriceX96))) {
      console.error("Error: sqrtPriceX96 is invalid:", sqrtPriceX96);
      return null;
    }

    const sqrtPrice = Big(sqrtPriceX96.toString());
    const decimalDifference = Number(_token0.decimals) - Number(_token1.decimals);
    const conversion = Big(10).pow(decimalDifference);

    const rate = sqrtPrice.div(Big(2).pow(96)).pow(2);
    const price = rate.mul(conversion).toString();

    return price;
  } catch (error) {
    console.error("Error calculating price:", error);
    return null;
  }
}

function calculateDifference(_uPrice, _sPrice) {
  try {
    const uPrice = Big(_uPrice);
    const sPrice = Big(_sPrice);

    return uPrice.minus(sPrice).div(sPrice).times(100).toFixed(2);
  } catch (error) {
    console.error("Error calculating price difference:", error);
    throw error;
  }
}

module.exports = {
  getTokenAndContract,
  getPoolAddress,
  getPoolContract,
  getPoolLiquidity,
  calculatePrice,
  calculateDifference,
};
