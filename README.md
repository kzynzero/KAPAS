# KAPAS

**Digital Production and Order Management System for Moriones-Inspired Local Artisans in Marinduque**

Web Systems and Technologies 1 final project, Marinduque State University, College of Information and Computing Sciences.
Group: Wonder Kids (BSI/T-3C)

## Selected sector

Tourism & Cultural Innovation

## Problem

Morion masks and other Moriones-inspired crafts are part of Marinduque's cultural heritage and a source of income for local makers. Demand rises around the festival and drops afterwards. The systems we reviewed for handicrafts, inventory and sales were built for general retail or industrial businesses. None combines product listings, raw material tracking and customer order tracking for heritage craft production. We have not yet interviewed local mask-makers, so how artisans currently track materials and orders is still a hypothesis. The full problem analysis and references are in the project documentation.

## Proposed solution

KAPAS is a web app where artisans and small businesses manage their products, materials and customer orders in one place. A public catalog lets customers browse products and send an order request without visiting the maker.

## Core functional features

1. **Product catalog management.** Add, edit and delete products with a name, description, category, price, stock and photo. Products can be hidden from the public catalog.
2. **Production and material tracking.** Record raw materials with a unit and a reorder level, add or use stock, see low-stock warnings, and record finished pieces, which adds them to a product's stock and can take the material used out of stock.
3. **Customer order management.** Order requests land in the seller's Orders page as Pending and move through In production, Ready for pickup and Completed. Completing an order takes its items out of stock.
4. **Public online catalog.** Anyone can search and filter products, open a product page and send an order request.
5. **Accounts.** Two account types, each with sign up, sign in, sign out and its own dashboard:
   - **Artisan:** an individual maker.
   - **Business:** a workshop or souvenir shop. It can sell its own products and send order requests to other sellers.
6. **Search, filter and sort.** The catalog, Products, Materials and Orders pages each have a search box plus filters and sorting.
7. **Live updates between pages.** When data changes in one tab, such as a new product photo, other open KAPAS tabs update without a refresh.
8. **Backup and restore.** Export everything to a JSON file and restore it from the dashboard.

Excluded, as in the paper: online payments, delivery tracking, a mobile app, accounting and payroll, marketing analytics, and coverage beyond Marinduque artisans.

## Technologies used

| Technology | Role |
|---|---|
| HTML5, CSS3 | Page structure; shared design system in `styles/` plus one stylesheet per page in `pages/` |
| Vanilla JavaScript (ES modules) | All behavior, with no framework and no build step |
| IndexedDB | Stores accounts, products, materials and orders in the browser |
| BroadcastChannel | Tells other open tabs to reload when data changes |
| Web Crypto (PBKDF2) | Salted password hashing |
| `serve` | Small static web server used by `npm start` (CodeSandbox and local) |
| Node test runner and fake-indexeddb | Automated tests of the data and business logic |

The justification and comparison for these choices is in the project documentation.

## Project structure

```
index.html  product.html  login.html          Public pages (storefront, product, sign in)
dashboard.html  products.html                  Seller workspace pages
materials.html  orders.html
assets/          Logo, favicon and the Morion mask photo
styles/          Shared design system
  tokens.css       colours, fonts, radii, shadows
  base.css         reset, typography, accessibility helpers, animations
  components.css   buttons, form fields, panels, tables, pills, dialogs, toasts
  layout.css       seller sidebar, storefront header and footer
  main.css         imports the four files above
pages/           One folder per page: <page>.js (behavior) and <page>.css (page-only styles)
  storefront/  product/  auth/  dashboard/  products/  materials/  orders/
js/              Shared modules
  store.js         IndexedDB data layer and cross-tab sync
  auth.js          accounts, password hashing, sessions, page guard
  shop.js          business rules for products, orders and materials
  filters.js       search, filter and sort helpers
  ui.js            escaping, money format, toasts, dialogs, form errors, photo compression
  layout.js        sidebar, storefront header and footer
  icons.js         inline SVG icons
test/            Node tests for the data layer, business rules and filters
.codesandbox/    CodeSandbox setup and start tasks
serve.json       Static server settings
```

Business rules live only in `js/shop.js` and `js/auth.js`. Pages call them and never change data directly.

## Limitations

- **Data stays on one device.** There is no server or shared database. A customer on another phone cannot see an artisan's catalog. For a demo, use one browser with several tabs.
- **Sign-in is local.** Passwords are hashed and every protected page checks the account type, but anyone with access to the browser's developer tools can read or change the stored data. It is not a replacement for server-side authentication.
- **Clearing browser data erases everything.** Use the backup button.
- **Order requests have no decline status.** The four statuses follow the paper. A seller who cannot take a request has to contact the customer directly.
- **Materials are not linked to products automatically.** The amount of material used is entered when finished pieces are recorded.
- **Operational validation with mask-makers has not been done yet.**
- Layout, forms and photo upload were checked in Chromium on desktop, tablet and phone widths.

## Group members

- LAYAG, Brex T.
- LECAROS, Christine Anne Quezaine O.
- LUSLOS, Ghincel Mae B.
- MATINING, Charlie A.
- PASTRANA, Ivan Emmanuel D.
- ROSALES, Kayleigh Plurin F.

## Documentation

- Full project documentation: `PROJECT_DOCUMENTATION.md`
- Manuscript PDF: `docs/final-manuscript.pdf`
- Author contributions: `CONTRIBUTIONS.md`

## AI disclosure

AI assistants were used in this project. The tool, task, prompt, output, validation and responsible member for each use are recorded in [`AI_DISCLOSURE.md`](AI_DISCLOSURE.md).
