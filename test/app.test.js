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
