import { ethers } from "ethers";
import Big from "big.js";
import { IUniswapV3PoolABI } from "./abi";
import IERC20 from "@openzeppelin/contracts/build/contracts/ERC20.json";
import { ISwapRouter as ISwapRouterType } from "../typechain-types/@uniswap/v3-periphery/contracts/interfaces/ISwapRouter"; // Import TypeChain type

// Define types for tokens and exchanges
interface Token {
    contract: ethers.Contract;
    address: string;
    symbol: string;
    decimals: number;
}

interface Exchange {
    name: string;
    factory: ethers.Contract;
    quoter: ethers.Contract;
    router: ISwapRouterType; // Use ISwapRouterType instead of ethers.Contract
}

// Helper functions
export async function getTokenAndContract(
    token0Address: string,
    token1Address: string,
    provider: ethers.WebSocketProvider
): Promise<{ token0: Token; token1: Token }> {
    const token0Contract = new ethers.Contract(token0Address, IERC20.abi, provider);
    const token1Contract = new ethers.Contract(token1Address, IERC20.abi, provider);

    const token0: Token = {
        contract: token0Contract,
        address: token0Address,
        symbol: await token0Contract.symbol(),
        decimals: await token0Contract.decimals(),
    };

    const token1: Token = {
        contract: token1Contract,
        address: token1Address,
        symbol: await token1Contract.symbol(),
        decimals: await token1Contract.decimals(),
    };

    return { token0, token1 };
}

export async function getPoolAddress(
    factory: ethers.Contract,
    token0: string,
    token1: string,
    fee: number
): Promise<string> {
    return await factory.getPool(token0, token1, fee);
}

export async function getPoolContract(
    exchange: Exchange,
    token0: string,
    token1: string,
    fee: number,
    provider: ethers.WebSocketProvider
): Promise<ethers.Contract> {
    const poolAddress = await getPoolAddress(exchange.factory, token0, token1, fee);
    return new ethers.Contract(poolAddress, IUniswapV3PoolABI, provider);
}

export async function getPoolLiquidity(
    factory: ethers.Contract,
    token0: Token,
    token1: Token,
    fee: number,
    provider: ethers.WebSocketProvider
): Promise<[bigint, bigint]> {
    const poolAddress = await getPoolAddress(factory, token0.address, token1.address, fee);
    const token0Balance = await token0.contract.balanceOf(poolAddress);
    const token1Balance = await token1.contract.balanceOf(poolAddress);
    return [token0Balance, token1Balance];
}

export async function calculatePrice(
    pool: ethers.Contract,
    token0: Token,
    token1: Token
): Promise<string> {
    const [sqrtPriceX96] = await pool.slot0();
    const decimalDifference = Number(Big(token0.decimals - token1.decimals).abs());
    const conversion = Big(10).pow(decimalDifference);
    const rate = Big((Big(sqrtPriceX96.toString()).div(Big(2 ** 96))).pow(2));
    const price = Big(rate).div(Big(conversion)).toString();
    return price === "0" ? Big(rate).mul(Big(conversion)).toString() : price;
}

export async function calculateDifference(uPrice: number, sPrice: number): Promise<string> {
    return (((uPrice - sPrice) / sPrice) * 100).toFixed(2);
}