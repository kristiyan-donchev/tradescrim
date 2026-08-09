import { pool } from '../db.js';

// First completion wins — if a lesson is somehow "completed" again (e.g. the
// user redoes it), completed_at and first_try_perfect stay whatever they
// were the first time, since that's what the streak/badges are meant to
// reflect.
export async function recordLessonCompletion(userId, lessonId, firstTryPerfect) {
  await pool.query(
    `INSERT INTO lesson_completions (user_id, lesson_id, completed_at, first_try_perfect)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, lesson_id) DO NOTHING`,
    [userId, lessonId, Date.now(), firstTryPerfect]
  );
}

export async function getCompletedLessons(userId) {
  const result = await pool.query(
    `SELECT lesson_id AS "lessonId", completed_at AS "completedAt", first_try_perfect AS "firstTryPerfect"
     FROM lesson_completions WHERE user_id = $1 ORDER BY completed_at ASC`,
    [userId]
  );
  return result.rows;
}
