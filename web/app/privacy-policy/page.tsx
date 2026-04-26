export const metadata = {
  title: 'Privacy Policy - ChatPlay Mafia',
  description: 'Privacy Policy for ChatPlay Mafia',
};

export default function PrivacyPolicy() {
  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '2rem',
      color: '#e0e0e0',
      background: '#1a1a1a',
      minHeight: '100vh',
      fontFamily: "'Courier New', monospace",
      lineHeight: '1.6'
    }}>
      <h1 style={{ 
        letterSpacing: '0.1em', 
        textAlign: 'center',
        borderBottom: '1px solid #333',
        paddingBottom: '1rem'
      }}>
        PRIVACY POLICY
      </h1>
      
      <p style={{ color: '#888', fontSize: '0.875rem' }}>
        Last updated: April 26, 2026
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        <strong>Account Information:</strong> When you register, we collect your email address and/or phone number for authentication purposes.
      </p>
      <p>
        <strong>Game Data:</strong> We store your in-game messages, conversation history with NPCs, and game progress.
      </p>
      <p>
        <strong>Passkey Data:</strong> If you use passkey authentication, we store credential identifiers associated with your account. We do not store your biometric data.
      </p>

      <h2>2. How We Use Your Information</h2>
      <p>
        <strong>Authentication:</strong> We use your email or phone to send verification codes and authenticate your account.
      </p>
      <p>
        <strong>Game Functionality:</strong> Your messages are used to provide AI-generated responses from NPCs within the game.
      </p>
      <p>
        <strong>Account Security:</strong> Passkey data is used to securely authenticate you without passwords.
      </p>

      <h2>3. Data Storage and Security</h2>
      <p>
        Your data is stored on secure servers with industry-standard encryption. We retain your data only as long as necessary to provide game services.
      </p>

      <h2>4. Third-Party Services</h2>
      <p>
        We use the following third-party services:
      </p>
      <ul>
        <li>OpenAI - For AI-generated NPC responses</li>
        <li>Railway - For hosting and data storage</li>
        <li>SMTP Services - For sending verification emails</li>
        <li>Twilio (optional) - For SMS verification</li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        We use essential cookies for authentication and session management. No tracking or advertising cookies are used.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        You have the right to:
      </p>
      <ul>
        <li>Access your personal data</li>
        <li>Delete your account and associated data</li>
        <li>Opt out of non-essential data processing</li>
      </ul>
      <p>
        Contact us at the email below to exercise these rights.
      </p>

      <h2>7. Contact</h2>
      <p>
        For privacy concerns, contact us at:<br />
        <strong>privacy@chatplay-mafia.com</strong> or <strong>castle.and.clark@gmail.com</strong>
      </p>

      <div style={{ 
        marginTop: '3rem', 
        paddingTop: '1rem', 
        borderTop: '1px solid #333',
        fontSize: '0.75rem',
        color: '#666'
      }}>
        <a href="/" style={{ color: '#888' }}>← Back to Game</a>
      </div>
    </div>
  );
}