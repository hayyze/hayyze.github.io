# AGENTS.md — Hayyiz Development Rules

## 1. Project Identity

This repository is the source code for "Hayyiz" (حيز), an Arabic RTL student tools platform.

The existing visual identity, UX, architecture, and design language are intentional.

The primary rule is:

> Improve Hayyiz without making it stop looking or behaving like Hayyiz.

Never redesign the project from scratch.

Never replace the existing visual identity with a new design system.

---

## 2. Preserve the Existing Design

Before modifying any UI, inspect the existing implementation and reuse its current:

- CSS variables
- colors
- typography
- cards
- buttons
- spacing
- border radius
- shadows
- icons
- navigation
- responsive behavior
- RTL layout
- existing components and classes

Do not introduce a different visual language.

New UI must look like it was originally designed as part of Hayyiz.

Do not introduce a new framework or UI library unless explicitly requested.

---

## 3. Incremental Changes Only

Prefer small, targeted modifications.

Do not rewrite entire files when a localized change is sufficient.

Do not refactor unrelated code.

Do not rename files or reorganize the project unless explicitly required.

Do not remove existing functionality merely because a different implementation appears cleaner.

The existing implementation is the source of truth.

---

## 4. Understand Before Modifying

Before making changes:

1. Inspect the relevant files.
2. Understand the existing architecture.
3. Search for existing implementations of the required functionality.
4. Reuse existing functions, components, storage keys and styles whenever possible.
5. Only then modify the minimum necessary files.

Never assume how the application works when the repository can answer the question.

---

## 5. LocalStorage and User Data

Hayyiz uses client-side storage.

Never casually rename, delete, or change existing LocalStorage keys.

Before modifying storage:

- Search the repository for every usage of the key.
- Understand the existing data structure.
- Preserve compatibility with existing user data.

If a storage migration is genuinely necessary, implement backward-compatible migration instead of silently discarding old data.

Never use fake data to make the interface appear functional.

---

## 6. Dashboard Philosophy

The Dashboard should help a student understand:

1. What should I do now?
2. What have I accomplished today?
3. What should I do next?
4. How was my day?

Do not turn the Dashboard into a generic SaaS analytics dashboard.

Avoid unnecessary statistics, charts, graphs, gamification, or decorative metrics.

Prioritize actionable information over information density.

---

## 7. Tool Integration

Hayyiz is intended to function as an integrated student toolkit.

Important relationships include:

Todo
↕
Pomodoro
↕
Dashboard

Prefer connecting existing tools instead of creating duplicate systems.

If an existing system already stores the required information, reuse it.

Do not create a second task system, second Pomodoro system, or second statistics system.

---

## 8. Pomodoro

Preserve the existing Pomodoro behavior unless the requested task explicitly requires a change.

When integrating Todo with Pomodoro:

- Reuse the existing Pomodoro implementation.
- Reuse existing session tracking.
- Preserve existing timer behavior.
- Do not break session persistence.
- Do not introduce unnecessary dependencies.

A task should be able to lead naturally into a focus session when appropriate.

---

## 9. Todo

Preserve all existing Todo functionality.

Do not break:

- task creation
- task editing
- task deletion
- task completion
- priorities
- persistence
- existing UI behavior

When integrating Todo with Dashboard or Pomodoro, extend the existing implementation rather than replacing it.

---

## 10. PWA

Hayyiz is a Progressive Web App.

Do not break:

- manifest.webmanifest
- service worker registration
- sw.js
- application icons
- caching
- offline functionality
- installation behavior

If new files are introduced and must be cached, update the existing service worker carefully.

Do not rewrite the service worker from scratch.

Do not remove existing cached assets without understanding the consequences.

---

## 11. Security

Security configuration is critical.

Never weaken existing security controls merely to make new code work.

Do not remove or weaken:

- Content-Security-Policy
- security-related meta tags
- integrity attributes
- Referrer-Policy
- Permissions-Policy
- other existing security mechanisms

Do not add:

- unsafe-inline
- unsafe-eval
- overly broad wildcards

unless explicitly authorized and technically justified.

Prefer changing the implementation so that it complies with the existing security policy.

Never expose secrets, tokens, passwords, or credentials.

---

## 12. SEO

Preserve existing SEO configuration.

Do not unnecessarily change:

- title
- meta description
- canonical
- robots
- Open Graph metadata
- structured data
- semantic headings
- lang
- dir

Do not introduce keyword stuffing.

Do not remove existing SEO metadata when modifying a page.

---

## 13. Performance

Hayyiz should remain lightweight and fast.

Avoid unnecessary:

- external libraries
- dependencies
- network requests
- polling
- timers
- DOM operations
- large JavaScript bundles

Prefer native HTML, CSS and JavaScript when the existing project already uses them.

Do not sacrifice performance for decorative features.

---

## 14. Responsive Design

Every UI modification must preserve:

- desktop usability
- laptop usability
- tablet usability
- iPad usability
- mobile usability
- RTL layout

Avoid horizontal overflow.

Ensure buttons and interactive elements remain usable on touch devices.

Do not create a desktop-only feature unless explicitly requested.

---

## 15. Accessibility

Preserve and improve accessibility where possible.

Use:

- semantic HTML
- real buttons for actions
- appropriate labels
- keyboard accessibility
- visible focus states
- appropriate ARIA attributes when necessary

Do not use accessibility as a reason to redesign the visual identity.

---

## 16. Dependencies

Do not add a dependency unless it is genuinely necessary.

Before adding a dependency:

1. Check whether the functionality already exists in the project.
2. Check whether native JavaScript can solve the problem.
3. Check whether an existing dependency can be reused.

Do not introduce React, Vue, Tailwind, Bootstrap, or another framework unless explicitly requested.

---

## 17. Code Style

Follow the coding style already present in the repository.

Respect:

- naming conventions
- indentation
- file organization
- comments
- JavaScript patterns
- CSS patterns
- existing architecture

Do not impose a new coding style on the project.

---

## 18. Scope Control

Only modify files necessary for the requested task.

Do not "clean up" unrelated code.

Do not perform unrelated refactoring.

Do not modify unrelated pages merely because improvements are possible.

If you discover an unrelated issue, report it instead of silently changing it.

---

## 19. Validation

After making changes, verify:

- JavaScript errors
- broken links
- broken buttons
- LocalStorage compatibility
- Todo functionality
- Pomodoro functionality
- Dashboard calculations
- responsive behavior
- PWA behavior
- service worker behavior
- security configuration
- SEO metadata

Do not claim something was tested if it was not actually tested.

---

## 20. Git Safety

Prefer changes that can be reviewed as a clear diff.

Do not make massive unrelated changes.

Before completing a task, summarize:

- files changed
- functionality added
- functionality modified
- storage changes
- PWA changes
- security changes
- SEO changes
- tests performed
- known limitations

---

## 21. Decision Priority

When making implementation decisions, use this priority:

1. Preserve existing Hayyiz identity.
2. Preserve existing functionality.
3. Preserve security.
4. Preserve user data.
5. Preserve PWA behavior.
6. Preserve SEO.
7. Preserve performance.
8. Improve usability.
9. Add new functionality only when it directly supports the requested goal.

When in doubt, make the smallest safe change.

---

## Final Rule

Do not make Hayyiz look like another product.

Do not redesign Hayyiz.

Do not rewrite Hayyiz.

Improve the existing Hayyiz implementation while preserving its identity, architecture, security, data and behavior.

The final result should look as if the original developer of Hayyiz implemented the improvement themselves.
