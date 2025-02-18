"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const big_js_1 = __importDefault(require("big.js"));
const ethers_1 = require("ethers");
const config_json_1 = __importDefault(require("./config.json"));
const helpers_1 = require("./helpers/helpers");
const initialization_1 = require("./helpers/initialization");
// -- CONFIGURATION VALUES HERE -- //
const ARB_FOR = config_json_1.default.TOKENS.ARB_FOR;
const ARB_AGAINST = config_json_1.default.TOKENS.ARB_AGAINST;
const POOL_FEE = config_json_1.default.TOKENS.POOL_FEE;
const UNITS = config_json_1.default.PROJECT_SETTINGS.PRICE_UNITS;
const PRICE_DIFFERENCE = config_json_1.default.PROJECT_SETTINGS.PRICE_DIFFERENCE;
const GAS_LIMIT = config_json_1.default.PROJECT_SETTINGS.GAS_LIMIT;
const GAS_PRICE = config_json_1.default.PROJECT_SETTINGS.GAS_PRICE;
let isExecuting = false;
const main = async () => {
    const { token0, token1 } = await (0, helpers_1.getTokenAndContract)(ARB_FOR, ARB_AGAINST, initialization_1.provider);
    const uPool = await (0, helpers_1.getPoolContract)(initialization_1.shadow, token0.address, token1.address, POOL_FEE, initialization_1.provider);
    const pPool = await (0, helpers_1.getPoolContract)(initialization_1.wagmi, token0.address, token1.address, POOL_FEE, initialization_1.provider);
    console.log(`Using ${token1.symbol}/${token0.symbol}\n`);
    console.log(`Shadow Pool Address: ${await uPool.getAddress()}`);
    console.log(`Wagmi Pool Address: ${await pPool.getAddress()}\n`);
    uPool.on("Swap", () => eventHandler(uPool, pPool, token0, token1));
    pPool.on("Swap", () => eventHandler(uPool, pPool, token0, token1));
    console.log("Waiting for swap event...\n");
};
const eventHandler = async (_uPool, _pPool, _token0, _token1) => {
    if (!isExecuting) {
        isExecuting = true;
        const priceDifference = await checkPrice([_uPool, _pPool], _token0, _token1);
        const exchangePath = await determineDirection(priceDifference);
        if (!exchangePath) {
            console.log(`No Arbitrage Currently Available\n`);
            console.log(`-----------------------------------------\n`);
            isExecuting = false;
            return;
        }
        const { isProfitable, amount } = await determineProfitability(exchangePath, _token0, _token1);
        if (!isProfitable) {
            console.log(`No Arbitrage Currently Available\n`);
            console.log(`-----------------------------------------\n`);
            isExecuting = false;
            return;
        }
        const receipt = await executeTrade(exchangePath, _token0, _token1, amount);
        isExecuting = false;
        console.log("\nWaiting for swap event...\n");
    }
};
const checkPrice = async (_pools, _token0, _token1) => {
    isExecuting = true;
    console.log(`Swap Detected, Checking Price...\n`);
    const currentBlock = await initialization_1.provider.getBlockNumber();
    const uPrice = await (0, helpers_1.calculatePrice)(_pools[0], _token0, _token1);
    const pPrice = await (0, helpers_1.calculatePrice)(_pools[1], _token0, _token1);
    const uFPrice = Number(uPrice).toFixed(UNITS);
    const pFPrice = Number(pPrice).toFixed(UNITS);
    const priceDifference = (((Number(uFPrice) - Number(pFPrice)) / Number(pFPrice)) * 100).toFixed(2);
    console.log(`Current Block: ${currentBlock}`);
    console.log(`-----------------------------------------`);
    console.log(`SHADOW     | ${_token1.symbol}/${_token0.symbol}\t | ${uFPrice}`);
    console.log(`WAGMI | ${_token1.symbol}/${_token0.symbol}\t | ${pFPrice}\n`);
    console.log(`Percentage Difference: ${priceDifference}%\n`);
    return Number(priceDifference);
};
const determineDirection = async (_priceDifference) => {
    console.log(`Determining Direction...\n`);
    if (_priceDifference >= PRICE_DIFFERENCE) {
        console.log(`Potential Arbitrage Direction:\n`);
        console.log(`Buy\t -->\t ${initialization_1.shadow.name}`);
        console.log(`Sell\t -->\t ${initialization_1.wagmi.name}\n`);
        return [initialization_1.shadow, initialization_1.wagmi];
    }
    else if (_priceDifference <= -PRICE_DIFFERENCE) {
        console.log(`Potential Arbitrage Direction:\n`);
        console.log(`Buy\t -->\t ${initialization_1.wagmi.name}`);
        console.log(`Sell\t -->\t ${initialization_1.shadow.name}\n`);
        return [initialization_1.wagmi, initialization_1.shadow];
    }
    else {
        return null;
    }
};
const determineProfitability = async (_exchangePath, _token0, _token1) => {
    console.log(`Determining Profitability...\n`);
    try {
        // Fetch liquidity off of the exchange to buy token1 from
        const liquidity = await (0, helpers_1.getPoolLiquidity)(_exchangePath[0].factory, _token0, _token1, POOL_FEE, initialization_1.provider);
        // An example of using a percentage of the liquidity
        const percentage = new big_js_1.default(0.5);
        const minAmount = new big_js_1.default(liquidity[1].toString()).mul(percentage);
        // Figure out how much token0 needed for X amount of token1...
        const quoteExactOutputSingleParams = {
            tokenIn: _token0.address,
            tokenOut: _token1.address,
            fee: POOL_FEE,
            amount: BigInt(minAmount.round().toFixed(0)),
            sqrtPriceLimitX96: 0,
        };
        const [token0Needed] = await _exchangePath[0].quoter.getFunction("quoteExactOutputSingle").staticCall(quoteExactOutputSingleParams);
        // Figure out how much token0 returned after swapping X amount of token1
        const quoteExactInputSingleParams = {
            tokenIn: _token1.address,
            tokenOut: _token0.address,
            fee: POOL_FEE,
            amountIn: BigInt(minAmount.round().toFixed(0)),
            sqrtPriceLimitX96: 0,
        };
        const [token0Returned] = await _exchangePath[1].quoter.getFunction("quoteExactOutputSingle").staticCall(quoteExactOutputSingleParams);
        const amountIn = ethers_1.ethers.formatUnits(token0Needed, _token0.decimals);
        const amountOut = ethers_1.ethers.formatUnits(token0Returned, _token0.decimals);
        console.log(`Estimated amount of ${_token0.symbol} needed to buy ${_token1.symbol} on ${_exchangePath[0].name}: ${amountIn}`);
        console.log(`Estimated amount of ${_token0.symbol} returned after swapping ${_token1.symbol} on ${_exchangePath[1].name}: ${amountOut}\n`);
        const amountDifference = Number(amountOut) - Number(amountIn);
        const estimatedGasCost = GAS_LIMIT * GAS_PRICE;
        // Fetch account
        const account = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, initialization_1.provider);
        const ethBalanceBefore = ethers_1.ethers.formatUnits(await initialization_1.provider.getBalance(account.address), 18);
        const ethBalanceAfter = Number(ethBalanceBefore) - estimatedGasCost;
        const wethBalanceBefore = Number(ethers_1.ethers.formatUnits(await _token0.contract.balanceOf(account.address), _token0.decimals));
        const wethBalanceAfter = amountDifference + wethBalanceBefore;
        const wethBalanceDifference = wethBalanceAfter - wethBalanceBefore;
        const data = {
            "ETH Balance Before": ethBalanceBefore,
            "ETH Balance After": ethBalanceAfter,
            "ETH Spent (gas)": estimatedGasCost,
            "-": {},
            "WETH Balance BEFORE": wethBalanceBefore,
            "WETH Balance AFTER": wethBalanceAfter,
            "WETH Gained/Lost": wethBalanceDifference,
            "--": {},
            "Total Gained/Lost": wethBalanceDifference - estimatedGasCost,
        };
        console.table(data);
        console.log();
        // Setup conditions...
        if (Number(amountOut) < Number(amountIn)) {
            throw new Error("Not enough to pay back flash loan");
        }
        if (Number(ethBalanceAfter) < 0) {
            throw new Error("Not enough ETH for gas fee");
        }
        return { isProfitable: true, amount: ethers_1.ethers.parseUnits(amountIn, _token0.decimals) };
    }
    catch (error) {
        console.log(error);
        console.log("");
        return { isProfitable: false, amount: 0 };
    }
};
const executeTrade = async (_exchangePath, _token0, _token1, _amount) => {
    console.log(`Attempting Arbitrage...\n`);
    const routerPath = [await _exchangePath[0].router.getAddress(), await _exchangePath[1].router.getAddress()];
    const tokenPath = [_token0.address, _token1.address];
    // Create Signer
    const account = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, initialization_1.provider);
    // Fetch token balances before
    const tokenBalanceBefore = await _token0.contract.balanceOf(account.address);
    const ethBalanceBefore = await initialization_1.provider.getBalance(account.address);
    if (config_json_1.default.PROJECT_SETTINGS.isDeployed) {
        const transaction = await initialization_1.arbitrage.connect(account).executeTrade(routerPath, tokenPath, POOL_FEE, _amount);
        const receipt = await transaction.wait(0);
    }
    console.log(`Trade Complete:\n`);
    // Fetch token balances after
    const tokenBalanceAfter = await _token0.contract.balanceOf(account.address);
    const ethBalanceAfter = await initialization_1.provider.getBalance(account.address);
    // Explicitly make sure these are treated as bigint
    const tokenBalanceDifference = BigInt(tokenBalanceAfter) - BigInt(tokenBalanceBefore);
    const ethBalanceDifference = BigInt(ethBalanceBefore) - BigInt(ethBalanceAfter);
    // Calculate the total difference, ensuring both are bigint
    const totalDifference = tokenBalanceDifference - ethBalanceDifference;
    const data = {
        "ETH Balance Before": ethers_1.ethers.formatUnits(ethBalanceBefore, 18),
        "ETH Balance After": ethers_1.ethers.formatUnits(ethBalanceAfter, 18),
        "ETH Spent (gas)": ethers_1.ethers.formatUnits(ethBalanceDifference.toString(), 18),
        "-": {},
        "WETH Balance BEFORE": ethers_1.ethers.formatUnits(tokenBalanceBefore, _token0.decimals),
        "WETH Balance AFTER": ethers_1.ethers.formatUnits(tokenBalanceAfter, _token0.decimals),
        "WETH Gained/Lost": ethers_1.ethers.formatUnits(tokenBalanceDifference.toString(), _token0.decimals),
        "--": {},
        "Total Gained/Lost": ethers_1.ethers.formatUnits(totalDifference.toString(), _token0.decimals),
    };
    console.table(data);
};
// Run the bot
main();
