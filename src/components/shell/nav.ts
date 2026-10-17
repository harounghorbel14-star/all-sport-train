import { Activity, Apple, Bot, BookOpen, Camera, CalendarDays, Compass, Flame, GraduationCap, HeartPulse, House, TrendingUp, Trophy, User, Users } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

export const NAV = [
  { href: "/today", key: "today", icon: House, primary: true },
  { href: "/coach", key: "coach", icon: Bot, primary: true },
  { href: "/plans", key: "plans", icon: CalendarDays, primary: true },
  { href: "/academy", key: "academy", icon: GraduationCap, primary: false },
  { href: "/exercises", key: "exercises", icon: BookOpen, primary: false },
  { href: "/nutrition", key: "nutrition", icon: Apple, primary: true },
  { href: "/activity", key: "activity", icon: Activity, primary: false },
  { href: "/progress", key: "progress", icon: TrendingUp, primary: false },
  { href: "/recovery", key: "recovery", icon: HeartPulse, primary: false },
  { href: "/form-check", key: "formCheck", icon: Camera, primary: false },
  { href: "/challenges", key: "challenges", icon: Trophy, primary: false },
  { href: "/community", key: "community", icon: Users, primary: false },
  { href: "/sports", key: "sports", icon: Compass, primary: false },
  { href: "/profile", key: "profile", icon: User, primary: false },
] as const satisfies readonly { href: string; key: keyof Dictionary["nav"]; icon: unknown; primary: boolean }[];

export const StreakIcon = Flame;
