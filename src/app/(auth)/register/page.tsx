import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await currentUser()) redirect("/today");
  return <AuthForm mode="register" />;
}
