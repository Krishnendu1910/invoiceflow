<div align="center">

<img src="https://img.shields.io/badge/INVOICEFLOW-BUSINESS%20DOCUMENTS-4F46E5?style=for-the-badge&labelColor=111827" alt="InvoiceFlow" />

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
