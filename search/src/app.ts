import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import cookieSession from "cookie-session";

import { errorHandler} from "@mtg-tracker/common"

// Import routes here and use them
import { healthRouter } from "./routes/health";
import { searchRouter } from "./routes/search";
import { trendingRouter } from "./routes/trending";

// Import logger
import { logger } from "./logger";

const app = express();
app.set("trust proxy", true);
app.use(json());
app.use((req, res, next) => {
  const clientIP = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  // logger.info('Client IP:', clientIP);
  next();
});

app.use(
  cookieSession({
    signed: false,
    secure: false, // Set to false to allow cookies over HTTP in dev
    sameSite: 'lax', // Allow cookies to be sent with cross-origin requests
    // Set to true for production
    httpOnly: false, // Prevent XSS attacks by blocking JavaScript access
  })
);

const now = new Date();
const timestamp = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
logger.log(`[${timestamp}] Search service up and running!!`);
// Use the imported routes here
app.use(healthRouter);
app.use(trendingRouter);
app.use(searchRouter);

// Error handler must be added AFTER all routes
app.use(errorHandler);

export { app };