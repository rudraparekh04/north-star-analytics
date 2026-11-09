import { redirect } from "next/navigation";
import AuthPageShell from "@/app/components/AuthPageShell";
import SignUpForm from "@/app/components/SignUpForm";
import { getSession } from "@/app/lib/auth";
import { getAvailableOrganizations } from "@/app/lib/organization-queries";

export default async function SignUpPage() {
  if (await getSession()) redirect("/");
  const organizations = await getAvailableOrganizations();

  return (
    <AuthPageShell
      eyebrow="Create an account"
      title="Join your workspace"
      description="Set up your account and request access to your organization."
    >
      <SignUpForm organizations={organizations} />
    </AuthPageShell>
  );
}
