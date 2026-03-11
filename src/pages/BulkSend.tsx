import { useState, useRef, useCallback } from "react";
import { Upload, Sparkles, Send, Check, Mail, Server, Users, Eye, X, Plus, Pencil, Trash2, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──
type Lead = Record<string, string>;
type EmailAccount = { id: string; email: string; display_name: string | null; smtp_host: string; smtp_port: number; daily_send_limit: number; sends_today: number };
type Preview = { lead: Lead; subject: string; body: string; personalized: boolean; accountId: string };
type SendResult = Preview & { ok: boolean; note: string };
type Strategy = "roundrobin" | "random" | "primary";

// ── Utils ──
function parseCSV(text: string): Lead[] {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    return headers.reduce((o, h, i) => ({ ...o, [h]: vals[i] || "" }), {} as Lead);
  });
}

function interpolate(tpl: string, lead: Lead): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => lead[k] || `{{${k}}}`);
}

// ── Steps ──
const STEPS = [
  { num: "01", label: "Leads", icon: Upload },
  { num: "02", label: "Accounts", icon: Server },
  { num: "03", label: "Template", icon: Pencil },
  { num: "04", label: "Preview", icon: Eye },
  { num: "05", label: "Send", icon: Send },
];

export default function BulkSend() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  // Leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [csvErr, setCsvErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Accounts
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("roundrobin");

  // Template
  const [tpl, setTpl] = useState({
    subject: "Quick thought for {{name}} at {{company}}",
    body: `Hi {{name}},

I noticed {{company}} might benefit from what we do — worth a quick 15-min call this week?

Best,
[Your Name]`,
  });
  const [aiInstr, setAiInstr] = useState("Write like an experienced SDR — direct, confident, no fluff. Reference the lead's data naturally. Under 90 words.");
  const [delay, setDelay] = useState(2000);

  // Previews
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [genProg, setGenProg] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [prevIdx, setPrevIdx] = useState(0);

  // Send
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [sending, setSending] = useState(false);
  const [sendProg, setSendProg] = useState(0);

  const cols = leads[0] ? Object.keys(leads[0]) : [];

  // ── Load email accounts ──
  const loadAccounts = async () => {
    if (!user || accountsLoaded) return;
    const { data } = await supabase
      .from("email_accounts")
      .select("id, email, display_name, smtp_host, smtp_port, daily_send_limit, sends_today")
      .eq("user_id", user.id);
    setAccounts((data as EmailAccount[]) || []);
    setAccountsLoaded(true);
  };

  // ── Pick account by strategy ──
  const pickAccountId = (index: number): string => {
    if (accounts.length === 0) return "";
    if (strategy === "roundrobin") return accounts[index % accounts.length].id;
    if (strategy === "random") return accounts[Math.floor(Math.random() * accounts.length)].id;
    return accounts[0].id;
  };

  // ── CSV handling ──
  const handleFile = (file: File) => {
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const p = parseCSV(ev.target?.result as string);
        if (!p[0]?.email) { setCsvErr("CSV must have an 'email' column."); return; }
        setLeads(p);
        setCsvErr("");
      } catch { setCsvErr("Could not parse CSV."); }
    };
    r.readAsText(file);
  };

  // ── Generate AI previews ──
  const generatePreviews = useCallback(async () => {
    if (accounts.length === 0) { toast.error("Add an email account first"); return; }
    setGenerating(true);
    setGenProg(0);

    // Batch AI personalization via edge function
    try {
      const { data, error } = await supabase.functions.invoke("ai-personalize", {
        body: {
          leads,
          template: tpl,
          aiInstructions: aiInstr || null,
        },
      });

      if (error) throw error;

      const results = data.results || [];
      const mapped: Preview[] = results.map((r: any, i: number) => ({
        lead: r.lead,
        subject: r.subject,
        body: r.body,
        personalized: r.personalized,
        accountId: pickAccountId(i),
      }));

      setPreviews(mapped);
      setGenProg(leads.length);
      setPrevIdx(0);
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "AI personalization failed");
      // Fallback: use interpolated templates
      const fallback: Preview[] = leads.map((lead, i) => ({
        lead,
        subject: interpolate(tpl.subject, lead),
        body: interpolate(tpl.body, lead),
        personalized: false,
        accountId: pickAccountId(i),
      }));
      setPreviews(fallback);
      setPrevIdx(0);
      setStep(3);
    } finally {
      setGenerating(false);
    }
  }, [leads, tpl, aiInstr, accounts, strategy]);

  // ── Send ──
  const startSend = async () => {
    if (!user) return;
    setSending(true);
    setSendProg(0);

    try {
      const emails = previews.map(p => ({
        recipientEmail: p.lead.email,
        subject: p.subject,
        body: p.body,
        emailAccountId: p.accountId,
        leadId: null,
      }));

      const { data, error } = await supabase.functions.invoke("bulk-send", {
        body: { emails, userId: user.id, delayMs: delay },
      });

      if (error) throw error;

      const serverResults = data.results || [];
      const mapped: SendResult[] = previews.map((p, i) => ({
        ...p,
        ok: serverResults[i]?.ok || false,
        note: serverResults[i]?.note || "Unknown",
      }));

      setSendResults(mapped);
      setSendProg(previews.length);
      setStep(4);
      toast.success(`${data.sent || 0} of ${data.total || 0} emails sent`);
    } catch (err: any) {
      toast.error(err.message || "Bulk send failed");
    } finally {
      setSending(false);
    }
  };

  const getAccountById = (id: string) => accounts.find(a => a.id === id);

  // ── Navigate to step ──
  const goToStep = (s: number) => {
    if (s === 1 && !accountsLoaded) loadAccounts();
    setStep(s);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk Email Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">Multi-account sending with AI personalization — ported from OutreachEngine.</p>
      </div>

      {/* Step Bar */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex-1">
              <div
                className={`h-1 rounded-full mb-2 transition-colors cursor-pointer ${active ? "bg-primary" : done ? "bg-primary/60" : "bg-muted"}`}
                onClick={() => done && goToStep(i)}
              />
              <span className={`text-xs font-bold ${active ? "text-foreground" : done ? "text-primary" : "text-muted-foreground"}`}>
                {s.num} {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ══ STEP 0: LEADS ══ */}
      {step === 0 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Upload Lead CSV</Label>
              <p className="text-sm text-muted-foreground">
                Required: <code className="text-primary font-mono text-xs">email</code> · Recommended: <code className="text-primary font-mono text-xs">name, company, title, pain_point</code>
              </p>
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Drop <strong className="text-foreground">.csv</strong> here or <span className="text-primary">click to browse</span>
                </p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
              {csvErr && <p className="text-sm text-destructive">{csvErr}</p>}
              {leads.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" /> {leads.length} rows parsed
                </Badge>
              )}
            </CardContent>
          </Card>

          {leads.length > 0 && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3 block">Preview</Label>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>{cols.map(c => <th key={c} className="text-left p-2 text-muted-foreground font-bold uppercase border-b">{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {leads.slice(0, 5).map((l, i) => (
                          <tr key={i}>{cols.map(c => <td key={c} className="p-2 border-b border-border/30 max-w-[140px] truncate">{l[c]}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                    {leads.length > 5 && <p className="text-xs text-muted-foreground mt-2">+{leads.length - 5} more rows</p>}
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button onClick={() => goToStep(1)}>Next: Configure Accounts →</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ STEP 1: ACCOUNTS ══ */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Sender Accounts</Label>
                  <p className="text-sm text-muted-foreground mt-1">Your configured SMTP accounts. Emails are distributed using the strategy below.</p>
                </div>
              </div>

              {accounts.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
                  No email accounts configured. <a href="/settings" className="text-primary hover:underline">Add one in Settings</a>.
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.map((acct, idx) => (
                    <div key={acct.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                      <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{idx + 1}</div>
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{acct.display_name || acct.email}</p>
                        <p className="text-xs text-muted-foreground font-mono">{acct.smtp_host}:{acct.smtp_port}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">SMTP</Badge>
                      <span className="text-xs text-muted-foreground">{acct.sends_today}/{acct.daily_send_limit}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Strategy picker */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Send Strategy</Label>
              <p className="text-sm text-muted-foreground">How should accounts be assigned to leads? ({accounts.length} accounts)</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "roundrobin" as Strategy, icon: RotateCcw, label: "Round Robin", desc: "Cycle through accounts" },
                  { id: "random" as Strategy, icon: Sparkles, label: "Random", desc: "Random sender each time" },
                  { id: "primary" as Strategy, icon: Users, label: "Primary Only", desc: "Always use first account" },
                ]).map(o => (
                  <button
                    key={o.id}
                    onClick={() => setStrategy(o.id)}
                    className={`p-3 rounded-lg border text-center transition-all ${strategy === o.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
                  >
                    <o.icon className="h-4 w-4 mx-auto mb-1" />
                    <p className="text-xs font-bold">{o.label}</p>
                    <p className="text-[10px] opacity-70">{o.desc}</p>
                  </button>
                ))}
              </div>

              {/* Assignment preview */}
              {leads.length > 0 && accounts.length > 0 && (
                <div className="space-y-1.5 mt-4">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Assignment Preview</Label>
                  {leads.slice(0, 4).map((l, i) => {
                    const acct = strategy === "roundrobin" ? accounts[i % accounts.length]
                      : strategy === "primary" ? accounts[0]
                      : accounts[Math.floor(Math.random() * accounts.length)];
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 bg-background rounded border text-xs">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="flex-1 truncate">{l.name || l.first_name || l.email} <span className="text-muted-foreground">({l.email})</span></span>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline" className="text-[10px]">{acct?.display_name || acct?.email || "—"}</Badge>
                      </div>
                    );
                  })}
                  {leads.length > 4 && <p className="text-xs text-muted-foreground pl-1">+{leads.length - 4} more…</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
            <Button disabled={accounts.length === 0} onClick={() => setStep(2)}>Next: Write Template →</Button>
          </div>
        </div>
      )}

      {/* ══ STEP 2: TEMPLATE ══ */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Email Template</Label>
                  <p className="text-sm text-muted-foreground mt-1">Use <code className="text-primary font-mono text-xs">{"{{field}}"}</code> to insert CSV values</p>
                </div>
                <div className="flex gap-1 flex-wrap max-w-xs justify-end">
                  {cols.map(k => (
                    <button
                      key={k}
                      onClick={() => setTpl(t => ({ ...t, body: t.body + ` {{${k}}}` }))}
                      className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-mono hover:bg-primary/20 transition-colors"
                    >
                      {`{{${k}}}`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Subject Line</Label>
                <Input value={tpl.subject} onChange={e => setTpl(t => ({ ...t, subject: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Body</Label>
                <Textarea className="min-h-[200px]" value={tpl.body} onChange={e => setTpl(t => ({ ...t, body: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label className="text-xs uppercase tracking-wider text-primary font-bold">AI Personalization Instructions</Label>
              </div>
              <Textarea
                className="min-h-[72px]"
                value={aiInstr}
                onChange={e => setAiInstr(e.target.value)}
                placeholder="Leave empty to skip AI personalization and just use template interpolation"
              />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
            <Button disabled={generating} onClick={generatePreviews}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {generating ? `Generating…` : `Generate ${leads.length} AI Previews`}
            </Button>
          </div>
        </div>
      )}

      {/* ══ STEP 3: PREVIEW ══ */}
      {step === 3 && previews.length > 0 && (
        <div className="space-y-4">
          {/* Lead selector tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {previews.map((p, i) => (
              <button
                key={i}
                onClick={() => setPrevIdx(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  prevIdx === i ? "border-primary bg-primary/5 text-primary border" : "text-muted-foreground border border-border hover:border-primary/30"
                }`}
              >
                <Users className="h-3 w-3" />
                {p.lead.name || p.lead.first_name || `Lead ${i + 1}`}
                {p.personalized && <Badge className="text-[9px] px-1 py-0 bg-primary/20 text-primary">AI</Badge>}
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-start">
                <p className="text-xs text-muted-foreground">To: <span className="text-foreground">{previews[prevIdx].lead.email}</span></p>
                <div className="flex gap-2">
                  <Badge variant={previews[prevIdx].personalized ? "default" : "secondary"} className="text-[10px]">
                    {previews[prevIdx].personalized ? "✦ AI personalized" : "⚠ fallback"}
                  </Badge>
                  {(() => {
                    const acct = getAccountById(previews[prevIdx].accountId);
                    return acct ? <Badge variant="outline" className="text-[10px] gap-1"><Server className="h-2.5 w-2.5" />{acct.display_name || acct.email}</Badge> : null;
                  })()}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm font-bold pb-3 mb-3 border-b border-border">{previews[prevIdx].subject}</div>
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{previews[prevIdx].body}</pre>
              </div>

              {/* Lead data grid */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                {Object.entries(previews[prevIdx].lead).map(([k, v]) => (
                  <div key={k} className="bg-muted/30 p-2 rounded border">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{k}</p>
                    <p className="text-xs text-primary font-mono truncate">{v}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Per-lead account override */}
          {accounts.length > 1 && (
            <Card>
              <CardContent className="pt-6 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Override Sender for This Lead</Label>
                <div className="flex gap-2 flex-wrap">
                  {accounts.map(acct => (
                    <button
                      key={acct.id}
                      onClick={() => setPreviews(prev => prev.map((p, i) => i === prevIdx ? { ...p, accountId: acct.id } : p))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        previews[prevIdx]?.accountId === acct.id ? "border-primary bg-primary/5 text-primary border" : "border border-border text-muted-foreground"
                      }`}
                    >
                      <Server className="h-3 w-3" />
                      {acct.display_name || acct.email}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={() => setStep(2)}>← Edit Template</Button>
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Delay:</span>
                <Select value={String(delay)} onValueChange={v => setDelay(Number(v))}>
                  <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[["500", "0.5s"], ["1000", "1s"], ["2000", "2s"], ["5000", "5s"], ["10000", "10s"]].map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={startSend} disabled={sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send {previews.length} Emails
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ STEP 4: RESULTS ══ */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sent", value: sendResults.filter(r => r.ok).length, color: "text-green-500 bg-green-500/10 border-green-500/20" },
              { label: "Failed", value: sendResults.filter(r => !r.ok).length, color: "text-destructive bg-destructive/10 border-destructive/20" },
              { label: "Total", value: sendResults.length, color: "text-primary bg-primary/10 border-primary/20" },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-5 text-center border ${s.color}`}>
                <p className="text-3xl font-extrabold">{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Per-account stats */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">By Account</Label>
              <div className="flex gap-2 flex-wrap">
                {accounts.map(acct => {
                  const acctResults = sendResults.filter(r => r.accountId === acct.id);
                  const sent = acctResults.filter(r => r.ok).length;
                  return (
                    <div key={acct.id} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border flex-1 min-w-[160px]">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold">{acct.display_name || acct.email}</p>
                        <p className="text-xs text-muted-foreground">{sent}/{acctResults.length} sent</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">SMTP</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Send log */}
          <Card>
            <CardContent className="pt-6">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3 block">Send Log</Label>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {["Recipient", "Email", "Subject", "Sent From", "Status"].map(h => (
                        <th key={h} className="text-left p-2 text-muted-foreground font-bold uppercase border-b">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sendResults.map((r, i) => {
                      const acct = getAccountById(r.accountId);
                      return (
                        <tr key={i}>
                          <td className="p-2 border-b border-border/20">{r.lead.name || r.lead.first_name || "—"}</td>
                          <td className="p-2 border-b border-border/20 text-muted-foreground font-mono">{r.lead.email}</td>
                          <td className="p-2 border-b border-border/20 max-w-[160px] truncate">{r.subject}</td>
                          <td className="p-2 border-b border-border/20">
                            <Badge variant="outline" className="text-[10px] gap-1"><Server className="h-2.5 w-2.5" />{acct?.display_name || acct?.email || "—"}</Badge>
                          </td>
                          <td className="p-2 border-b border-border/20">
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant={r.ok ? "default" : "destructive"} className="text-[10px]">{r.ok ? "✓ Sent" : "✗ Failed"}</Badge>
                              </TooltipTrigger>
                              <TooltipContent>{r.note}</TooltipContent>
                            </Tooltip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => { setStep(0); setLeads([]); setPreviews([]); setSendResults([]); }}>← New Campaign</Button>
            <Button variant="secondary" onClick={() => setStep(3)}><Eye className="mr-2 h-4 w-4" /> Review Emails</Button>
          </div>
        </div>
      )}

      {/* ── SENDING OVERLAY ── */}
      {sending && (
        <div className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center">
          <div className="bg-card border rounded-2xl p-10 text-center min-w-[320px] shadow-lg">
            <Send className="h-8 w-8 mx-auto mb-4 text-primary" />
            <h2 className="text-lg font-bold mb-1">Sending Campaign…</h2>
            <p className="text-sm text-muted-foreground mb-5">{sendProg} of {previews.length} dispatched</p>
            <Progress value={(sendProg / previews.length) * 100} className="h-1.5" />
            <div className="flex gap-2 justify-center mt-4 flex-wrap">
              {accounts.map(acct => {
                const dispatched = previews.slice(0, sendProg).filter(p => p.accountId === acct.id).length;
                return dispatched > 0 ? (
                  <Badge key={acct.id} variant="outline" className="text-[10px]">{acct.display_name || acct.email}: {dispatched}</Badge>
                ) : null;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
