const request = require("supertest");
const testDb = require("./testDb");
const createApp = require("../src/app");
const env = require("../src/config/env");
const emailService = require("../src/services/email/email.service");
const resendProvider = require("../src/services/email/resend.provider");
const developmentProvider = require("../src/services/email/development.provider");
const EmailToken = require("../src/models/EmailToken");
const User = require("../src/models/User");

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
  jest.restoreAllMocks();
  // Restore default test email mode
  env.email.mode = "development";
});

describe("Email Delivery Modes", () => {
  describe("Development Mode", () => {
    it("does not call Resend and returns development mode metadata", async () => {
      env.email.mode = "development";
      const resendSpy = jest.spyOn(resendProvider, "send");

      const result = await emailService.sendVerificationEmail("devuser@example.com", "raw-token-abc");

      expect(resendSpy).not.toHaveBeenCalled();
      expect(result.mode).toBe("development");
      expect(result.link).toContain("/verify-email?token=raw-token-abc");
      expect(result.to).toBe("devuser@example.com");
    });

    it("logs the development verification URL to console without leaking secrets", async () => {
      env.email.mode = "development";
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await emailService.sendVerificationEmail("devuser@example.com", "raw-token-123");

      const loggedOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");

      expect(loggedOutput).toContain("[email:development]");
      expect(loggedOutput).toContain("*** DEVELOPMENT ONLY — NO ACTUAL EMAIL SENT ***");
      expect(loggedOutput).toContain("Verification URL: http://localhost:5173/verify-email?token=raw-token-123");

      // Verify no sensitive credentials are leaked
      expect(loggedOutput).not.toContain(env.jwt.accessSecret);
      expect(loggedOutput).not.toContain("password");
      expect(loggedOutput).not.toContain("re_");
    });

    it("logs password reset URL correctly in development mode", async () => {
      env.email.mode = "development";
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const result = await emailService.sendPasswordResetEmail("devuser@example.com", "reset-token-xyz");

      const loggedOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");

      expect(result.mode).toBe("development");
      expect(loggedOutput).toContain("Password Reset URL: http://localhost:5173/reset-password?token=reset-token-xyz");
    });

    it("full registration and verification flow works end-to-end in development mode", async () => {
      env.email.mode = "development";
      let capturedLink = "";
      jest.spyOn(console, "log").mockImplementation((msg) => {
        if (typeof msg === "string" && msg.includes("/verify-email?token=")) {
          capturedLink = msg;
        }
      });

      const regRes = await request(app).post("/api/auth/register").send({
        name: "Dev Developer",
        email: "developer@example.com",
        password: "secure-dev-password-1",
      });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);

      // Verify token was stored in DB
      const tokenRecord = await EmailToken.findOne({ purpose: "email_verification" });
      expect(tokenRecord).toBeTruthy();

      // Extract raw token from development log
      const tokenMatch = capturedLink.match(/token=([a-zA-Z0-9_-]+)/);
      expect(tokenMatch).toBeTruthy();
      const rawToken = tokenMatch[1];

      // Perform verification
      const verifyRes = await request(app).post("/api/auth/verify-email").send({ token: rawToken });
      expect(verifyRes.status).toBe(200);

      const user = await User.findOne({ email: "developer@example.com" });
      expect(user.isEmailVerified).toBe(true);
    });
  });

  describe("Resend Mode", () => {
    it("calls resendProvider when EMAIL_MODE=resend", async () => {
      env.email.mode = "resend";
      const resendSpy = jest.spyOn(resendProvider, "send").mockResolvedValue({
        skipped: false,
        id: "msg_123",
        mode: "resend",
      });

      const result = await emailService.sendVerificationEmail("customer@example.com", "token-resend-1");

      expect(resendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "customer@example.com",
          subject: "Verify your InvoiceFlow email address",
          type: "verification",
        })
      );
      expect(result.id).toBe("msg_123");
    });

    it("converts provider errors to safe application-level error rather than raw provider details", async () => {
      env.email.mode = "resend";
      // Simulate Resend returning a domain restriction error
      jest.spyOn(resendProvider, "send").mockImplementation(async () => {
        const ApiError = require("../src/utils/ApiError");
        throw new ApiError(502, "Unable to send email at this time. Please try again later.");
      });

      const res = await request(app).post("/api/auth/register").send({
        name: "Test Customer",
        email: "unregistered-domain@example.com",
        password: "secure-password-1",
      });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Unable to send email at this time. Please try again later.");
      // Ensure raw provider messages / secrets do not leak
      expect(res.body.message).not.toContain("resend");
      expect(res.body.message).not.toContain("onboarding@resend.dev");
    });
  });

  describe("Production Safeguard", () => {
    it("throws error and prevents development email delivery if production mode is active", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalIsProd = env.isProduction;

      try {
        process.env.NODE_ENV = "production";
        env.isProduction = true;
        env.email.mode = "development";

        await expect(developmentProvider.send({
          to: "test@example.com",
          subject: "Test",
          link: "http://localhost:5173/verify-email?token=123",
        })).rejects.toThrow("Development email provider cannot be used in production.");

        await expect(emailService.sendVerificationEmail("test@example.com", "token123"))
          .rejects.toThrow("Development email delivery cannot be used in production.");
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        env.isProduction = originalIsProd;
        env.email.mode = "development";
      }
    });
  });

  describe("GET /api/auth/config", () => {
    it("exposes the current emailMode in auth config", async () => {
      env.email.mode = "development";
      const res = await request(app).get("/api/auth/config");

      expect(res.status).toBe(200);
      expect(res.body.data.emailMode).toBe("development");
    });
  });

  describe("EMAIL_MODE Configuration Validation", () => {
    const originalEnv = process.env.EMAIL_MODE;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.EMAIL_MODE;
      } else {
        process.env.EMAIL_MODE = originalEnv;
      }
    });

    it("fails startup when EMAIL_MODE is set to an invalid value", () => {
      process.env.EMAIL_MODE = "smtp";
      expect(() => {
        jest.isolateModules(() => {
          require("../src/config/env");
        });
      }).toThrow('Invalid EMAIL_MODE: "smtp". Allowed values are "development" or "resend".');
    });

    it("succeeds startup when EMAIL_MODE is explicitly 'development'", () => {
      process.env.EMAIL_MODE = "development";
      expect(() => {
        jest.isolateModules(() => {
          const loadedEnv = require("../src/config/env");
          expect(loadedEnv.email.mode).toBe("development");
        });
      }).not.toThrow();
    });

    it("succeeds startup when EMAIL_MODE is explicitly 'resend'", () => {
      process.env.EMAIL_MODE = "resend";
      expect(() => {
        jest.isolateModules(() => {
          const loadedEnv = require("../src/config/env");
          expect(loadedEnv.email.mode).toBe("resend");
        });
      }).not.toThrow();
    });
  });
});

