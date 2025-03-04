// -- HANDLE INITIAL SETUP -- //
require("dotenv").config()
require('./helpers/server.cjs')

const Big = require('big.js')

const ethers = require("ethers")
const config = require('./config.json')
const { getTokenAndContract, getPoolContract, getPoolLiquidity, calculatePrice } = require('./helpers/helpers.cjs')
const { provider, uniswap, spooky, wagmi, shadow, arbitrage } = require('./helpers/initialization.cjs')

// -- CONFIGURATION VALUES HERE -- //
const ARB_FOR = config.TOKENS.ARB_FOR
const ARB_AGAINST = config.TOKENS.ARB_AGAINST
const POOL_FEE = config.TOKENS.POOL_FEE
const UNITS = config.PROJECT_SETTINGS.PRICE_UNITS
const PRICE_DIFFERENCE = config.PROJECT_SETTINGS.PRICE_DIFFERENCE
const GAS_LIMIT = config.PROJECT_SETTINGS.GAS_LIMIT
const GAS_PRICE = config.PROJECT_SETTINGS.GAS_PRICE

let isExecuting = false

const main = async () => {
    const { token0, token1 } = await getTokenAndContract(ARB_FOR, ARB_AGAINST, provider)
    const uPool = await getPoolContract(uniswap, token0.address, token1.address, POOL_FEE, provider)
    const pPool = await getPoolContract(wagmi, token0.address, token1.address, POOL_FEE, provider)

    console.log(`Using ${token1.symbol}/${token0.symbol}\n`)

    console.log(`Uniswap Pool Address: ${await uPool.getAddress()}`)
    console.log(`Wagmi Pool Address: ${await pPool.getAddress()}\n`)

    uPool.on('Swap', () => eventHandler(uPool, pPool, token0, token1))
    pPool.on('Swap', () => eventHandler(uPool, pPool, token0, token1))

    console.log("Waiting for swap event...\n")
}

const eventHandler = async (_uPool, _pPool, _token0, _token1) => {
    if (!isExecuting) {
        isExecuting = true;

        const priceData = await checkPrice([_uPool, _pPool], _token0, _token1);
        if (!priceData) {
            console.log(`Failed to get price data\n`);
            console.log(`-----------------------------------------\n`);
            isExecuting = false;
            return;
        }

        const arbitrageInfo = await determineDirection(priceData);
        if (!arbitrageInfo) {
            console.log(`No Arbitrage Currently Available\n`);
            console.log(`-----------------------------------------\n`);
            isExecuting = false;
            return;
        }

        const { isProfitable, amount } = await determineProfitability(
            arbitrageInfo.path,
            _token0,
            _token1
        );

        if (!isProfitable) {
            console.log(`No Arbitrage Currently Available\n`);
            console.log(`-----------------------------------------\n`);
            isExecuting = false;
            return;
        }

        const receipt = await executeTrade(arbitrageInfo.path, _token0, _token1, amount, { gasLimit: GAS_LIMIT });
        isExecuting = false;

        console.log("\nWaiting for swap event...\n");
    }
};

const checkPrice = async (_pools, _token0, _token1) => {
    isExecuting = true;
    console.log(`Swap Detected, Checking Price...\n`);

    const currentBlock = await provider.getBlockNumber();

    const uPrice = await calculatePrice(_pools[0], _token0, _token1);
    const pPrice = await calculatePrice(_pools[1], _token0, _token1);

    if (!uPrice || !pPrice || isNaN(Number(uPrice)) || isNaN(Number(pPrice))) {
        console.error("Error: One or both pool prices are invalid!");
        return null;
    }

    const uFPrice = Number(uPrice).toFixed(UNITS);
    const pFPrice = Number(pPrice).toFixed(UNITS);
    
    // Calculate both directions
    const uniswapToWagmi = (((pFPrice - uFPrice) / uFPrice) * 100).toFixed(2);
    const wagmiToUniswap = (((uFPrice - pFPrice) / pFPrice) * 100).toFixed(2);

    console.log(`Current Block: ${currentBlock}`);
    console.log(`-----------------------------------------`);
    console.log(`UNISWAP     | ${_token1.symbol}/${_token0.symbol} | ${uFPrice}`);
    console.log(`WAGMI      | ${_token1.symbol}/${_token0.symbol} | ${pFPrice}\n`);
    console.log(`Uniswap -> Wagmi Difference: ${uniswapToWagmi}%`);
    console.log(`Wagmi -> Uniswap Difference: ${wagmiToUniswap}%\n`);

    // Return all price info for better decision making
    return { 
        uniswapToWagmi, 
        wagmiToUniswap,
        uFPrice,
        pFPrice
    };
};

const determineDirection = async (priceData) => {
    console.log(`Determining Direction...\n`);

    const { uniswapToWagmi, wagmiToUniswap } = priceData;

    // Check Uniswap -> Wagmi direction
    if (Number(uniswapToWagmi) >= PRICE_DIFFERENCE) {
        console.log(`Potential Arbitrage Direction:\n`);
        console.log(`Buy\t -->\t ${uniswap.name}`);
        console.log(`Sell\t -->\t ${wagmi.name}\n`);
        console.log(`Expected Profit: ${uniswapToWagmi}%\n`);
        return { 
            path: [uniswap, wagmi],
            profitPercentage: uniswapToWagmi
        };
    }
    // Check Wagmi -> Uniswap direction
    else if (Number(wagmiToUniswap) >= PRICE_DIFFERENCE) {
        console.log(`Potential Arbitrage Direction:\n`);
        console.log(`Buy\t -->\t ${wagmi.name}`);
        console.log(`Sell\t -->\t ${uniswap.name}\n`);
        console.log(`Expected Profit: ${wagmiToUniswap}%\n`);
        return {
            path: [wagmi, uniswap],
            profitPercentage: wagmiToUniswap
        };
    }
    // No arbitrage opportunity
    else {
        console.log(`No arbitrage opportunity available (threshold: ${PRICE_DIFFERENCE}%)\n`);
        return null;
    }
};

const determineProfitability = async (_exchangePath, _token0, _token1) => {
    console.log(`🔍 Detailed Profitability Analysis...\n`);

    try {
        // Get pool liquidity
        const liquidity = await getPoolLiquidity(_exchangePath[0].factory, _token0, _token1, POOL_FEE, provider);
        console.log(`📊 Pool Liquidity for ${_token1.symbol}: ${ethers.formatUnits(liquidity[1], _token1.decimals)}`);

        // Reduce trade amount to minimize slippage
        const percentage = Big(0.25); // 25% of pool liquidity
        const minAmount = Big(liquidity[1]).mul(percentage);

        // Diagnostic logging of initial amount
        console.log(`🔢 Trade Amount: ${minAmount.toString()} ${_token1.symbol}`);

        // Get current gas price
        const feeData = await provider.getFeeData();
        const dynamicGasPrice = feeData.gasPrice || BigInt(GAS_PRICE);
        const estimatedGasCost = Big(ethers.formatUnits(dynamicGasPrice * BigInt(GAS_LIMIT), 18));
        console.log(`⛽ Estimated Gas Cost: ${estimatedGasCost.toString()} ETH`);

        // Quote: Buy token1 with token0 (exactOutput)
        const quoteExactOutputSingleParams = {
            tokenIn: _token0.address,
            tokenOut: _token1.address,
            fee: POOL_FEE,
            amount: BigInt(minAmount.toFixed(0)),
            sqrtPriceLimitX96: 0
        };

        const [token0Needed] = await _exchangePath[0].quoter.quoteExactOutputSingle.staticCall(
            quoteExactOutputSingleParams
        );

        // Quote: Sell token1 for token0 (exactInput)
        const quoteExactInputSingleParams = {
            tokenIn: _token1.address,
            tokenOut: _token0.address,
            fee: POOL_FEE,
            amountIn: BigInt(minAmount.toFixed(0)),
            sqrtPriceLimitX96: 0
        };

        const [token0Returned] = await _exchangePath[1].quoter.quoteExactInputSingle.staticCall(
            quoteExactInputSingleParams
        );

        // Convert amounts with precise decimal handling
        const amountIn = Big(ethers.formatUnits(token0Needed, _token0.decimals));
        const amountOut = Big(ethers.formatUnits(token0Returned, _token0.decimals));

        // Detailed logging of swap amounts
        console.log(`💸 Amount In:  ${amountIn.toString()} ${_token0.symbol}`);
        console.log(`💰 Amount Out: ${amountOut.toString()} ${_token0.symbol}`);

        // Calculate profit and margins
        const amountDifference = amountOut.minus(amountIn);
        const profitMargin = amountDifference.div(amountIn).mul(100);

        console.log(`📈 Raw Profit Difference: ${amountDifference.toString()} ${_token0.symbol}`);
        console.log(`📊 Profit Margin: ${profitMargin.toFixed(4)}%`);

        // Comprehensive trade analysis
        const tradeAnalysis = {
            'Initial Trade Amount': `${minAmount.toString()} ${_token1.symbol}`,
            'Amount In': `${amountIn.toString()} ${_token0.symbol}`,
            'Amount Out': `${amountOut.toString()} ${_token0.symbol}`,
            'Raw Profit': `${amountDifference.toString()} ${_token0.symbol}`,
            'Profit Margin': `${profitMargin.toFixed(4)}%`,
            'Gas Cost': `${estimatedGasCost.toString()} S`
        };

        console.table(tradeAnalysis);

        // Remove strict profitability condition
        const isProfitable = amountOut.gt(amountIn);

        if (isProfitable) {
            console.log(`✅ Profitable Trade Detected!\n`);
            return { 
                isProfitable: true, 
                amount: BigInt(minAmount.toFixed(0)) 
            };
        }

        console.log(`❌ Trade Not Profitable. Skipping...\n`);
        return { isProfitable: false, amount: BigInt(0) };

    } catch (error) {
        console.error("Profitability Determination Error:", error);
        return { isProfitable: false, amount: BigInt(0) };
    }
};

const executeTrade = async (_exchangePath, _token0, _token1, _amount) => {
    console.log(`Attempting Arbitrage...\n`);

    const routerPath = [
        await _exchangePath[0].router.getAddress(),
        await _exchangePath[1].router.getAddress()
    ];

    const tokenPath = [
        _token0.address,
        _token1.address
    ];

    // Create Signer
    const account = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Fetch token balances before
    const tokenBalanceBefore = await _token0.contract.balanceOf(account.address);
    const sBalanceBefore = await provider.getBalance(account.address);

    console.log(`Account balance: ${ethers.formatUnits(sBalanceBefore, 18)} S`);

    if (config.PROJECT_SETTINGS.isDeployed) {
        try {
            // Approve tokens if necessary
            const token0Contract = new ethers.Contract(_token0.address, IERC20.abi, account);
            const allowance = await token0Contract.allowance(account.address, arbitrage.address);
            if (allowance.lt(_amount)) {
                console.log("Approving tokens...");
                const tx = await token0Contract.approve(arbitrage.address, _amount);
                await tx.wait();
            }

            // Execute trade
            const transaction = await arbitrage.connect(account).executeTrade(
                routerPath,
                tokenPath,
                POOL_FEE,
                _amount,
                { gasLimit: GAS_LIMIT }
            );

            const receipt = await transaction.wait();
            console.log("Trade executed successfully:", receipt);
        } catch (error) {
            console.error("Error executing trade:", error);
            throw error; // Re-throw the error to stop further execution
        }
    }

    console.log(`Trade Complete:\n`);

    // Fetch token balances after
    const tokenBalanceAfter = await _token0.contract.balanceOf(account.address);
    const sBalanceAfter = await provider.getBalance(account.address);

    const tokenBalanceDifference = tokenBalanceAfter - tokenBalanceBefore;
    const sBalanceDifference = sBalanceBefore - sBalanceAfter;

    const data = {
        'S Balance Before': ethers.formatUnits(sBalanceBefore, 18),
        'S Balance After': ethers.formatUnits(sBalanceAfter, 18),
        'S Spent (gas)': ethers.formatUnits(sBalanceDifference.toString(), 18),
        '-': {},
        'WETH Balance BEFORE': ethers.formatUnits(tokenBalanceBefore, _token0.decimals),
        'WETH Balance AFTER': ethers.formatUnits(tokenBalanceAfter, _token0.decimals),
        'WETH Gained/Lost': ethers.formatUnits(tokenBalanceDifference.toString(), _token0.decimals),
        '-': {},
        'Total Gained/Lost': `${ethers.formatUnits((tokenBalanceDifference - sBalanceDifference).toString(), _token0.decimals)}`
    };

    console.table(data);
};

main()