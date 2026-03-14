import cron from 'node-cron';
import nodemailer from 'nodemailer';
import BorrowedBook from '../models/BorrowedBook.js';
import Student from '../models/Student.js';
import Reservation from '../models/Reservation.js';

// HTML Email Template Helper
const getHtmlTemplate = (title, bodyContent, footerNote = '') => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9; }
    .header { background-color: #06b6d4; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background-color: white; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
    .button { display: inline-block; padding: 10px 20px; background-color: #06b6d4; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
    .warning { color: #d32f2f; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>Athenaeum Library System</p>
      <p>${footerNote}</p>
    </div>
  </div>
</body>
</html>
`;

// Helper: Get Transporter dynamically to ensure env vars are loaded
const getTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Helper: Generic Email Sender
export const sendEmail = async (studentEmail, subject, htmlContent) => {
  if (!studentEmail) return false;

  const transporter = getTransporter();

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: studentEmail,
    subject: subject,
    html: htmlContent
  };

  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${studentEmail}: ${subject}`);
        return true;
    } else {
        console.warn('⚠️ EMAIL CREDENTIALS MISSING IN .ENV');
        console.log(`[Mock Email] To: ${studentEmail}, Subject: ${subject}`);
        console.log('Body Preview:', htmlContent.substring(0, 100) + '...');
        // Throw error so the UI sees the failure
        throw new Error('Missing EMAIL_USER or EMAIL_PASS in .env file');
    }
  } catch (error) {
    console.error(`Error sending email to ${studentEmail}:`, error);
    // Rethrow specific authentication errors for better UI feedback
    if (error.code === 'EAUTH') {
      throw new Error('Authentication failed. Check your App Password.');
    }
    throw error;
  }
};

// 1. Overdue Checker
export const checkOverdueBooks = async () => {
  console.log('Running overdue book check...');
  try {
    const today = new Date();
    const overdueBooks = await BorrowedBook.find({
      returnStatus: { $ne: 'Returned' },
      dueDate: { $lt: today }
    });

    for (const record of overdueBooks) {
      const dueDate = new Date(record.dueDate);
      const diffTime = Math.abs(today - dueDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      let student = null;
      if (record.studentId.match(/^[0-9a-fA-F]{24}$/)) {
          student = await Student.findById(record.studentId);
      } else {
           student = await Student.findOne({ rollNo: record.studentId });
      }

      if (student) {
        const subject = `ACTION REQUIRED: Overdue Book - ${record.bookTitle}`;
        const body = `
          <p>Dear ${student.name},</p>
          <p>This is an important reminder that the book <strong>"${record.bookTitle}"</strong> was due on <strong>${dueDate.toDateString()}</strong>.</p>
          <p class="warning">It is currently ${diffDays} days overdue.</p>
          <p>Please return the book immediately to avoid accumulating further fines.</p>
          <p>Fines are calculated daily based on our library policy.</p>
        `;
        const html = getHtmlTemplate('Overdue Notice', body, 'Please do not reply to this automated email.');

        try {
          await sendEmail(student.email, subject, html);
          if (record.returnStatus !== 'Overdue') {
              record.returnStatus = 'Overdue';
              await record.save();
          }
        } catch (e) {
          // Log but continue
          console.error("Failed to send overdue email:", e.message);
        }
      }
    }
  } catch (error) {
    console.error('Error in overdue book check:', error);
  }
};

// 2. Pre-Due Date Reminder (2 Days Before)
export const checkUpcomingDueBooks = async () => {
  console.log('Running upcoming due book check...');
  try {
    const today = new Date();
    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(today.getDate() + 2);
    
    twoDaysLater.setHours(0,0,0,0);
    const endOfTwoDaysLater = new Date(twoDaysLater);
    endOfTwoDaysLater.setHours(23,59,59,999);

    const upcomingBooks = await BorrowedBook.find({
      returnStatus: { $ne: 'Returned' },
      dueDate: { $gte: twoDaysLater, $lte: endOfTwoDaysLater }
    });

    for (const record of upcomingBooks) {
      let student = null;
      if (record.studentId.match(/^[0-9a-fA-F]{24}$/)) {
          student = await Student.findById(record.studentId);
      } else {
           student = await Student.findOne({ rollNo: record.studentId });
      }

      if (student) {
        const subject = `Reminder: Book Due Soon - ${record.bookTitle}`;
        const body = `
          <p>Dear ${student.name},</p>
          <p>We hope you are enjoying <strong>"${record.bookTitle}"</strong>.</p>
          <p>This is a friendly reminder that this book is due in <strong>2 days</strong> (on ${new Date(record.dueDate).toDateString()}).</p>
          <p>Please return or renew it before the due date to avoid any fines.</p>
        `;
        const html = getHtmlTemplate('Due Date Reminder', body);
        
        try {
          await sendEmail(student.email, subject, html);
        } catch (e) {
           console.error("Failed to send reminder email:", e.message);
        }
      }
    }
  } catch (error) {
    console.error('Error in upcoming due check:', error);
  }
};

// 3. Reservation Notification
export const checkReservationsAndNotify = async (bookId, bookTitle) => {
  try {
    const reservation = await Reservation.findOne({ 
      bookId: bookId, 
      status: 'Active' 
    }).sort({ reservationDate: 1 }).populate('studentId');

    if (reservation && reservation.studentId) {
      const student = reservation.studentId;
      const subject = `Good News! Book Available - ${bookTitle}`;
      const body = `
        <p>Dear ${student.name},</p>
        <p>The book you reserved, <strong>"${bookTitle}"</strong>, has just been returned and is now available.</p>
        <p>We have placed it on hold for you.</p>
        <p><strong>Please collect it within the next 24 hours.</strong></p>
      `;
      const html = getHtmlTemplate('Book Available', body);

      await sendEmail(student.email, subject, html);
      console.log(`Reservation notification sent to ${student.email}`);
    }
  } catch (error) {
    console.error('Error checking reservations:', error);
  }
};

// Initialize Scheduler (Deprecated for Vercel - kept for local dev reference or cleanup)
export const initNotificationScheduler = () => {
  console.log('Notification Scheduler logic is available for Vercel Cron.');
};