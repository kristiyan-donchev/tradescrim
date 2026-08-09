import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { recordLessonCompletion, getCompletedLessons } from '../lib/lessons.js';

const router = Router();

router.use(requireAuth);

router.get('/completed', async (req, res) => {
  try {
    res.json({ completed: await getCompletedLessons(req.userId) });
  } catch (err) {
    console.error('get completed lessons error', err.message);
    res.status(500).json({ error: 'Could not load your lesson progress right now.' });
  }
});

router.post('/:lessonId/complete', async (req, res) => {
  try {
    const firstTryPerfect = Boolean(req.body.firstTryPerfect);
    await recordLessonCompletion(req.userId, req.params.lessonId, firstTryPerfect);
    res.json({ completed: await getCompletedLessons(req.userId) });
  } catch (err) {
    console.error('record lesson completion error', err.message);
    res.status(500).json({ error: 'Could not save your lesson progress right now.' });
  }
});

export default router;
