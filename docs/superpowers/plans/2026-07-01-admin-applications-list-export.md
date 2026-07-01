# Admin Applications List Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the admin applications list to show 10 items per page, hide email/depositor details behind a disclosure, remove redundant payment text, and export all applications as HTML or Excel-readable files.

**Architecture:** Keep the existing Express/EJS structure. Add small server helpers for pagination and export rendering, pass paginated data to the dashboard, and render export files from all application rows.

**Tech Stack:** Node.js, Express, EJS, better-sqlite3, node:test, supertest.

---

### Task 1: Tests

**Files:**
- Modify: `test/app.test.js`

- [ ] **Step 1: Add tests for admin application list behavior**

Add a test that creates more than 10 applications, logs in, requests `/admin`, and asserts that the first page shows 10 visible rows, has pagination, hides email/depositor data from table cells until the details disclosure, and renders only the checkbox in the payment label.

- [ ] **Step 2: Add tests for exports**

Add a test that logs in, requests `/admin/applications/export.html` and `/admin/applications/export.xls`, and asserts that both include all application rows and expected response headers.

- [ ] **Step 3: Run tests and verify failure**

Run: `npm test`
Expected: fail because pagination/export routes and new markup are not implemented yet.

### Task 2: Server Changes

**Files:**
- Modify: `src/server.js`

- [ ] **Step 1: Add escaping and export helpers**

Add an HTML escape helper and a function that renders all applications to a complete HTML table document.

- [ ] **Step 2: Add pagination in `/admin`**

Read `page` from `req.query.page`, clamp invalid values to page 1, slice `db.listApplications()` to 10 items, and pass `applicationsPage` metadata to the view.

- [ ] **Step 3: Add export routes**

Add admin-only GET routes for `/admin/applications/export.html` and `/admin/applications/export.xls`. The HTML route sends `text/html; charset=utf-8`; the XLS route sends the same table with `application/vnd.ms-excel; charset=utf-8` and an attachment filename.

### Task 3: View And Styles

**Files:**
- Modify: `src/views/admin-dashboard.ejs`
- Modify: `src/public/styles.css`

- [ ] **Step 1: Update dashboard table**

Render export buttons above the applications table. Show only name, phone, lecture, payment checkbox, and details disclosure on the main row. Put email and depositor name inside `<details>`.

- [ ] **Step 2: Add pagination controls**

Render previous/next links and current page text when there is more than one page.

- [ ] **Step 3: Add minimal CSS**

Add styles for the section toolbar, detail disclosure, checkbox-only form, and pagination controls.

### Task 4: Verification

**Files:**
- No production changes unless tests reveal a problem.

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Inspect git diff**

Run: `git diff -- src/server.js src/views/admin-dashboard.ejs src/public/styles.css test/app.test.js docs/superpowers/plans/2026-07-01-admin-applications-list-export.md`
Expected: diff only contains the requested admin application list/export changes.
