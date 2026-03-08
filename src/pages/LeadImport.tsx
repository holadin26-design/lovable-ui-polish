import { useState, useEffect } from "react";
import { Upload, FileText, Users, Trash2, CheckCircle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    const { error } = await supabase.from("leads").insert({ user_id: user.id, email: newLead.email, name: newLead.name || null, company: newLead.company || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Lead added");
    setShowAddDialog(false);
    setNewLead({ email: "", name: "", company: "" });
    loadLeads();
  };

  const deleteLead = async (id: string) => {
    await supabase.from("leads").delete().eq("id", id);
    toast.success("Deleted");
    loadLeads();
  };

  const handleCSVUpload = async (file: File) => {
    if (!user) return;
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) { toast.error("CSV needs a header and data rows"); return; }
    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const emailIdx = header.findIndex((h) => h.includes("email"));
    const nameIdx = header.findIndex((h) => h.includes("name") && !h.includes("company"));
    const companyIdx = header.findIndex((h) => h.includes("company") || h.includes("org"));
    if (emailIdx === -1) { toast.error("CSV must have an 'email' column"); return; }
    const newLeads = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return { user_id: user.id, email: cols[emailIdx], name: nameIdx >= 0 ? cols[nameIdx] || null : null, company: companyIdx >= 0 ? cols[companyIdx] || null : null };
    }).filter((l) => l.email && l.email.includes("@"));
    if (newLeads.length === 0) { toast.error("No valid emails found"); return; }
    const { error } = await supabase.from("leads").insert(newLeads);
    if (error) { toast.error(error.message); return; }
    toast.success(`${newLeads.length} leads imported`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead Lists</h1>
          <p className="text-sm text-muted-foreground mt-1">Import from CSV or add leads manually.</p>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Lead
        </Button>
      </div>

      {/* Upload */}
      <div
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
          dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm font-medium mb-1">Drop CSV file here</p>
        <p className="text-xs text-muted-foreground mb-3">Requires email column. Name and company columns are optional.</p>
        <label>
          <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
          <Button variant="outline" size="sm" asChild><span><FileText className="mr-1.5 h-3.5 w-3.5" /> Browse</span></Button>
        </label>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users className="h-4 w-4 text-primary" />
          <div><p className="text-lg font-semibold">{leads.length}</p><p className="text-[11px] text-muted-foreground">Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <CheckCircle className="h-4 w-4 text-success" />
          <div><p className="text-lg font-semibold">{importedCount}</p><p className="text-[11px] text-muted-foreground">Imported</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <FileText className="h-4 w-4 text-warning" />
          <div><p className="text-lg font-semibold">{duplicateCount}</p><p className="text-[11px] text-muted-foreground">Duplicates</p></div>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm font-medium">Leads</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div> : leads.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No leads yet</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Company</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="text-sm">{lead.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.company || "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        lead.status === "imported" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                      }`}>
                        {lead.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteLead(lead.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input placeholder="lead@example.com" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input placeholder="John Doe" value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Company</Label><Input placeholder="Acme Inc" value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={addLead} disabled={!newLead.email}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
