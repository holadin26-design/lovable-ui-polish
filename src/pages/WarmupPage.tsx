import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Play, Pause, TrendingUp, Mail, BarChart2, Plus, Trash2, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function WarmupPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    email_account_id: "",
    target_daily_limit: 50,
    ramp_increment: 3,
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const [{ data: sched }, { data: accs }] = await Promise.all([
      supabase.from("warmup_schedules").select("*, email_accounts(email)").order("created_at", { ascending: false }),
      supabase.from("email_accounts").select("*"),
    ]);
    setSchedules(sched || []);
    setEmailAccounts(accs || []);
    setLoading(false);
  };

  const createSchedule = async () => {
    if (!user) return;
    const { error } = await supabase.from("warmup_schedules").insert({
      user_id: user.id,
      email_account_id: newSchedule.email_account_id,
      target_daily_limit: newSchedule.target_daily_limit,
      ramp_increment: newSchedule.ramp_increment,
    });
    if (error) { toast.error(error.message); return; }

    // Enable warmup on the email account
    await supabase.from("email_accounts").update({ warmup_enabled: true }).eq("id", newSchedule.email_account_id);

    toast.success("Warmup schedule created!");
    setShowCreateDialog(false);
    setNewSchedule({ email_account_id: "", target_daily_limit: 50, ramp_increment: 3 });
    loadData();
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    const { error } = await supabase.from("warmup_schedules").update({ status: newStatus as any }).eq("id", id);
    if (!error) { toast.success(`Warmup ${newStatus}`); loadData(); }
  };

  const deleteSchedule = async (id: string) => {
    const { error } = await supabase.from("warmup_schedules").delete().eq("id", id);
    if (!error) { toast.success("Warmup schedule deleted"); loadData(); }
  };

  const statusColors: Record<string, string> = {
    active: "text-success",
    paused: "text-warning",
    completed: "text-primary",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Email Warmup</h1>
          <p className="text-muted-foreground mt-1">
            Gradually increase sending volume and exchange warmup emails to build sender reputation.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} disabled={emailAccounts.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> New Warmup Schedule
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Flame className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm">How Warmup Works</h3>
            <p className="text-sm text-muted-foreground mt-1">
              <strong>Gradual Ramp-up:</strong> Starts with a low daily send limit and increases by your configured increment each day.
              <br />
              <strong>Warmup Exchanges:</strong> The system sends and receives warmup emails between your accounts to build deliverability and inbox reputation.
            </p>
          </div>
        </CardContent>
      </Card>

      {emailAccounts.length === 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-center">
            <Settings className="h-6 w-6 text-warning mx-auto mb-2" />
            <p className="font-medium">No email accounts configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add an email account with SMTP/IMAP credentials in Settings first.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = "/settings"}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{schedules.filter((s) => s.status === "active").length}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{schedules.reduce((a, s) => a + s.total_sent, 0)}</p>
              <p className="text-sm text-muted-foreground">Total Sent</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
              <BarChart2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{schedules.reduce((a, s) => a + s.total_received, 0)}</p>
              <p className="text-sm text-muted-foreground">Total Received</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : schedules.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Flame className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>No warmup schedules yet.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule, i) => {
            const progress = Math.min(100, (schedule.current_daily_limit / schedule.target_daily_limit) * 100);
            const accountEmail = (schedule.email_accounts as any)?.email || "Unknown";
            return (
              <motion.div key={schedule.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Flame className={`h-5 w-5 ${statusColors[schedule.status] || "text-muted-foreground"}`} />
                          <h3 className="font-display font-semibold">{accountEmail}</h3>
                          <Badge variant={schedule.status === "active" ? "default" : "secondary"}>
                            {schedule.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <span>Day {schedule.days_active}</span>
                          <span>Current: {schedule.current_daily_limit}/day</span>
                          <span>Target: {schedule.target_daily_limit}/day</span>
                          <span>+{schedule.ramp_increment}/day</span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <Progress value={progress} className="h-2 flex-1" />
                          <span className="text-sm font-medium text-muted-foreground w-10">{Math.round(progress)}%</span>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Sent: {schedule.total_sent}</span>
                          <span>Received: {schedule.total_received}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => toggleStatus(schedule.id, schedule.status)}>
                          {schedule.status === "active" ? <><Pause className="mr-1.5 h-3.5 w-3.5" /> Pause</> : <><Play className="mr-1.5 h-3.5 w-3.5" /> Resume</>}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteSchedule(schedule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Create Warmup Schedule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Account</Label>
              <Select value={newSchedule.email_account_id} onValueChange={(v) => setNewSchedule({ ...newSchedule, email_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select email account" /></SelectTrigger>
                <SelectContent>
                  {emailAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Daily Limit</Label>
              <Input type="number" value={newSchedule.target_daily_limit} onChange={(e) => setNewSchedule({ ...newSchedule, target_daily_limit: parseInt(e.target.value) || 50 })} />
              <p className="text-xs text-muted-foreground">The maximum daily sends to ramp up to</p>
            </div>
            <div className="space-y-2">
              <Label>Daily Ramp Increment</Label>
              <Input type="number" value={newSchedule.ramp_increment} onChange={(e) => setNewSchedule({ ...newSchedule, ramp_increment: parseInt(e.target.value) || 3 })} />
              <p className="text-xs text-muted-foreground">How many additional emails per day to add</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={createSchedule} disabled={!newSchedule.email_account_id}>Create Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
