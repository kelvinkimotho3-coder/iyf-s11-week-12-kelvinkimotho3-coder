import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { attachSession, authRouter } from "../auth";
import { appRouter, createContext } from "../routers";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(attachSession);

app.use("/api/auth", authRouter);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`TechHub server listening on port ${port}`);
});
