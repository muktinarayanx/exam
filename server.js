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
  const https = require('https');
  const result = {
    RESEND_API_KEY: process.env.RESEND_API_KEY ? `✅ set (${process.env.RESEND_API_KEY.length} chars)` : '❌ missing'
  };

  if (!process.env.RESEND_API_KEY) {
    result.error = '❌ RESEND_API_KEY not set. Get one free at https://resend.com';
    return res.json(result);
  }

  try {
    const testData = JSON.stringify({
      from: 'Exam Platform <onboarding@resend.dev>',
      to: ['foradvance685@gmail.com'],
      subject: 'Test Email from Exam Platform',
      text: 'If you see this, Resend email is working on Render!'
    });

    const apiResult = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(testData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.write(testData);
      req.end();
    });

    result.apiResponse = apiResult;
    if (apiResult.status >= 200 && apiResult.status < 300) {
      result.testEmail = '✅ Test email sent!';
    } else {
      result.error = `❌ API returned ${apiResult.status}: ${apiResult.body}`;
    }
  } catch (err) {
    result.error = `❌ ${err.message}`;
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
