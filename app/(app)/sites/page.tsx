import { createClient } from "@/lib/supabase/server";
import { SitesClient } from "./sites-client";
import type { Site } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const supabase = await createClient();

  const { data: sites, error } = await supabase
    .from("sites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Failed to load sites: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the endpoints that receive keep-alive pings.
        </p>
      </div>
      <SitesClient initialSites={(sites as Site[]) ?? []} />
    </div>
  );
}
