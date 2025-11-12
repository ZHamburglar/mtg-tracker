import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import cookieSession from "cookie-session";

// Import routes here and use them
import { newUserRouter } from "./routes/newuser";
import { healthRouter } from "./routes/health";


const app = express();
app.set("trust proxy", true);
app.use(json());
app.use((req, res, next) => {
  const clientIP = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log('Client IP:', clientIP);
  next();
});

app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV !== "test",
  })
);

console.log("Auth service up and running!!");
// Use the imported routes here
app.use(healthRouter);
app.use(newUserRouter);


export { app };