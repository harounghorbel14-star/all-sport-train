import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/today");
  return <AuthForm mode="login" />;
}
