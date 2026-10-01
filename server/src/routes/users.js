import { Router } from 'express';
import { optionalAuth, requireFeature } from '../middleware/auth.js';
import { getUserProfile } from '../lib/profiles.js';

const router = Router();

// Public, like the leaderboard it's opened from — guests can view profiles
// too, and private ones come back with holdings/transactions omitted.
router.get('/:id/profile', optionalAuth, requireFeature('profile-privacy'), async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user.' });
  }
  try {
    const profile = await getUserProfile(userId, req.userId);
    if (!profile) return res.status(404).json({ error: 'That user does not exist.' });
    res.json({ profile });
  } catch (err) {
    console.error('get user profile error', err.message);
    res.status(500).json({ error: 'Could not load that profile right now.' });
  }
});

export default router;
