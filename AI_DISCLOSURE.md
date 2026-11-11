## AI_DISCLOSURE (For Paper)

## 1. Section 2-  Identified Problem 

**AI-assisted task:**

Drafting of the sector context (PSA data) and local context (Inquirer article) paragraphs from two links provided by the group; advice on the order of sector context and local context; evaluation of whether the two sources are sufficient to identify the problem; English version of the paragraphs. The paragraphs were AI-drafted, not only proofread.

**Affected section:**

Section 2 – Identified Problem (Sector Context, Local Context, references [1] and [2]).

**Prompt:**

Become my research assistant help me to write the Identified Problem section. Write a sector context paragraph from the PSA tourism page and a local context paragraph from the Inquirer article; then judge whether these sources are enough to identify the problem. Project KAPAS, tourism and cultural innovation, Marinduque which is sources limited to https://psa.gov.ph/statistics/tourism and the Inquirer Q1 2024 article https://canadianinquirer.net/2024/05/12/marinduque-tourism-sector-posts-strong-q1-performance/ . Use only the two links sector context first, then local context; do not claim the artisans have problems the sources do not show; be honest about source fit; write in English with IEEE citations. One sector context paragraph, one local context paragraph, IEEE references, and an honest evaluation of source sufficiency.

**Validation evidence:**

The AI compared the figures against the text of both web pages when drafting (PSA: 8.6% of GDP, PhP 2.09 trillion, 6.21 million jobs in 2023; Inquirer: over 16,000 visitors in Q1 2024). Our members confirm it by open both links and confirm each figure and the citation details before submission. The AI advised that the two sources, support sector and local context only and do not prove the artisans' problem, operational evidence from artisan interviews or surveys is still required.



---
## AI_DISCLOSURE (For Feature 1)
**Project:** KAPAS (Kayas/Pukpuk/Artisan): Digital Production and Order Management System for Moriones-Inspired Local Artisans in Marinduque,

**Section:** 8. AI Disclosure Progress

**Status:** Provisional.

**AI tool:** Claude

---

## 2. AI-assisted task

| Item | Detail |
|---|---|
| Task | Generate semantic HTML5 structure and CSS styling from our own UI design of the Product Management page |
| Input given to AI | Our UI design image (`Frame.png`) of the Product Management page |
| Affected section | Front-end UI of the Product Management page (Feature 1: Product Catalog Management) |
| Affected files | `index.html`, `styles.css` |
| What the AI produced | Page structure (sidebar, header, search/filter toolbar, product table, Add New Product form) and the stylesheet (colors, fonts, layout, responsive rules, focus styles) |
| What the AI did NOT produce | The UI design and layout, JavaScript, PHP, MySQL, database design, and any back-end logic |

---

## 3. Exact prompt

Prompt sent with the attached `Frame.png`:

```text
This is the new website design for our product management, can you create me a full semantic html, with css
```

## 4. Validation evidence

| Check | Result |
|---|---|
| Opened `index.html` in a browser and compared it with `Frame.png` | Pass |
| Responsive check (desktop, tablet, mobile width) | Pass | 
| Keyboard check (Tab through links, buttons, form fields) | Pass 

**What we checked:**

  - We reviewed the HTML structure and confirmed that semantic tags were used correctly.

  - We compared the UI with the Figma design. Some colors, particularly in the status indicators, did not match the original design.

  - We tested the responsive layout and confirmed that it worked properly.

**Issues found:**

  - Product images have no image placeholders or image tags.

**Changes we made:**

  - Changed the logo to our own logo.
  - Changed the swatch as a placeholder for product images into an image tag.
  - Changed the color of the status

**What we understood**
  - We learned the importance of using semantic HTML, following the design guidelines, and testing the responsiveness of a webpage.
  - We also understood that small UI details, such as colors and product images, are important for maintaining a consistent design.

    
