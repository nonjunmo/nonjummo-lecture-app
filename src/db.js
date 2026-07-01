const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

function createDatabase(databasePath = path.join(process.cwd(), "data", "app.db")) {
  const resolvedPath = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const db = new Database(resolvedPath);
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS lectures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      schedule_at TEXT NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      application_deadline TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lecture_id INTEGER NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      depositor_name TEXT NOT NULL,
      payment_confirmed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  function listLecturesWithCounts() {
    return db.prepare(`
      SELECT
        lectures.*,
        COUNT(CASE WHEN applications.payment_confirmed = 1 THEN 1 END) AS confirmed_count
      FROM lectures
      LEFT JOIN applications ON applications.lecture_id = lectures.id
      GROUP BY lectures.id
      ORDER BY lectures.schedule_at ASC
    `).all();
  }

  function getLectureWithCount(id) {
    return db.prepare(`
      SELECT
        lectures.*,
        COUNT(CASE WHEN applications.payment_confirmed = 1 THEN 1 END) AS confirmed_count
      FROM lectures
      LEFT JOIN applications ON applications.lecture_id = lectures.id
      WHERE lectures.id = ?
      GROUP BY lectures.id
    `).get(id);
  }

  function createLecture(lecture) {
    const result = db.prepare(`
      INSERT INTO lectures (title, description, schedule_at, location, capacity, application_deadline)
      VALUES (@title, @description, @schedule_at, @location, @capacity, @application_deadline)
    `).run(lecture);
    return Number(result.lastInsertRowid);
  }

  function updateLecture(id, lecture) {
    return db.prepare(`
      UPDATE lectures
      SET title = @title,
          description = @description,
          schedule_at = @schedule_at,
          location = @location,
          capacity = @capacity,
          application_deadline = @application_deadline,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ ...lecture, id });
  }

  function deleteLecture(id) {
    return db.prepare("DELETE FROM lectures WHERE id = ?").run(id);
  }

  function createApplication(application) {
    const result = db.prepare(`
      INSERT INTO applications (lecture_id, name, phone, email, depositor_name)
      VALUES (@lecture_id, @name, @phone, @email, @depositor_name)
    `).run(application);
    return Number(result.lastInsertRowid);
  }

  function deleteApplication(id) {
    return db.prepare("DELETE FROM applications WHERE id = ?").run(id);
  }

  function listApplications() {
    return db.prepare(`
      SELECT applications.*, lectures.title AS lecture_title
      FROM applications
      JOIN lectures ON lectures.id = applications.lecture_id
      ORDER BY applications.created_at DESC, applications.id DESC
    `).all();
  }

  function setPaymentConfirmed(id, confirmed) {
    return db.prepare(`
      UPDATE applications
      SET payment_confirmed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(confirmed ? 1 : 0, id);
  }

  return {
    createApplication,
    createLecture,
    deleteApplication,
    deleteLecture,
    getLectureWithCount,
    listApplications,
    listLecturesWithCounts,
    setPaymentConfirmed,
    updateLecture
  };
}

module.exports = {
  createDatabase
};
