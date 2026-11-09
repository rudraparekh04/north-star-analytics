import { redirect } from "next/navigation";
import AuthPageShell from "@/app/components/AuthPageShell";
import SignInForm from "@/app/components/SignInForm";
import { getSession } from "@/app/lib/auth";

export default async function SignInPage() {
  if (await getSession()) redirect("/");

  return (
    <AuthPageShell
      eyebrow="Organization workspace"
      title="Welcome back"
      description="Sign in to continue to your analytics dashboard."
    >
      <SignInForm />
    </AuthPageShell>
  );
}
