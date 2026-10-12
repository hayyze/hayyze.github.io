# HAYYIZ — Intellectual Property & Brand Record

## 1. Project Identity

* **Arabic Project / Brand Identity:** حيز
* **Primary Latin Spelling Currently Used by Project:** `Hayyiz`
* **Repository & Technical Identity Variants:**
  * `Hayiz` (Commit author metadata name in repository Git history)
  * `adawati` (Repository directory name)
  * `hayyze` (Target GitHub repository and Cloudflare Pages subdomain prefix `hayyze.pages.dev`)
  * `heez` (Technical namespace prefix used in Service Worker cache versioning)
* **Public Project / Developer Identity:** `just-C` / `hayyze`
* **Legal Rights Holder:** Not publicly identified in this repository
* **Public Contact Email:** `adawati.support@gmail.com` (Official project contact / support email)
* **Project Description:** A free Arabic student productivity and academic management web platform containing an integrated suite of study tools: Pomodoro Focus Engine, Todo Action Engine, Synchronized Workspaces & Collaborative Tasks, Cloud Sync, GPA Calculator ecosystem, Student Timeline & Calendar, Free Writing & Canvas Workspace, Notes Engine, Habit Tracker, Letter Game, and Educational Blog.
* **Hosted URL:** `https://hayyze.pages.dev/`
* **GitHub Repository:** `hayyze/hayyze.github.io` (URL: `https://github.com/hayyze/hayyze.github.io`)

## 2. Project Scope

Hayyiz is a digital student productivity platform operating via web browsers using HTML, CSS, JavaScript, LocalStorage/IndexedDB browser storage, and Supabase cloud services (Auth, Database, Cloud Sync, Realtime Workspaces) hosted on Cloudflare Pages. The platform's scope encompasses:

* **Daily Summary Dashboard (`index.html`, `summary.js`):** Unified student dashboard integrating focus state, task recommendations, calendar countdowns, and academic goal progress.
* **Focus Engine / Pomodoro Timer (`pomodoro.html`, `pomodoro.js`):** Timestamp-based session focus timer supporting inline duration editing, contextual task linking, streak tracking, and background tab reconciliation.
* **Student Action Engine / Todo List (`todo.html`, `todo.js`):** Priority task management engine with smart task recommendations ("ماذا أفعل الآن؟"), relative due dates, and Pomodoro focus integration.
* **Synchronized Workspaces & Collaborative Tasks (`workspaces.html`, `spaces.js`, `spaces-realtime-runtime.js`):** Group workspace collaboration module supporting shared workspace creation, team members, collaborative tasks, and Supabase Realtime synchronization.
* **Generic Cloud Synchronization Engine (`sync.js`, `supabase.js`, `auth-ui.js`):** Non-blocking incremental sync engine syncing todos, notes, habits, subjects, student exams, custom events, GPA snapshots, goals, birthdates, focus logs, and Pomodoro preferences across devices via Supabase PostgreSQL table `public.sync_items`.
* **GPA Calculator Hub & Academic Engines (`gpa.html`, `gpa.js`, and grade landing pages):** Academic GPA calculators, What-If scenario modeling, reverse goal optimization, and subject impact analysis across Saudi educational grade levels (intermediate, secondary, cumulative, and weighted).
* **Student Timeline & Calendar / Calculator (`calculator.html`, `calculator.js`):** Student age calculator, exam countdowns, conflict detection, and event-to-task conversion engine.
* **Free Writing & Canvas Workspace (`draw.html`):** Infinite canvas workspace supporting vector pen strokes, pan/zoom camera matrix transformations, text objects, and passive PDF document import rendered via PDF.js.
* **Notes Engine (`notes.html`, `notes.js`):** Rich local note-taking workspace with real-time draft autosaving and cloud sync.
* **Habit Tracker (`habits.html`, `habits.js`):** Student daily habit logging with streak calculation and state persistence.
* **Educational Letter Game (`game.html`, `game.js`, `words.json`):** Vocabulary letter game utilizing a local JSON dictionary.
* **Educational Blog (`blog.html`, `blog-1.html` through `blog-16.html`):** Educational articles on study techniques, time management, and academic strategy.
* **Platform Information Pages:** Founder narrative (`founder.html`), About page (`about.html`), Contact (`contact.html`), Terms of Use (`terms.html`), and Privacy Policy (`privacy.html`).

External cloud infrastructure (Supabase Auth/DB/Sync/Realtime, Cloudflare Pages, Google Analytics 4) is utilized exclusively to deliver optional user accounts, cross-device sync, group collaboration, hosting, and anonymous traffic analytics as disclosed in `privacy.html` and `terms.html`.

## 3. Intellectual Property Ownership

The intellectual property associated with original assets created specifically for Hayyiz encompasses the following categories, subject to applicable copyright law and excluding third-party components detailed in Section 8:

* **Source Code:** All original JavaScript files (`common.js`, `gpa.js`, `pomodoro.js`, `todo.js`, `summary.js`, `calculator.js`, `game.js`, `notes.js`, `habits.js`, `spaces.js`, `spaces-realtime-runtime.js`, `supabase.js`, `auth-ui.js`, `sync.js`, `sw.js`), HTML markup across all 46 page templates, custom CSS stylesheets (`style.css`), database schema scripts (`supabase-schema-and-security.sql`), and automated test suites (`test-all.js`, `test-auth.js`, `test-generic-sync.js`, `test-workspaces.js`, `test-security-audit.js`, `test-seo-migration.js`).
* **Original Content:** All Arabic UI text, microcopy, blog articles (`blog-1.html` through `blog-16.html`), founder narrative (`founder.html`), terms and privacy text (`terms.html`, `privacy.html`), structured JSON-LD schemas, and the Arabic vocabulary dictionary (`words.json`).
* **UI/UX and Design:** Visual layout, responsive RTL design, CSS variable themes (Visual Identity 2.0 Warm Paper / Deep Ink / Terracotta), component hierarchy, card design system, and custom user interaction patterns.
* **Original Graphics & Brand Assets:** Custom favicons (`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`), Apple touch icon (`apple-touch-icon.png`), and PWA icon assets (`android-chrome-192x192.png`, `android-chrome-512x512.png`).
* **Documentation:** `AGENTS.md` instructions, repository documentation, code comments, and this Intellectual Property & Brand Record document (`HAYYIZ-IP-AND-BRAND-RECORD.md`).
* **Other Original Materials:** Proprietary LocalStorage schema keys prefixed with `hayyiz-` (e.g., `hayyiz-todos`, `hayyiz-focus-sessions-log`, `hayyiz-student-exams`, `hayyiz-deleted-items`) and platform data backup key arrays (`HAYYIZ_ALLOWED_BACKUP_KEYS`).

*Note: The real-world legal identity of the underlying rights holder is not publicly identified in this repository.*

## 4. Brand Identity

* **Arabic Brand Identity:** **حيز**
* **Primary Latin Spelling Currently Used by Project:** `Hayyiz` (Used across meta tags, page titles, PWA web manifest, and technical documentation)
* **Technical & Repository Variants:**
  * `Hayiz` (Commit author metadata name in repository Git history)
  * `hayyze` (Target GitHub organization/repo name and live domain `hayyze.pages.dev`)
  * `heez` (Technical namespace prefix used in Service Worker cache versioning strings)
* **Visual Identity & Iconography (Visual Identity 2.0):**
  * Primary Logo Mark: Graduation cap icon (`fa-solid fa-graduation-cap`).
  * Primary Palette: Deep Ink `#18364D`, Terracotta Accent `#B6533B`, Warm Paper `#F2EEE5` / `#FBF9F4`.
  * Theme Support: Dual light/dark theme system (`theme-light` / `theme-dark`).
* **Slogans / Taglines Observed in Repository:**
  * "حيز — منصة أدوات دراسية للطلاب" (Hayyiz — Student Productivity Tools Platform)
  * "أدوات دراسية مجانية تجمع كل ما يحتاجه الطالب في مكان واحد" (Free study tools bringing together everything a student needs in one place)
  * "حيز واحد للدراسة والتنظيم" (One dedicated space for study and organization)

## 5. Trademark Status

* **Registration Finding:** **No evidence of formal trademark registration for the project was established from the current repository materials.** (لم يتم إثبات تسجيل علامة تجارية للمشروع من مواد المستودع الحالية.)
* **Symbol Usage:** The registered trademark symbol ® is not used in the repository and must not be used unless formal government registration is completed and verified.
* **Public Use & Legal Distinction:** Public deployment or commercial use of the name "حيز" or "Hayyiz" does not automatically create or guarantee formal legal trademark registration.
* **Scope of Document:** This record is an internal documentary reference and does not establish, grant, or certify legal trademark registration or government ownership title.

## 6. Evidence Inventory

| Evidence Item | Date | Source | What It Proves | Strength Evaluation |
| :--- | :--- | :--- | :--- | :--- |
| **Git Commit Log** | Aug 2026 – Present | Repository Git history | Proves directly observable repository history, commit timestamps, and file additions. | **Strong** (as internal repository record) |
| **PWA Web Manifest (`manifest.webmanifest`)** | Aug 2026 | Repository root file | Corroborates project name ("حيز"), short name, description, and PWA metadata configuration. | **Moderate** (corroborates project identity) |
| **Terms of Use (`terms.html`)** | March 2026 | Repository file content | Corroborates public terms, support email `adawati.support@gmail.com`, and IP rights assertions. | **Moderate** (corroborates public usage) |
| **Founder Story (`founder.html`)** | Aug 2026 | Repository file content | Corroborates narrative origin of "حيز", explanation of name choice, and public developer identity. | **Moderate** (corroborates brand narrative) |
| **Service Worker Cache Namespace (`sw.js`)** | Aug 2026 | `sw.js` code | Proves technical cache versioning string and offline asset caching implementation. | **Strong** (as observable technical code record) |
| **Trademark Registration Certificate** | N/A | None in repository | Confirms absence of official registered trademark certificate or legal registration documents within the repository. | **Not Evidence of Trademark Registration** |

## 7. Third-Party Components & Services

The Hayyiz platform incorporates third-party software libraries and external services. These are kept distinct from original project assets:

### Software Libraries
* **Font Awesome Free (v6.4.0):** User interface icons loaded via Cloudflare CDN (`cdnjs.cloudflare.com`). Licensed under CC BY 4.0 (Icons), SIL OFL 1.1 (Fonts), and MIT License (Code).
* **Google Fonts — Cairo Font Family:** Primary typography loaded via Google Fonts API (`fonts.googleapis.com`). Licensed under SIL Open Font License, Version 1.1.
* **PDF.js (v3.11.174 / Mozilla):** Client-side PDF parsing and canvas rendering in `draw.html` (`pdf.min.js` and `pdf.worker.min.js`). Licensed under Apache License, Version 2.0.

### External Third-Party Services
* **Supabase:** Cloud authentication (Auth), PostgreSQL database, generic cloud sync (`sync_items`), and Realtime collaboration channels (`hayyiz-workspaces-realtime`).
* **Cloudflare Pages:** Web platform hosting and edge delivery.
* **Google Analytics (`gtag.js`):** External website analytics tracking (`G-F94Z3H2D3S`). Operating as a third-party service subject to applicable Google Terms of Service and Privacy Policy.

## 8. Usage Restrictions

* **Public Repository Access:** The repository is publicly viewable on GitHub. Public viewability does not in itself grant a broad copyright license or permission to copy, redistribute, or create derivative works.
* **Proprietary Status:** Original project code, assets, and materials are proprietary ("All Rights Reserved") under applicable copyright law.
* **Terms of Use Reference:** Permitted end-user interaction with the website and tools is governed by `terms.html`. Section 6 of `terms.html` explicitly reserves rights to original software, design, content, and branding.

## 9. Website Terms & Privacy

The hosted platform's public interaction terms and privacy policies are defined in two primary root files:

* **`terms.html` (Terms of Use / شروط الاستخدام):** Defines acceptable and prohibited uses of the website, distinguishes guest LocalStorage usage from authenticated cloud sync & workspaces, outlines user responsibility for content, affirms IP rights over original materials, and disclaims academic warranties.
* **`privacy.html` (Privacy Policy / سياسة الخصوصية):** Outlines client-side browser storage architecture, authenticated cloud sync via Supabase, synchronized workspaces data processing, external service disclosures, cookies/analytics, data subject rights (access, correction, erasure), deletion requests via `adawati.support@gmail.com`, and minor student guidelines.

These documents govern end-user website interaction, while standard copyright law governs source code rights and distribution.

## 10. Unauthorized Use Notice

Public access to this repository does **not** grant authorization to:

1. Copy, clone, modify, or redistribute source code or platform design for commercial or non-commercial public deployment without explicit permission from the rights holder.
2. Rebrand, white-label, or repackage Hayyiz tools under another project or brand name.
3. Extract original blog articles or UI copy for republication as third-party original work.

Third-party software components used in the repository remain bound by their respective upstream licenses (MIT, SIL OFL 1.1, Apache 2.0).

## 11. Disclaimer

**DISCLAIMER:** This document (`HAYYIZ-IP-AND-BRAND-RECORD.md`) is an internal documentary record created to summarize project history, brand references, and copyright categories based on available repository evidence. It **does not** constitute formal legal advice, a legal opinion, or a substitute for formal trademark registration with official government authorities (such as SAIP). For legal registration or enforcement, consult a qualified intellectual property attorney.

## 12. Document Metadata

* **Document Name:** HAYYIZ — Intellectual Property & Brand Record
* **Project Name:** حيز (Hayyiz)
* **Last Reviewed Date:** 2026-03-30
* **Repository:** `hayyze/hayyze.github.io`
* **Live Domain:** `https://hayyze.pages.dev/`
* **Document Purpose:** Internal documentary reference for brand identity, priority evidence, IP ownership categories, and third-party asset attribution.
* **Document Status:** Active Internal Record
