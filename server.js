require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB Atlas (non-blocking)
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/exams', require('./routes/exam'));
app.use('/api/student', require('./routes/student'));

// Debug: Test email endpoint (visit /api/debug/email-test in browser)
app.get('/api/debug/email-test', async (req, res) => {
  const nodemailer = require('nodemailer');
  const result = {
    envVars: {
      EMAIL_HOST: process.env.EMAIL_HOST ? '✅ set' : '❌ missing',
      EMAIL_PORT: process.env.EMAIL_PORT ? '✅ set' : '❌ missing',
      EMAIL_USER: process.env.EMAIL_USER ? `✅ ${process.env.EMAIL_USER}` : '❌ missing',
      EMAIL_PASS: process.env.EMAIL_PASS ? `✅ set (${process.env.EMAIL_PASS.length} chars)` : '❌ missing'
    }
  };

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.verify();
    result.smtpConnection = '✅ SMTP connection verified';

    // Try sending a test email to the sender itself
    await transporter.sendMail({
      from: `"Exam Platform" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: 'Test Email from Exam Platform',
      text: 'If you see this, email is working on Render!'
    });
    result.testEmail = '✅ Test email sent to ' + process.env.EMAIL_USER;
  } catch (err) {
    result.error = `❌ ${err.message}`;
    result.errorCode = err.code || 'unknown';
    result.fullError = err.toString();
  }

  res.json(result);
});

// Serve frontend pages
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Exam Platform running on http://0.0.0.0:${PORT}\n`);
});
