function requireText(body, field, label, errors) {
  const value = String(body[field] || "").trim();
  if (!value) errors.push(`${label}을(를) 입력해 주세요.`);
  return value;
}

function validateLectureInput(body) {
  const errors = [];
  const capacity = Number.parseInt(body.capacity, 10);
  const lecture = {
    title: requireText(body, "title", "강의 제목", errors),
    description: requireText(body, "description", "강의 내용", errors),
    schedule_at: requireText(body, "schedule_at", "강의 일정", errors),
    location: requireText(body, "location", "장소", errors),
    capacity,
    application_deadline: requireText(body, "application_deadline", "신청 마감일", errors)
  };

  if (!Number.isInteger(capacity) || capacity < 1) {
    errors.push("모집 정원은 1명 이상이어야 합니다.");
  }

  return { lecture, errors };
}

function validateApplicationInput(body, lectureId) {
  const errors = [];
  const application = {
    lecture_id: Number.parseInt(lectureId, 10),
    name: requireText(body, "name", "이름", errors),
    phone: requireText(body, "phone", "연락처", errors),
    email: requireText(body, "email", "이메일", errors),
    depositor_name: requireText(body, "depositor_name", "입금자명", errors)
  };

  if (!Number.isInteger(application.lecture_id)) {
    errors.push("신청 강의가 올바르지 않습니다.");
  }
  if (application.email && !application.email.includes("@")) {
    errors.push("이메일 형식을 확인해 주세요.");
  }

  return { application, errors };
}

module.exports = {
  validateApplicationInput,
  validateLectureInput
};
