import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { FEATURES, getPublishedFeatureKeys, isAdminUser } from '../lib/features.js';

const router = Router();

// Which flagged features the caller gets. Everyone receives the published
// ones; admins also receive the unpublished ones as `preview`, so the client
// can show them (or not — admins can switch preview off to see the site as
// everyone else does). Unpublished feature keys are never sent to non-admins.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const published = await getPublishedFeatureKeys();
    const preview = isAdminUser(req.user) ? FEATURES.map((f) => f.key).filter((k) => !published.has(k)) : [];
    res.json({ published: [...published], preview });
  } catch (err) {
    console.error('get features error', err.message);
    res.status(500).json({ error: 'Could not load features right now.' });
  }
});

export default router;
