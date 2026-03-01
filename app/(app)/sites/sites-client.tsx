"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  PlusCircle,
  Pencil,
  Trash2,
  Globe,
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Site, HttpMethod } from "@/types/database";

interface SiteFormData {
  name: string;
  description: string;
  url: string;
  method: HttpMethod;
  secret: string;
  headers: string;
  active: boolean;
}

const DEFAULT_FORM: SiteFormData = {
  name: "",
  description: "",
  url: "",
  method: "GET",
  secret: "",
  headers: "{}",
  active: true,
};

function methodColor(method: HttpMethod) {
  switch (method) {
    case "GET":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "POST":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "PUT":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    case "PATCH":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    default:
      return "";
  }
}

function isValidJson(str: string) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

interface Props {
  initialSites: Site[];
}

export function SitesClient({ initialSites }: Props) {
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogSite, setDeleteDialogSite] = useState<Site | null>(null);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [form, setForm] = useState<SiteFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = createClient();

  function openAdd() {
    setEditingSite(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEdit(site: Site) {
    setEditingSite(site);
    setForm({
      name: site.name,
      description: site.description ?? "",
      url: site.url,
      method: site.method,
      secret: site.secret ?? "",
      headers: JSON.stringify(site.headers ?? {}, null, 2),
      active: site.active,
    });
    setDialogOpen(true);
  }

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.url.trim()) {
      toast.error("URL is required");
      return;
    }
    if (!isValidJson(form.headers)) {
      toast.error("Headers must be valid JSON");
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      url: form.url.trim(),
      method: form.method,
      secret: form.secret.trim() || null,
      headers: JSON.parse(form.headers),
      active: form.active,
      updated_at: new Date().toISOString(),
    };

    if (editingSite) {
      const { data, error } = await supabase
        .from("sites")
        .update(payload)
        .eq("id", editingSite.id)
        .select()
        .single();

      if (error) {
        toast.error("Failed to update site: " + error.message);
      } else {
        setSites((prev) =>
          prev.map((s) => (s.id === editingSite.id ? (data as Site) : s))
        );
        toast.success("Site updated");
        setDialogOpen(false);
      }
    } else {
      const { data, error } = await supabase
        .from("sites")
        .insert(payload)
        .select()
        .single();

      if (error) {
        toast.error("Failed to add site: " + error.message);
      } else {
        setSites((prev) => [data as Site, ...prev]);
        toast.success("Site added");
        setDialogOpen(false);
      }
    }

    setSaving(false);
  }, [form, editingSite, supabase]);

  async function handleToggle(site: Site) {
    setTogglingId(site.id);
    const { data, error } = await supabase
      .from("sites")
      .update({ active: !site.active, updated_at: new Date().toISOString() })
      .eq("id", site.id)
      .select()
      .single();

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      setSites((prev) =>
        prev.map((s) => (s.id === site.id ? (data as Site) : s))
      );
    }
    setTogglingId(null);
  }

  async function handleDelete(site: Site) {
    setDeletingId(site.id);
    const { error } = await supabase.from("sites").delete().eq("id", site.id);

    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      setSites((prev) => prev.filter((s) => s.id !== site.id));
      toast.success("Site deleted");
    }
    setDeleteDialogSite(null);
    setDeletingId(null);
  }

  return (
    <>
      {sites.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <Globe className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">No sites yet</CardTitle>
            <CardDescription>
              Add your first endpoint to start sending keep-alive pings.
            </CardDescription>
            <Button onClick={openAdd} className="mt-4 gap-2">
              <PlusCircle className="w-4 h-4" />
              Add Site
            </Button>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {sites.length} site{sites.length !== 1 ? "s" : ""} ·{" "}
              {sites.filter((s) => s.active).length} active
            </p>
            <Button onClick={openAdd} size="sm" className="gap-2">
              <PlusCircle className="w-4 h-4" />
              Add Site
            </Button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="w-[80px]">Method</TableHead>
                  <TableHead className="w-[90px]">Auth</TableHead>
                  <TableHead className="w-[80px] text-center">Active</TableHead>
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id} className="group">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{site.name}</p>
                        {site.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {site.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono truncate max-w-[280px]"
                      >
                        {site.url}
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${methodColor(site.method)}`}
                      >
                        {site.method}
                      </span>
                    </TableCell>
                    <TableCell>
                      {site.secret ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Bearer
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={site.active}
                        disabled={togglingId === site.id}
                        onCheckedChange={() => handleToggle(site)}
                        className="scale-75 data-[state=checked]:bg-emerald-500"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openEdit(site)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => setDeleteDialogSite(site)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSite ? "Edit Site" : "Add Site"}</DialogTitle>
            <DialogDescription>
              {editingSite
                ? "Update the endpoint configuration."
                : "Add a new endpoint to receive keep-alive pings."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="My App"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description</Label>
              <Input
                id="desc"
                placeholder="Optional notes"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            {/* URL + Method */}
            <div className="space-y-1.5">
              <Label htmlFor="url">
                Endpoint URL <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Select
                  value={form.method}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, method: v as HttpMethod }))
                  }
                >
                  <SelectTrigger className="w-[90px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="url"
                  placeholder="https://my-app.vercel.app/api/keep-alive"
                  value={form.url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, url: e.target.value }))
                  }
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>

            {/* Secret */}
            <div className="space-y-1.5">
              <Label htmlFor="secret">
                Bearer Secret{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (sent as Authorization: Bearer …)
                </span>
              </Label>
              <Input
                id="secret"
                type="password"
                placeholder="Leave blank for no auth"
                value={form.secret}
                onChange={(e) =>
                  setForm((f) => ({ ...f, secret: e.target.value }))
                }
              />
            </div>

            {/* Extra Headers */}
            <div className="space-y-1.5">
              <Label htmlFor="headers">
                Extra Headers{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (JSON object)
                </span>
              </Label>
              <Textarea
                id="headers"
                rows={3}
                className="font-mono text-xs"
                placeholder={'{\n  "X-Custom-Header": "value"\n}'}
                value={form.headers}
                onChange={(e) =>
                  setForm((f) => ({ ...f, headers: e.target.value }))
                }
              />
              {!isValidJson(form.headers) && (
                <p className="text-xs text-destructive">Invalid JSON</p>
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Include in keep-alive pings
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingSite ? "Save Changes" : "Add Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteDialogSite}
        onOpenChange={(open) => !open && setDeleteDialogSite(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete site?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{deleteDialogSite?.name}</strong> and all its logs. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDialogSite && handleDelete(deleteDialogSite)}
              disabled={!!deletingId}
            >
              {deletingId ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
