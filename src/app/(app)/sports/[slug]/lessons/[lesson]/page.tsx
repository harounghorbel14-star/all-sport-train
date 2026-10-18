import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { AppError } from "@/lib/server/errors";
import { getLesson } from "@/lib/services/sports";
import { Badge, Card, CardTitle, Notice, PageHeader } from "@/components/ui/primitives";
import { DrillBadges, SourceList } from "@/components/sports/badges";
import { LessonActions } from "./actions";
import { SaveOffline } from "@/components/pwa/save-offline";

async function load(userId: string, slug: string, lesson: string) {
  try {
    return await getLesson(userId, slug, lesson);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lesson: string }> }) {
  const { slug, lesson: lessonSlug } = await params;
  const { user } = await requireUser();
  const { hub, lesson, drills, completedLessons, prereqsMet, previous, next } = await load(user.id, slug, lessonSlug);
  const done = completedLessons.includes(lesson.slug);
  const c = lesson.content;
  const missing = lesson.prerequisites.filter((p) => !completedLessons.includes(p)).map((p) => hub.lessons.find((l) => l.slug === p));
  const sources = hub.sources.filter((s) => lesson.sources.includes(s.slug));
  const list = (items?: string[], ordered = false) => {
    if (!items?.length) return null;
    const L = ordered ? "ol" : "ul";
    return (
      <L className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 ps-5 text-sm text-muted`}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </L>
    );
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/sports/${slug}?tab=learn`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
        <ArrowLeft className="size-4 rtl:rotate-180" /> {hub.sport.name} lessons
      </Link>
      <PageHeader eyebrow={`${hub.sport.name} · ${lesson.level}`} title={lesson.title} subtitle={lesson.summary} />
      {!prereqsMet && (
        <Notice tone="warn" icon={<Lock className="size-4" />}>
          Recommended first:{" "}
          {missing.map((l, i) => (
            <span key={l?.slug ?? i}>
              {i > 0 && ", "}
              {l ? <Link href={`/sports/${slug}/lessons/${l.slug}`} className="underline">{l.title}</Link> : "an earlier lesson"}
            </span>
          ))}
          . You can still read this lesson.
        </Notice>
      )}
      {lesson.requiresSupervision && (
        <Notice tone="danger" icon={<ShieldAlert className="size-4" />}>
          Practise the partner parts of this lesson only with a qualified coach.
        </Notice>
      )}
      <Card>
        <CardTitle>What you&apos;ll learn</CardTitle>
        {list(c.objectives)}
      </Card>
      <Card>
        <CardTitle>Key points</CardTitle>
        {list(c.keyPoints)}
      </Card>
      {c.steps?.length ? (
        <Card>
          <CardTitle>Step by step</CardTitle>
          {list(c.steps, true)}
        </Card>
      ) : null}
      {c.mistakes?.length ? (
        <Card>
          <CardTitle>Common mistakes</CardTitle>
          {list(c.mistakes)}
        </Card>
      ) : null}
      {c.safety?.length ? (
        <Card>
          <CardTitle icon={<ShieldAlert className="size-4 text-warn" />}>Safety</CardTitle>
          {list(c.safety)}
        </Card>
      ) : null}
      {drills.length > 0 && (
        <Card>
          <CardTitle>Practise it</CardTitle>
          <ul className="space-y-2">
            {drills.map((d) => (
              <li key={d.slug}>
                <Link href={`/sports/${slug}?tab=drills#${d.slug}`} className="block rounded-xl bg-surface-2 p-3 hover:text-accent">
                  <span className="font-medium">{d.title}</span> <span className="text-xs text-muted">· {d.durationMin} min</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <DrillBadges contact={d.contact} requiresSupervision={d.requiresSupervision} setting={d.setting} minPlayers={d.minPlayers} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-subtle">The practice builder prefers drills from your next lesson.</p>
        </Card>
      )}
      {c.progressTest && (
        <Card>
          <CardTitle>Check your progress</CardTitle>
          <p className="text-sm text-muted">{c.progressTest.description}</p>
          {c.progressTest.metricKey && (
            <Link href={`/sports/${slug}?tab=progress`} className="mt-2 inline-block text-sm text-accent underline">
              Log a result
            </Link>
          )}
        </Card>
      )}
      {sources.length > 0 && <SourceList sources={sources} />}
      <div className="flex flex-wrap items-center gap-2">
        <LessonActions slug={slug} lesson={lesson.slug} done={done} />
        <SaveOffline url={`/sports/${slug}/lessons/${lesson.slug}`} title={`${hub.sport.name}: ${lesson.title}`} kind="lesson" />
      </div>
      <div className="flex justify-between text-sm">
        {previous ? (
          <Link href={`/sports/${slug}/lessons/${previous.slug}`} className="inline-flex items-center gap-1 text-muted hover:text-accent">
            <ArrowLeft className="size-4 rtl:rotate-180" /> {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/sports/${slug}/lessons/${next.slug}`} className="inline-flex items-center gap-1 text-muted hover:text-accent">
            {next.title} <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        )}
      </div>
      {done && <Badge tone="success">Completed</Badge>}
    </div>
  );
}
