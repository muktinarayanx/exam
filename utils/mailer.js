const nodemailer = require('nodemailer');

// Warn at startup if email config is missing
if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️  WARNING: Email environment variables (EMAIL_HOST, EMAIL_USER, EMAIL_PASS) are not fully configured!');
  console.warn('   Result emails will NOT be sent. Set these in your Render environment variables.');
}

const createTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email not configured: EMAIL_HOST, EMAIL_USER, or EMAIL_PASS is missing');
  }
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
};

const sendResultEmail = async (studentEmail, studentName, examTitle, score, totalMarks, percentage, passed) => {
  try {
    const transporter = createTransporter();

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

    await transporter.sendMail({
      from: `"Exam Platform" <${process.env.EMAIL_USER}>`,
      to: studentEmail,
      subject: `Exam Result: ${examTitle} — ${passed ? 'Passed ✅' : 'Failed ❌'}`,
      html: htmlContent
    });

    console.log(`📧 Result email sent to ${studentEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ Email error: ${err.message}`);
    return false;
  }
};

module.exports = { sendResultEmail };
