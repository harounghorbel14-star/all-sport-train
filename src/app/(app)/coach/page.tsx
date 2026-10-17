import { requireUser } from "@/lib/auth/server";
import { coachHistory } from "@/lib/ai/coach";
import { aiStatus } from "@/lib/ai/provider";
import { mySports, sportBySlug } from "@/lib/services/sports";
import { CoachChat } from "./chat";

export const metadata = { title: "AI Coach" };

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const { user, profile } = await requireUser();
  const { sport } = await searchParams;
  const [messages, mine, selected] = await Promise.all([coachHistory(user.id), mySports(user.id), sport ? sportBySlug(sport) : null]);
  const sports = mine.map((s) => ({ slug: s.slug, name: s.name }));
  if (selected && !sports.some((s) => s.slug === selected.slug)) sports.unshift({ slug: selected.slug, name: selected.name });
  return (
    <CoachChat
      initial={messages.map((m) => ({ id: m.id, role: m.role, content: m.content, provider: m.provider, action: m.action, createdAt: m.createdAt.toISOString() }))}
      ai={aiStatus()}
      nutritionShared={profile.nutritionInCoach}
      sports={sports}
      initialSport={selected?.slug ?? ""}
    />
  );
}
