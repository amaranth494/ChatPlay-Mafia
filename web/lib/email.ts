import nodemailer from 'nodemailer';

const getTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT || '587');
  const isSecure = port === 465 || process.env.SMTP_SECURE === 'true';
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: isSecure,
    requireTLS: !isSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });
};

export async function sendOtpEmail(to: string, code: string): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`[Email] SMTP not configured, logging OTP for ${to}: ${code}`);
    return false;
  }

  try {
    const transporter = getTransporter();
    
    // Verify connection first
    await transporter.verify();
    console.log(`[Email] SMTP connection verified`);
    
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@chatplay-mafia.com',
      to,
      subject: 'Your ChatPlay Mafia Verification Code',
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this code, please ignore this email.`,
      html: `
        <div style="font-family: 'Courier New', monospace; background: #1a1a1a; color: #e0e0e0; padding: 2rem; text-align: center;">
          <h1 style="letter-spacing: 0.2em; font-weight: 400;">CHATPLAY MAFIA</h1>
          <p>Your verification code:</p>
          <div style="font-size: 2rem; font-weight: bold; letter-spacing: 0.5em; background: #333; padding: 1rem 2rem; display: inline-block; margin: 1rem 0;">
            ${code}
          </div>
          <p style="color: #888; font-size: 0.875rem;">This code expires in 10 minutes.</p>
        </div>
      `,
    });
    
    console.log(`[Email] Sent OTP to ${to}:`, result.messageId);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    return false;
  }
}

export async function sendSms(to: string, code: string): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[SMS] Twilio not configured, logging OTP for ${to}: ${code}`);
    return false;
  }

  try {
    // Twilio integration would go here
    console.log(`[SMS] Would send SMS to ${to} with code ${code}`);
    return true;
  } catch (error) {
    console.error('[SMS] Failed to send SMS:', error);
    return false;
  }
}