# HAYYIZ — Intellectual Property & Brand Record

## 1. Project Identity

* **Arabic Name:** حيز
* **Latin Spellings Used:**
  * `Hayyiz` (Primary Latin brand name used in page titles, meta tags, PWA web manifest, and technical documentation)
  * `Hayiz` (Secondary Latin spelling recorded in repository Git commit metadata)
  * `adawati` (Repository directory name and URL slug in live GitHub Pages deployment)
  * `heez` (Technical namespace prefix used in Service Worker cache versioning)
* **Project Description:** A free Arabic student productivity and academic management web platform containing an integrated suite of study tools: Pomodoro Focus Engine, Todo Action Engine, GPA Calculator ecosystem, Student Timeline & Calendar, Free Writing & Notes Workspace, Habit Tracker, Letter Game, and Educational Blog.
* **Hosted URL:** `https://just-c.github.io/adawati/`
* **GitHub Repository:** `just-c/adawati` (URL: `https://github.com/just-c/adawati`)
* **Project Owner / Maintainer:** `Hayiz` (Git author identity, email: `misho707599@gmail.com`) / `just-c` (GitHub organization/account handle). As documented in `founder.html`, the founder operates under the username `just-c`. Contact email listed in `terms.html` and `privacy.html`: `adawati.support@gmail.com`.

## 2. Project Scope

Hayyiz is a client-side digital student productivity platform operating entirely within the web browser using vanilla HTML, CSS, JavaScript, and LocalStorage/IndexedDB browser storage. The platform's scope is strictly limited to the tools and services physically present in the repository:

* **Daily Summary Dashboard (`index.html`, `summary.js`):** Unified student dashboard integrating focus state, task recommendations, calendar countdowns, and academic goal progress.
* **Focus Engine / Pomodoro Timer (`pomodoro.html`, `pomodoro.js`):** Timestamp-based session focus timer supporting inline duration editing, contextual task linking, streak tracking, and background tab reconciliation.
* **Student Action Engine / Todo List (`todo.html`, `todo.js`):** Priority task management engine with smart task recommendations ("ماذا أفعل الآن؟"), relative due dates, and Pomodoro focus integration.
* **GPA Calculator Hub & Academic Engines (`gpa.html`, `gpa.js`, and 8 grade landing pages):** Academic GPA calculators, What-If scenario modeling, reverse goal optimization, and subject impact analysis across Saudi educational grade levels (first/second/third intermediate, first/second/third secondary, cumulative, and weighted).
* **Student Timeline & Calendar / Calculator (`calculator.html`, `calculator.js`):** Student age calculator, exam countdowns, conflict detection, and event-to-task conversion engine.
* **Free Writing & Canvas Workspace (`draw.html`):** Infinite canvas workspace supporting vector pen strokes, pan/zoom camera matrix transformations, text objects, and passive PDF document import rendered via PDF.js.
* **Notes Engine (`notes.html`, `notes.js`):** Rich local note-taking workspace with real-time draft autosaving and session restoration.
* **Habit Tracker (`habits.html`, `habits.js`):** Student daily habit logging with streak calculation and LocalStorage state persistence.
* **Educational Letter Game (`game.html`, `game.js`, `words.json`):** Vocabulary letter game utilizing a local JSON dictionary.
* **Educational Blog (`blog.html`, `blog-1.html` through `blog-15.html`):** Educational articles on study techniques, time management, and academic strategy.
* **Platform Information Pages:** Founder narrative (`founder.html`), About page (`about.html`), Contact (`contact.html`), Terms of Use (`terms.html`), and Privacy Policy (`privacy.html`).

No external services, social networks, user accounts, server-side databases, or AI chatbots exist within the project scope.

## 3. Intellectual Property Ownership

All original assets and intellectual property created specifically for Hayyiz belong to the project owner to the fullest extent permitted by applicable copyright law, excluding third-party open-source components detailed in Section 8.

* **Source Code:** All original JavaScript files (`common.js`, `gpa.js`, `pomodoro.js`, `todo.js`, `summary.js`, `calculator.js`, `game.js`, `notes.js`, `habits.js`, `sw.js`), HTML markup across all 35+ page templates, custom CSS stylesheets (`style.css`), and automated test suites (`test-all.js`, `test-gpa.js`, `test-regression.js`).
* **Original Content:** All Arabic UI text, microcopy, blog articles (`blog-1.html` through `blog-15.html`), founder narrative (`founder.html`), terms and privacy text (`terms.html`, `privacy.html`), structured JSON-LD schemas, and the Arabic vocabulary dictionary (`words.json`).
* **UI/UX and Design:** Visual layout, responsive RTL design, CSS variable themes (dark/light mode logic), component hierarchy, card design system, and custom user interaction patterns.
* **Original Graphics & Brand Assets:** Custom favicons (`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`), Apple touch icon (`apple-touch-icon.png`), and PWA icon assets (`android-chrome-192x192.png`, `android-chrome-512x512.png`).
* **Documentation:** `AGENTS.md` instructions, repository documentation, code comments, and this Intellectual Property & Brand Record document (`HAYYIZ-IP-AND-BRAND-RECORD.md`).
* **Other Original Materials:** Proprietary LocalStorage schema keys prefixed with `hayyiz-` (e.g., `hayyiz-todos`, `hayyiz-focus-sessions-log`, `hayyiz-student-exams`) and platform data backup key arrays (`HAYYIZ_BACKUP_KEYS`).

## 4. Brand Identity

* **Primary Arabic Brand Name:** **حيز**
* **Latin Name Spellings Recorded in Repository:**
  * `Hayyiz` (Official Latin transliteration used across meta tags, page titles, PWA web manifest, and technical documentation)
  * `Hayiz` (Alternate Latin spelling appearing in Git commit author tags and commit message titles)
  * `adawati` (Repository directory name and web URL slug)
  * `heez` (Technical namespace prefix used in Service Worker cache versioning strings like `heez-v1.5.2`)
* **Visual Identity & Iconography:**
  * Primary Logo Mark: Graduation cap icon (`fa-solid fa-graduation-cap`).
  * Primary Brand Color: `#4f46e5` (Indigo / primary UI accent color defined in CSS custom properties).
  * Theme Support: Dual light/dark theme system (`theme-light` / `theme-dark`).
* **Official Slogans & Taglines Used in Project:**
  * "حيز — منصة أدوات دراسية للطلاب" (Hayyiz — Student Productivity Tools Platform)
  * "أدوات دراسية مجانية تجمع كل ما يحتاجه الطالب في مكان واحد" (Free study tools bringing together everything a student needs in one place)
  * "حيز واحد للدراسة والتنظيم" (One dedicated space for study and organization)

No other unofficial brand names or alternative Latin spellings are recognized as part of the official brand identity.

## 5. Trademark Status

* **Registration Finding:** **No evidence of a registered trademark for the project was established from the current repository materials.** (لم يتم إثبات تسجيل علامة تجارية للمشروع من مواد المستودع الحالية.)
* **Symbol Usage:** The registered trademark symbol ® is not used in the repository and must not be used unless formal government registration is completed and verified.
* **Commercial / Public Use Distinction:** The public availability, web deployment, and commercial/non-commercial usage of the name "حيز" or "Hayyiz" do not constitute formal legal trademark registration.
* **Scope of Document:** This record is an internal documentary reference and does not grant, convey, or certify legal trademark registration or government ownership title.

## 6. First-Use / Priority Evidence

The following chronological timeline documents the project's evolution and first recorded usage of the name **حيز** based strictly on verifiable Git commit history and file artifacts in the repository:

| Date & Time (UTC/Local) | Event Description | Evidence / File Path | Git Commit Hash |
| :--- | :--- | :--- | :--- |
| **2026-08-18 17:00:24 UTC** | First recorded commit in repository history, establishing the full Hayyiz student ecosystem integration, complete with web manifest and terms. | `index.html`, `manifest.webmanifest`, `terms.html`, `about.html` | `3444247` |
| **2026-08-18 18:19:39 UTC** | Dashboard and task number calculation refinements across `summary.js`. | `summary.js`, `style.css` | `0b000cf` |
| **2026-08-18 22:26:31 +0300** | Commit by author `Hayiz <misho707599@gmail.com>`, confirming developer handle and email. | Git commit metadata | `3272736` |
| **2026-08-20 01:23:32 UTC** | FOUC (Flash of Unstyled Content) dark theme initialization fix in `<head>`. | HTML page headers | `98c58a9` |
| **2026-08-20 18:38:13 UTC** | Addition of Student Calculator tool for age calculation and exam countdowns. | `calculator.html`, `calculator.js` | `ea0f9af` |
| **2026-08-21 19:27:55 UTC** | Passive PDF import feature addition to free writing workspace in `draw.html`. | `draw.html` | `74ae185` |
| **2026-08-22 04:18:47 UTC** | GPA calculator ecosystem restructuring and multi-grade landing pages completion. | `gpa.html`, grade HTML files, `gpa.js` | `a4b1cbd` |
| **2026-08-22 05:45:20 UTC** | Implementation of reverse GPA goal optimization and subject impact analysis. | `gpa.js`, `test-gpa.js` | `8cc3a91` |
| **2026-08-22 07:14:35 UTC** | Elevation of Student Calendar to interactive Student Timeline product. | `calculator.html`, `calculator.js` | `0e441cb` |
| **2026-08-22 08:30:21 UTC** | Todo list transformation into integrated Student Action Engine with hero cards. | `todo.html`, `todo.js` | `5c5a388` |
| **2026-08-22 08:57:00 UTC** | Focus Engine timestamp reconciliation overhaul for background session durability. | `pomodoro.js`, `test-regression.js` | `9f320a7` |
| **2026-08-23 00:36:33 UTC** | On-demand lazy loading optimization for PDF.js assets (`pdf.min.js`, `pdf.worker.min.js`). | `draw.html`, `sw.js` | `34acae9` |
| **2026-08-23 10:27:39 UTC** | Final SEO optimizations and JSON-LD structured data refinement across platform pages. | Platform HTML pages | `1597ed0` |
| **2026-08-24 03:48:12 +0300** | Latest commit by author `Hayiz` fixing Pomodoro timing logic. | `pomodoro.js` | `c33c649` |

*Note: This evidence documents internal repository priority and first-use dates, but does not constitute formal trademark registration.*

## 7. Evidence Inventory

| Evidence Item | Date | Source | What It Proves | Strength Evaluation |
| :--- | :--- | :--- | :--- | :--- |
| **Git Commit Log (`3444247` to `c33c649`)** | Aug 18–24, 2026 | Repository Git history | Verifies chronological record of project development, commit timestamps, file additions, and developer identity (`Hayiz`). | **Strong** (as internal repository record) |
| **PWA Web Manifest (`manifest.webmanifest`)** | Aug 18, 2026 | Repository root file | Proves explicit brand naming ("حيز"), short name, description, and PWA metadata configuration. | **Moderate** |
| **Terms of Use (`terms.html`)** | Aug 2026 | Repository file content | Proves public deployment terms dated "أغسطس 2026", support email `adawati.support@gmail.com`, and IP ownership assertions. | **Moderate** |
| **Founder Story (`founder.html`)** | Aug 2026 | Repository file content | Documents the origin story of "حيز", explanation of name choice, developer username `just-c`, and project philosophy. | **Moderate** |
| **Service Worker Cache Namespace (`sw.js`)** | Aug 18–24, 2026 | `sw.js` code | Documents technical cache versioning string `heez-v1.5.2` and offline asset caching strategy. | **Moderate** |
| **Trademark Registration Certificate** | N/A | None in repository | Confirms absence of official registered trademark certificate or legal registration documents within the repository. | **Negative Finding** (No evidence present) |

## 8. Third-Party Components

The Hayyiz codebase incorporates several third-party libraries, fonts, icons, and external APIs. These assets are not owned by Hayyiz and remain subject to their respective licenses:

* **Font Awesome Free (v6.4.0):**
  * **Usage:** User interface icons loaded via Cloudflare CDN (`cdnjs.cloudflare.com`).
  * **License:** CC BY 4.0 (Icons), SIL OFL 1.1 (Fonts), MIT License (Code).
* **Google Fonts — Cairo Font Family:**
  * **Usage:** Primary typography loaded via Google Fonts API (`fonts.googleapis.com` and `fonts.gstatic.com`).
  * **License:** SIL Open Font License, Version 1.1.
* **PDF.js (v3.11.174 / Mozilla):**
  * **Usage:** Client-side PDF document parsing and canvas rendering in `draw.html` (`pdf.min.js` and `pdf.worker.min.js`).
  * **License:** Apache License, Version 2.0.
* **Google Analytics & Google Tag Manager (`gtag.js`):**
  * **Usage:** Anonymous website usage analytics tracking (`G-F94Z3H2D3S`).
  * **License:** Proprietary service subject to Google Terms of Service.

## 9. Usage Restrictions

All original source code, HTML templates, CSS stylesheets, JavaScript files, graphics, blog articles, and documentation in this repository are protected by copyright.

* **Open-Source Status:** The original source code and content of Hayyiz are **not licensed under an open-source license** unless explicitly declared in a dedicated `LICENSE` file.
* **Default Copyright Protection:** In the absence of an open-source license grant, standard copyright laws apply ("All Rights Reserved").
* **Terms of Use Reference:** Usage of the hosted website and web tools is governed by `terms.html`. Section 8 of `terms.html` explicitly reserves all rights to original design, branding, software, and content to Hayyiz.

## 10. Website Terms & Privacy

The hosted platform's terms and privacy policies are defined in two primary files in the repository root:

* **`terms.html` (Terms of Use / شروط الاستخدام):**
  * Defines acceptable and prohibited uses of the website and tools.
  * Outlines user responsibility regarding local browser storage (LocalStorage).
  * Affirms copyright and IP rights over original platform code, content, and branding.
  * Disclaims legal warranty for academic results and tool outcomes.
* **`privacy.html` (Privacy Policy / سياسة الخصوصية):**
  * Outlines client-side browser storage architecture (LocalStorage/IndexedDB).
  * Confirms no collection of personal information or account credentials.
  * Explains third-party analytics (Google Analytics) usage.

These documents govern end-user website interaction, while standard copyright law governs source code rights and distribution.

## 11. Unauthorized Use Notice

Public access to this GitHub repository or website does **not** grant any license or right to:

1. Copy, clone, modify, or redistribute the source code or platform design for commercial or non-commercial public deployment without prior written authorization from the project owner.
2. Rebrand, white-label, or repackage the Hayyiz platform or its individual tools under another brand or project name.
3. Extract original blog content, UI text, or founder narratives for republication as third-party original work.

Third-party components used within the project remain bound by their individual upstream licenses (MIT, SIL OFL 1.1, Apache 2.0).

## 12. Trademark Monitoring

For internal project maintenance and future brand protection, the maintainers should monitor:

* **Confusingly Similar Domain Names or Brand Names:** Usage of "حيز" or "Hayyiz" in combination with student tools, academic calculators, or productivity apps in Arabic target markets.
* **Unauthorized Clones & White-Label Deployments:** Automated or manual cloning of the repository deployed commercially without attribution or authorization.
* **Trademark Application Filings:** Future national trademark filings in relevant jurisdictions (e.g., SAIP in Saudi Arabia) should the project owner choose to seek formal registration.

*Note: This monitoring strategy is an internal recommendation and does not constitute formal legal enforcement or trademark monitoring service.*

## 13. Disclaimer

**DISCLAIMER:** This document (`HAYYIZ-IP-AND-BRAND-RECORD.md`) is an internal documentary record created to summarize project history, brand assets, and copyright ownership based on repository evidence. It **does not** constitute formal legal advice, a legal opinion, or a substitute for formal trademark registration with official government authorities (such as the Saudi Authority for Intellectual Property - SAIP). For legal enforcement or registration, consult a qualified intellectual property attorney.

## 14. Document Metadata

* **Document Name:** HAYYIZ — Intellectual Property & Brand Record
* **Project Name:** حيز (Hayyiz)
* **Initial Creation Date:** 2026-08-24
* **Last Reviewed Date:** 2026-08-24
* **Repository:** `just-c/adawati`
* **Document Purpose:** Internal documentary reference for brand identity, priority evidence, IP ownership, and third-party asset attribution.
* **Document Status:** Active Internal Record
