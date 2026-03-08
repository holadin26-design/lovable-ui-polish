import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Users, Download, Trash2, CheckCircle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function LeadImport() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLead, setNewLead] = useState({ email: "", name: "", company: "" });

  useEffect(() => {
    if (user) loadLeads();
  }, [user]);

  const loadLeads = async () => {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads(data || []);
    setLoading(false);
  };

  const addLead = async () => {
    if (!user) return;
    const { error } = await supabase.from("leads").insert({
      user_id: user.id,
      email: newLead.email,
      name: newLead.name || null,
      company: newLead.company || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lead added!");
    setShowAddDialog(false);
    setNewLead({ email: "", name: "", company: "" });
    loadLeads();
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (!error) { toast.success("Lead deleted"); loadLeads(); }
  };

  const handleCSVUpload = async (file: File) => {
    if (!user) return;
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) { toast.error("CSV needs a header row and at least one data row"); return; }

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const emailIdx = header.findIndex((h) => h.includes("email"));
    const nameIdx = header.findIndex((h) => h.includes("name") && !h.includes("company"));
    const companyIdx = header.findIndex((h) => h.includes("company") || h.includes("org"));

    if (emailIdx === -1) { toast.error("CSV must have an 'email' column"); return; }

    const newLeads = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return {
        user_id: user.id,
        email: cols[emailIdx],
        name: nameIdx >= 0 ? cols[nameIdx] || null : null,
        company: companyIdx >= 0 ? cols[companyIdx] || null : null,
      };
    }).filter((l) => l.email && l.email.includes("@"));

    if (newLeads.length === 0) { toast.error("No valid emails found"); return; }

    const { error } = await supabase.from("leads").insert(newLeads);
    if (error) { toast.error(error.message); return; }
    toast.success(`${newLeads.length} leads imported!`);
    loadLeads();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleCSVUpload(file);
    else toast.error("Please upload a CSV file");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCSVUpload(file);
  };

  const importedCount = leads.filter((l) => l.status === "imported").length;
  const duplicateCount = leads.filter((l) => l.status === "duplicate").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Bulk Import</h1>
          <p className="text-muted-foreground mt-1">Import leads from CSV or add them manually.</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Lead
        </Button>
      </div>

      {/* Upload Area */}
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <CardContent className="py-12 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-display text-lg font-semibold mb-1">Drop your CSV file here</h3>
          <p className="text-sm text-muted-foreground mb-4">or click to browse. CSV needs email, name, company columns.</p>
          <label>
            <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
            <Button variant="outline" asChild><span><FileText className="mr-2 h-4 w-4" /> Browse Files</span></Button>
          </label>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Users className="h-4 w-4 text-primary" /></div>
          <div><p className="text-xl font-display font-bold">{leads.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10"><CheckCircle className="h-4 w-4 text-success" /></div>
          <div><p className="text-xl font-display font-bold">{importedCount}</p><p className="text-xs text-muted-foreground">Imported</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10"><FileText className="h-4 w-4 text-warning" /></div>
          <div><p className="text-xl font-display font-bold">{duplicateCount}</p><p className="text-xs text-muted-foreground">Duplicates</p></div>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="font-display">Leads</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="py-12 text-center text-muted-foreground">Loading...</div> : leads.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No leads yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.email}</TableCell>
                    <TableCell>{lead.name || "—"}</TableCell>
                    <TableCell>{lead.company || "—"}</TableCell>
                    <TableCell><Badge variant={lead.status === "imported" ? "default" : "secondary"}>{lead.status}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteLead(lead.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Lead</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Email *</Label><Input placeholder="lead@example.com" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Name</Label><Input placeholder="John Doe" value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Company</Label><Input placeholder="Acme Inc" value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={addLead} disabled={!newLead.email}>Add Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
