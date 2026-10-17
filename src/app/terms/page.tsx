import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms">
      <h2>Not medical advice</h2>
      <p>APEX FIT provides general training, nutrition and sports education. It is not a medical service. Consult a qualified professional before starting a new program if you have a health condition, injury or are pregnant, and stop any exercise that causes pain.</p>
      <h2>Estimates and AI</h2>
      <p>Calorie numbers, AI coach answers, meal estimates and form feedback are estimates and can be wrong. Rules summaries are simplified and may be out of date; check the current rulebook of your league or federation.</p>
      <h2>Contact sports</h2>
      <p>The app never prescribes sparring or full-contact training. Partner and contact work must be supervised by a qualified coach.</p>
      <h2>Your account</h2>
      <p>Keep your password private. You can export or permanently delete your data from your profile at any time. Guest sessions and their data are deleted after 30 days of inactivity.</p>
      <h2>Community</h2>
      <p>Be respectful. Content that is reported repeatedly is hidden pending review, and accounts that abuse others may be removed.</p>
    </LegalPage>
  );
}
