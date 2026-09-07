jest.mock("../src/services/email/email.service", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ skipped: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ skipped: true }),
}));

const request = require("supertest");
const testDb = require("./testDb");
const createApp = require("../src/app");
const emailService = require("../src/services/email/email.service");
const EmailToken = require("../src/models/EmailToken");
const { hashToken } = require("../src/utils/secureToken");

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
  jest.clearAllMocks();
});

const credentials = { name: "Katherine Johnson", email: "katherine@example.com", password: "hidden-figure-1" };

async function expireToken(rawToken) {
  await EmailToken.updateOne({ tokenHash: hashToken(rawToken) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
}

describe("email verification", () => {
  it("verifies an account with a valid token", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const rawToken = emailService.sendVerificationEmail.mock.calls[0][1];

    const res = await request(app).post("/api/auth/verify-email").send({ token: rawToken });
    expect(res.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(me.body.data.user.isEmailVerified).toBe(true);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app).post("/api/auth/verify-email").send({ token: "totally-made-up" });
    expect(res.status).toBe(400);
  });

  it("rejects an expired token", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const rawToken = emailService.sendVerificationEmail.mock.calls[0][1];
    await expireToken(rawToken);

    const res = await request(app).post("/api/auth/verify-email").send({ token: rawToken });
    expect(res.status).toBe(400);
  });

  it("rejects reusing an already-consumed token", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const rawToken = emailService.sendVerificationEmail.mock.calls[0][1];

    await request(app).post("/api/auth/verify-email").send({ token: rawToken });
    const res = await request(app).post("/api/auth/verify-email").send({ token: rawToken });
    expect(res.status).toBe(400);
  });

  it("resend-verification returns a generic response whether or not the account exists", async () => {
    await request(app).post("/api/auth/register").send(credentials);

    const existing = await request(app).post("/api/auth/resend-verification").send({ email: credentials.email });
    const missing = await request(app).post("/api/auth/resend-verification").send({ email: "nobody@example.com" });

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(existing.body.message).toBe(missing.body.message);
  });
});

describe("password reset", () => {
  it("forgot-password returns a generic response whether or not the account exists", async () => {
    await request(app).post("/api/auth/register").send(credentials);

    const existing = await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    const missing = await request(app).post("/api/auth/forgot-password").send({ email: "nobody@example.com" });

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(existing.body.message).toBe(missing.body.message);
  });

  it("resets the password with a valid token and revokes existing sessions", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(credentials);
    await agent.post("/api/auth/login").send({ email: credentials.email, password: credentials.password });

    await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    const rawToken = emailService.sendPasswordResetEmail.mock.calls[0][1];

    const newPassword = "brand-new-password-1";
    const resetRes = await request(app).post("/api/auth/reset-password").send({ token: rawToken, password: newPassword });
    expect(resetRes.status).toBe(200);

    // Old session must be dead.
    const refreshRes = await agent.post("/api/auth/refresh");
    expect(refreshRes.status).toBe(401);

    // Old password no longer works, new password does.
    const oldLogin = await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/auth/login").send({ email: credentials.email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });

  it("rejects an invalid reset token", async () => {
    const res = await request(app).post("/api/auth/reset-password").send({ token: "made-up", password: "whatever123" });
    expect(res.status).toBe(400);
  });

  it("rejects an expired reset token", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    const rawToken = emailService.sendPasswordResetEmail.mock.calls[0][1];
    await expireToken(rawToken);

    const res = await request(app).post("/api/auth/reset-password").send({ token: rawToken, password: "whatever123" });
    expect(res.status).toBe(400);
  });

  it("rejects a new password shorter than 8 characters", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    const rawToken = emailService.sendPasswordResetEmail.mock.calls[0][1];

    const res = await request(app).post("/api/auth/reset-password").send({ token: rawToken, password: "short" });
    expect(res.status).toBe(400);
  });
});
