const assert = require("node:assert/strict");
const test = require("node:test");
const os = require("node:os");
const path = require("node:path");
const request = require("supertest");

const { createApp } = require("../src/server");
const { getLectureStatus } = require("../src/view-models");

function makeTestApp() {
  const databasePath = path.join(os.tmpdir(), `nonjummo-test-${Date.now()}-${Math.random()}.db`);
  return createApp({
    databasePath,
    adminPassword: "secret",
    sessionSecret: "test-secret",
    now: () => new Date("2026-06-26T10:00:00+09:00")
  });
}

test("lecture status is 신청중 when confirmed count is below capacity", () => {
  const status = getLectureStatus(
    { capacity: 2, application_deadline: "2026-07-10" },
    1,
    new Date("2026-06-26T10:00:00+09:00")
  );

  assert.equal(status.label, "신청중");
  assert.equal(status.isOpen, true);
});

test("lecture status is 마감 when confirmed count reaches capacity", () => {
  const status = getLectureStatus(
    { capacity: 2, application_deadline: "2026-07-10" },
    2,
    new Date("2026-06-26T10:00:00+09:00")
  );

  assert.equal(status.label, "마감");
  assert.equal(status.isOpen, false);
});

test("lecture status is 마감 after application deadline", () => {
  const status = getLectureStatus(
    { capacity: 20, application_deadline: "2026-06-01" },
    1,
    new Date("2026-06-26T10:00:00+09:00")
  );

  assert.equal(status.label, "마감");
  assert.equal(status.isOpen, false);
});

test("public pages show lectures, detail, application, and confirmed capacity status", async () => {
  const { app, db } = makeTestApp();
  const lectureId = db.createLecture({
    title: "방학 논술 집중 특강",
    description: "기출 분석과 답안 첨삭을 함께 진행합니다.",
    schedule_at: "2026-07-20T14:00",
    location: "논준모연구소 강의실",
    capacity: 1,
    application_deadline: "2026-07-10"
  });

  const listResponse = await request(app).get("/");
  assert.equal(listResponse.status, 200);
  assert.match(listResponse.text, /텍스트 목록/);
  assert.match(listResponse.text, /달력/);
  assert.match(listResponse.text, /방학 논술 집중 특강/);

  const detailResponse = await request(app).get(`/lectures/${lectureId}`);
  assert.equal(detailResponse.status, 200);
  assert.match(detailResponse.text, /현재 입금확인 완료 인원/);
  assert.match(detailResponse.text, /신청중/);
  assert.match(detailResponse.text, /입금자명/);

  const applyResponse = await request(app)
    .post(`/lectures/${lectureId}/apply`)
    .type("form")
    .send({
      name: "홍길동",
      phone: "010-1234-5678",
      email: "hong@example.com",
      depositor_name: "홍길동"
    });
  assert.equal(applyResponse.status, 302);
  assert.match(applyResponse.headers.location, /success/);

  const applications = db.listApplications();
  assert.equal(applications.length, 1);
  assert.equal(applications[0].name, "홍길동");

  db.setPaymentConfirmed(applications[0].id, true);
  const closedResponse = await request(app).get(`/lectures/${lectureId}`);
  assert.match(closedResponse.text, /1 \/ 1명/);
  assert.match(closedResponse.text, /마감/);
  assert.doesNotMatch(closedResponse.text, /신청하기/);
});

test("admin can log in and manage lectures", async () => {
  const { app, db } = makeTestApp();
  const agent = request.agent(app);

  const redirected = await agent.get("/admin");
  assert.equal(redirected.status, 302);
  assert.equal(redirected.headers.location, "/admin/login");

  const login = await agent.post("/admin/login").type("form").send({ password: "secret" });
  assert.equal(login.status, 302);
  assert.equal(login.headers.location, "/admin");

  const create = await agent.post("/admin/lectures").type("form").send({
    title: "관리자 등록 특강",
    description: "관리자가 등록한 강의입니다.",
    schedule_at: "2026-08-01T10:00",
    location: "세미나실 A",
    capacity: "12",
    application_deadline: "2026-07-25"
  });
  assert.equal(create.status, 302);
  const lecture = db.listLecturesWithCounts()[0];
  assert.equal(lecture.title, "관리자 등록 특강");

  const update = await agent.post(`/admin/lectures/${lecture.id}`).type("form").send({
    title: "수정된 특강",
    description: "수정된 내용입니다.",
    schedule_at: "2026-08-02T10:00",
    location: "세미나실 B",
    capacity: "15",
    application_deadline: "2026-07-26"
  });
  assert.equal(update.status, 302);
  assert.equal(db.getLectureWithCount(lecture.id).title, "수정된 특강");

  const remove = await agent.post(`/admin/lectures/${lecture.id}/delete`).type("form").send();
  assert.equal(remove.status, 302);
  assert.equal(db.listLecturesWithCounts().length, 0);
});

test("admin payment confirmation updates public confirmed count both ways", async () => {
  const { app, db } = makeTestApp();
  const agent = request.agent(app);
  await agent.post("/admin/login").type("form").send({ password: "secret" });

  const lectureId = db.createLecture({
    title: "입금 확인 테스트 특강",
    description: "입금 상태가 사용자 화면에 반영됩니다.",
    schedule_at: "2026-07-22T14:00",
    location: "논준모연구소",
    capacity: 3,
    application_deadline: "2026-07-15"
  });
  const applicationId = db.createApplication({
    lecture_id: lectureId,
    name: "김신청",
    phone: "010-0000-0000",
    email: "kim@example.com",
    depositor_name: "김입금"
  });

  const dashboard = await agent.get("/admin");
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.text, /김신청/);
  assert.match(dashboard.text, /김입금/);

  await agent
    .post(`/admin/applications/${applicationId}/payment`)
    .type("form")
    .send({ payment_confirmed: "on" });
  const confirmed = await request(app).get(`/lectures/${lectureId}`);
  assert.match(confirmed.text, /1 \/ 3명/);

  await agent.post(`/admin/applications/${applicationId}/payment`).type("form").send({});
  const unconfirmed = await request(app).get(`/lectures/${lectureId}`);
  assert.match(unconfirmed.text, /0 \/ 3명/);
});

test("admin applications list paginates and hides private fields behind details", async () => {
  const { app, db } = makeTestApp();
  const agent = request.agent(app);
  await agent.post("/admin/login").type("form").send({ password: "secret" });

  const lectureId = db.createLecture({
    title: "페이지 테스트 특강",
    description: "신청 내역 페이지네이션을 확인합니다.",
    schedule_at: "2026-07-22T14:00",
    location: "논준모연구소",
    capacity: 20,
    application_deadline: "2026-07-15"
  });

  for (let index = 1; index <= 12; index += 1) {
    db.createApplication({
      lecture_id: lectureId,
      name: `신청자${String(index).padStart(2, "0")}`,
      phone: `010-0000-${String(index).padStart(4, "0")}`,
      email: `applicant${index}@example.com`,
      depositor_name: `입금자${String(index).padStart(2, "0")}`
    });
  }

  const firstPage = await agent.get("/admin");
  assert.equal(firstPage.status, 200);
  assert.match(firstPage.text, /1 \/ 2페이지/);
  assert.match(firstPage.text, /신청자12/);
  assert.match(firstPage.text, /신청자03/);
  assert.doesNotMatch(firstPage.text, /신청자02<\/td>/);
  assert.doesNotMatch(firstPage.text, /<th>이메일<\/th>/);
  assert.doesNotMatch(firstPage.text, /<th>입금자명<\/th>/);
  assert.match(firstPage.text, /<summary>더보기<\/summary>/);
  assert.match(firstPage.text, /applicant12@example\.com/);
  assert.match(firstPage.text, /입금자12/);
  assert.doesNotMatch(firstPage.text, /<input type="checkbox"[^>]*>\s*입금확인/);

  const secondPage = await agent.get("/admin?page=2");
  assert.equal(secondPage.status, 200);
  assert.match(secondPage.text, /2 \/ 2페이지/);
  assert.match(secondPage.text, /신청자02/);
  assert.match(secondPage.text, /신청자01/);
  assert.doesNotMatch(secondPage.text, /신청자03<\/td>/);
});

test("admin can export all applications as html and excel-readable files", async () => {
  const { app, db } = makeTestApp();
  const agent = request.agent(app);
  await agent.post("/admin/login").type("form").send({ password: "secret" });

  const lectureId = db.createLecture({
    title: "내보내기 테스트 특강",
    description: "신청 내역 전체 내보내기를 확인합니다.",
    schedule_at: "2026-07-22T14:00",
    location: "논준모연구소",
    capacity: 20,
    application_deadline: "2026-07-15"
  });

  for (let index = 1; index <= 12; index += 1) {
    db.createApplication({
      lecture_id: lectureId,
      name: `내보내기${String(index).padStart(2, "0")}`,
      phone: `010-1111-${String(index).padStart(4, "0")}`,
      email: `export${index}@example.com`,
      depositor_name: `송금자${String(index).padStart(2, "0")}`
    });
  }

  const htmlExport = await agent.get("/admin/applications/export.html");
  assert.equal(htmlExport.status, 200);
  assert.match(htmlExport.headers["content-type"], /text\/html/);
  assert.match(htmlExport.text, /신청 내역/);
  assert.match(htmlExport.text, /내보내기12/);
  assert.match(htmlExport.text, /내보내기01/);
  assert.match(htmlExport.text, /export12@example\.com/);

  const excelExport = await agent.get("/admin/applications/export.xls");
  assert.equal(excelExport.status, 200);
  assert.match(excelExport.headers["content-type"], /application\/vnd\.ms-excel/);
  assert.match(excelExport.headers["content-disposition"], /attachment; filename="applications\.xls"/);
  assert.match(excelExport.text, /내보내기12/);
  assert.match(excelExport.text, /내보내기01/);
  assert.match(excelExport.text, /송금자01/);
});

test("admin can delete an application and confirmed count updates", async () => {
  const { app, db } = makeTestApp();
  const agent = request.agent(app);
  await agent.post("/admin/login").type("form").send({ password: "secret" });

  const lectureId = db.createLecture({
    title: "삭제 테스트 특강",
    description: "신청 내역 삭제를 확인합니다.",
    schedule_at: "2026-07-22T14:00",
    location: "논준모연구소",
    capacity: 3,
    application_deadline: "2026-07-15"
  });
  const applicationId = db.createApplication({
    lecture_id: lectureId,
    name: "삭제대상",
    phone: "010-2222-3333",
    email: "delete-me@example.com",
    depositor_name: "삭제입금"
  });
  db.setPaymentConfirmed(applicationId, true);
  for (let index = 1; index <= 10; index += 1) {
    db.createApplication({
      lecture_id: lectureId,
      name: `유지대상${String(index).padStart(2, "0")}`,
      phone: `010-4444-${String(index).padStart(4, "0")}`,
      email: `keep${index}@example.com`,
      depositor_name: `유지입금${String(index).padStart(2, "0")}`
    });
  }

  const dashboard = await agent.get("/admin?page=2");
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.text, new RegExp(`/admin/applications/${applicationId}/delete\\?page=2`));
  assert.match(dashboard.text, /정말 삭제하시겠습니까\?/);

  const remove = await agent.post(`/admin/applications/${applicationId}/delete?page=2`).type("form").send();
  assert.equal(remove.status, 302);
  assert.equal(remove.headers.location, "/admin?page=2");
  assert.equal(db.listApplications().some((application) => application.id === applicationId), false);

  const detail = await request(app).get(`/lectures/${lectureId}`);
  assert.match(detail.text, /0 \/ 3명/);
  assert.doesNotMatch(detail.text, /삭제대상/);
});
