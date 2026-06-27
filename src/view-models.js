function deadlineEnd(deadline) {
  return new Date(`${deadline}T23:59:59`);
}

function getLectureStatus(lecture, confirmedCount, now = new Date()) {
  const capacity = Number(lecture.capacity);
  const isFull = confirmedCount >= capacity;
  const isPastDeadline = lecture.application_deadline
    ? now > deadlineEnd(lecture.application_deadline)
    : false;
  const isOpen = !isFull && !isPastDeadline;

  return {
    label: isOpen ? "신청중" : "마감",
    isOpen,
    confirmedCount,
    capacity
  };
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function buildCalendarWeeks(lectures) {
  if (lectures.length === 0) return [];

  const dates = lectures.map((lecture) => new Date(lecture.schedule_at));
  const firstLectureDate = new Date(Math.min(...dates));
  const year = firstLectureDate.getFullYear();
  const month = firstLectureDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    cells.push({ day: "", lectures: [] });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      day,
      lectures: lectures.filter((lecture) => lecture.schedule_at.slice(0, 10) === key)
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: "", lectures: [] });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

module.exports = {
  buildCalendarWeeks,
  formatDate,
  formatDateTime,
  getLectureStatus
};
