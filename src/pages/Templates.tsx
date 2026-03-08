import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, FileText, Edit2, Trash2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    const { error } = await supabase.from("templates").insert({
      user_id: user.id,
      name: newTemplate.name,
      subject: newTemplate.subject,
      body: newTemplate.body,
      variables,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Template created!");
    setShowCreateDialog(false);
    setNewTemplate({ name: "", subject: "", body: "" });
    loadTemplates();
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (!error) { toast.success("Template deleted"); loadTemplates(); }
  };

  const duplicateTemplate = async (template: any) => {
    if (!user) return;
    const { error } = await supabase.from("templates").insert({
      user_id: user.id,
      name: template.name + " (copy)",
      subject: template.subject,
      body: template.body,
      variables: template.variables,
    });
    if (!error) { toast.success("Template duplicated"); loadTemplates(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-1">Create reusable email templates with dynamic variables.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Template
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>No templates yet. Create your first one!</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template, i) => (
            <motion.div key={template.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-display">{template.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Used {template.usage_count} times</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm font-medium text-foreground/80 mb-2">Subject: {template.subject}</p>
                  <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{template.body}</p>
                  {template.variables?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {template.variables.map((v: string) => (
                        <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-4 pt-4 border-t">
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => duplicateTemplate(template)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicate
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteTemplate(template.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Create Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Template Name</Label><Input placeholder="e.g., Initial Outreach" value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Subject Line</Label><Input placeholder="Use {{variable}} for dynamic content" value={newTemplate.subject} onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })} /></div>
            <div className="space-y-2"><Label>Body</Label><Textarea placeholder="Write your template body here..." className="min-h-[160px]" value={newTemplate.body} onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Use {"{{name}}"} for variables that will be replaced with actual values.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={createTemplate} disabled={!newTemplate.name || !newTemplate.subject}>Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
