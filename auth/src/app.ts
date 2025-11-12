import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import cookieSession from "cookie-session";

// Import routes here and use them
import { newUserRouter } from "./routes/newuser";
import { currentUserRouter } from "./routes/current-user";
import { userSignoutRouter } from "./routes/signout-user";
import { userSigninRouter } from "./routes/signin-user";

import { healthRouter } from "./routes/health";
import { errorHandler } from "./middlewares/error-handler";


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

console.log("Auth service up and running!!");
// Use the imported routes here
app.use(healthRouter);
app.use(newUserRouter);
app.use(currentUserRouter);
app.use(userSignoutRouter);
app.use(userSigninRouter);

// Error handler must be added AFTER all routes
app.use(errorHandler);

export { app };