<div align="center">



# 🧾 InvoiceFlow

### Quotations in. Invoices out. Business in control.

A work-in-progress, India-first invoicing and quotation management platform for small businesses, freelancers, shops, agencies, and service providers.

<br />

<img src="https://img.shields.io/badge/🚧-Work%20in%20Progress-F59E0B?style=for-the-badge" alt="Work in progress" />

<br /><br />

<img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=flat-square&logo=react&logoColor=111827" alt="React and Vite" />
<img src="https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js and Express" />
<img src="https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />
<img src="https://img.shields.io/badge/Styling-Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
<img src="https://img.shields.io/badge/Testing-Jest-C21325?style=flat-square&logo=jest&logoColor=white" alt="Jest" />

<p><em>Built incrementally with a focus on maintainability, secure business-data separation, and reliable document calculations.</em></p>

</div>

---

## 🚧 Project Status — Work in Progress

InvoiceFlow is **actively being developed**. It is not yet a finished, production-ready SaaS product.

The repository already contains a substantial foundation: authentication flows, business onboarding and settings, customer and item management, document models and lifecycle services, a shared calculation engine, and server-side tests.

The main dashboard remains a placeholder, and some complete user journeys—including polished invoice and quotation creation, document preview/PDF delivery, and customer-facing document sharing—are still under development.

**Please treat this repository as an evolving development project.** Features, routes, setup requirements, and workflows may change as development continues.

## 💡 What Is InvoiceFlow?

InvoiceFlow aims to bring everyday business-document workflows into one place, reducing the friction involved in creating quotations, preparing invoices, and tracking payments.

<div align="center">

| 🧾 Invoices | 📝 Quotations | 🏢 Business Profiles |
|:---:|:---:|:---:|
| Create and track billing documents | Prepare estimates and proposals | Manage business identity and defaults |

| 👥 Customers | 📦 Products & Services | ⚙️ Business Settings |
|:---:|:---:|:---:|
| Maintain customer records | Reuse an item/service catalogue | Configure branding, tax, numbering, and payment details |

</div>

### 🔄 Intended Business Workflow

```text
Business Setup
      │
      ▼
Customer + Item Catalogue
      │
      ▼
Create Quotation ──► Share / Review / Accept
      │                         │
      │                         ▼
      └──────────────────► Convert to Invoice
                                │
                                ▼
                      Track Payment Status


## 🧰 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React, Vite, React Router | Web application and navigation |
| Styling | Tailwind CSS | Interface styling |
| Localization | i18next, react-i18next | Translation-ready UI |
| HTTP client | Axios | Frontend-to-API communication |
| Backend | Node.js, Express | REST API and business logic |
| Database | MongoDB, Mongoose | Data persistence |
| Authentication | Argon2, JWT, refresh sessions | Account and session management |
| Validation | Zod | Request validation |
| Security | Helmet, express-rate-limit | Security headers and rate limiting |
| Email | Resend integration | Verification and password-reset email delivery |
| Testing | Jest, Supertest, mongodb-memory-server | Backend and HTTP-level testing |

## 🗂️ Project Structure

```text
invoiceflow/
├── CLAUDE.md
├── client/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── api/              # API clients and request utilities
│       ├── assets/           # Static assets
│       ├── components/       # Shared UI components
│       ├── context/          # Authentication and business contexts
│       ├── i18n/              # Internationalization setup
│       ├── pages/             # Authentication, onboarding, customers, items, settings
│       └── routes/            # Route guards
│
└── server/
    ├── .env.example
    ├── jest.config.js
    ├── package.json
    ├── src/
    │   ├── config/            # Environment and database setup
    │   ├── controllers/       # HTTP controllers
    │   ├── middleware/        # Authentication, access, validation, errors
    │   ├── models/            # Mongoose models
    │   ├── routes/            # REST endpoints
    │   ├── services/          # Business logic and calculation engine
    │   └── utils/              # Validation schemas and utilities
    └── tests/                 # Backend test suites
```

## ⚙️ Local Development Setup

InvoiceFlow has two applications: a React frontend and an Express backend. Run each in a separate terminal.

### Prerequisites

- [Node.js](https://nodejs.org/) and npm
- MongoDB Atlas or a local MongoDB instance
- Git
- Optional Google OAuth and Resend credentials for their integrations

### 1. Clone the repository

```bash
git clone https://github.com/Krishnendu1910/invoiceflow.git
cd invoiceflow
```

### 2. Configure the backend

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env` and configure the required values:

```dotenv
PORT=5050
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
CLIENT_URL=http://localhost:5173
JWT_ACCESS_SECRET=<your-long-random-secret>
JWT_ACCESS_EXPIRES_IN=15m
EMAIL_MODE=development
```

The backend requires `PORT`, `MONGODB_URI`, `CLIENT_URL`, and `JWT_ACCESS_SECRET`.

Use your actual database connection string and a strong, randomly generated JWT secret. Never commit `.env` files or real credentials.

For local development, `EMAIL_MODE=development` logs verification and password-reset links in the server terminal instead of sending real emails. Google OAuth remains disabled until its required credentials are configured.

Start the backend:

```bash
npm run dev
```

The API defaults to **http://localhost:5050**.

Health endpoint:

```text
GET http://localhost:5050/api/health
```

### 3. Configure the frontend

Open a second terminal from the repository root:

```bash
cd client
npm install
cp .env.example .env
```

Configure the frontend API URL in `client/.env`:

```dotenv
VITE_API_URL=http://localhost:5050/api
```

Start the frontend:

```bash
npm run dev
```

Open the local URL printed by Vite, normally **http://localhost:5173**.

### 4. Run checks

Run these commands from their respective directories.

**Frontend — inside `client/`:**

```bash
npm run build
npm run lint
```

**Backend — inside `server/`:**

```bash
npm test
```

The backend tests use Jest, Supertest, and mongodb-memory-server. The first test run may need network access to download a temporary MongoDB binary.

## 🔐 Security & Data Isolation

InvoiceFlow is designed to keep business data isolated and protect sensitive application operations.

- 🔑 Keep database credentials, JWT secrets, OAuth secrets, and email API keys private.
- 🏢 Enforce business ownership and tenant isolation on protected endpoints.
- 🧾 Preserve historical document data when customer or business details change.
- 🧪 Test changes to authentication, calculations, numbering, and document lifecycle rules.
- 📧 Configure a verified sender and `EMAIL_MODE=resend` for production email delivery.
- 🔎 Review deployment settings, monitoring, backups, and security before handling real business data.

These are project design principles, not a claim that the application has undergone an independent security audit.

## 🇮🇳 Product Direction

InvoiceFlow is being designed with Indian business workflows in mind.

| Area | Direction |
|---|---|
| 🧾 Tax | GST, CGST, SGST, IGST, GSTIN, PAN, HSN/SAC |
| 🔢 Numbering | Per-business document sequences and configurable period resets |
| 🧮 Calculations | Shared calculation engine for invoices and quotations |
| 🎨 Branding | Business logo, brand color, and standard document text |
| 🌐 Localization | Translation-ready interface; English is the primary language |
| 💳 Payments | Manual payment tracking as the initial direction |
| 🌍 Expansion | Potential support for additional countries and currencies |

## 🛣️ Development Roadmap

The following items represent ongoing work, not completed features.

- [ ] Finish the operational dashboard with document summaries and pending actions.
- [ ] Complete invoice and quotation creation and editing in the frontend.
- [ ] Finish document previews and server-generated PDF download/printing.
- [ ] Complete customer-facing document sharing with secure public tokens.
- [ ] Complete quotation acceptance/rejection and conversion workflows.
- [ ] Validate email verification, password recovery, and optional Google OAuth end to end.
- [ ] Improve responsive behavior and accessibility.
- [ ] Expand regression tests as more workflows are implemented.
- [ ] Review production deployment, monitoring, backups, and security requirements.

## 🧭 Development Principles

The repository's `CLAUDE.md` records established product decisions, architecture, and development rules.

- 🔍 Inspect existing code before making changes.
- 🧱 Make focused changes and reuse established services.
- 🧮 Keep invoice and quotation logic on the shared document/calculation foundation.
- 🛡️ Prioritize server-side validation and business-level data isolation.
- 🧪 Test changes to critical business rules and document lifecycles.
- 📌 Keep `main` stable and use meaningful commit messages.

## 📌 Current Project Status

| Area | Assessment |
|---|---|
| Frontend/backend foundation | 🟢 Present |
| Authentication foundations | 🟡 Implemented; deployment flows need verification |
| Business onboarding and settings | 🟢 Implementation present |
| Customer and item management | 🟢 Implementation present |
| Calculation engine and document lifecycle backend | 🟢 Substantial implementation and tests present |
| Full operational dashboard | 🟡 Placeholder / ongoing |
| Complete invoice and quotation UI journeys | 🟡 Ongoing |
| Customer-facing sharing and PDF workflows | 🟡 Ongoing |
| Production readiness | 🔴 Not yet declared production-ready |

*This assessment is based on repository source inspection. It does not guarantee deployment health or that every feature works end to end.*

---

<div align="center">

### 🧾 InvoiceFlow

**Less paperwork friction. More clarity for everyday business.**

Built incrementally with a focus on correctness, security, and useful business workflows.

[⭐ Explore InvoiceFlow on GitHub](https://github.com/Krishnendu1910/invoiceflow)

</div>
