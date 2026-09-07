jest.mock("../src/services/email/email.service", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ skipped: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ skipped: true }),
}));

const request = require("supertest");
const testDb = require("./testDb");
const createApp = require("../src/app");
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

// Registers, verifies, and logs in a user; returns their access token and id.
async function verifiedUser({ name, email, password }) {
  await request(app).post("/api/auth/register").send({ name, email, password });
  const calls = emailService.sendVerificationEmail.mock.calls;
  const rawToken = calls[calls.length - 1][1];
  await request(app).post("/api/auth/verify-email").send({ token: rawToken });

  const login = await request(app).post("/api/auth/login").send({ email, password });
  return { accessToken: login.body.data.accessToken, userId: login.body.data.user.id };
}

const userA = { name: "Alice Owner", email: "alice@example.com", password: "alice-password-1" };
const userB = { name: "Bob Outsider", email: "bob@example.com", password: "bob-password-1" };

describe("business onboarding and ownership", () => {
  it("requires a verified email to create a business", async () => {
    await request(app).post("/api/auth/register").send(userA);
    const login = await request(app).post("/api/auth/login").send({ email: userA.email, password: userA.password });

    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`)
      .send({ name: "Alice's Shop", type: "shop" });

    expect(res.status).toBe(403);
  });

  it("creates the first business and sets it as the owner's active business", async () => {
    const { accessToken, userId } = await verifiedUser(userA);

    const createRes = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Alice's Shop", type: "shop", country: "IN" });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.business.ownerId).toBe(userId);
    expect(createRes.body.data.business.currency.code).toBe("INR");

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(me.body.data.user.lastActiveBusiness).toBe(createRes.body.data.business.id);
  });

  it("accepts a custom business type that is not one of the suggested values", async () => {
    const { accessToken } = await verifiedUser(userA);

    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Alice's Studio", type: "Boutique Pottery Studio" });

    expect(res.status).toBe(201);
    expect(res.body.data.business.type).toBe("Boutique Pottery Studio");
  });

  it("defaults business type to 'other' when omitted", async () => {
    const { accessToken } = await verifiedUser(userA);

    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Alice's Shop" });

    expect(res.status).toBe(201);
    expect(res.body.data.business.type).toBe("other");
  });

  it("prevents one user from reading another user's business", async () => {
    const a = await verifiedUser(userA);
    const b = await verifiedUser(userB);

    const createRes = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ name: "Alice's Agency", type: "agency" });

    const businessId = createRes.body.data.business.id;

    const res = await request(app)
      .get(`/api/businesses/${businessId}`)
      .set("Authorization", `Bearer ${b.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("only lists businesses owned by the authenticated user", async () => {
    const a = await verifiedUser(userA);
    const b = await verifiedUser(userB);

    await request(app).post("/api/businesses").set("Authorization", `Bearer ${a.accessToken}`).send({ name: "Alice's Shop" });
    await request(app).post("/api/businesses").set("Authorization", `Bearer ${b.accessToken}`).send({ name: "Bob's Shop" });

    const res = await request(app).get("/api/businesses").set("Authorization", `Bearer ${a.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.businesses).toHaveLength(1);
    expect(res.body.data.businesses[0].name).toBe("Alice's Shop");
  });

  it("rejects business routes without authentication", async () => {
    const res = await request(app).get("/api/businesses");
    expect(res.status).toBe(401);
  });
});
