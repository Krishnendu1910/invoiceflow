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

async function verifiedUserWithBusiness({ name, email, password }, businessName = "Test Co") {
  await request(app).post("/api/auth/register").send({ name, email, password });
  const calls = emailService.sendVerificationEmail.mock.calls;
  const rawToken = calls[calls.length - 1][1];
  await request(app).post("/api/auth/verify-email").send({ token: rawToken });

  const login = await request(app).post("/api/auth/login").send({ email, password });
  const accessToken = login.body.data.accessToken;

  const business = await request(app)
    .post("/api/businesses")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: businessName });

  return { accessToken, userId: login.body.data.user.id, businessId: business.body.data.business.id };
}

const userA = { name: "Alice Owner", email: "alice@example.com", password: "alice-password-1" };
const userB = { name: "Bob Outsider", email: "bob@example.com", password: "bob-password-1" };

function authed(req, accessToken) {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

describe("customer API", () => {
  it("creates a customer scoped to the authenticated business", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
      name: "Ravi Kumar",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.customer.businessId).toBe(businessId);
    expect(res.body.data.customer.status).toBe("active");
    expect(res.body.data.customer.name).toBe("Ravi Kumar");
  });

  it("rejects creating a customer without authentication", async () => {
    const res = await request(app).post("/api/customers").send({ type: "individual", name: "X" });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid customer (missing required name)", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
    });

    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === "name")).toBe(true);
  });

  it("requires GSTIN when the customer is marked GST registered", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "business",
      name: "Acme Traders",
      tax: { gstRegistered: true },
    });

    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === "tax.gstin")).toBe(true);
  });

  it("rejects a malformed GSTIN", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "business",
      name: "Acme Traders",
      tax: { gstRegistered: true, gstin: "not-a-gstin" },
    });

    expect(res.status).toBe(400);
  });

  it("accepts a valid GSTIN and stores it uppercased", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "business",
      name: "Acme Traders",
      tax: { gstRegistered: true, gstin: "27aabcu9603r1zm" },
    });

    expect(res.status).toBe(201);
    expect(res.body.data.customer.tax.gstin).toBe("27AABCU9603R1ZM");
  });

  it("allows duplicate customer names within the same business", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const first = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
      name: "Same Name",
    });
    const second = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
      name: "Same Name",
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.customer.id).not.toBe(second.body.data.customer.id);
  });

  it("reads a customer belonging to the authenticated user's business", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const create = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
      name: "Ravi Kumar",
    });

    const res = await authed(request(app).get(`/api/customers/${create.body.data.customer.id}`), accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data.customer.name).toBe("Ravi Kumar");
  });

  it("prevents reading another business's customer even with a known id", async () => {
    const a = await verifiedUserWithBusiness(userA);
    const b = await verifiedUserWithBusiness(userB, "Bob's Shop");

    const create = await authed(request(app).post("/api/customers"), a.accessToken).send({
      businessId: a.businessId,
      type: "individual",
      name: "Alice's Customer",
    });

    const res = await authed(request(app).get(`/api/customers/${create.body.data.customer.id}`), b.accessToken);
    expect(res.status).toBe(403);
  });

  it("prevents listing customers by supplying another user's businessId", async () => {
    const a = await verifiedUserWithBusiness(userA);
    const b = await verifiedUserWithBusiness(userB, "Bob's Shop");

    const res = await authed(request(app).get(`/api/customers?businessId=${a.businessId}`), b.accessToken);
    expect(res.status).toBe(403);
  });

  it("updates a customer it owns", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const create = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
      name: "Ravi Kumar",
    });

    const res = await authed(request(app).patch(`/api/customers/${create.body.data.customer.id}`), accessToken).send(
      { phone: "9876543210", tags: ["VIP", "vip", " Returning "] }
    );

    expect(res.status).toBe(200);
    expect(res.body.data.customer.phone).toBe("9876543210");
    expect(res.body.data.customer.tags).toEqual(["VIP", "Returning"]);
  });

  it("prevents updating another business's customer", async () => {
    const a = await verifiedUserWithBusiness(userA);
    const b = await verifiedUserWithBusiness(userB, "Bob's Shop");

    const create = await authed(request(app).post("/api/customers"), a.accessToken).send({
      businessId: a.businessId,
      type: "individual",
      name: "Alice's Customer",
    });

    const res = await authed(
      request(app).patch(`/api/customers/${create.body.data.customer.id}`),
      b.accessToken
    ).send({ name: "Hijacked" });

    expect(res.status).toBe(403);
  });

  it("cannot set status directly through update", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const create = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
      name: "Ravi Kumar",
    });

    const res = await authed(request(app).patch(`/api/customers/${create.body.data.customer.id}`), accessToken).send(
      { status: "archived" }
    );

    expect(res.status).toBe(200);
    expect(res.body.data.customer.status).toBe("active");
  });

  it("archives and restores a customer", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const create = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
      name: "Ravi Kumar",
    });
    const id = create.body.data.customer.id;

    const archive = await authed(request(app).post(`/api/customers/${id}/archive`), accessToken);
    expect(archive.status).toBe(200);
    expect(archive.body.data.customer.status).toBe("archived");

    const restore = await authed(request(app).post(`/api/customers/${id}/restore`), accessToken);
    expect(restore.status).toBe(200);
    expect(restore.body.data.customer.status).toBe("active");
  });

  it("excludes archived customers from the default (active) list", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const create = await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
      name: "Archive Me",
    });
    await authed(request(app).post(`/api/customers/${create.body.data.customer.id}/archive`), accessToken);

    const activeList = await authed(request(app).get(`/api/customers?businessId=${businessId}`), accessToken);
    expect(activeList.body.data.customers).toHaveLength(0);

    const archivedList = await authed(
      request(app).get(`/api/customers?businessId=${businessId}&status=archived`),
      accessToken
    );
    expect(archivedList.body.data.customers).toHaveLength(1);

    const allList = await authed(
      request(app).get(`/api/customers?businessId=${businessId}&status=all`),
      accessToken
    );
    expect(allList.body.data.customers).toHaveLength(1);
  });

  it("searches customers by name, email, and phone", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
      name: "Priya Sharma",
      email: "priya@example.com",
      phone: "9000000001",
    });
    await authed(request(app).post("/api/customers"), accessToken).send({
      businessId,
      type: "individual",
      name: "Rahul Verma",
      email: "rahul@example.com",
      phone: "9000000002",
    });

    const byName = await authed(request(app).get(`/api/customers?businessId=${businessId}&search=priya`), accessToken);
    expect(byName.body.data.customers).toHaveLength(1);
    expect(byName.body.data.customers[0].name).toBe("Priya Sharma");

    const byPhone = await authed(
      request(app).get(`/api/customers?businessId=${businessId}&search=9000000002`),
      accessToken
    );
    expect(byPhone.body.data.customers).toHaveLength(1);
    expect(byPhone.body.data.customers[0].name).toBe("Rahul Verma");
  });

  it("paginates results deterministically", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    for (let i = 0; i < 5; i += 1) {
      await authed(request(app).post("/api/customers"), accessToken).send({
        businessId,
        type: "individual",
        name: `Customer ${i}`,
      });
    }

    const page1 = await authed(
      request(app).get(`/api/customers?businessId=${businessId}&limit=2&page=1&sort=name`),
      accessToken
    );
    const page2 = await authed(
      request(app).get(`/api/customers?businessId=${businessId}&limit=2&page=2&sort=name`),
      accessToken
    );

    expect(page1.body.data.customers).toHaveLength(2);
    expect(page2.body.data.customers).toHaveLength(2);
    expect(page1.body.data.pagination.total).toBe(5);
    expect(page1.body.data.pagination.pages).toBe(3);
    expect(page1.body.data.customers.map((c) => c.name)).toEqual(["Customer 0", "Customer 1"]);
    expect(page2.body.data.customers.map((c) => c.name)).toEqual(["Customer 2", "Customer 3"]);
  });

  it("caps list page size to the maximum allowed limit", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const res = await authed(request(app).get(`/api/customers?businessId=${businessId}&limit=500`), accessToken);
    expect(res.status).toBe(400);
  });
});
