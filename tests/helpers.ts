import { resetRateLimits } from "@/lib/server/rate-limit";
import * as register from "@/app/api/auth/register/route";
import * as onboarding from "@/app/api/onboarding/route";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export async function call(handler: Handler, opts: { method?: string; path?: string; body?: unknown; cookie?: string; params?: Record<string, string>; headers?: Record<string, string>; form?: FormData } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const req = new Request(`http://localhost${opts.path ?? "/api/test"}`, {
    method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper returns loosely typed JSON
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, res };
}

let counter = 0;
export async function newUser(overrides: Partial<Record<string, unknown>> = {}, onboard = true) {
  resetRateLimits();
  const email = `user${Date.now()}${counter++}@example.com`;
  const r = await call(register.POST, { body: { email, password: "password123", displayName: `Tester ${counter}`, timezone: "UTC" } });
  if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.json)}`);
  const cookie = r.res.headers.get("set-cookie")!.split(";")[0];
  if (onboard) {
    const o = await call(onboarding.POST, { cookie, body: { ...defaultOnboarding, ...overrides } });
    if (o.status !== 200) throw new Error(`onboarding failed: ${JSON.stringify(o.json)}`);
  }
  return { cookie, email, userId: r.json.user.id as string };
}

export const defaultOnboarding = {
  ageRange: "25-34",
  sex: "unspecified",
  experience: "beginner",
  startFromZero: false,
  goals: ["calisthenics", "general_fitness"],
  emphasis: "balanced_calisthenics",
  sports: ["calisthenics"],
  location: "home",
  equipment: ["pullup_bar"],
  daysPerWeek: 3,
  trainingDays: [1, 3, 5],
  sessionMinutes: 30,
  activityLevel: "light",
  limitations: [],
  exercisePrefs: [],
  heightCm: 178,
  weightKg: 75,
  dietPrefs: [],
  allergies: [],
};
