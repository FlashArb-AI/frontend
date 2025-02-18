const hre = require("hardhat")
const config = require('../config.json')

// -- IMPORT HELPER FUNCTIONS & CONFIG -- //
const { getTokenAndContract, getPoolContract, calculatePrice } = require('../helpers/helpers.cjs')
const { provider, wagmi, spooky } = require('../helpers/initialization.cjs')

// -- CONFIGURE VALUES HERE -- //
const EXCHANGE_TO_USE = wagmi; // Use Spooky or Wagmi
const UNLOCKED_ACCOUNT = "0xb38A90f14b24ae81Ec0B8f1373694f5B59811D8A"; // Account to impersonate
const AMOUNT = "50"; // Amount of tokens to swap

async function main() {
    // Fetch contracts
    const {
        token0: ARB_AGAINST,
        token1: ARB_FOR
    } = await getTokenAndContract(config.TOKENS.ARB_AGAINST, config.TOKENS.ARB_FOR, provider)

    const pool = await getPoolContract(EXCHANGE_TO_USE, ARB_AGAINST.address, ARB_FOR.address, config.TOKENS.POOL_FEE, provider)

    // Fetch price of SHIB/WETH before we execute the swap
    const priceBefore = await calculatePrice(pool, ARB_AGAINST, ARB_FOR)

    // Send ETH to account to ensure they have enough ETH to create the transaction
    await (await hre.ethers.getSigners())[0].sendTransaction({
        to: UNLOCKED_ACCOUNT,
        value: hre.ethers.parseUnits('1', 18)
    })

    await manipulatePrice([ARB_AGAINST, ARB_FOR])

    // Fetch price of SHIB/WETH after the swap
    const priceAfter = await calculatePrice(pool, ARB_AGAINST, ARB_FOR)

    const data = {
        'Price Before': `1 ${ARB_FOR.symbol} = ${Number(priceBefore).toFixed(0)} ${ARB_AGAINST.symbol}`,
        'Price After': `1 ${ARB_FOR.symbol} = ${Number(priceAfter).toFixed(0)} ${ARB_AGAINST.symbol}`,
    }

    console.table(data)
}

async function manipulatePrice(_path) {
    console.log(`\nBeginning Swap...\n`);
    console.log(`Input Token: ${_path[0].symbol}`);
    console.log(`Output Token: ${_path[1].symbol}\n`);
  
    const fee = config.TOKENS.POOL_FEE;
    const amount = hre.ethers.parseUnits(AMOUNT, _path[0].decimals);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  
    // Impersonate the unlocked account
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [UNLOCKED_ACCOUNT],
    });
  
    // Get the signer for the unlocked account
    const signer = await hre.ethers.provider.getSigner(UNLOCKED_ACCOUNT);
    console.log("Signer Address:", await signer.getAddress());
  
    // Check balances
    const ethBalance = await provider.getBalance(UNLOCKED_ACCOUNT);
    const tokenInBalance = await _path[0].contract.balanceOf(UNLOCKED_ACCOUNT);
    console.log(`ETH Balance: ${ethers.formatUnits(ethBalance, 18)}`);
    console.log(`${_path[0].symbol} Balance: ${ethers.formatUnits(tokenInBalance, _path[0].decimals)}\n`);
  
    // Approve the router to spend tokens
    const routerAddress = await EXCHANGE_TO_USE.router.getAddress();
    const approvalTx = await _path[0].contract.connect(signer).approve(routerAddress, amount, { gasLimit: 300_000 });
    await approvalTx.wait();
    console.log("Approval confirmed\n");
  
    // Check allowance
    const allowance = await _path[0].contract.allowance(UNLOCKED_ACCOUNT, routerAddress);
    console.log(`Allowance: ${ethers.formatUnits(allowance, _path[0].decimals)}\n`);
  
    const exactInputSingleParams = {
        tokenIn: _path[0].address,
        tokenOut: _path[1].address,
        fee: config.TOKENS.POOL_FEE,
        recipient: signer.address,
        amountIn: ethers.parseUnits(AMOUNT, _path[0].decimals),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
    };
    
    try {
        const swapTx = await EXCHANGE_TO_USE.router.connect(signer).exactInputSingle(
            exactInputSingleParams,
            {
                gasLimit: 2_000_000,
                value: ethers.parseUnits("0.1", 18)
            }
        );
        const receipt = await swapTx.wait();
        console.log("Swap Successful! Tx Hash:", receipt.hash);
    } catch (error) {
        console.error("Swap Failed:", error);
        
        if (error.code && error.code === 'CALL_EXCEPTION') {
            try {
                // Try to simulate the call to get more detailed error
                await EXCHANGE_TO_USE.router.connect(signer).exactInputSingle.staticCall(
                    exactInputSingleParams,
                    {
                        gasLimit: 2_000_000,
                        value: ethers.parseUnits("0.1", 18)
                    }
                );
            } catch (staticCallError) {
                console.error("Static call error details:", staticCallError.reason);
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});