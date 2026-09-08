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

describe("item API", () => {
  it("creates an item scoped to the authenticated business", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Notebook",
      rate: 49.5,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.item.businessId).toBe(businessId);
    expect(res.body.data.item.status).toBe("active");
    expect(res.body.data.item.rate).toBe(49.5);
  });

  it("rejects an item without a name", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const res = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      rate: 10,
    });
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === "name")).toBe(true);
  });

  it("allows a zero rate", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const res = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "service",
      name: "Free Consultation",
      rate: 0,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.item.rate).toBe(0);
  });

  it("rejects a negative rate", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const res = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Bad Item",
      rate: -5,
    });
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === "rate")).toBe(true);
  });

  it("stores hsnSac as a string even when it looks numeric", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const res = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Widget",
      rate: 10,
      hsnSac: "0602",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.item.hsnSac).toBe("0602");
  });

  it("rejects a discount/tax percentage above 100", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const res = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Widget",
      rate: 10,
      defaultTax: { type: "percentage", rate: 150 },
    });
    expect(res.status).toBe(400);
  });

  it("persists defaultTax.rate and defaultDiscount.value independently", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const res = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Widget",
      rate: 10,
      defaultTax: { type: "percentage", rate: 18, label: "GST" },
      defaultDiscount: { type: "fixed", value: 5, label: "Launch offer" },
    });

    expect(res.status).toBe(201);
    expect(res.body.data.item.defaultTax).toMatchObject({ type: "percentage", rate: 18, label: "GST" });
    expect(res.body.data.item.defaultDiscount).toMatchObject({ type: "fixed", value: 5, label: "Launch offer" });
  });

  it("enforces SKU uniqueness within a business", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const first = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Widget A",
      rate: 10,
      sku: "SKU-1",
    });
    expect(first.status).toBe(201);

    const second = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Widget B",
      rate: 20,
      sku: "SKU-1",
    });
    expect(second.status).toBe(409);
  });

  it("allows the same SKU across different businesses", async () => {
    const a = await verifiedUserWithBusiness(userA);
    const b = await verifiedUserWithBusiness(userB, "Bob's Shop");

    const first = await authed(request(app).post("/api/items"), a.accessToken).send({
      businessId: a.businessId,
      type: "product",
      name: "Widget A",
      rate: 10,
      sku: "SHARED-SKU",
    });
    const second = await authed(request(app).post("/api/items"), b.accessToken).send({
      businessId: b.businessId,
      type: "product",
      name: "Widget B",
      rate: 10,
      sku: "SHARED-SKU",
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("frees an archived item's SKU for reuse", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const first = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Widget A",
      rate: 10,
      sku: "REUSABLE",
    });
    await authed(request(app).post(`/api/items/${first.body.data.item.id}/archive`), accessToken);

    const second = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Widget B",
      rate: 15,
      sku: "REUSABLE",
    });
    expect(second.status).toBe(201);

    const restore = await authed(request(app).post(`/api/items/${first.body.data.item.id}/restore`), accessToken);
    expect(restore.status).toBe(409);
  });

  it("allows multiple items with no SKU in the same business", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const first = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "No SKU A",
      rate: 10,
    });
    const second = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "No SKU B",
      rate: 10,
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("reads an item belonging to the authenticated user's business", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const create = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Widget",
      rate: 10,
    });

    const res = await authed(request(app).get(`/api/items/${create.body.data.item.id}`), accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data.item.name).toBe("Widget");
  });

  it("prevents reading another business's item even with a known id", async () => {
    const a = await verifiedUserWithBusiness(userA);
    const b = await verifiedUserWithBusiness(userB, "Bob's Shop");

    const create = await authed(request(app).post("/api/items"), a.accessToken).send({
      businessId: a.businessId,
      type: "product",
      name: "Alice's Widget",
      rate: 10,
    });

    const res = await authed(request(app).get(`/api/items/${create.body.data.item.id}`), b.accessToken);
    expect(res.status).toBe(403);
  });

  it("updates an item it owns", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const create = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Widget",
      rate: 10,
    });

    const res = await authed(request(app).patch(`/api/items/${create.body.data.item.id}`), accessToken).send({
      rate: 25,
      unit: "box",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.item.rate).toBe(25);
    expect(res.body.data.item.unit).toBe("box");
  });

  it("prevents updating another business's item", async () => {
    const a = await verifiedUserWithBusiness(userA);
    const b = await verifiedUserWithBusiness(userB, "Bob's Shop");

    const create = await authed(request(app).post("/api/items"), a.accessToken).send({
      businessId: a.businessId,
      type: "product",
      name: "Alice's Widget",
      rate: 10,
    });

    const res = await authed(request(app).patch(`/api/items/${create.body.data.item.id}`), b.accessToken).send({
      rate: 999,
    });
    expect(res.status).toBe(403);
  });

  it("archives and restores an item", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const create = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Widget",
      rate: 10,
    });
    const id = create.body.data.item.id;

    const archive = await authed(request(app).post(`/api/items/${id}/archive`), accessToken);
    expect(archive.status).toBe(200);
    expect(archive.body.data.item.status).toBe("archived");

    const restore = await authed(request(app).post(`/api/items/${id}/restore`), accessToken);
    expect(restore.status).toBe(200);
    expect(restore.body.data.item.status).toBe("active");
  });

  it("filters by type", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "A Product",
      rate: 10,
    });
    await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "service",
      name: "A Service",
      rate: 10,
    });

    const res = await authed(request(app).get(`/api/items?businessId=${businessId}&type=service`), accessToken);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].type).toBe("service");
  });

  it("excludes archived items from the default (active) list", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const create = await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Archive Me",
      rate: 10,
    });
    await authed(request(app).post(`/api/items/${create.body.data.item.id}/archive`), accessToken);

    const activeList = await authed(request(app).get(`/api/items?businessId=${businessId}`), accessToken);
    expect(activeList.body.data.items).toHaveLength(0);

    const archivedList = await authed(
      request(app).get(`/api/items?businessId=${businessId}&status=archived`),
      accessToken
    );
    expect(archivedList.body.data.items).toHaveLength(1);
  });

  it("searches items by name and SKU", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Blue Widget",
      rate: 10,
      sku: "BLU-001",
    });
    await authed(request(app).post("/api/items"), accessToken).send({
      businessId,
      type: "product",
      name: "Red Widget",
      rate: 10,
      sku: "RED-001",
    });

    const bySku = await authed(request(app).get(`/api/items?businessId=${businessId}&search=BLU`), accessToken);
    expect(bySku.body.data.items).toHaveLength(1);
    expect(bySku.body.data.items[0].name).toBe("Blue Widget");
  });

  it("paginates and sorts results deterministically", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    for (let i = 0; i < 5; i += 1) {
      await authed(request(app).post("/api/items"), accessToken).send({
        businessId,
        type: "product",
        name: `Item ${i}`,
        rate: i,
      });
    }

    const page1 = await authed(
      request(app).get(`/api/items?businessId=${businessId}&limit=2&page=1&sort=name`),
      accessToken
    );
    const page2 = await authed(
      request(app).get(`/api/items?businessId=${businessId}&limit=2&page=2&sort=name`),
      accessToken
    );

    expect(page1.body.data.pagination.total).toBe(5);
    expect(page1.body.data.items.map((i) => i.name)).toEqual(["Item 0", "Item 1"]);
    expect(page2.body.data.items.map((i) => i.name)).toEqual(["Item 2", "Item 3"]);
  });
});
