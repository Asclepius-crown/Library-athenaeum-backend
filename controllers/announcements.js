import Announcement from '../models/Announcement.js';

export const createAnnouncement = async (req, res) => {
  try {
    const announcement = new Announcement({
      ...req.body,
      author: req.user.name
    });
    await announcement.save();
    res.status(201).json(announcement);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAnnouncements = async (req, res) => {
  try {
    const role = req.user ? req.user.role : 'student';
    const announcements = await Announcement.find({
      targetRole: { $in: ['all', role] }
    }).sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
