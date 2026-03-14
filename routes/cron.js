import express from 'express';
import { checkOverdueBooks, checkUpcomingDueBooks } from '../utils/notificationScheduler.js';

const router = express.Router();

// This route is called by Vercel Cron
router.get('/notifications', async (req, res) => {
  // Optional: Verify Vercel Cron signature if CRON_SECRET is set
  // const authHeader = req.headers.authorization;
  // if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  console.log('Received Cron Request for Notifications');
  
  try {
    const results = await Promise.allSettled([
      checkOverdueBooks(),
      checkUpcomingDueBooks()
    ]);

    const summary = results.map((r, i) => ({
      task: i === 0 ? 'Overdue Check' : 'Upcoming Due Check',
      status: r.status,
      reason: r.status === 'rejected' ? r.reason.message : undefined
    }));

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Cron Job Global Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
