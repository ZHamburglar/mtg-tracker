import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import cookieSession from "cookie-session";
import { errorHandler } from "@mtg-tracker/common";

// Import routes here and use them
import { newUserRouter } from "./routes/newuser";
import { currentUserRouter } from "./routes/current-user";
import { userSignoutRouter } from "./routes/signout-user";
import { userSigninRouter } from "./routes/signin-user";
import { updateUserRouter } from "./routes/update-user";
import { healthRouter } from "./routes/health";

import { logger } from "./logger";


const app = express();
app.set("trust proxy", true);
app.use(json());
app.use((req, res, next) => {
  const clientIP = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  // console.log('Client IP:', clientIP);
  next();
});

app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV !== 'test', // Use HTTPS in production, HTTP in tests
    sameSite: 'none', // Allow cross-origin cookies (localhost:3000 to mtg-tracker.local)
    httpOnly: false, // Prevent XSS attacks by blocking JavaScript access
    domain: undefined, // Don't set domain - allows cookies to work from any origin when sameSite: 'none'
  })
);

const now = new Date();
const timestamp = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
logger.log(`[${timestamp}] Auth service up and running!!`);
// Use the imported routes here
app.use(healthRouter);
app.use(newUserRouter);
app.use(currentUserRouter);
app.use(userSignoutRouter);
app.use(userSigninRouter);
app.use(updateUserRouter);

// Error handler must be added AFTER all routes
app.use(errorHandler);

export { app };