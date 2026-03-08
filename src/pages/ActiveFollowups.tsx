import { useState, useEffect } from "react";
import { Search, Clock, CheckCircle, XCircle, Send, Trash2, Filter, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-warning", label: "Pending" },
  sent: { icon: Send, color: "text-primary", label: "Sent" },
  replied: { icon: CheckCircle, color: "text-success", label: "Replied" },
  cancelled: { icon: XCircle, color: "text-muted-foreground", label: "Cancelled" },
  failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
};

export default function ActiveFollowups() {
  const { user } = useAuth();
  const [followups, setFollowups] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [newFollowup, setNewFollowup] = useState({ recipient_email: "", subject: "", body: "", scheduled_for: "", email_account_id: "" });

  useEffect(() => {
    if (user) { loadFollowups(); loadEmailAccounts(); }
  }, [user]);

  const loadFollowups = async () => {
    setLoading(true);
    const { data } = await supabase.from("followups").select("*").order("scheduled_for", { ascending: true });
    setFollowups(data || []);
    setLoading(false);
  };

  const loadEmailAccounts = async () => {
    const { data } = await supabase.from("email_accounts").select("*");
    setEmailAccounts(data || []);
  };

  const createFollowup = async () => {
    if (!user) return;
    const { error } = await supabase.from("followups").insert({
      user_id: user.id,
      recipient_email: newFollowup.recipient_email,
      subject: newFollowup.subject,
      body: newFollowup.body,
      scheduled_for: new Date(newFollowup.scheduled_for).toISOString(),
      email_account_id: newFollowup.email_account_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Follow-up created");
    setShowCreateDialog(false);
    setNewFollowup({ recipient_email: "", subject: "", body: "", scheduled_for: "", email_account_id: "" });
    loadFollowups();
  };

  const cancelFollowup = async (id: string) => {
    await supabase.from("followups").update({ status: "cancelled" as any }).eq("id", id);
    toast.success("Cancelled");
    loadFollowups();
  };

  const deleteFollowup = async (id: string) => {
    await supabase.from("followups").delete().eq("id", id);
    toast.success("Deleted");
    loadFollowups();
  };

  const filtered = followups.filter((f) => {
    if (statusFilter && f.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return f.recipient_email.toLowerCase().includes(q) || f.subject.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = followups.reduce((acc, f) => { acc[f.status] = (acc[f.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sequences</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage scheduled follow-up emails.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New Follow-up
        </Button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              statusFilter === key
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            <config.icon className={`h-3 w-3 ${config.color}`} />
            {config.label}
            <span className="ml-0.5 text-[10px] opacity-60">{counts[key] || 0}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search by email or subject…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {loading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Filter className="h-5 w-5 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No follow-ups found</p>
              </div>
            ) : (
              filtered.map((followup) => {
                const config = statusConfig[followup.status] || statusConfig.pending;
                const Icon = config.icon;
                return (
                  <div key={followup.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors">
                    <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{followup.recipient_email}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">#{followup.attempt_number}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{followup.subject}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground hidden sm:block">
                      {new Date(followup.scheduled_for).toLocaleString()}
                    </p>
                    {followup.status === "pending" && (
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cancelFollowup(followup.id)}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteFollowup(followup.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Create Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Recipient Email</Label><Input placeholder="recipient@example.com" value={newFollowup.recipient_email} onChange={(e) => setNewFollowup({ ...newFollowup, recipient_email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Subject</Label><Input placeholder="Follow-up subject" value={newFollowup.subject} onChange={(e) => setNewFollowup({ ...newFollowup, subject: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Body</Label><Textarea placeholder="Message body…" className="min-h-[100px]" value={newFollowup.body} onChange={(e) => setNewFollowup({ ...newFollowup, body: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Schedule</Label><Input type="datetime-local" value={newFollowup.scheduled_for} onChange={(e) => setNewFollowup({ ...newFollowup, scheduled_for: e.target.value })} /></div>
            {emailAccounts.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Send From</Label>
                <Select value={newFollowup.email_account_id} onValueChange={(v) => setNewFollowup({ ...newFollowup, email_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>{emailAccounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={createFollowup} disabled={!newFollowup.recipient_email || !newFollowup.subject || !newFollowup.scheduled_for}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
