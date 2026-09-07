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

const credentials = { name: "Ada Lovelace", email: "ada@example.com", password: "correct-horse-1" };

describe("GET /api/auth/config", () => {
  it("reports Google sign-in as disabled when no credentials are configured", async () => {
    const res = await request(app).get("/api/auth/config");
    expect(res.status).toBe(200);
    expect(res.body.data.googleEnabled).toBe(false);
  });
});

describe("POST /api/auth/register", () => {
  it("creates a new unverified account", async () => {
    const res = await request(app).post("/api/auth/register").send(credentials);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(credentials.email);
    expect(res.body.data.user.isEmailVerified).toBe(false);
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app).post("/api/auth/register").send(credentials);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...credentials, password: "short" });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid email address", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...credentials, email: "not-an-email" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(credentials);
  });

  it("logs in with correct credentials and sets a refresh cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.headers["set-cookie"].some((c) => c.startsWith("invoiceflow_refresh_token="))).toBe(true);
  });

  it("rejects an invalid password with a generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password.");
  });

  it("rejects a nonexistent email with the same generic message (no enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password.");
  });
});

describe("GET /api/auth/me", () => {
  it("rejects a request with no access token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed/invalid access token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns the authenticated user for a valid access token", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(credentials.email);
    expect(res.body.data.user.hasPassword).toBe(true);
  });
});

describe("POST /api/auth/logout and /logout-all", () => {
  async function registerAndLogin(agentCredentials = credentials) {
    await request(app).post("/api/auth/register").send(agentCredentials);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: agentCredentials.email, password: agentCredentials.password });
    return login;
  }

  it("revokes the current session so its refresh cookie can no longer be used", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(credentials);
    await agent.post("/api/auth/login").send({ email: credentials.email, password: credentials.password });

    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);

    const refreshRes = await agent.post("/api/auth/refresh");
    expect(refreshRes.status).toBe(401);
  });

  it("logout-all revokes every session for the user, not just the current one", async () => {
    const login = await registerAndLogin();
    const accessToken = login.body.data.accessToken;

    // Simulate a second device/session by logging in again.
    const secondAgent = request.agent(app);
    await secondAgent.post("/api/auth/login").send({ email: credentials.email, password: credentials.password });

    const logoutAllRes = await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(logoutAllRes.status).toBe(200);

    const secondRefresh = await secondAgent.post("/api/auth/refresh");
    expect(secondRefresh.status).toBe(401);
  });

  it("logout-all requires authentication", async () => {
    const res = await request(app).post("/api/auth/logout-all");
    expect(res.status).toBe(401);
  });
});
