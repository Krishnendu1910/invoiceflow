const env = require("./config/env");
const { connectDB, disconnectDB } = require("./config/db");
const createApp = require("./app");

async function start() {
  await connectDB();

  const app = createApp();

  const httpServer = app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);

    httpServer.close(async () => {
      console.log("HTTP server closed");

      try {
        await disconnectDB();
      } finally {
        process.exit(0);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
