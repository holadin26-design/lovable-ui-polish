import { useState, useEffect } from "react";
import { Plus, FileText, Trash2, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", subject: "", body: "" });

  useEffect(() => {
    if (user) loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    const { data } = await supabase.from("templates").select("*").order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
  };

  const createTemplate = async () => {
    if (!user) return;
    const variables = extractVariables(newTemplate.subject + " " + newTemplate.body);
    const { error } = await supabase.from("templates").insert({ user_id: user.id, name: newTemplate.name, subject: newTemplate.subject, body: newTemplate.body, variables });
    if (error) { toast.error(error.message); return; }
    toast.success("Template created");
    setShowCreateDialog(false);
    setNewTemplate({ name: "", subject: "", body: "" });
    loadTemplates();
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("templates").delete().eq("id", id);
    toast.success("Deleted");
    loadTemplates();
  };

  const duplicateTemplate = async (template: any) => {
    if (!user) return;
    await supabase.from("templates").insert({ user_id: user.id, name: template.name + " (copy)", subject: template.subject, body: template.body, variables: template.variables });
    toast.success("Duplicated");
    loadTemplates();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Reusable email templates with dynamic variables.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New Template
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No templates yet</p>
            <Button size="sm" className="mt-4" onClick={() => setShowCreateDialog(true)}>Create your first template</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="flex flex-col hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Used {template.usage_count}×</p>
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground mb-1"><span className="font-medium text-foreground/70">Subject:</span> {template.subject}</p>
                <p className="text-xs text-muted-foreground line-clamp-3 flex-1">{template.body}</p>
                {template.variables?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {template.variables.map((v: string) => (
                      <span key={v} className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{`{{${v}}}`}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t">
                  <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => duplicateTemplate(template)}>
                    <Copy className="mr-1 h-3 w-3" /> Duplicate
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTemplate(template.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input placeholder="e.g., Initial Outreach" value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Subject</Label><Input placeholder="Use {{variable}} for dynamic content" value={newTemplate.subject} onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Body</Label><Textarea placeholder="Template body…" className="min-h-[140px]" value={newTemplate.body} onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })} /></div>
            <p className="text-[11px] text-muted-foreground">Use {"{{name}}"} syntax for variables.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={createTemplate} disabled={!newTemplate.name || !newTemplate.subject}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
