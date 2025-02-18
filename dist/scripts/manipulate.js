"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const config_json_1 = __importDefault(require("../config.json"));
const helpers_1 = require("../helpers/helpers");
const initialization_1 = require("../helpers/initialization");
// -- CONFIGURE VALUES HERE -- //
const EXCHANGE_TO_USE = initialization_1.wagmi; // Use Shadow or Wagmi
const UNLOCKED_ACCOUNT = "0x5f81Ad8264B6fa7b02D5C0Ee1cc8EaEc5162b00A"; // Account to impersonate
const AMOUNT = "200"; // Amount of tokens to swap
async function main() {
    // Fetch contracts
    const { token0: ARB_AGAINST, token1: ARB_FOR } = await (0, helpers_1.getTokenAndContract)(config_json_1.default.TOKENS.ARB_AGAINST, config_json_1.default.TOKENS.ARB_FOR, initialization_1.provider);
    const pool = await (0, helpers_1.getPoolContract)(EXCHANGE_TO_USE, ARB_AGAINST.address, ARB_FOR.address, config_json_1.default.TOKENS.POOL_FEE, initialization_1.provider);
    // Fetch price before the swap
    const priceBefore = await (0, helpers_1.calculatePrice)(pool, ARB_AGAINST, ARB_FOR);
    // Send ETH to the unlocked account to cover gas fees
    const [signer] = await hardhat_1.ethers.getSigners();
    await signer.sendTransaction({
        to: UNLOCKED_ACCOUNT,
        value: hardhat_1.ethers.parseEther("1"), // Send 1 ETH
    });
    // Manipulate the price
    await manipulatePrice([ARB_AGAINST, ARB_FOR]);
    // Fetch price after the swap
    const priceAfter = await (0, helpers_1.calculatePrice)(pool, ARB_AGAINST, ARB_FOR);
    // Log the results
    const data = {
        "Price Before": `1 ${ARB_FOR.symbol} = ${Number(priceBefore).toFixed(0)} ${ARB_AGAINST.symbol}`,
        "Price After": `1 ${ARB_FOR.symbol} = ${Number(priceAfter).toFixed(0)} ${ARB_AGAINST.symbol}`,
    };
    console.table(data);
}
async function manipulatePrice(_path) {
    console.log(`\nBeginning Swap...\n`);
    console.log(`Input Token: ${_path[0].symbol}`);
    console.log(`Output Token: ${_path[1].symbol}\n`);
    const fee = config_json_1.default.TOKENS.POOL_FEE;
    const amount = hardhat_1.ethers.parseUnits(AMOUNT, _path[0].decimals);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    // Impersonate the unlocked account
    await hardhat_1.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [UNLOCKED_ACCOUNT],
    });
    const signer = await hardhat_1.ethers.getSigner(UNLOCKED_ACCOUNT);
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
    const swap = await EXCHANGE_TO_USE.router
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
