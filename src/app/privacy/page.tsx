import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>What we store</h2>
      <p>Your email, display name, password hash (scrypt — never the password itself), onboarding answers, training, nutrition and activity logs, check-ins, and any photos or videos you upload. If you sign in with Google we store Google&apos;s account identifier and your verified email — not your Google password.</p>
      <h2>Sessions and security</h2>
      <p>We use one essential, HTTP-only session cookie. We keep a security log of sign-ins, failed attempts and password resets (IP address and browser) to protect your account.</p>
      <h2>Guests</h2>
      <p>Guest progress is stored on our server, linked to a cookie in your browser, and deleted after 30 days of inactivity. If you create an account, it is kept. If you sign in to an existing account, we ask before importing anything.</p>
      <h2>Private media</h2>
      <p>Progress photos and form-check uploads are private to you, stored outside the public web folder and never shared in the community.</p>
      <h2>AI</h2>
      <p>When an AI provider is configured, the coach sends the relevant parts of your training data with your question. Nutrition logs are only shared with the coach if you allow it in your profile.</p>
      <h2>Your rights</h2>
      <p>Export all your data or delete your account permanently from Profile → Account.</p>
    </LegalPage>
  );
}
