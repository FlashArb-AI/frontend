"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const PORT = process.env.PORT || 5000;
const app = (0, express_1.default)();
const server = http_1.default.createServer(app).listen(PORT, () => console.log(`Listening on ${PORT}\n`));
app.use(express_1.default.static(path_1.default.join(__dirname, "public")));
app.use((0, cors_1.default)({ credentials: true, origin: "*" }));
