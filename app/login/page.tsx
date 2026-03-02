import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { LoginButton } from "./login-button";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/sites");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <Image src="/logo.png" alt="Keep Alive" width={48} height={48} className="rounded-xl" />
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Keep Alive
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to manage your endpoints
            </p>
          </div>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <LoginButton />
          <p className="text-xs text-center text-muted-foreground">
            Only authorized administrators can access this dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
