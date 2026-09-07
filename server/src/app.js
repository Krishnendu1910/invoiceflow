const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const env = require("./config/env");
const { getDbState } = require("./config/db");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth.routes");
const businessRoutes = require("./routes/business.routes");

function createApp() {
  const app = express();

  // Required for express-rate-limit to key on the real client IP when the
  // app runs behind a reverse proxy/load balancer in production.
  app.set("trust proxy", env.isProduction ? 1 : false);

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  if (!env.isProduction && !env.isTest) {
    app.use(morgan("dev"));
  }

  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      message: "InvoiceFlow API is running",
      database: getDbState(),
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/businesses", businessRoutes);

  app.use("/api", notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
