const request = require("supertest");
const testDb = require("./testDb");
const createApp = require("../src/app");

let app;

beforeAll(async () => {
  await testDb.connect();
  app = createApp();
});

afterAll(async () => {
  await testDb.disconnect();
});

afterEach(async () => {
  await testDb.clear();
});

const credentials = { name: "Grace Hopper", email: "grace@example.com", password: "compiler-lady-1" };

function extractCookie(res) {
  return res.headers["set-cookie"].find((c) => c.startsWith("invoiceflow_refresh_token="));
}

describe("POST /api/auth/refresh", () => {
  it("rejects a refresh request with no cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("issues a new access token and rotates the refresh cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(credentials);
    const login = await agent.post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    const firstCookie = extractCookie(login);

    const refreshRes = await agent.post("/api/auth/refresh");
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));

    const rotatedCookie = extractCookie(refreshRes);
    expect(rotatedCookie).not.toBe(firstCookie);
  });

  it("detects replay of an already-rotated refresh token and revokes the whole session family", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(credentials);
    const login = await agent.post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    const originalCookie = extractCookie(login);

    // Normal rotation: the agent's cookie jar now holds the new (second) token.
    const firstRefresh = await agent.post("/api/auth/refresh");
    expect(firstRefresh.status).toBe(200);

    // Replay the original (now-revoked) refresh token directly.
    const replayRes = await request(app).post("/api/auth/refresh").set("Cookie", originalCookie);
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.message).toMatch(/already been used/i);

    // Because reuse was detected, the whole session family — including the
    // token issued by the legitimate rotation above — must now be dead.
    const secondRefresh = await agent.post("/api/auth/refresh");
    expect(secondRefresh.status).toBe(401);
  });

  it("rejects a garbage/invalid refresh token", async () => {
    const res = await request(app).post("/api/auth/refresh").set("Cookie", "invoiceflow_refresh_token=not-a-real-token");
    expect(res.status).toBe(401);
  });
});
