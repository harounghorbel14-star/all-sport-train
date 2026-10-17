"use client";

import { Flag, Flame, MessageCircle, Search, Send, ShieldBan, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Badge, Button, Card, CardTitle, EmptyState, Input, Notice, Segmented, Select, Textarea, cx } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlay";

interface Post {
  id: string;
  kind: string;
  body: string;
  visibility: string;
  group: string | null;
  createdAt: string;
  author: { handle?: string; displayName?: string; isSelf: boolean };
  reactions: number;
  reacted: boolean;
  comments: { id: string; body: string; author?: string; handle?: string; isSelf: boolean }[];
  commentCount: number;
}
interface Conn { id: string; status: string; handle?: string; displayName?: string }
interface Group { id: string; name: string; description: string; sport: string | null; members: number; joined: boolean; isOwner: boolean }

export function CommunityApp({ initialFeed, connections, groups: initialGroups, me }: { initialFeed: { posts: Post[]; nextCursor: string | null }; connections: { friends: Conn[]; incoming: Conn[]; outgoing: Conn[] }; groups: Group[]; me: { handle: string; visibility: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"feed" | "friends" | "groups">("feed");
  const [posts, setPosts] = useState(initialFeed.posts);
  const [cursor, setCursor] = useState(initialFeed.nextCursor);
  const [groups, setGroups] = useState(initialGroups);
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"friends" | "public" | "group">("friends");
  const [postGroup, setPostGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ type: "post" | "comment" | "user"; id: string } | null>(null);
  const [reason, setReason] = useState("");

  async function loadFeed(group = groupFilter, more = false) {
    const r = await api<{ posts: Post[]; nextCursor: string | null }>(`/api/community/feed?${group ? `group=${group}&` : ""}${more && cursor ? `cursor=${cursor}` : ""}`);
    setPosts(more ? [...posts, ...r.posts] : r.posts);
    setCursor(r.nextCursor);
  }

  async function publish() {
    setBusy(true);
    try {
      await api("/api/community/posts", { body: { body, kind: "text", visibility, groupId: visibility === "group" ? postGroup : undefined } });
      setBody("");
      await loadFeed();
      toast("Posted");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not post", "error");
    } finally {
      setBusy(false);
    }
  }
  async function react(id: string) {
    const r = await api<{ reacted: boolean }>(`/api/community/posts/${id}/react`, { method: "POST" }).catch(() => null);
    if (r) setPosts((p) => p.map((x) => (x.id === id ? { ...x, reacted: r.reacted, reactions: x.reactions + (r.reacted ? 1 : -1) } : x)));
  }
  async function comment(id: string, text: string) {
    try {
      await api(`/api/community/posts/${id}/comments`, { body: { body: text } });
      await loadFeed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not comment", "error");
    }
  }
  async function del(id: string) {
    await api(`/api/community/posts/${id}`, { method: "DELETE" }).catch(() => undefined);
    setPosts((p) => p.filter((x) => x.id !== id));
  }
  async function delComment(id: string) {
    await api(`/api/community/comments/${id}`, { method: "DELETE" }).catch(() => undefined);
    await loadFeed();
  }
  async function block(handle?: string) {
    if (!handle || !confirm(`Block @${handle}? You won't see each other's posts and any connection is removed.`)) return;
    await api("/api/community/block", { body: { handle } }).catch(() => undefined);
    toast(`@${handle} blocked`);
    await loadFeed();
    router.refresh();
  }
  async function sendReport() {
    if (!report) return;
    try {
      await api("/api/community/report", { body: { targetType: report.type, targetId: report.id, reason } });
      toast("Report sent. Thank you.");
      setReport(null);
      setReason("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not report", "error");
    }
  }

  return (
    <div className="space-y-5">
      <Segmented label="community" value={tab} onChange={setTab} options={[{ value: "feed", label: "Feed" }, { value: "friends", label: `Friends${connections.incoming.length ? ` (${connections.incoming.length})` : ""}` }, { value: "groups", label: "Groups" }]} />
      {me.visibility === "private" && <Notice tone="info">Your profile is private — others can&apos;t find you. Change this in <Link href="/profile" className="underline">Profile → Privacy</Link>.</Notice>}

      {tab === "feed" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <Textarea placeholder="Share a win, a question or some encouragement…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} aria-label="New post" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Select aria-label="Visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className="h-9 w-36 text-sm">
                    <option value="friends">Friends</option>
                    <option value="public">Public</option>
                    {groups.some((g) => g.joined) && <option value="group">A group</option>}
                  </Select>
                  {visibility === "group" && (
                    <Select aria-label="Group" value={postGroup} onChange={(e) => setPostGroup(e.target.value)} className="h-9 w-40 text-sm">
                      <option value="">Choose…</option>
                      {groups.filter((g) => g.joined).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </Select>
                  )}
                </div>
                <Button onClick={publish} loading={busy} disabled={!body.trim() || (visibility === "group" && !postGroup)} icon={<Send className="size-4" />}>Post</Button>
              </div>
              <p className="mt-2 text-[11px] text-subtle">Text only — photos can&apos;t be attached to posts, so body images are never published.</p>
            </Card>
            {groupFilter && (
              <div className="flex items-center gap-2 text-sm">
                <Badge tone="info">Group: {groups.find((g) => g.id === groupFilter)?.name}</Badge>
                <button className="text-muted underline" onClick={() => { setGroupFilter(""); loadFeed(""); }}>Show all</button>
              </div>
            )}
            {posts.length === 0 ? (
              <EmptyState icon={<Users className="size-5" />} title="Nothing here yet" body="Add friends or join a group to fill your feed — or share the first post." />
            ) : (
              posts.map((p) => <PostCard key={p.id} p={p} onReact={react} onComment={comment} onDelete={del} onDeleteComment={delComment} onReport={(type, id) => setReport({ type, id })} onBlock={block} />)
            )}
            {cursor && <Button variant="ghost" onClick={() => loadFeed(groupFilter, true)}>Load more</Button>}
          </div>
          <FriendsPanel connections={connections} compact />
        </div>
      )}

      {tab === "friends" && <FriendsPanel connections={connections} />}

      {tab === "groups" && <GroupsPanel groups={groups} setGroups={setGroups} onOpen={(id) => { setGroupFilter(id); setTab("feed"); loadFeed(id); }} />}

      <Sheet open={!!report} onClose={() => setReport(null)} title="Report content">
        <Textarea placeholder="What's wrong? (spam, harassment, unsafe advice…)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} aria-label="Reason" />
        <Button className="mt-3 w-full" onClick={sendReport} disabled={!reason.trim()}>Send report</Button>
      </Sheet>
    </div>
  );
}

function PostCard({ p, onReact, onComment, onDelete, onDeleteComment, onReport, onBlock }: { p: Post; onReact: (id: string) => void; onComment: (id: string, t: string) => void; onDelete: (id: string) => void; onDeleteComment: (id: string) => void; onReport: (t: "post" | "comment" | "user", id: string) => void; onBlock: (h?: string) => void }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{p.author.displayName} <span className="text-xs font-normal text-subtle">@{p.author.handle}</span></p>
          <p className="text-[11px] text-subtle">{new Date(p.createdAt).toLocaleString()} · {p.group ?? p.visibility}{p.kind !== "text" && <> · <Badge tone="accent">{p.kind}</Badge></>}</p>
        </div>
        <div className="flex gap-1">
          {p.author.isSelf ? (
            <button aria-label="Delete post" onClick={() => onDelete(p.id)} className="grid size-8 place-items-center rounded-lg text-muted hover:text-danger"><Trash2 className="size-4" /></button>
          ) : (
            <>
              <button aria-label="Report post" onClick={() => onReport("post", p.id)} className="grid size-8 place-items-center rounded-lg text-muted hover:text-warn"><Flag className="size-4" /></button>
              <button aria-label={`Block @${p.author.handle}`} onClick={() => onBlock(p.author.handle)} className="grid size-8 place-items-center rounded-lg text-muted hover:text-danger"><ShieldBan className="size-4" /></button>
            </>
          )}
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => onReact(p.id)} aria-pressed={p.reacted} className={cx("flex items-center gap-1 rounded-full px-3 py-1 text-sm", p.reacted ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted")}><Flame className="size-4" /> {p.reactions}</button>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-sm text-muted"><MessageCircle className="size-4" /> {p.commentCount}</button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {p.comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <p><span className="font-semibold">{c.author}</span> {c.body}</p>
              {c.isSelf || p.author.isSelf ? (
                <button aria-label="Delete comment" onClick={() => onDeleteComment(c.id)} className="text-subtle hover:text-danger"><Trash2 className="size-3.5" /></button>
              ) : (
                <button aria-label="Report comment" onClick={() => onReport("comment", c.id)} className="text-subtle hover:text-warn"><Flag className="size-3.5" /></button>
              )}
            </div>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onComment(p.id, text); setText(""); } }} className="flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" maxLength={500} className="h-9" aria-label="Comment" />
            <Button type="submit" size="sm" disabled={!text.trim()}>Reply</Button>
          </form>
        </div>
      )}
    </Card>
  );
}

function FriendsPanel({ connections, compact }: { connections: { friends: Conn[]; incoming: Conn[]; outgoing: Conn[] }; compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ handle: string; displayName: string }[]>([]);
  async function search() {
    if (q.trim().length < 2) return;
    const r = await api<{ athletes: { handle: string; displayName: string }[] }>(`/api/community/athletes?q=${encodeURIComponent(q)}`).catch(() => ({ athletes: [] }));
    setResults(r.athletes);
  }
  async function add(handle: string) {
    try {
      await api("/api/community/friends", { body: { handle } });
      toast("Request sent");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not send", "error");
    }
  }
  async function respond(id: string, accept: boolean) {
    await api(`/api/community/friends/${id}`, { method: "PATCH", body: { accept } }).catch(() => undefined);
    router.refresh();
  }
  async function remove(id: string) {
    await api(`/api/community/friends/${id}`, { method: "DELETE" }).catch(() => undefined);
    router.refresh();
  }
  return (
    <div className={cx("space-y-4", !compact && "grid gap-5 space-y-0 lg:grid-cols-2")}>
      <Card>
        <CardTitle icon={<Search className="size-4" />}>Find athletes</CardTitle>
        <form onSubmit={(e) => { e.preventDefault(); search(); }} className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or @handle" aria-label="Search athletes" className="h-10" />
          <Button type="submit" size="md" variant="secondary">Search</Button>
        </form>
        <ul className="mt-3 space-y-2">
          {results.map((r) => (
            <li key={r.handle} className="flex items-center justify-between text-sm">
              <span>{r.displayName} <span className="text-subtle">@{r.handle}</span></span>
              <Button size="sm" variant="outline" onClick={() => add(r.handle)} icon={<UserPlus className="size-3.5" />}>Add</Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle icon={<Users className="size-4" />}>Friends</CardTitle>
        {connections.incoming.length > 0 && (
          <ul className="mb-4 space-y-2">
            {connections.incoming.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl bg-accent-soft px-3 py-2 text-sm">
                <span>{c.displayName} wants to connect</span>
                <span className="flex gap-1"><Button size="sm" onClick={() => respond(c.id, true)}>Accept</Button><Button size="sm" variant="ghost" onClick={() => respond(c.id, false)}>Decline</Button></span>
              </li>
            ))}
          </ul>
        )}
        {connections.friends.length === 0 ? (
          <p className="text-sm text-muted">No friends yet. Search for training partners above.</p>
        ) : (
          <ul className="space-y-2">
            {connections.friends.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>{c.displayName} <span className="text-subtle">@{c.handle}</span></span>
                <button aria-label={`Remove ${c.displayName}`} onClick={() => remove(c.id)} className="text-muted hover:text-danger"><UserMinus className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {connections.outgoing.length > 0 && <p className="mt-3 text-xs text-subtle">Pending: {connections.outgoing.map((c) => `@${c.handle}`).join(", ")}</p>}
      </Card>
    </div>
  );
}

function GroupsPanel({ groups, setGroups, onOpen }: { groups: Group[]; setGroups: (g: Group[]) => void; onOpen: (id: string) => void }) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  async function refresh() {
    const r = await api<{ groups: Group[] }>("/api/community/groups");
    setGroups(r.groups);
  }
  async function toggle(g: Group) {
    try {
      await api(`/api/community/groups/${g.id}`, { body: { join: !g.joined } });
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update", "error");
    }
  }
  async function create() {
    try {
      await api("/api/community/groups", { body: { name, description: desc } });
      setCreating(false);
      setName("");
      setDesc("");
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create", "error");
    }
  }
  return (
    <div className="space-y-4">
      <Button onClick={() => setCreating(true)} icon={<Users className="size-4" />}>Create a group</Button>
      {groups.length === 0 ? (
        <EmptyState title="No groups yet" body="Start one for your crew, gym or park workout spot." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id}>
              <p className="font-semibold">{g.name}</p>
              <p className="text-xs text-muted">{g.description}</p>
              <p className="mt-1 text-[11px] text-subtle">{g.members} member{g.members === 1 ? "" : "s"}</p>
              <div className="mt-3 flex gap-2">
                {g.joined && <Button size="sm" variant="secondary" onClick={() => onOpen(g.id)}>Open feed</Button>}
                {!g.isOwner && <Button size="sm" variant={g.joined ? "ghost" : "primary"} onClick={() => toggle(g)}>{g.joined ? "Leave" : "Join"}</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Sheet open={creating} onClose={() => setCreating(false)} title="Create a group">
        <div className="space-y-3">
          <Input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Group name" />
          <Textarea placeholder="What's this group about?" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} aria-label="Description" />
          <Button className="w-full" onClick={create} disabled={!name.trim() || !desc.trim()}>Create</Button>
        </div>
      </Sheet>
    </div>
  );
}
