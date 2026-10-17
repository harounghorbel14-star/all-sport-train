import { requireUser } from "@/lib/auth/server";
import { coachHistory } from "@/lib/ai/coach";
import { aiStatus } from "@/lib/ai/provider";
import { CoachChat } from "./chat";

export const metadata = { title: "AI Coach" };

export default async function CoachPage() {
  const { user, profile } = await requireUser();
  const messages = await coachHistory(user.id);
  return (
    <CoachChat
      initial={messages.map((m) => ({ id: m.id, role: m.role, content: m.content, provider: m.provider, action: m.action, createdAt: m.createdAt.toISOString() }))}
      ai={aiStatus()}
      nutritionShared={profile.nutritionInCoach}
    />
  );
}
