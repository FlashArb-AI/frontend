"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("@nomicfoundation/hardhat-toolbox");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const privateKey = process.env.PRIVATE_KEY || "";
const config = {
    solidity: "0.8.18",
    networks: {
        hardhat: {
            forking: {
                url: `https://sonic-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
                blockNumber: 8368000,
            },
        },
    },
};
exports.default = config;
