import { useState, useEffect } from "react";
import { Upload, FileText, Users, Trash2, CheckCircle, Plus, Shield, ShieldAlert, ShieldX, Clock, Brain, Loader2, Search, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const validationIcons: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  valid: { icon: CheckCircle, color: "text-success", label: "Valid" },
  invalid: { icon: ShieldX, color: "text-destructive", label: "Invalid" },
  risky: { icon: AlertTriangle, color: "text-warning", label: "Risky" },
  catchall: { icon: ShieldAlert, color: "text-warning", label: "Catch-all" },
  pending: { icon: Clock, color: "text-muted-foreground", label: "Pending" },
};

export default function LeadImport() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [showResearchDialog, setShowResearchDialog] = useState(false);
  const [newLead, setNewLead] = useState({ email: "", name: "", company: "" });
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [validating, setValidating] = useState(false);
  const [bulkValidating, setBulkValidating] = useState(false);
  const [researching, setResearching] = useState(false);
  const [offerDescription, setOfferDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  
  // CSV mapping state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const [{ data: l }, { data: c }] = await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("campaigns").select("id, name"),
    ]);
    setLeads(l || []);
    setCampaigns(c || []);
    setLoading(false);
  };

  const addLead = async () => {
    if (!user) return;
    const { error } = await supabase.from("leads").insert({ user_id: user.id, email: newLead.email, name: newLead.name || null, company: newLead.company || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Lead added");
    setShowAddDialog(false);
    setNewLead({ email: "", name: "", company: "" });
    loadData();
  };

  const deleteLead = async (id: string) => {
    await supabase.from("leads").delete().eq("id", id);
    toast.success("Deleted");
    loadData();
  };

  const deleteSelected = async () => {
    for (const id of selectedLeads) {
      await supabase.from("leads").delete().eq("id", id);
    }
    toast.success(`${selectedLeads.size} leads deleted`);
    setSelectedLeads(new Set());
    loadData();
  };

  // CSV parsing with column mapping
  const parseCSV = (text: string) => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) { toast.error("CSV needs a header and data rows"); return; }
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
    
    setCsvHeaders(headers);
    setCsvRows(rows);
    
    // Auto-detect mappings
    const mapping: Record<string, string> = {};
    headers.forEach((h, i) => {
      const lower = h.toLowerCase();
      if (lower.includes("email")) mapping[String(i)] = "email";
      else if (lower.includes("first") && lower.includes("name")) mapping[String(i)] = "name";
      else if (lower === "name" || lower === "full name") mapping[String(i)] = "name";
      else if (lower.includes("company") || lower.includes("org")) mapping[String(i)] = "company";
    });
    setColumnMapping(mapping);
    setShowMappingDialog(true);
  };

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    parseCSV(text);
  };

  const importMappedCSV = async () => {
    if (!user) return;
    const emailColIdx = Object.entries(columnMapping).find(([_, v]) => v === "email")?.[0];
    if (!emailColIdx) { toast.error("Map at least the email column"); return; }

    const nameColIdx = Object.entries(columnMapping).find(([_, v]) => v === "name")?.[0];
    const companyColIdx = Object.entries(columnMapping).find(([_, v]) => v === "company")?.[0];
    
    // Find custom field mappings
    const customFieldMappings = Object.entries(columnMapping).filter(([_, v]) => v === "custom");

    const newLeads = csvRows.map((row) => {
      const customFields: Record<string, string> = {};
      customFieldMappings.forEach(([idx]) => {
        const header = csvHeaders[Number(idx)];
        if (header && row[Number(idx)]) {
          customFields[header] = row[Number(idx)];
        }
      });

      return {
        user_id: user.id,
        email: row[Number(emailColIdx)] || "",
        name: nameColIdx ? row[Number(nameColIdx)] || null : null,
        company: companyColIdx ? row[Number(companyColIdx)] || null : null,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
      };
    }).filter((l) => l.email && l.email.includes("@"));

    if (newLeads.length === 0) { toast.error("No valid emails found"); return; }
    const { error } = await supabase.from("leads").insert(newLeads);
    if (error) { toast.error(error.message); return; }
    toast.success(`${newLeads.length} leads imported`);
    setShowMappingDialog(false);
    loadData();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleFileUpload(file);
    else toast.error("Please upload a CSV file");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Bulk validate all unvalidated leads
  const validateAllUnvalidated = async () => {
    const unvalidated = leads.filter(l => !l.validation_status || l.validation_status === 'pending');
    if (unvalidated.length === 0) { toast.info("All leads are already validated"); return; }
    setBulkValidating(true);
    try {
      const ids = unvalidated.map(l => l.id);
      // Process in batches of 50
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { data, error } = await supabase.functions.invoke("validate-leads", {
          body: { lead_ids: batch },
        });
        if (error) throw error;
      }
      toast.success(`Validated ${ids.length} leads`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Bulk validation failed");
    } finally {
      setBulkValidating(false);
    }
  };

  // Batch validation
  const validateSelected = async () => {
    if (selectedLeads.size === 0) { toast.error("Select leads first"); return; }
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-leads", {
        body: { lead_ids: Array.from(selectedLeads) },
      });
      if (error) throw error;
      const valid = data.results?.filter((r: any) => r.status === "valid").length || 0;
      const invalid = data.results?.filter((r: any) => r.status === "invalid").length || 0;
      toast.success(`Validated: ${valid} valid, ${invalid} invalid`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  // AI Research
  const researchSelected = async () => {
    if (selectedLeads.size === 0) { toast.error("Select leads first"); return; }
    setResearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-research", {
        body: { lead_ids: Array.from(selectedLeads), offer_description: offerDescription },
      });
      if (error) throw error;
      toast.success(`Researched ${data.results?.length || 0} leads`);
      setShowResearchDialog(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Research failed");
    } finally {
      setResearching(false);
    }
  };

  const assignToCampaign = async (campaignId: string) => {
    if (selectedLeads.size === 0) {
      toast.error("Select at least one lead first");
      return;
    }

    for (const id of selectedLeads) {
      await supabase.from("leads").update({ campaign_id: campaignId, status: "active" as any }).eq("id", id);
    }

    toast.success(`${selectedLeads.size} leads assigned`);
    setSelectedLeads(new Set());
    loadData();
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  };

  const filteredLeads = leads.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return l.email.toLowerCase().includes(q) || (l.name?.toLowerCase().includes(q)) || (l.company?.toLowerCase().includes(q));
  });

  const importedCount = leads.filter((l) => l.status === "imported").length;
  const validCount = leads.filter((l) => l.validation_status === "valid").length;
  const invalidCount = leads.filter((l) => l.validation_status === "invalid").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead Lists</h1>
          <p className="text-sm text-muted-foreground mt-1">Import, validate, and enrich your leads with AI.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={validateAllUnvalidated} disabled={bulkValidating}>
            {bulkValidating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Shield className="mr-1.5 h-3.5 w-3.5" />}
            {bulkValidating ? "Validating…" : "Validate All"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Lead
          </Button>
        </div>
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
        <p className="text-xs text-muted-foreground mb-3">Column mapping UI will let you assign fields. Extra columns become custom fields for AI personalization.</p>
        <label>
          <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
          <Button variant="outline" size="sm" asChild><span><FileText className="mr-1.5 h-3.5 w-3.5" /> Browse</span></Button>
        </label>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users className="h-4 w-4 text-primary" />
          <div><p className="text-lg font-semibold">{leads.length}</p><p className="text-[11px] text-muted-foreground">Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <CheckCircle className="h-4 w-4 text-success" />
          <div><p className="text-lg font-semibold">{validCount}</p><p className="text-[11px] text-muted-foreground">Valid</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <ShieldX className="h-4 w-4 text-destructive" />
          <div><p className="text-lg font-semibold">{invalidCount}</p><p className="text-[11px] text-muted-foreground">Invalid</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Brain className="h-4 w-4 text-primary" />
          <div><p className="text-lg font-semibold">{leads.filter(l => l.ai_researched_at).length}</p><p className="text-[11px] text-muted-foreground">Researched</p></div>
        </CardContent></Card>
      </div>

      {/* Actions bar */}
      {selectedLeads.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <span className="text-xs font-medium">{selectedLeads.size} selected</span>
          <Separator orientation="vertical" className="h-4" />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={validateSelected} disabled={validating}>
            {validating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Shield className="mr-1 h-3 w-3" />}
            Validate
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowResearchDialog(true)} disabled={researching}>
            {researching ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Brain className="mr-1 h-3 w-3" />}
            AI Research
          </Button>
          {campaigns.length > 0 && (
            <Select onValueChange={assignToCampaign}>
              <SelectTrigger className="h-7 text-xs w-auto min-w-[140px]">
                <SelectValue placeholder="Assign to campaign" />
              </SelectTrigger>
              <SelectContent>{campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive ml-auto" onClick={deleteSelected}>
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search leads…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div> : filteredLeads.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No leads yet</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10"><Checkbox checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Company</TableHead>
                <TableHead className="text-xs">Validation</TableHead>
                <TableHead className="text-xs">AI Score</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const valConfig = validationIcons[lead.validation_status] || validationIcons.pending;
                  const ValIcon = valConfig.icon;
                  return (
                    <TableRow key={lead.id} className={selectedLeads.has(lead.id) ? "bg-primary/5" : ""}>
                      <TableCell><Checkbox checked={selectedLeads.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} /></TableCell>
                      <TableCell className="text-sm font-medium">{lead.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.company || "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-[11px] ${valConfig.color}`}>
                          <ValIcon className="h-3 w-3" /> {valConfig.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {lead.ai_relevancy_score ? (
                          <Badge variant={lead.ai_relevancy_score >= 7 ? "default" : lead.ai_relevancy_score >= 4 ? "secondary" : "outline"} className="text-[10px]">
                            {lead.ai_relevancy_score}/10
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          lead.status === "active" ? "bg-success/10 text-success" : 
                          lead.status === "replied" ? "bg-primary/10 text-primary" :
                          "bg-muted text-muted-foreground"
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Lead Dialog */}
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

      {/* Column Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Map CSV Columns</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Assign each column to a field. Unmapped columns with "Custom" will be stored as custom fields for AI personalization.</p>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {csvHeaders.map((header, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{header}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    e.g., {csvRows[0]?.[idx] || "—"}
                  </p>
                </div>
                <Select value={columnMapping[String(idx)] || ""} onValueChange={(v) => setColumnMapping({ ...columnMapping, [String(idx)]: v })}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Skip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="custom">Custom Field</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{csvRows.length}</span> rows found. Preview: {csvRows.slice(0, 2).map(r => r[0]).join(", ")}…
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowMappingDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={importMappedCSV}>Import {csvRows.length} Leads</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Research Dialog */}
      <Dialog open={showResearchDialog} onOpenChange={setShowResearchDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>AI Lead Research</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">The AI will analyze {selectedLeads.size} leads, generating summaries, pain points, relevancy scores, and personalized opening lines.</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Your Offer (optional)</Label>
            <Textarea placeholder="Describe your product/service, value prop, and ideal customer…" className="min-h-[80px]" value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Providing your offer helps the AI score relevancy and craft better hooks.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowResearchDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={researchSelected} disabled={researching}>
              {researching ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Researching…</> : <>Research {selectedLeads.size} Leads</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
