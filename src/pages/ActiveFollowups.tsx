import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Clock, CheckCircle, XCircle, Send, Trash2, Edit2, Filter, Plus } from "lucide-react";
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

const statusConfig: Record<string, { icon: typeof Clock; color: string; bgColor: string; label: string }> = {
  pending: { icon: Clock, color: "text-warning", bgColor: "bg-warning/10", label: "Pending" },
  sent: { icon: Send, color: "text-primary", bgColor: "bg-primary/10", label: "Sent" },
  replied: { icon: CheckCircle, color: "text-success", bgColor: "bg-success/10", label: "Replied" },
  cancelled: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10", label: "Cancelled" },
  failed: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10", label: "Failed" },
};

export default function ActiveFollowups() {
  const { user } = useAuth();
  const [followups, setFollowups] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [newFollowup, setNewFollowup] = useState({
    recipient_email: "",
    subject: "",
    body: "",
    scheduled_for: "",
    email_account_id: "",
  });

  useEffect(() => {
    if (user) {
      loadFollowups();
      loadEmailAccounts();
    }
  }, [user]);

  const loadFollowups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("followups")
        .select("*")
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      setFollowups(data || []);
    } catch (error) {
      console.error("Error loading follow-ups:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmailAccounts = async () => {
    const { data } = await supabase.from("email_accounts").select("*");
    setEmailAccounts(data || []);
  };

  const createFollowup = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("followups").insert({
        user_id: user.id,
        recipient_email: newFollowup.recipient_email,
        subject: newFollowup.subject,
        body: newFollowup.body,
        scheduled_for: new Date(newFollowup.scheduled_for).toISOString(),
        email_account_id: newFollowup.email_account_id || null,
      });
      if (error) throw error;
      toast.success("Follow-up created!");
      setShowCreateDialog(false);
      setNewFollowup({ recipient_email: "", subject: "", body: "", scheduled_for: "", email_account_id: "" });
      loadFollowups();
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const cancelFollowup = async (id: string) => {
    const { error } = await supabase.from("followups").update({ status: "cancelled" as any }).eq("id", id);
    if (!error) {
      toast.success("Follow-up cancelled");
      loadFollowups();
    }
  };

  const deleteFollowup = async (id: string) => {
    const { error } = await supabase.from("followups").delete().eq("id", id);
    if (!error) {
      toast.success("Follow-up deleted");
      loadFollowups();
    }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Active Follow-ups</h1>
          <p className="text-muted-foreground mt-1">Manage and track all your scheduled follow-up emails.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Follow-up
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(statusConfig).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <motion.div key={key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="cursor-pointer" onClick={() => setStatusFilter(statusFilter === key ? "" : key)}>
              <Card className={statusFilter === key ? "ring-2 ring-primary" : ""}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div>
                    <p className="text-xl font-display font-bold">{counts[key] || 0}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by email or subject..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Filter className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>No follow-ups found.</p>
              </div>
            ) : (
              filtered.map((followup, i) => {
                const config = statusConfig[followup.status] || statusConfig.pending;
                const Icon = config.icon;
                return (
                  <motion.div key={followup.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/50 transition-colors">
                    <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{followup.recipient_email}</p>
                        <Badge variant="outline" className="text-xs">#{followup.attempt_number}</Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground/80 truncate">{followup.subject}</p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{followup.body}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Scheduled: {new Date(followup.scheduled_for).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {followup.status === "pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cancelFollowup(followup.id)}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteFollowup(followup.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Create Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input placeholder="recipient@example.com" value={newFollowup.recipient_email} onChange={(e) => setNewFollowup({ ...newFollowup, recipient_email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input placeholder="Follow-up subject" value={newFollowup.subject} onChange={(e) => setNewFollowup({ ...newFollowup, subject: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea placeholder="Follow-up message body..." className="min-h-[120px]" value={newFollowup.body} onChange={(e) => setNewFollowup({ ...newFollowup, body: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Scheduled For</Label>
              <Input type="datetime-local" value={newFollowup.scheduled_for} onChange={(e) => setNewFollowup({ ...newFollowup, scheduled_for: e.target.value })} />
            </div>
            {emailAccounts.length > 0 && (
              <div className="space-y-2">
                <Label>Send From</Label>
                <Select value={newFollowup.email_account_id} onValueChange={(v) => setNewFollowup({ ...newFollowup, email_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select email account" /></SelectTrigger>
                  <SelectContent>
                    {emailAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={createFollowup} disabled={!newFollowup.recipient_email || !newFollowup.subject || !newFollowup.scheduled_for}>
              Create Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
