const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const { getDbState } = require("./config/db");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  if (!env.isProduction) {
    app.use(morgan("dev"));
  }

  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      message: "InvoiceFlow API is running",
      database: getDbState(),
    });
  });

  app.use("/api", notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
