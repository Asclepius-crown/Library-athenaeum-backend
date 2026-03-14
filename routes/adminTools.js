import express from 'express';
import fs from 'fs';
import path from 'path';
import checkRole from '../middleware/role.js';
import authMiddleware from '../middleware/auth.js';
import { sendEmail } from '../utils/notificationScheduler.js';

const router = express.Router();

// Helper to update .env file
const updateEnvFile = (key, value) => {
  if (process.env.VERCEL) {
    console.warn("Skipping .env update on Vercel (Read-Only Filesystem).");
    return true; // Pretend it succeeded to allow memory update
  }

  const envPath = path.resolve(process.cwd(), '.env');
  
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp(`^${key}=.*`, 'm');
    
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    return true;
  } catch (error) {
    console.error(`Error updating .env file: ${error}`);
    return false;
  }
};

// Admin Only: Test Email Configuration
router.post('/test-email', authMiddleware, checkRole(['admin']), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Target email is required' });

  try {
    const subject = "Athenaeum System Test";
    const body = `
      <p>This is a test email from your Library Management System.</p>
      <p>If you are reading this, your email configuration (SMTP) is working correctly!</p>
      <p>✅ <strong>Success</strong></p>
    `;
    const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial; padding: 20px; text-align: center;">
      <h1 style="color: #06b6d4;">System Test</h1>
      ${body}
    </body>
    </html>
    `;

    await sendEmail(email, subject, html);
    res.json({ message: 'Test email sent successfully!' });
  } catch (error) {
    console.error("Test Email Error:", error);
    res.status(500).json({ message: error.message || 'Error sending test email' });
  }
});

// Admin Only: Update Email Configuration
router.post('/update-email-config', authMiddleware, checkRole(['admin']), async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and App Password are required.' });
  }

  try {
    // 1. Update .env file
    const emailUpdated = updateEnvFile('EMAIL_USER', email);
    const passUpdated = updateEnvFile('EMAIL_PASS', password);

    if (!emailUpdated || !passUpdated) {
      throw new Error('Failed to write to .env file');
    }

    // 2. Update process.env in memory immediately
    process.env.EMAIL_USER = email;
    process.env.EMAIL_PASS = password;

    res.json({ message: 'Configuration updated successfully! You can now send a test email.' });
  } catch (error) {
    console.error('Config Update Error:', error);
    res.status(500).json({ message: 'Failed to update configuration. Check server permissions.' });
  }
});

export default router;