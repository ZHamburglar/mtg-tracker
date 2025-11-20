import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import cookieSession from "cookie-session";

import { errorHandler } from "@mtg-tracker/common"

// Import routes here and use them
import { healthRouter } from "./routes/health";
import { listingRouter } from "./routes/listing";

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
    secure: false, // Set to false to allow cookies over HTTP in dev
    sameSite: 'lax', // Allow cookies to be sent with cross-origin requests
    httpOnly: true, // Prevent JavaScript access to cookies for security
  })
);

console.log("Listing service up and running!!");
// Use the imported routes here
app.use(healthRouter);
app.use(listingRouter);

// Error handler must be added AFTER all routes
app.use(errorHandler);

export { app };