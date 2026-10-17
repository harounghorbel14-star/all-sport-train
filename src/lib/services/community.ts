import { db } from "../server/db";
import { badRequest, conflict, forbidden, notFound } from "../server/errors";

const LINK_RE = /https?:\/\/|www\./gi;

/** Light anti-spam checks for user-generated text. */
export function checkText(text: string, max: number) {
  const t = text.trim();
  if (!t) throw badRequest("Write something first");
  if (t.length > max) throw badRequest(`Keep it under ${max} characters`);
  if ((t.match(LINK_RE) ?? []).length > 2) throw badRequest("Too many links");
  if (/(.)\1{14,}/.test(t)) throw badRequest("That looks like spam");
  return t;
}

async function blockedIds(userId: string) {
  const rows = await db.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
  return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}

export async function friendIds(userId: string) {
  const rows = await db.friendship.findMany({ where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] } });
  return new Set(rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId)));
}

async function canView(viewerId: string, ownerId: string, visibility: string) {
  if (viewerId === ownerId) return true;
  if ((await blockedIds(viewerId)).has(ownerId)) return false;
  if (visibility === "public") return true;
  if (visibility === "friends") return (await friendIds(viewerId)).has(ownerId);
  return false;
}

export async function publicProfile(viewerId: string, handle: string) {
  const p = await db.profile.findUnique({ where: { handle } });
  if (!p) throw notFound("Athlete not found");
  if (!(await canView(viewerId, p.userId, p.visibility))) throw notFound("This profile is private");
  const [achievements, workouts, friendship] = await Promise.all([
    db.userAchievement.count({ where: { userId: p.userId } }),
    db.workoutSession.count({ where: { userId: p.userId, status: "completed" } }),
    db.friendship.findFirst({ where: { OR: [{ requesterId: viewerId, addresseeId: p.userId }, { requesterId: p.userId, addresseeId: viewerId }] } }),
  ]);
  // Body data, photos and measurements are never exposed here.
  return {
    userId: p.userId,
    handle: p.handle,
    displayName: p.displayName,
    bio: p.bio,
    xp: p.xp,
    achievements,
    workouts: p.shareWorkouts || viewerId === p.userId ? workouts : null,
    isSelf: viewerId === p.userId,
    friendship: friendship ? { status: friendship.status, outgoing: friendship.requesterId === viewerId, id: friendship.id } : null,
  };
}

export async function searchAthletes(viewerId: string, q: string) {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const blocked = await blockedIds(viewerId);
  const rows = await db.profile.findMany({
    where: { visibility: { not: "private" }, OR: [{ handle: { contains: query } }, { displayName: { contains: q.trim() } }] },
    take: 20,
    select: { userId: true, handle: true, displayName: true },
  });
  return rows.filter((r) => r.userId !== viewerId && !blocked.has(r.userId));
}

export async function sendFriendRequest(userId: string, handle: string) {
  const target = await db.profile.findUnique({ where: { handle } });
  if (!target || target.userId === userId) throw badRequest("Can't add this athlete");
  if ((await blockedIds(userId)).has(target.userId)) throw forbidden("You can't connect with this athlete");
  if (target.visibility === "private") throw badRequest("This athlete isn't accepting requests");
  const existing = await db.friendship.findFirst({
    where: { OR: [{ requesterId: userId, addresseeId: target.userId }, { requesterId: target.userId, addresseeId: userId }] },
  });
  if (existing) {
    // Reciprocal request → accept automatically
    if (existing.status === "pending" && existing.addresseeId === userId) {
      return db.friendship.update({ where: { id: existing.id }, data: { status: "accepted" } });
    }
    throw conflict("Request already exists");
  }
  return db.friendship.create({ data: { requesterId: userId, addresseeId: target.userId } });
}

export async function respondFriendRequest(userId: string, id: string, accept: boolean) {
  const f = await db.friendship.findFirst({ where: { id, addresseeId: userId, status: "pending" } });
  if (!f) throw notFound("Request not found");
  if (accept) return db.friendship.update({ where: { id }, data: { status: "accepted" } });
  await db.friendship.delete({ where: { id } });
  return null;
}

export async function removeFriend(userId: string, id: string) {
  const { count } = await db.friendship.deleteMany({ where: { id, OR: [{ requesterId: userId }, { addresseeId: userId }] } });
  if (!count) throw notFound("Connection not found");
}

export async function listConnections(userId: string) {
  const rows = await db.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: { requester: { select: { profile: { select: { handle: true, displayName: true } } } }, addressee: { select: { profile: { select: { handle: true, displayName: true } } } } },
    take: 200,
  });
  const map = (r: (typeof rows)[number]) => {
    const other = r.requesterId === userId ? r.addressee : r.requester;
    return { id: r.id, status: r.status, outgoing: r.requesterId === userId, handle: other.profile?.handle, displayName: other.profile?.displayName };
  };
  return {
    friends: rows.filter((r) => r.status === "accepted").map(map),
    incoming: rows.filter((r) => r.status === "pending" && r.addresseeId === userId).map(map),
    outgoing: rows.filter((r) => r.status === "pending" && r.requesterId === userId).map(map),
  };
}

export async function blockUser(userId: string, handle: string) {
  const target = await db.profile.findUnique({ where: { handle } });
  if (!target || target.userId === userId) throw badRequest("Can't block this athlete");
  await db.block.upsert({ where: { blockerId_blockedId: { blockerId: userId, blockedId: target.userId } }, create: { blockerId: userId, blockedId: target.userId }, update: {} });
  await db.friendship.deleteMany({ where: { OR: [{ requesterId: userId, addresseeId: target.userId }, { requesterId: target.userId, addresseeId: userId }] } });
}

export async function unblockUser(userId: string, handle: string) {
  const target = await db.profile.findUnique({ where: { handle } });
  if (!target) throw notFound("Athlete not found");
  await db.block.deleteMany({ where: { blockerId: userId, blockedId: target.userId } });
}

export async function createPost(userId: string, input: { body: string; kind: "text" | "workout" | "achievement"; refId?: string; visibility: "friends" | "public" | "group"; groupId?: string }) {
  const body = checkText(input.body, 1000);
  if (input.visibility === "group") {
    if (!input.groupId) throw badRequest("Choose a group");
    const member = await db.groupMember.findUnique({ where: { groupId_userId: { groupId: input.groupId, userId } } });
    if (!member) throw forbidden("Join the group to post");
  }
  // Shared references must belong to the author.
  if (input.kind === "workout" && input.refId) {
    const s = await db.workoutSession.findFirst({ where: { id: input.refId, userId, status: "completed" } });
    if (!s) throw badRequest("Workout not found");
  }
  if (input.kind === "achievement" && input.refId) {
    const a = await db.userAchievement.findFirst({ where: { key: input.refId, userId } });
    if (!a) throw badRequest("Achievement not found");
  }
  return db.post.create({
    data: { authorId: userId, body, kind: input.kind, refId: input.refId ?? null, visibility: input.visibility, groupId: input.visibility === "group" ? input.groupId! : null },
  });
}

const postInclude = () => ({
  author: { select: { profile: { select: { handle: true, displayName: true } } } },
  comments: { where: { hidden: false }, orderBy: { createdAt: "asc" as const }, take: 20, include: { author: { select: { profile: { select: { handle: true, displayName: true } } } } } },
  reactions: { select: { userId: true, emoji: true } },
  _count: { select: { comments: true } },
  group: { select: { name: true } },
});

function shapePost(userId: string, p: Awaited<ReturnType<typeof db.post.findMany<{ include: ReturnType<typeof postInclude> }>>>[number], blocked: Set<string>) {
  return {
    id: p.id,
    kind: p.kind,
    body: p.body,
    refId: p.refId,
    visibility: p.visibility,
    group: p.group?.name ?? null,
    createdAt: p.createdAt,
    author: { handle: p.author.profile?.handle, displayName: p.author.profile?.displayName, isSelf: p.authorId === userId },
    reactions: p.reactions.length,
    reacted: p.reactions.some((r) => r.userId === userId),
    comments: p.comments.filter((c) => !blocked.has(c.authorId)).map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt, author: c.author.profile?.displayName, handle: c.author.profile?.handle, isSelf: c.authorId === userId })),
    commentCount: p._count.comments,
  };
}

export async function feed(userId: string, opts: { cursor?: string; groupId?: string } = {}) {
  const [friends, blocked, groups] = await Promise.all([
    friendIds(userId),
    blockedIds(userId),
    db.groupMember.findMany({ where: { userId }, select: { groupId: true } }),
  ]);
  const groupIds = groups.map((g) => g.groupId);
  if (opts.groupId && !groupIds.includes(opts.groupId)) throw forbidden("Join the group to view its feed");
  const where = opts.groupId
    ? { groupId: opts.groupId, hidden: false }
    : {
        hidden: false,
        authorId: { notIn: [...blocked] },
        OR: [
          { authorId: userId },
          { visibility: "public" },
          { visibility: "friends", authorId: { in: [...friends] } },
          { visibility: "group", groupId: { in: groupIds } },
        ],
      };
  const posts = await db.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 21,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: postInclude(),
  });
  const page = posts.slice(0, 20).filter((p) => !blocked.has(p.authorId));
  return { posts: page.map((p) => shapePost(userId, p, blocked)), nextCursor: posts.length > 20 ? posts[19].id : null };
}

async function visiblePost(userId: string, postId: string) {
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post || post.hidden) throw notFound("Post not found");
  if (post.authorId === userId) return post;
  if ((await blockedIds(userId)).has(post.authorId)) throw notFound("Post not found");
  if (post.visibility === "public") return post;
  if (post.visibility === "friends" && (await friendIds(userId)).has(post.authorId)) return post;
  if (post.visibility === "group" && post.groupId && (await db.groupMember.findUnique({ where: { groupId_userId: { groupId: post.groupId, userId } } }))) return post;
  throw notFound("Post not found");
}

export async function toggleReaction(userId: string, postId: string) {
  await visiblePost(userId, postId);
  const existing = await db.reaction.findUnique({ where: { postId_userId: { postId, userId } } });
  if (existing) await db.reaction.delete({ where: { postId_userId: { postId, userId } } });
  else await db.reaction.create({ data: { postId, userId } });
  return { reacted: !existing };
}

export async function addComment(userId: string, postId: string, body: string) {
  await visiblePost(userId, postId);
  return db.comment.create({ data: { postId, authorId: userId, body: checkText(body, 500) } });
}

export async function deletePost(userId: string, postId: string) {
  const { count } = await db.post.deleteMany({ where: { id: postId, authorId: userId } });
  if (!count) throw notFound("Post not found");
}

export async function deleteComment(userId: string, commentId: string) {
  const c = await db.comment.findUnique({ where: { id: commentId }, include: { post: true } });
  if (!c || (c.authorId !== userId && c.post.authorId !== userId)) throw notFound("Comment not found");
  await db.comment.delete({ where: { id: commentId } });
}

const AUTO_HIDE_REPORTS = 3;

export async function report(userId: string, input: { targetType: "post" | "comment" | "user"; targetId: string; reason: string }) {
  const reason = checkText(input.reason, 300);
  const dup = await db.report.findFirst({ where: { reporterId: userId, targetType: input.targetType, targetId: input.targetId } });
  if (dup) return dup;
  const r = await db.report.create({ data: { reporterId: userId, targetType: input.targetType, targetId: input.targetId, reason } });
  const count = await db.report.count({ where: { targetType: input.targetType, targetId: input.targetId, status: "open" } });
  if (count >= AUTO_HIDE_REPORTS) {
    if (input.targetType === "post") await db.post.updateMany({ where: { id: input.targetId }, data: { hidden: true } });
    if (input.targetType === "comment") await db.comment.updateMany({ where: { id: input.targetId }, data: { hidden: true } });
  }
  return r;
}

export async function listGroups(userId: string) {
  const groups = await db.group.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { _count: { select: { members: true } }, members: { where: { userId } } } });
  return groups.map((g) => ({ id: g.id, name: g.name, description: g.description, sport: g.sport, members: g._count.members, joined: g.members.length > 0, isOwner: g.ownerId === userId }));
}

export async function createGroup(userId: string, input: { name: string; description: string; sport?: string }) {
  const g = await db.group.create({ data: { ownerId: userId, name: checkText(input.name, 60), description: checkText(input.description, 300), sport: input.sport ?? null } });
  await db.groupMember.create({ data: { groupId: g.id, userId, role: "owner" } });
  return g;
}

export async function setGroupMembership(userId: string, groupId: string, join: boolean) {
  const g = await db.group.findUnique({ where: { id: groupId } });
  if (!g) throw notFound("Group not found");
  if (join) await db.groupMember.upsert({ where: { groupId_userId: { groupId, userId } }, create: { groupId, userId }, update: {} });
  else {
    if (g.ownerId === userId) throw badRequest("Owners can't leave their own group");
    await db.groupMember.deleteMany({ where: { groupId, userId } });
  }
  return { joined: join };
}
