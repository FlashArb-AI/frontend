import { ethers, network } from "hardhat";
import config from "../config.json";
import { getTokenAndContract, getPoolContract, calculatePrice } from "../helpers/helpers";
import { provider, shadow, wagmi } from "../helpers/initialization";
import { ISwapRouter as ISwapRouterType } from "../typechain-types/@uniswap/v3-periphery/contracts/interfaces/ISwapRouter"; // Import TypeChain type

// -- CONFIGURE VALUES HERE -- //
const EXCHANGE_TO_USE = wagmi; // Use Shadow or Wagmi
const UNLOCKED_ACCOUNT = "0xB38e8c17e38363aF6EbdCb3dAE12e0243582891D"; // Account to impersonate
const AMOUNT = "10000"; // Amount of tokens to swap

async function main() {
    // Fetch contracts
    const { token0: ARB_AGAINST, token1: ARB_FOR } = await getTokenAndContract(
        config.TOKENS.ARB_AGAINST,
        config.TOKENS.ARB_FOR,
        provider
    );

    const pool = await getPoolContract(
        EXCHANGE_TO_USE,
        ARB_AGAINST.address,
        ARB_FOR.address,
        config.TOKENS.POOL_FEE,
        provider
    );

    // Fetch price before the swap
    const priceBefore = await calculatePrice(pool, ARB_AGAINST, ARB_FOR);

    // Send ETH to the unlocked account to cover gas fees
    const [signer] = await ethers.getSigners();
    await signer.sendTransaction({
        to: UNLOCKED_ACCOUNT,
        value: ethers.parseEther("1"), // Send 1 ETH
    });

    // Manipulate the price
    await manipulatePrice([ARB_AGAINST, ARB_FOR]);

    // Fetch price after the swap
    const priceAfter = await calculatePrice(pool, ARB_AGAINST, ARB_FOR);

    // Log the results
    const data = {
        "Price Before": `1 ${ARB_FOR.symbol} = ${Number(priceBefore).toFixed(0)} ${ARB_AGAINST.symbol}`,
        "Price After": `1 ${ARB_FOR.symbol} = ${Number(priceAfter).toFixed(0)} ${ARB_AGAINST.symbol}`,
    };

    console.table(data);
}

async function manipulatePrice(_path: any[]) {
    console.log(`\nBeginning Swap...\n`);

    console.log(`Input Token: ${_path[0].symbol}`);
    console.log(`Output Token: ${_path[1].symbol}\n`);

    const fee = config.TOKENS.POOL_FEE;
    const amount = ethers.parseUnits(AMOUNT, _path[0].decimals);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

    // Impersonate the unlocked account
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [UNLOCKED_ACCOUNT],
    });

    const signer = await ethers.getSigner(UNLOCKED_ACCOUNT);

    // Approve the router to spend tokens
    const routerAddress = await EXCHANGE_TO_USE.router.getAddress(); // Use getAddress() instead of .address
    const approval = await _path[0].contract
        .connect(signer)
        .approve(routerAddress, amount, { gasLimit: 125000 });
    await approval.wait();

    // Perform the swap
    const ExactInputSingleParams = {
        tokenIn: _path[0].address,
        tokenOut: _path[1].address,
        fee: fee,
        recipient: signer.address,
        deadline: deadline,
        amountIn: amount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
    };

    const swap = await (EXCHANGE_TO_USE.router as ISwapRouterType)
        .connect(signer)
        .exactInputSingle(ExactInputSingleParams);
    await swap.wait();

    console.log(`Swap Complete!\n`);
}

// Run the script
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});