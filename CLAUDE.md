# InvoiceFlow — Project Constitution

This file is the source of truth for how InvoiceFlow is built. It documents product
decisions, architecture, and working rules. Follow it before writing code. If a
requirement is ambiguous or requires a product decision not covered here, ask before
proceeding rather than inventing a requirement.

## Project

- **Product name:** InvoiceFlow
- **Purpose:** A production-minded invoice and quotation management platform for small
  businesses, shops, freelancers, agencies, and service providers.
- **Market:** India-first product, with architecture ready for global expansion.
- **Ambition:** This is intended to eventually become a sellable SaaS product, not
  merely a demo. Build with that bar in mind, without over-engineering ahead of need.

## Tech Stack

- **Frontend:** React + Vite
- **Styling:** Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** MongoDB with Mongoose
- **API style:** REST
- **Authentication:** Email/password + Google
- **Frontend deployment target:** Vercel
- **Backend deployment:** Independently deployable from the frontend
- **Source repository:** GitHub

## Architecture

```
client/                     React frontend
server/
  src/config/                configuration
  src/controllers/           request/business controllers
  src/middleware/            middleware
  src/models/                Mongoose models
  src/routes/                API routes
  src/services/              reusable business logic
  src/utils/                 utilities
docs/                        project documentation
```

- Keep business logic out of React components and route files where practical —
  push it into services.
- Prefer reusable services and modules over duplicated logic.
- Invoice and quotation functionality must use a **shared, reusable Document Engine**
  rather than two separate implementations. Quotations and invoices are two states/
  representations of the same underlying document concept.

## Security

- Never commit `.env` files or secrets.
- Never expose database credentials, API keys, tokens, or private configuration in
  frontend code.
- Backend must enforce authentication and authorization on every protected route.
- Every business's data must be isolated from other businesses (multi-tenant
  isolation by business ID, enforced server-side — not just filtered in the UI).
- Validate and sanitize all user input.
- Use secure authentication practices (hashed passwords, secure session/token
  handling, safe OAuth flow for Google).
- Use rate limiting where appropriate (e.g. auth endpoints, public share endpoints).
- Shareable document links must use secure, non-guessable identifiers/tokens (not
  sequential IDs).
- Do not weaken security for convenience.
- Production security decisions require careful review — flag them explicitly rather
  than silently choosing the easy option.

## Business Structure

- One user can own/manage multiple businesses.
- Users must be able to switch between businesses.
- Business data must be isolated by business ID.
- Business profile information should be reusable across documents (branding,
  address, tax details, etc. defined once per business).

## Customers

- Customer database with customer profile and complete invoice/quotation/payment
  history.
- Support both individual and business customers.
- Support GST-registered and GST-unregistered customers.
- Support GSTIN and PAN.
- Support billing and shipping addresses.
- Support tags/groups.

## Products and Services

- Maintain a reusable product/service catalog.
- Inventory management is **not** part of the initial MVP.
- Architecture should allow inventory to be added later without a rewrite (e.g. don't
  preclude stock fields/relations on the product model).

## Documents

Invoice and quotation line items and document-level fields must support:

- Item/service
- Description
- SKU/item code
- HSN/SAC
- Quantity
- Unit
- Rate
- Discount
- Tax
- Amount
- Per-item tax override
- Per-item discount
- Overall discount
- Fixed or percentage discounts
- Multiple additional charges (shipping, packaging, handling, delivery, and other
  charges)
- Notes
- Payment terms
- Custom fields
- Branding information

### Quotation Lifecycle

```
Draft → Sent → Viewed → Accepted/Rejected → Expired → Converted to Invoice
```

### Invoice Lifecycle

```
Draft → Sent → Viewed → Partially Paid → Paid
```

Invoices may also become:

- Overdue
- Cancelled

**Issued/sent documents must not be silently overwritten.** Preserve appropriate
version/audit history.

## Payments

Initial payment tracking is **manual**:

- Paid / unpaid / partial
- Payment date
- Payment method
- Payment reference
- Amount

Future possibilities (not MVP):

- Payment reminders
- Payment gateway integration

## Workflow

Primary business workflow:

```
Quotation → Accept/Reject → Invoice → Payment → Receipt
```

## Sharing

- Customers should not need an account to access a shared document.
- Shareable documents should allow appropriate customer actions such as:
  - View
  - Download
  - Accept/reject quotation
  - Comment/request changes
  - Future payment

## PDF

- Frontend provides a live document preview.
- Backend/server generates the final authoritative PDF.
- Support download and printing.

## Templates and Branding

- Shared template system for invoices and quotations.
- Multiple professional templates.
- Business branding should support:
  - Logo
  - Brand color
  - Header/footer text
  - Payment terms
  - Notes
  - Custom fields
- Full drag-and-drop document customization is a **future feature**, not MVP.

## Tax and Localization

India-first support:

- GST, CGST, SGST, IGST
- GSTIN
- HSN/SAC
- PAN
- UPI
- INR

Architecture must support future country-specific tax systems and currencies — do
not hard-code Indian tax rules where a general tax abstraction is feasible.

The application should be **multilingual-ready from day one** using proper i18n
architecture, even though English is the first complete language.

## Currency

- Support currency code and symbol at the architecture level.
- Do not hard-code INR throughout the application.
- Live exchange rates are a future feature.

## Numbering

- Document numbering is isolated per business.
- Configurable prefixes/formats.
- Separate invoice and quotation series.
- Support calendar year, financial year, or custom numbering periods.

## Dashboard

Initial dashboard focuses on business operations:

- Invoice summary
- Quotation summary
- Paid/unpaid
- Outstanding amount
- Recent documents
- Pending actions

Do **not** build a full accounting system into the MVP.

## UX

- Responsive web application; desktop and mobile should both work well.
- PWA/offline capabilities can be added later.
- Prefer clean, professional SaaS UX.
- Avoid unnecessary complexity.

## Future-Ready Architecture (do not build prematurely)

Leave room for, but do not implement until requested:

- Team members and roles
- Branches
- Recurring invoices
- Payment gateways
- Automated WhatsApp notifications
- Advanced customization
- Inventory
- Accounting features
- Global tax systems
- Offline/PWA
- Subscription/freemium/lifetime pricing

## Development Rules

- Do not build the entire application in one step — work in clearly defined phases.
- Before major architectural changes, explain the reasoning.
- Do not introduce unnecessary dependencies.
- Reuse existing abstractions instead of duplicating logic.
- Keep components and services maintainable.
- Follow consistent naming conventions.
- Prefer explicit, readable code over clever code.
- Handle errors properly.
- Do not silently change established product decisions.
- If a requirement is ambiguous, ask before making a major product decision.
- Do not invent requirements.

## Git Rules

- `main` should remain stable.
- Use feature branches for substantial features.
- Use meaningful commit messages.
- Do not commit secrets.
- Do not modify Git history destructively.
- Do not force push unless explicitly instructed.
- Before committing, verify `git status` and staged files.

## Claude Code Working Style

- Act as a senior implementation partner, not an autonomous product owner.
- Inspect existing code before modifying it.
- Explain important architectural decisions briefly.
- Make focused changes; do not rewrite unrelated files.
- Do not install packages without explaining why they are needed.
- Do not implement future features unless explicitly requested.
- Keep the MVP scope under control.
- After completing a task, report:
  1. What changed
  2. Files changed
  3. Why the change was made
  4. How it was tested
  5. Any remaining concerns

## Current Project Status

- Git repository already initialized; `main` branch exists.
- Initial foundation commit already exists.
- GitHub remote is configured.
- MongoDB Atlas connection is working.
- Express backend health endpoint is working on port 5050.
- React/Vite frontend exists.
- Do not recreate the project from scratch.
