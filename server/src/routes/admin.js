import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { isKnownFeature, listFeaturesForAdmin, setFeaturePublished } from '../lib/features.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/features', async (_req, res) => {
  try {
    res.json({ features: await listFeaturesForAdmin() });
  } catch (err) {
    console.error('admin list features error', err.message);
    res.status(500).json({ error: 'Could not load features right now.' });
  }
});

router.post('/features/:key', async (req, res) => {
  const { key } = req.params;
  const { published } = req.body || {};
  if (!isKnownFeature(key)) return res.status(404).json({ error: 'Unknown feature.' });
  if (typeof published !== 'boolean') {
    return res.status(400).json({ error: 'published must be true or false.' });
  }
  try {
    await setFeaturePublished(key, published);
    console.log('feature publish state changed', { key, published, by: req.userId });
    res.json({ features: await listFeaturesForAdmin() });
  } catch (err) {
    console.error('admin set feature error', err.message);
    res.status(500).json({ error: 'Could not update that feature right now.' });
  }
});

export default router;
