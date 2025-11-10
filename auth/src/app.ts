import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import cookieSession from "cookie-session";

// Import routes here and use them
import { newUserRouter } from "./routes/newuser";


const app = express();
app.set("trust proxy", true);
app.use(json());

app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV !== "test",
  })
);

console.log("Auth service - app.ts loaded");

// Use the imported routes here
app.use(newUserRouter);


export { app };