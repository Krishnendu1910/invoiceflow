const express = require("express");
const rateLimit = require("express-rate-limit");
const request = require("supertest");

// The application's real auth rate limiters are disabled under NODE_ENV=test
// (see src/middleware/rateLimit.js) so the rest of the suite isn't throttled
// against itself. This test exercises express-rate-limit directly, using the
// exact same construction the app uses, to prove the mechanism itself works.
describe("rate limiting", () => {
  it("returns 429 after the configured request limit is exceeded within the window", async () => {
    const app = express();
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      limit: 3,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => res.status(429).json({ success: false, message: "Too many requests. Please try again later." }),
    });
    app.use("/test", limiter, (req, res) => res.json({ success: true }));

    const agent = request.agent(app);

    for (let i = 0; i < 3; i += 1) {
      const res = await agent.get("/test");
      expect(res.status).toBe(200);
    }

    const blocked = await agent.get("/test");
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many requests/i);
  });
});
