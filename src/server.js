const path = require("node:path");
const express = require("express");
const session = require("express-session");
const { createDatabase } = require("./db");
const { validateApplicationInput, validateLectureInput } = require("./validators");
const { buildCalendarWeeks, formatDate, formatDateTime, getLectureStatus } = require("./view-models");

const APPLICATIONS_PER_PAGE = 10;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderApplicationsExport(applications) {
  const rows = applications.map((application) => `
      <tr>
        <td>${escapeHtml(application.name)}</td>
        <td>${escapeHtml(application.phone)}</td>
        <td>${escapeHtml(application.email)}</td>
        <td>${escapeHtml(application.lecture_title)}</td>
        <td>${escapeHtml(application.depositor_name)}</td>
        <td>${application.payment_confirmed ? "확인" : "미확인"}</td>
        <td>${escapeHtml(formatDateTime(application.created_at))}</td>
      </tr>`).join("");

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <title>신청 내역</title>
  </head>
  <body>
    <h1>신청 내역</h1>
    <table border="1">
      <thead>
        <tr>
          <th>신청자</th>
          <th>연락처</th>
          <th>이메일</th>
          <th>강의</th>
          <th>입금자명</th>
          <th>입금확인</th>
          <th>신청일</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </body>
</html>`;
}

function createApp(options = {}) {
  const app = express();
  const db = options.db || createDatabase(options.databasePath || process.env.DATABASE_PATH);
  const adminPassword = options.adminPassword || process.env.ADMIN_PASSWORD || "admin1234";
  const now = options.now || (() => new Date());

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, "public")));
  app.use(
    session({
      secret: options.sessionSecret || process.env.SESSION_SECRET || "development-secret",
      resave: false,
      saveUninitialized: false
    })
  );

  app.use((req, res, next) => {
    res.locals.isAdmin = Boolean(req.session.isAdmin);
    res.locals.formatDate = formatDate;
    res.locals.formatDateTime = formatDateTime;
    next();
  });

  function decorateLecture(lecture) {
    const confirmedCount = Number(lecture.confirmed_count || 0);
    return {
      ...lecture,
      confirmed_count: confirmedCount,
      status: getLectureStatus(lecture, confirmedCount, now())
    };
  }

  function requireAdmin(req, res, next) {
    if (!req.session.isAdmin) {
      res.redirect("/admin/login");
      return;
    }
    next();
  }

  app.get("/", (req, res) => {
    const lectures = db.listLecturesWithCounts().map(decorateLecture);
    res.render("index", {
      title: "논준모연구소 방학 오프라인 특강",
      lectures,
      calendarWeeks: buildCalendarWeeks(lectures)
    });
  });

  app.get("/lectures/:id", (req, res) => {
    const lecture = db.getLectureWithCount(req.params.id);
    if (!lecture) {
      res.status(404).send("강의를 찾을 수 없습니다.");
      return;
    }
    res.render("lecture-detail", {
      title: lecture.title,
      lecture: decorateLecture(lecture),
      errors: [],
      form: {}
    });
  });

  app.post("/lectures/:id/apply", (req, res) => {
    const lecture = db.getLectureWithCount(req.params.id);
    if (!lecture) {
      res.status(404).send("강의를 찾을 수 없습니다.");
      return;
    }
    const decoratedLecture = decorateLecture(lecture);
    if (!decoratedLecture.status.isOpen) {
      res.status(409).render("lecture-detail", {
        title: lecture.title,
        lecture: decoratedLecture,
        errors: ["마감된 강의는 신청할 수 없습니다."],
        form: req.body
      });
      return;
    }

    const { application, errors } = validateApplicationInput(req.body, req.params.id);
    if (errors.length > 0) {
      res.status(422).render("lecture-detail", {
        title: lecture.title,
        lecture: decoratedLecture,
        errors,
        form: req.body
      });
      return;
    }

    const applicationId = db.createApplication(application);
    res.redirect(`/applications/${applicationId}/success`);
  });

  app.get("/applications/:id/success", (req, res) => {
    res.render("success", { title: "신청 완료" });
  });

  app.get("/admin/login", (req, res) => {
    res.render("admin-login", { title: "관리자 로그인", error: "" });
  });

  app.post("/admin/login", (req, res) => {
    if (req.body.password === adminPassword) {
      req.session.isAdmin = true;
      res.redirect("/admin");
      return;
    }
    res.status(401).render("admin-login", { title: "관리자 로그인", error: "비밀번호를 확인해 주세요." });
  });

  app.post("/admin/logout", requireAdmin, (req, res) => {
    req.session.destroy(() => res.redirect("/admin/login"));
  });

  app.get("/admin", requireAdmin, (req, res) => {
    const lectures = db.listLecturesWithCounts().map(decorateLecture);
    const allApplications = db.listApplications();
    const totalPages = Math.max(1, Math.ceil(allApplications.length / APPLICATIONS_PER_PAGE));
    const requestedPage = Number.parseInt(req.query.page, 10);
    const currentPage = Math.min(Math.max(Number.isNaN(requestedPage) ? 1 : requestedPage, 1), totalPages);
    const pageStart = (currentPage - 1) * APPLICATIONS_PER_PAGE;

    res.render("admin-dashboard", {
      title: "관리자 페이지",
      lectures,
      applications: allApplications.slice(pageStart, pageStart + APPLICATIONS_PER_PAGE),
      applicationsPage: {
        current: currentPage,
        hasNext: currentPage < totalPages,
        hasPrevious: currentPage > 1,
        perPage: APPLICATIONS_PER_PAGE,
        total: allApplications.length,
        totalPages
      }
    });
  });

  app.get("/admin/applications/export.html", requireAdmin, (req, res) => {
    res.type("html").send(renderApplicationsExport(db.listApplications()));
  });

  app.get("/admin/applications/export.xls", requireAdmin, (req, res) => {
    res
      .type("application/vnd.ms-excel; charset=utf-8")
      .set("Content-Disposition", 'attachment; filename="applications.xls"')
      .send(renderApplicationsExport(db.listApplications()));
  });

  app.get("/admin/lectures/new", requireAdmin, (req, res) => {
    res.render("admin-lecture-form", {
      title: "강의 등록",
      action: "/admin/lectures",
      lecture: {},
      errors: []
    });
  });

  app.post("/admin/lectures", requireAdmin, (req, res) => {
    const { lecture, errors } = validateLectureInput(req.body);
    if (errors.length > 0) {
      res.status(422).render("admin-lecture-form", {
        title: "강의 등록",
        action: "/admin/lectures",
        lecture: req.body,
        errors
      });
      return;
    }
    db.createLecture(lecture);
    res.redirect("/admin");
  });

  app.get("/admin/lectures/:id/edit", requireAdmin, (req, res) => {
    const lecture = db.getLectureWithCount(req.params.id);
    if (!lecture) {
      res.status(404).send("강의를 찾을 수 없습니다.");
      return;
    }
    res.render("admin-lecture-form", {
      title: "강의 수정",
      action: `/admin/lectures/${lecture.id}`,
      lecture,
      errors: []
    });
  });

  app.post("/admin/lectures/:id", requireAdmin, (req, res) => {
    const { lecture, errors } = validateLectureInput(req.body);
    if (errors.length > 0) {
      res.status(422).render("admin-lecture-form", {
        title: "강의 수정",
        action: `/admin/lectures/${req.params.id}`,
        lecture: { ...req.body, id: req.params.id },
        errors
      });
      return;
    }
    db.updateLecture(req.params.id, lecture);
    res.redirect("/admin");
  });

  app.post("/admin/lectures/:id/delete", requireAdmin, (req, res) => {
    db.deleteLecture(req.params.id);
    res.redirect("/admin");
  });

  app.post("/admin/applications/:id/payment", requireAdmin, (req, res) => {
    db.setPaymentConfirmed(req.params.id, req.body.payment_confirmed === "on");
    res.redirect("/admin");
  });

  return { app, db };
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  const { app } = createApp();
  app.listen(port, () => {
    console.log(`논준모연구소 특강 신청 웹사이트: http://localhost:${port}`);
  });
}

module.exports = {
  createApp
};
