import express from "express";
import path from "path";
import http from "http";
import cors from "cors";

const PORT = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app).listen(PORT, () => console.log(`Listening on ${PORT}\n`));

app.use(express.static(path.join(__dirname, "public")));
app.use(cors({ credentials: true, origin: "*" }));