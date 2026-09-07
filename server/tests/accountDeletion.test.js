jest.mock("../src/services/email/email.service", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ skipped: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ skipped: true }),
}));

const request = require("supertest");
const testDb = require("./testDb");
const createApp = require("../src/app");
const User = require("../src/models/User");
const RefreshSession = require("../src/models/RefreshSession");
const Business = require("../src/models/Business");
const EmailToken = require("../src/models/EmailToken");
const emailService = require("../src/services/email/email.service");

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

const credentials = { name: "Delete Me", email: "deleteme@example.com", password: "goodbye-password-1" };

describe("DELETE /api/auth/account", () => {
  it("requires authentication", async () => {
    const res = await request(app).delete("/api/auth/account");
    expect(res.status).toBe(401);
  });

  it("refuses to delete without the correct password", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const login = await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });

    const res = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`)
      .send({ password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(await User.findOne({ email: credentials.email })).not.toBeNull();
  });

  it("permanently deletes the user and all associated data", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const rawToken = emailService.sendVerificationEmail.mock.calls[0][1];
    await request(app).post("/api/auth/verify-email").send({ token: rawToken });

    const login = await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    const accessToken = login.body.data.accessToken;
    const userId = login.body.data.user.id;

    await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Doomed Business" });

    const res = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password: credentials.password });

    expect(res.status).toBe(200);

    expect(await User.findById(userId)).toBeNull();
    expect(await RefreshSession.find({ user: userId })).toHaveLength(0);
    expect(await Business.find({ ownerId: userId })).toHaveLength(0);
    expect(await EmailToken.find({ user: userId })).toHaveLength(0);

    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(meRes.status).toBe(401);
  });
});
