# 논준모연구소 특강 신청 웹사이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node/Express/SQLite web app for listing vacation offline lectures, accepting transfer-based applications, and letting admins manage lectures and payment confirmation.

**Architecture:** Express serves server-rendered HTML pages and JSON-free form posts. SQLite stores lectures and applications, with confirmed payments as the only count toward capacity. CSS is plain responsive CSS shared across public and admin pages.

**Tech Stack:** Node.js, Express, better-sqlite3, express-session, EJS, node:test, supertest.

---

## File Structure

- `package.json`: scripts and dependencies.
- `.env.example`: documents `ADMIN_PASSWORD` and session secret settings.
- `src/server.js`: app factory, middleware, routes, startup.
- `src/db.js`: SQLite connection, schema migration, query helpers.
- `src/validators.js`: lecture and application form validation.
- `src/view-models.js`: lecture status and calendar data shaping.
- `src/views/*.ejs`: server-rendered pages and partials.
- `src/public/styles.css`: responsive public and admin styling.
- `test/app.test.js`: integration coverage for core flows.

## Tasks

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `src/server.js`
- Create: `src/db.js`

- [ ] **Step 1: Add package metadata and scripts**

Create `package.json` with:

```json
{
  "name": "nonjummo-lecture-app",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node src/server.js",
    "test": "node --test"
  },
  "dependencies": {
    "better-sqlite3": "^11.9.1",
    "ejs": "^3.1.10",
    "express": "^4.21.2",
    "express-session": "^1.18.1"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Document environment variables**

Create `.env.example`:

```text
ADMIN_PASSWORD=change-me
SESSION_SECRET=replace-with-random-secret
PORT=3000
DATABASE_PATH=./data/app.db
```

- [ ] **Step 3: Implement app bootstrap**

Create `src/server.js` with an exported `createApp` function and a direct startup path. Configure EJS, static assets, URL-encoded forms, session auth, and routes added in later tasks.

- [ ] **Step 4: Implement DB initialization**

Create `src/db.js` with `createDatabase(databasePath)`, schema creation for `lectures` and `applications`, foreign key enforcement, and exported query methods used by routes.

- [ ] **Step 5: Run install and smoke test**

Run: `npm install`

Run: `npm test`

Expected: Node test runner starts. It may report zero tests until Task 2.

### Task 2: Validation and View Models

**Files:**
- Create: `src/validators.js`
- Create: `src/view-models.js`
- Create: `test/app.test.js`

- [ ] **Step 1: Write tests for lecture status rules**

In `test/app.test.js`, add tests that verify:

- confirmed count below capacity returns `신청중`
- confirmed count at capacity returns `마감`
- past deadline returns `마감`

- [ ] **Step 2: Implement validation helpers**

Create `validateLectureInput(body)` requiring title, description, schedule date/time, location, positive capacity, and deadline. Create `validateApplicationInput(body)` requiring name, phone, email, depositor name, and valid lecture id.

- [ ] **Step 3: Implement status and calendar helpers**

Create `getLectureStatus(lecture, confirmedCount, now = new Date())` and `buildCalendarWeeks(lectures)` in `src/view-models.js`.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: validation and status tests pass.

### Task 3: Public Lecture Pages

**Files:**
- Modify: `src/server.js`
- Modify: `src/db.js`
- Create: `src/views/layout.ejs`
- Create: `src/views/index.ejs`
- Create: `src/views/lecture-detail.ejs`
- Create: `src/views/success.ejs`
- Create: `src/views/partials/status.ejs`

- [ ] **Step 1: Write integration tests**

In `test/app.test.js`, verify:

- `GET /` renders text list and calendar sections.
- `GET /lectures/:id` renders lecture details and application form when open.
- `POST /lectures/:id/apply` stores an application and redirects to success.
- full capacity by confirmed applications hides or blocks the application form.

- [ ] **Step 2: Add public DB queries**

Implement lecture listing, lecture lookup with confirmed count, and application insertion in `src/db.js`.

- [ ] **Step 3: Add public routes**

Implement:

- `GET /`
- `GET /lectures/:id`
- `POST /lectures/:id/apply`
- `GET /applications/:id/success`

- [ ] **Step 4: Add EJS views**

Create accessible Korean pages for list, calendar, detail, application form, and success message.

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: all public flow tests pass.

### Task 4: Admin Login and Lecture Management

**Files:**
- Modify: `src/server.js`
- Modify: `src/db.js`
- Create: `src/views/admin-login.ejs`
- Create: `src/views/admin-dashboard.ejs`
- Create: `src/views/admin-lecture-form.ejs`

- [ ] **Step 1: Write admin tests**

In `test/app.test.js`, verify:

- unauthenticated admin routes redirect to `/admin/login`
- correct password starts a session
- admin can create, edit, and delete a lecture

- [ ] **Step 2: Add auth middleware**

Use `ADMIN_PASSWORD` or default development password `admin1234`. Store `req.session.isAdmin = true` on successful login.

- [ ] **Step 3: Add lecture admin queries**

Implement insert, update, and delete lecture methods. Delete should cascade applications via foreign keys.

- [ ] **Step 4: Add admin lecture routes and views**

Implement:

- `GET /admin/login`
- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin`
- `GET /admin/lectures/new`
- `POST /admin/lectures`
- `GET /admin/lectures/:id/edit`
- `POST /admin/lectures/:id`
- `POST /admin/lectures/:id/delete`

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: public and admin lecture tests pass.

### Task 5: Admin Applications and Payment Confirmation

**Files:**
- Modify: `src/server.js`
- Modify: `src/db.js`
- Modify: `src/views/admin-dashboard.ejs`

- [ ] **Step 1: Write payment confirmation tests**

In `test/app.test.js`, verify:

- submitted applications appear on `/admin`
- toggling payment confirmation updates the public confirmed count
- toggling confirmation off decreases the public confirmed count

- [ ] **Step 2: Add application admin queries**

Implement application listing grouped by lecture and `setPaymentConfirmed(applicationId, confirmed)`.

- [ ] **Step 3: Add admin application route**

Implement `POST /admin/applications/:id/payment` with checkbox form handling.

- [ ] **Step 4: Render application table**

Show applicant name, phone, email, lecture title, depositor name, created date, and payment confirmation checkbox.

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: payment confirmation tests pass.

### Task 6: Responsive Design and Seed Experience

**Files:**
- Create: `src/public/styles.css`
- Modify: `src/views/*.ejs`
- Modify: `src/db.js`

- [ ] **Step 1: Add responsive CSS**

Style public and admin pages with a clean white background, ink text, restrained blue/green accents, clear cards, tables, forms, and mobile stacking. Ensure cards use 8px radius or less.

- [ ] **Step 2: Add empty-state and sample guidance**

When no lectures exist, public page should say 등록된 특강이 없고 admin page should guide the admin to add the first lecture.

- [ ] **Step 3: Run automated tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 4: Start app locally**

Run: `npm run dev`

Expected: app listens on `http://localhost:3000`.

- [ ] **Step 5: Browser verification**

Open the local app and verify desktop and mobile layouts for:

- public list and calendar
- lecture detail and application form
- admin login
- admin dashboard
- lecture form

## Self-Review

- Spec coverage: public list, calendar, detail, application submission, admin lecture CRUD, admin payment confirmation, capacity counting by confirmed payments, deadline closing, and responsive design all map to tasks.
- Placeholder scan: no task relies on TBD or undefined future work.
- Type consistency: `lectures`, `applications`, `payment_confirmed`, `getLectureStatus`, and route names are consistent across tasks.
