<div align="center">

# 🧾 InvoiceFlow

### Quotations in. Invoices out. Business in control.

A work-in-progress, India-first invoicing and quotation management platform designed to help small businesses, freelancers, agencies, shops, and service providers manage their business documents more efficiently.

<p>
  <img src="https://img.shields.io/badge/Status-Work%20in%20Progress-F59E0B?style=for-the-badge" alt="Work in Progress" />
  <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Backend-Express%205-222222?style=for-the-badge&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
</p>

<p>
  <img src="https://img.shields.io/badge/Node.js-Backend%20Runtime-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Vite-Frontend%20Tooling-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-Styling-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/API-REST-6C757D?style=flat-square" alt="REST API" />
  <img src="https://img.shields.io/badge/Tests-Jest%20%2B%20Supertest-C21325?style=flat-square&logo=jest&logoColor=white" alt="Jest and Supertest" />
</p>

**[Explore the Repository](https://github.com/Krishnendu1910/invoiceflow)**

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Key Features](#-key-features)
- [Project Status](#-project-status)
- [Application Preview](#-application-preview)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Environment Configuration](#-environment-configuration)
- [Running the Application](#-running-the-application)
- [Using InvoiceFlow](#-using-invoiceflow)
- [API Overview](#-api-overview)
- [Project Structure](#-project-structure)
- [Engineering Practices](#-engineering-practices)
- [Security Considerations](#-security-considerations)
- [Testing](#-testing)
- [Roadmap](#-roadmap)
- [Known Limitations](#-known-limitations)
- [Contributing](#-contributing)
- [License](#-license)
- [Author](#-author)

---

## 💡 Overview

InvoiceFlow is a full-stack web application being developed to simplify invoicing, quotation management, and everyday business-document workflows.

The long-term goal is to provide businesses with a centralized workspace where they can manage their business profiles, maintain customer records, organize products and services, prepare quotations, generate invoices, and track payment status.

The project follows an India-first product direction, with planned support for business tax information such as GSTIN, PAN, HSN/SAC, CGST, SGST, and IGST.

Rather than treating invoices and quotations as completely separate systems, InvoiceFlow is being built around a shared document-engine approach to encourage reusable business logic and consistent calculations.

> **Project status:** InvoiceFlow is actively under development. The repository contains a substantial application foundation, but the complete end-to-end product is not yet finished or declared production-ready.

## 🎯 The Problem

Small businesses, freelancers, and service providers often manage quotations, invoices, customer details, and payment records across disconnected tools, spreadsheets, and manually maintained documents.

This can lead to:

- Repeated entry of customer and business information.
- Inconsistent document formats and calculations.
- Difficulty maintaining reusable product and service details.
- Extra effort when turning an accepted quotation into an invoice.
- Limited visibility into outstanding and completed payments.

InvoiceFlow aims to bring these workflows together in one organized application.

## ✅ The Solution

InvoiceFlow is being developed around a single workspace for managing business information and documents.

The planned workflow is:

```text
Business Setup
      |
      v
Customer & Product/Service Catalogue
      |
      v
Create Quotation
      |
      v
Review and Accept/Reject
      |
      v
Convert Accepted Quotation into Invoice
      |
      v
Track Payment Status
```

The application separates frontend presentation from backend business logic and uses a shared document foundation to support reusable calculations, validation, and document lifecycle rules.

## ✨ Key Features

The features below distinguish existing implementation from ongoing product work.

### Implemented Foundation

- **Authentication foundation** — registration, login, email verification, password recovery, and session-management flows.
- **Business onboarding** — a foundation for associating users with business profiles.
- **Business settings** — separate settings areas for profile, branding, tax, document numbering, payment details, document defaults, and financial-year configuration.
- **Customer management** — create and edit customer records, manage contact details, maintain tax information, and manage billing and shipping addresses.
- **Product and service catalogue** — maintain reusable items with details such as item type, SKU, HSN/SAC, rate, and status.
- **REST API foundation** — organized API routes, controllers, services, middleware, and database models.
- **Document-engine foundation** — backend document models, validation, calculation logic, and invoice/quotation lifecycle operations.
- **Backend regression tests** — test suites covering authentication, customers, business settings, calculations, document operations, and related workflows.

### India-First Product Direction

The product is being designed with support for business-document requirements such as:

- GST registration details and GSTIN.
- PAN and HSN/SAC information.
- CGST, SGST, and IGST tax treatments.
- Configurable document numbering and financial-year preferences.
- Business branding and document defaults.
- INR-oriented business workflows, with an architecture intended to accommodate other currencies.

These capabilities may be at different stages of implementation. Their presence in the data model or backend does not mean every corresponding user-facing workflow is complete.

### Work in Progress

The following areas still require development or end-to-end verification:

- A fully operational dashboard with document summaries and pending actions.
- Complete invoice and quotation creation and editing journeys.
- Customer-facing document sharing.
- Final document preview, PDF generation, download, and printing workflows.
- Complete quotation acceptance/rejection and conversion workflows.
- End-to-end verification of authentication and external-service integrations.
- Production deployment preparation and final security review.

## 🚧 Project Status

InvoiceFlow is a development-stage project.

| Area | Current Status |
|---|---|
| React frontend and Express backend | Foundation implemented |
| Authentication and session management | Implementation present; complete flows require verification |
| Business onboarding and settings | Implementation present |
| Customer management | Implementation present |
| Product/service catalogue | Implementation present |
| Document models and backend lifecycle logic | Substantial implementation present |
| Calculation engine and regression tests | Implemented foundation and tests present |
| Complete dashboard | Placeholder; ongoing |
| Complete invoice/quotation frontend workflows | In progress |
| Customer-facing sharing and final PDF workflows | In progress |
| Production readiness | Not yet established |

This status describes the repository implementation, not a guarantee that every workflow works in every deployment environment.

## 🖥️ Application Preview

The application is still being developed, and a verified public demo or a complete set of application screenshots is not currently documented here.

As the major user journeys become complete, this section can include:

- Authentication and business onboarding.
- Business settings and branding.
- Customer and product/service management.
- Invoice and quotation creation.
- Document previews and payment-status tracking.

Screenshots should be added from the actual application rather than mockups presented as completed functionality.

## 🧰 Technology Stack

InvoiceFlow uses a JavaScript-based full-stack architecture.

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19 | Component-based user interface |
| Frontend tooling | Vite | Development server and production builds |
| Routing | React Router | Client-side application navigation |
| Styling | Tailwind CSS 4 | Utility-based interface styling |
| HTTP communication | Axios | Frontend API requests |
| Internationalization | i18next, react-i18next | Translation-ready interface |
| Backend runtime | Node.js | JavaScript execution environment |
| Backend framework | Express 5 | REST API and middleware |
| Database | MongoDB | Persistent application data |
| Database modelling | Mongoose | Schemas, models, and database access |
| Authentication | Argon2, JWT, database-backed refresh sessions | Password hashing and session management |
| Validation | Zod | Request and input validation |
| Security middleware | Helmet, express-rate-limit | Security headers and request-rate limits |
| Email integration | Resend | Verification and password-reset email delivery |
| Optional authentication integration | Google OAuth | Google sign-in integration |
| Backend testing | Jest, Supertest | Automated tests and HTTP-level testing |
| Test database support | mongodb-memory-server | Isolated database testing |

## 🏗️ Architecture

InvoiceFlow separates the application into a React client and a Node.js/Express server.

```text
                    InvoiceFlow
                         |
             +-----------+-----------+
             |                       |
             v                       v
       React Frontend           Express API
       (client/)                (server/)
             |                       |
             |                       v
             |                  Middleware
             |                  - Authentication
             |                  - Authorization
             |                  - Validation
             |                  - Error handling
             |                       |
             |                       v
             |                  Controllers
             |                       |
             |                       v
             |                   Services
             |                  - Business logic
             |                  - Document lifecycle
             |                  - Calculations
             |                       |
             |                       v
             |                    Mongoose
             |                       |
             |                       v
             |                    MongoDB
             |
             +---- HTTP / REST ---->
```

### Architectural Principles

- Keep business logic in reusable backend services where practical.
- Use shared document and calculation foundations for invoices and quotations.
- Validate incoming requests before performing business operations.
- Enforce authentication and business-level authorization on protected endpoints.
- Preserve relevant customer and business snapshots in historical documents.
- Keep sensitive configuration and credentials on the server.
- Avoid duplicating business rules between the frontend and backend.

The diagram represents the intended architectural separation; individual workflows are still evolving.

## ⚙️ Getting Started

Follow these instructions to run the existing application locally.

### Prerequisites

Install the following:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) with a compatible npm version.
- [MongoDB Atlas](https://www.mongodb.com/atlas) or a local MongoDB instance.
- A terminal and code editor.

Optional integrations require additional configuration:

- Google OAuth credentials for Google sign-in.
- A Resend API key and verified sender configuration for real email delivery.

### 1. Clone the Repository

```bash
git clone https://github.com/Krishnendu1910/invoiceflow.git
cd invoiceflow
```

### 2. Install Frontend Dependencies

```bash
cd client
npm install
```

### 3. Configure the Frontend Environment

Create a local environment file:

```bash
cp .env.example .env
```

The `client/.env.example` file contains:

```dotenv
VITE_API_URL=http://localhost:5050/api
```

Keep this URL aligned with the address at which the backend API is running.

### 4. Install Backend Dependencies

Open a second terminal from the repository root:

```bash
cd server
npm install
```

### 5. Configure the Backend Environment

Create the backend environment file:

```bash
cp .env.example .env
```

Edit `server/.env` and configure at least the following required values:

```dotenv
PORT=5050
MONGODB_URI=mongodb://127.0.0.1:27017/invoiceflow
CLIENT_URL=http://localhost:5173

JWT_ACCESS_SECRET=replace_with_a_long_random_secret
JWT_ACCESS_EXPIRES_IN=15m

EMAIL_MODE=development
```

**Important:** The MongoDB URI shown above is an example for a local MongoDB instance. Adjust it for your environment. For MongoDB Atlas, use your own connection string.

Generate a strong local JWT secret using Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the generated value into `JWT_ACCESS_SECRET`.

The server's environment configuration also supports refresh-token lifetime, cookie domain, email-token lifetimes, Google OAuth credentials, and Resend configuration. Refer to [`server/.env.example`](https://github.com/Krishnendu1910/invoiceflow/blob/main/server/.env.example) for the complete list and the intended configuration of each variable.

Never commit `.env` files or real credentials.

## 🔧 Environment Configuration

### Backend Variables

| Variable | Purpose | Required |
|---|---|---|
| `PORT` | Backend listening port | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `CLIENT_URL` | Allowed frontend origin for CORS | Yes |
| `JWT_ACCESS_SECRET` | Signs access tokens | Yes |
| `JWT_ACCESS_EXPIRES_IN` | Access-token lifetime; defaults to `15m` | No |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-session lifetime; defaults to `30` | No |
| `EMAIL_MODE` | `development` or `resend` email mode | No; defaults depend on environment |
| `RESEND_API_KEY` | Resend API key for real email delivery | Required for production email delivery |
| `EMAIL_FROM` | Sender identity for email delivery | Required in production |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Optional |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | Optional |
| `COOKIE_DOMAIN` | Optional refresh-cookie domain | No |

Additional token-lifetime settings are documented in the backend environment example.

### Development Email Mode

With `EMAIL_MODE=development`, verification and password-reset links are logged in the backend terminal instead of being sent through Resend. This is intended for local development.

The backend configuration explicitly rejects development email mode in production. Configure real email delivery before deploying a production environment.

Google sign-in also depends on valid OAuth credentials and the configured callback URL.

## ▶️ Running the Application

The frontend and backend run as separate processes. Keep both terminals open during local development.

### Start the Backend

From the `server/` directory:

```bash
npm run dev
```

The API defaults to:

```text
http://localhost:5050
```

Verify the health endpoint:

```text
GET http://localhost:5050/api/health
```

You can open this URL in your browser:

[http://localhost:5050/api/health](http://localhost:5050/api/health)

The response reports API availability and the database connection state.

### Start the Frontend

From the `client/` directory:

```bash
npm run dev
```

Vite normally serves the application at:

[http://localhost:5173](http://localhost:5173)

Use the local address printed in your terminal if Vite selects a different port.

### Build the Frontend

From the `client/` directory:

```bash
npm run build
```

### Run Frontend Linting

From the `client/` directory:

```bash
npm run lint
```

### Run Backend Tests

From the `server/` directory:

```bash
npm test
```

The backend test setup uses Jest, Supertest, and mongodb-memory-server. Depending on your environment, the first test run may require network access to download a MongoDB binary.

These commands are documented project scripts; successful execution has not been verified for every environment.

## 🧭 Using InvoiceFlow

The currently implemented frontend provides a foundation for account access, business onboarding, customer management, product/service management, and business settings.

A typical local exploration sequence is:

1. Start the backend and frontend.
2. Open the frontend in your browser.
3. Register an account or use the available login flow.
4. Follow the configured email-verification flow if required.
5. Complete business onboarding.
6. Explore the customer and product/service catalogue screens.
7. Review the business profile, branding, tax, numbering, payment, document, and financial-year settings.

For local email verification or password recovery, check the backend terminal when development email mode is enabled.

The dashboard is currently a placeholder, and complete invoice/quotation creation and customer-facing document workflows should not be assumed to be available yet.

## 🔌 API Overview

The Express application currently registers the following main API groups:

| API Prefix | Responsibility |
|---|---|
| `/api/health` | API and database health information |
| `/api/auth` | Registration, login, session management, email verification, password recovery, and authentication integrations |
| `/api/businesses` | Business management and onboarding |
| `/api/customers` | Customer record management |
| `/api/items` | Product and service catalogue management |
| `/api/documents` | Backend document operations and lifecycle transitions |

The document API includes routes for creating, listing, retrieving, updating, deleting eligible drafts, changing document status, and converting documents to invoices. Document routes use authentication, email-verification requirements, validation, and business-access middleware.

Exact request schemas, authorization requirements, and response payloads should be checked against the implementation before integrating an external client.

Example health check:

```bash
curl http://localhost:5050/api/health
```

A full API reference with request examples and response schemas can be added as the API stabilizes.

## 📁 Project Structure

The repository uses separate directories for the frontend and backend.

```text
invoiceflow/
│
├── client/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── api/              # API clients and HTTP utilities
│       ├── assets/           # Static frontend assets
│       ├── components/       # Reusable UI components
│       ├── constants/        # Shared frontend constants
│       ├── context/          # Authentication and business contexts
│       ├── i18n/             # Internationalization setup
│       ├── pages/
│       │   ├── customers/    # Customer management screens
│       │   ├── items/        # Product and service screens
│       │   ├── onboarding/   # Business onboarding
│       │   └── settings/     # Business settings
│       ├── routes/           # Route guards
│       ├── App.jsx           # Application routes and composition
│       └── main.jsx          # Frontend entry point
│
├── server/
│   ├── .env.example
│   ├── jest.config.js
│   ├── package.json
│   ├── src/
│   │   ├── config/           # Environment and database setup
│   │   ├── controllers/      # HTTP request handlers
│   │   ├── middleware/       # Authentication, validation, and errors
│   │   ├── models/           # Mongoose data models
│   │   ├── routes/           # REST API route definitions
│   │   ├── services/         # Business logic and domain services
│   │   └── utils/            # Shared helpers and validation schemas
│   └── tests/                # Backend automated tests
│
├── .gitignore
├── CLAUDE.md                 # Product decisions and development guidelines
├── package.json              # Root scripts and tooling
├── package-lock.json
└── README.md
```

Some folders may contain additional modules as development progresses.

## 🧪 Engineering Practices

InvoiceFlow is being developed with an emphasis on maintainable business logic and predictable document behavior.

### Separation of Responsibilities

The application separates frontend components, API communication, request handlers, services, data models, and validation rules.

This makes it easier to modify a business workflow without unnecessarily rewriting unrelated parts of the application.

### Shared Document Logic

Invoices and quotations share a document-oriented backend foundation. A shared calculation engine and document lifecycle services help keep important calculations and transitions in one place.

### Validation and Error Handling

The backend uses Zod-based request validation, structured middleware, and a centralized error-handling approach. Frontend API utilities also help present request errors to the interface.

### Regression Testing

Automated backend tests cover important application areas, including:

- Authentication and session-related behavior.
- Business and customer operations.
- Document models and document lifecycle behavior.
- Calculation rules.
- Quotation-to-invoice conversion.
- Email delivery and token-related behavior.
- Rate limiting and account-related operations.

The repository contains these tests, but test coverage percentages and passing CI results should not be claimed until measured and verified.

## 🔐 Security Considerations

Security is a core design consideration because InvoiceFlow is intended to handle business and customer information.

The existing codebase includes several security-related mechanisms:

- Argon2 password hashing.
- JWT-based access tokens and database-backed refresh sessions.
- Authentication and authorization middleware.
- Business-access checks on protected routes.
- Zod-based request validation.
- Helmet security headers.
- Rate limiting for sensitive authentication actions.
- Cookie handling and credential-aware CORS configuration.
- Environment-based secrets and integration configuration.

These mechanisms are part of the implementation, but their presence alone does not establish that the whole application is secure.

Before using InvoiceFlow with real business data, additional verification is required for authorization boundaries, session handling, production configuration, secret management, logging, backups, error handling, deployment settings, and all externally accessible document workflows.

**Do not use real customer or financial information in an unverified deployment.** The application has not been declared production-ready or independently security-audited.

## 🛣️ Roadmap

The following items represent ongoing development goals.

### Application Experience

- [ ] Replace the placeholder dashboard with an operational dashboard.
- [ ] Complete the invoice creation and editing experience.
- [ ] Complete the quotation creation and editing experience.
- [ ] Add polished document previews and final PDF workflows.
- [ ] Complete customer-facing document sharing.
- [ ] Complete quotation acceptance/rejection and invoice-conversion journeys.
- [ ] Improve and verify responsive behavior and accessibility across key screens.

### Reliability and Quality

- [ ] Expand end-to-end regression testing for complete business workflows.
- [ ] Verify account registration, verification, recovery, and optional Google sign-in end to end.
- [ ] Complete integration testing for document lifecycle transitions.
- [ ] Validate production email and deployment configuration.
- [ ] Review monitoring, backup, recovery, and operational readiness.
- [ ] Complete a production-readiness and security review.

The roadmap will evolve as existing functionality is completed and tested.

## ⚠️ Known Limitations

- The project is still under active development.
- The main dashboard is a placeholder.
- Some invoice and quotation workflows are not yet complete in the frontend.
- Customer-facing sharing and final PDF workflows require further implementation or verification.
- External integrations depend on environment configuration and valid provider credentials.
- Local setup requires a working MongoDB connection.
- Development email mode logs verification and recovery links locally rather than sending actual emails.
- A public demo, complete visual showcase, and production-readiness status are not currently documented here.

These limitations will be updated as the application progresses.

## 🤝 Contributing

InvoiceFlow is currently under active development, and its architecture and product workflows may change.

For anyone interested in contributing:

1. Fork the repository.
2. Create a focused feature branch.
3. Make changes consistent with the existing architecture.
4. Add or update tests for the affected business logic.
5. Run the relevant frontend lint/build commands and backend test suite.
6. Submit a pull request describing the change and its verification.

For larger architectural changes, review [`CLAUDE.md`](https://github.com/Krishnendu1910/invoiceflow/blob/main/CLAUDE.md) first. It records the project's product decisions, development principles, and technical constraints.

Bug reports and feature suggestions can be submitted through [GitHub Issues](https://github.com/Krishnendu1910/invoiceflow/issues).

## 📄 License

The root `package.json` currently declares the `ISC` license. A standalone `LICENSE` file was not identified during repository inspection.

Before redistributing the project or accepting contributions under a stated open-source license, verify the intended licensing terms and add the corresponding license file to the repository.

## 👨‍💻 Author

**Krishnendu Sarkar**

- GitHub: [@Krishnendu1910](https://github.com/Krishnendu1910)
- LinkedIn: [Krishnendu Sarkar](https://www.linkedin.com/in/krishnendu-sarkar19/)

---

<div align="center">

### 🧾 InvoiceFlow

**Less paperwork friction. More clarity for everyday business.**

Built incrementally with a focus on reusable architecture, reliable document calculations, and secure business workflows.

[View Repository](https://github.com/Krishnendu1910/invoiceflow) · [Report an Issue](https://github.com/Krishnendu1910/invoiceflow/issues)

</div>
