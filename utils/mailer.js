const https = require('https');

// Warn at startup if email config is missing
if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  WARNING: RESEND_API_KEY is not set! Result emails will NOT be sent.');
  console.warn('   Get a free API key at https://resend.com and add it to Render environment variables.');
}

const sendResultEmail = async (studentEmail, studentName, examTitle, score, totalMarks, percentage, passed) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const passStatus = passed ? '🎉 PASSED' : '❌ FAILED';
    const passColor = passed ? '#00d4aa' : '#ff4757';

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #eee; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: white;">📝 Exam Result</h1>
          <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">${examTitle}</p>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 16px; color: #ccc;">Hello <strong style="color: #fff;">${studentName}</strong>,</p>
          <p style="color: #aaa; line-height: 1.6;">Here are your exam results:</p>
          
          <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin: 20px 0;">
            <div style="text-align: center; margin-bottom: 16px;">
              <span style="font-size: 48px; font-weight: bold; color: ${passColor};">${percentage}%</span>
              <br/>
              <span style="font-size: 18px; color: ${passColor}; font-weight: 600;">${passStatus}</span>
            </div>
            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 16px 0;"/>
            <table style="width: 100%; color: #ccc; font-size: 14px;">
              <tr><td style="padding: 8px 0;">Score</td><td style="text-align: right; font-weight: bold; color: #fff;">${score} / ${totalMarks}</td></tr>
              <tr><td style="padding: 8px 0;">Percentage</td><td style="text-align: right; font-weight: bold; color: #fff;">${percentage}%</td></tr>
              <tr><td style="padding: 8px 0;">Status</td><td style="text-align: right; font-weight: bold; color: ${passColor};">${passed ? 'Passed' : 'Failed'}</td></tr>
            </table>
          </div>

          <p style="color: #888; font-size: 13px; text-align: center; margin-top: 24px;">
            This is an automated email from the Exam Platform.
          </p>
        </div>
      </div>
    `;

    // Use Resend API (works over HTTPS - no SMTP port blocking)
    const emailData = JSON.stringify({
      from: 'Exam Platform <onboarding@resend.dev>',
      to: [studentEmail],
      subject: `Exam Result: ${examTitle} — ${passed ? 'Passed ✅' : 'Failed ❌'}`,
      html: htmlContent
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(emailData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Resend API error (${res.statusCode}): ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(emailData);
      req.end();
    });

    console.log(`📧 Result email sent to ${studentEmail} (Resend ID: ${result.id})`);
    return true;
  } catch (err) {
    console.error(`❌ Email error: ${err.message}`);
    return false;
  }
};

module.exports = { sendResultEmail };
