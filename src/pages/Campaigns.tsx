import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Play, Pause, Users, Trash2, Zap, GripVertical, Copy, Rocket, Loader2, Upload, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusBadge: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
  active: { variant: "default", label: "Active" },
  paused: { variant: "secondary", label: "Paused" },
  draft: { variant: "outline", label: "Draft" },
  completed: { variant: "default", label: "Completed" },
};

type CampaignStep = {
  id?: string;
  step_order: number;
  subject: string;
  body: string;
  delay_days: number;
  variant_label: string;
};

export default function Campaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showStepsDialog, setShowStepsDialog] = useState<string | null>(null);
  const [newCampaign, setNewCampaign] = useState({ name: "", followup_delay_hours: 48, max_followups: 3 });
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [hasPrimaryEmailAccount, setHasPrimaryEmailAccount] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [steps, setSteps] = useState<CampaignStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);

  // Lead upload state
  const [showUploadDialog, setShowUploadDialog] = useState<string | null>(null);
  const [showAddLeadDialog, setShowAddLeadDialog] = useState<string | null>(null);
  const [newLead, setNewLead] = useState({ email: "", name: "", company: "" });
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMappingDialog, setShowMappingDialog] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    const [{ data, error: campaignsError }, { data: tmpl }, { data: primaryAccount }] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("templates").select("*"),
      supabase
        .from("email_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .maybeSingle(),
    ]);

    if (campaignsError) {
      toast.error(campaignsError.message);
      setLoading(false);
      return;
    }

    setCampaigns(data || []);
    setTemplates(tmpl || []);
    setHasPrimaryEmailAccount(Boolean(primaryAccount));

    if (data && data.length > 0) {
      const countEntries = await Promise.all(
        data.map(async (campaign) => {
          const { count } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id);
          return [campaign.id, count || 0] as const;
        })
      );
      setLeadCounts(Object.fromEntries(countEntries));
    } else {
      setLeadCounts({});
    }

    setLoading(false);
  };

  const createCampaign = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("campaigns").insert({
      user_id: user.id, name: newCampaign.name,
      followup_delay_hours: newCampaign.followup_delay_hours,
      max_followups: newCampaign.max_followups,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      await supabase.from("campaign_steps").insert({
        campaign_id: data.id, user_id: user.id,
        step_order: 1, subject: "Initial outreach", body: "Hi {{name}},\n\n", delay_days: 0, variant_label: "A",
      });
    }
    toast.success("Campaign created");
    setShowCreateDialog(false);
    setNewCampaign({ name: "", followup_delay_hours: 48, max_followups: 3 });
    loadData();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("campaigns").update({ status: status as any }).eq("id", id);
    if (!error) { toast.success(`Campaign ${status}`); loadData(); }
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (!error) { toast.success("Campaign deleted"); loadData(); }
  };

  // --- Lead upload helpers ---
  const addLeadToCampaign = async () => {
    if (!user || !showAddLeadDialog) return;
    const { error } = await supabase.from("leads").insert({
      user_id: user.id,
      email: newLead.email,
      name: newLead.name || null,
      company: newLead.company || null,
      campaign_id: showAddLeadDialog,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lead added to campaign");
    setShowAddLeadDialog(null);
    setNewLead({ email: "", name: "", company: "" });
    loadData();
  };

  const handleCSVFile = (file: File, campaignId: string) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) { toast.error("CSV needs a header and data rows"); return; }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));

      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-detect mappings — be precise to avoid false positives
      const mapping: Record<string, string> = {};
      headers.forEach((h, i) => {
        const lower = h.toLowerCase().trim();
        if (lower === "email" || lower === "e-mail" || lower === "email address") mapping[String(i)] = "email";
        else if (lower === "name" || lower === "full name" || lower === "first name" || lower === "first_name") mapping[String(i)] = "name";
        else if (lower === "company" || lower === "company name" || lower === "company_name" || lower === "organization") mapping[String(i)] = "company";
        // Skip surname, title, etc. — user can map manually
      });
      setColumnMapping(mapping);
      setShowUploadDialog(null);
      setShowMappingDialog(campaignId);
    };
    reader.readAsText(file);
  };

  const importMappedCSV = async () => {
    if (!user || !showMappingDialog) return;
    const emailColIdx = Object.entries(columnMapping).find(([_, v]) => v === "email")?.[0];
    if (!emailColIdx) { toast.error("Map at least the email column"); return; }

    const nameColIdx = Object.entries(columnMapping).find(([_, v]) => v === "name")?.[0];
    const companyColIdx = Object.entries(columnMapping).find(([_, v]) => v === "company")?.[0];

    const newLeads = csvRows.map((row) => ({
      user_id: user.id,
      email: row[Number(emailColIdx)] || "",
      name: nameColIdx ? row[Number(nameColIdx)] || null : null,
      company: companyColIdx ? row[Number(companyColIdx)] || null : null,
      campaign_id: showMappingDialog,
    })).filter((l) => l.email && l.email.includes("@"));

    if (newLeads.length === 0) { toast.error("No valid emails found"); return; }
    const { error } = await supabase.from("leads").insert(newLeads);
    if (error) { toast.error(error.message); return; }
    toast.success(`${newLeads.length} leads imported to campaign`);
    setShowMappingDialog(null);
    loadData();
  };

  // Launch campaign
  const launchCampaign = async (campaignId: string) => {
    if (!user) return;
    setLaunching(campaignId);
    try {
      const { data: campaignSteps, error: stepsError } = await supabase
        .from("campaign_steps").select("*").eq("campaign_id", campaignId).order("step_order");
      if (stepsError) throw stepsError;
      if (!campaignSteps || campaignSteps.length === 0) { toast.error("Add at least one step to the sequence first"); return; }

      const { data: leads, error: leadsError } = await supabase
        .from("leads").select("id, email").eq("campaign_id", campaignId).in("status", ["imported", "active"]);
      if (leadsError) throw leadsError;
      if (!leads || leads.length === 0) { toast.error("No leads assigned. Upload leads first."); return; }

      const { data: emailAccount, error: accountError } = await supabase
        .from("email_accounts").select("id").eq("user_id", user.id).eq("is_primary", true).maybeSingle();
      if (accountError) throw accountError;
      if (!emailAccount?.id) { toast.error("Add a primary email account in Settings first."); navigate("/settings"); return; }

      const stepsByOrder = campaignSteps.reduce((acc, step) => {
        if (!acc[step.step_order]) acc[step.step_order] = [];
        acc[step.step_order].push(step);
        return acc;
      }, {} as Record<number, any[]>);

      const followups: any[] = [];
      const now = new Date();

      for (const lead of leads) {
        let cumulativeDelay = 0;
        for (const [order, variants] of Object.entries(stepsByOrder).sort(([a], [b]) => Number(a) - Number(b))) {
          const step = variants[Math.floor(Math.random() * variants.length)];
          cumulativeDelay += Number(step.delay_days);
          const scheduledFor = new Date(now.getTime() + cumulativeDelay * 24 * 60 * 60 * 1000);
          followups.push({
            user_id: user.id, recipient_email: lead.email, subject: step.subject, body: step.body,
            scheduled_for: scheduledFor.toISOString(), status: "pending", attempt_number: Number(order),
            max_attempts: Object.keys(stepsByOrder).length, lead_id: lead.id, email_account_id: emailAccount.id,
          });
        }
      }

      const { error: insertError } = await supabase.from("followups").insert(followups);
      if (insertError) throw insertError;

      const leadIds = leads.map((lead) => lead.id);
      await supabase.from("leads").update({ status: "active" as any }).in("id", leadIds);
      await supabase.from("campaigns").update({ status: "active" as any }).eq("id", campaignId);

      toast.success(`Launched! ${followups.length} emails queued for ${leads.length} leads`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Launch failed");
    } finally {
      setLaunching(null);
    }
  };

  // Steps management
  const openSteps = async (campaignId: string) => {
    setShowStepsDialog(campaignId);
    setStepsLoading(true);
    const { data } = await supabase.from("campaign_steps").select("*").eq("campaign_id", campaignId).order("step_order");
    setSteps(data || []);
    setStepsLoading(false);
  };

  const addStep = () => {
    setSteps([...steps, { step_order: steps.length + 1, subject: "", body: "", delay_days: 3, variant_label: "A" }]);
  };

  const addVariant = (stepOrder: number) => {
    const variants = steps.filter(s => s.step_order === stepOrder);
    const nextLabel = String.fromCharCode(65 + variants.length);
    const baseStep = variants[0];
    setSteps([...steps, { step_order: stepOrder, subject: baseStep.subject, body: baseStep.body, delay_days: baseStep.delay_days, variant_label: nextLabel }]);
  };

  const updateStep = (index: number, field: string, value: any) => {
    const updated = [...steps];
    (updated[index] as any)[field] = value;
    setSteps(updated);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const saveSteps = async () => {
    if (!showStepsDialog || !user) return;
    await supabase.from("campaign_steps").delete().eq("campaign_id", showStepsDialog);
    const inserts = steps.map(s => ({
      campaign_id: showStepsDialog, user_id: user.id,
      step_order: s.step_order, subject: s.subject, body: s.body, delay_days: s.delay_days, variant_label: s.variant_label,
    }));
    if (inserts.length > 0) {
      const { error } = await supabase.from("campaign_steps").insert(inserts);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Sequence saved");
    setShowStepsDialog(null);
  };

  const applyTemplate = (index: number, templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl) {
      updateStep(index, "subject", tmpl.subject);
      updateStep(index, "body", tmpl.body);
    }
  };

  const groupedSteps = steps.reduce((acc, step, idx) => {
    const key = step.step_order;
    if (!acc[key]) acc[key] = [];
    acc[key].push({ ...step, _index: idx });
    return acc;
  }, {} as Record<number, (CampaignStep & { _index: number })[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">Build multi-step email sequences with A/B testing.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New Campaign
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && showUploadDialog) handleCSVFile(file, showUploadDialog);
          e.target.value = "";
        }}
      />

      {loading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Zap className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No campaigns yet</p>
            <Button size="sm" className="mt-4" onClick={() => setShowCreateDialog(true)}>Create your first campaign</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{campaign.name}</p>
                      <Badge variant={statusBadge[campaign.status]?.variant || "outline"} className="text-[10px] px-1.5 py-0">
                        {statusBadge[campaign.status]?.label || campaign.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{leadCounts[campaign.id] || 0} leads</span>
                      <span>Delay: {campaign.followup_delay_hours}h</span>
                      <span>Max {campaign.max_followups} steps</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {/* Upload leads buttons */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setShowUploadDialog(campaign.id);
                        setTimeout(() => fileInputRef.current?.click(), 100);
                      }}
                    >
                      <Upload className="mr-1 h-3 w-3" /> CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setShowAddLeadDialog(campaign.id)}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Lead
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openSteps(campaign.id)}>
                      Sequence
                    </Button>
                    {campaign.status === "draft" && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        onClick={() => launchCampaign(campaign.id)}
                        disabled={launching === campaign.id || (leadCounts[campaign.id] || 0) === 0 || !hasPrimaryEmailAccount}
                        title={!hasPrimaryEmailAccount ? "Add a primary email account in Settings first" : (leadCounts[campaign.id] || 0) === 0 ? "Upload leads first" : "Launch campaign"}
                      >
                        {launching === campaign.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Rocket className="mr-1 h-3 w-3" />}
                        Launch
                      </Button>
                    )}
                    {campaign.status === "active" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(campaign.id, "paused")}>
                        <Pause className="mr-1 h-3 w-3" /> Pause
                      </Button>
                    )}
                    {campaign.status === "paused" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(campaign.id, "active")}>
                        <Play className="mr-1 h-3 w-3" /> Resume
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteCampaign(campaign.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Campaign Name</Label><Input placeholder="e.g., Q1 Outreach" value={newCampaign.name} onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Delay (hours)</Label><Input type="number" value={newCampaign.followup_delay_hours} onChange={(e) => setNewCampaign({ ...newCampaign, followup_delay_hours: parseInt(e.target.value) || 48 })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Max Follow-ups</Label><Input type="number" value={newCampaign.max_followups} onChange={(e) => setNewCampaign({ ...newCampaign, max_followups: parseInt(e.target.value) || 3 })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={createCampaign} disabled={!newCampaign.name}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Single Lead Dialog */}
      <Dialog open={!!showAddLeadDialog} onOpenChange={() => setShowAddLeadDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Lead to Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input placeholder="lead@company.com" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input placeholder="John Doe" value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Company</Label><Input placeholder="Acme Inc." value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddLeadDialog(null)}>Cancel</Button>
            <Button size="sm" onClick={addLeadToCampaign} disabled={!newLead.email.includes("@")}>Add Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Column Mapping Dialog */}
      <Dialog open={!!showMappingDialog} onOpenChange={() => setShowMappingDialog(null)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle className="text-center">Map CSV Columns</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground text-center">Found {csvRows.length} rows. Map columns to fields:</p>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {csvHeaders.map((header, i) => (
              <div key={i} className="grid grid-cols-2 items-center gap-4">
                <span className="text-sm truncate font-medium text-right">{header}</span>
                <Select value={columnMapping[String(i)] || "skip"} onValueChange={(v) => setColumnMapping({ ...columnMapping, [String(i)]: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {csvRows.length > 0 && (
            <div className="rounded-md bg-muted/50 p-2 mt-2">
              <p className="text-[11px] text-muted-foreground font-medium mb-1">Preview (first row):</p>
              <p className="text-[11px] text-muted-foreground truncate">{csvRows[0].join(" | ")}</p>
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setShowMappingDialog(null)}>Cancel</Button>
            <Button size="sm" onClick={importMappedCSV} disabled={!Object.values(columnMapping).includes("email")}>
              Import {csvRows.length} Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sequence Builder Dialog */}
      <Dialog open={!!showStepsDialog} onOpenChange={() => setShowStepsDialog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Email Sequence Builder</DialogTitle></DialogHeader>
          {stepsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedSteps).sort(([a], [b]) => Number(a) - Number(b)).map(([order, variants]) => (
                <div key={order} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Step {order}</span>
                      {Number(order) > 1 && (
                        <Badge variant="outline" className="text-[10px]">+{variants[0].delay_days}d delay</Badge>
                      )}
                    </div>
                    {variants.length < 3 && (
                      <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => addVariant(Number(order))}>
                        <Copy className="mr-1 h-3 w-3" /> A/B Variant
                      </Button>
                    )}
                  </div>
                  {variants.map((step) => (
                    <div key={step._index} className="space-y-2 pl-6 border-l-2 border-muted ml-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5">Variant {step.variant_label}</Badge>
                        {templates.length > 0 && (
                          <Select onValueChange={(v) => applyTemplate(step._index, v)}>
                            <SelectTrigger className="h-6 text-[11px] w-auto min-w-[120px]">
                              <SelectValue placeholder="Use template" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto text-muted-foreground hover:text-destructive" onClick={() => removeStep(step._index)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input placeholder="Subject line" className="h-8 text-sm" value={step.subject} onChange={(e) => updateStep(step._index, "subject", e.target.value)} />
                      <Textarea placeholder="Email body… Use {{name}}, {{company}}, {{personalized_line}}" className="min-h-[80px] text-sm" value={step.body} onChange={(e) => updateStep(step._index, "body", e.target.value)} />
                      {Number(order) > 1 && (
                        <div className="flex items-center gap-2">
                          <Label className="text-[11px] text-muted-foreground">Delay</Label>
                          <Input type="number" className="h-7 w-16 text-xs" value={step.delay_days} onChange={(e) => updateStep(step._index, "delay_days", parseInt(e.target.value) || 0)} />
                          <span className="text-[11px] text-muted-foreground">days after prev step</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={addStep}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Step
              </Button>
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Variables:</span> {"{{name}}"}, {"{{company}}"}, {"{{email}}"}, {"{{personalized_line}}"}, or any custom field from your CSV import.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowStepsDialog(null)}>Cancel</Button>
            <Button size="sm" onClick={saveSteps}>Save Sequence</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
