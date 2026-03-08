import { useState, useEffect } from "react";
import { Flame, Play, Pause, TrendingUp, Mail, BarChart2, Plus, Trash2, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  const [newSchedule, setNewSchedule] = useState({ email_account_id: "", target_daily_limit: 50, ramp_increment: 3 });

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
      user_id: user.id, email_account_id: newSchedule.email_account_id,
      target_daily_limit: newSchedule.target_daily_limit, ramp_increment: newSchedule.ramp_increment,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("email_accounts").update({ warmup_enabled: true }).eq("id", newSchedule.email_account_id);
    toast.success("Warmup started");
    setShowCreateDialog(false);
    setNewSchedule({ email_account_id: "", target_daily_limit: 50, ramp_increment: 3 });
    loadData();
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await supabase.from("warmup_schedules").update({ status: newStatus as any }).eq("id", id);
    toast.success(`Warmup ${newStatus}`);
    loadData();
  };

  const deleteSchedule = async (id: string) => {
    await supabase.from("warmup_schedules").delete().eq("id", id);
    toast.success("Deleted");
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Warmup</h1>
          <p className="text-sm text-muted-foreground mt-1">Build sender reputation with gradual ramp-up.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)} disabled={emailAccounts.length === 0}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New Schedule
        </Button>
      </div>

      {/* Info */}
      <div className="rounded-lg border bg-primary/5 border-primary/15 p-4 flex items-start gap-3">
        <Flame className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">How it works:</span> Gradually increases daily sending volume and exchanges warmup emails to improve inbox placement.
        </div>
      </div>

      {emailAccounts.length === 0 && (
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-6 text-center">
          <Settings className="h-5 w-5 text-warning mx-auto mb-2" />
          <p className="text-sm font-medium">No email accounts</p>
          <p className="text-xs text-muted-foreground mt-1">Add SMTP/IMAP credentials in Settings first.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = "/settings"}>Go to Settings</Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <TrendingUp className="h-4 w-4 text-success" />
          <div><p className="text-lg font-semibold">{schedules.filter((s) => s.status === "active").length}</p><p className="text-[11px] text-muted-foreground">Active</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Mail className="h-4 w-4 text-primary" />
          <div><p className="text-lg font-semibold">{schedules.reduce((a, s) => a + s.total_sent, 0)}</p><p className="text-[11px] text-muted-foreground">Sent</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
          <div><p className="text-lg font-semibold">{schedules.reduce((a, s) => a + s.total_received, 0)}</p><p className="text-[11px] text-muted-foreground">Received</p></div>
        </CardContent></Card>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : schedules.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Flame className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No warmup schedules yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => {
            const progress = Math.min(100, (schedule.current_daily_limit / schedule.target_daily_limit) * 100);
            const accountEmail = (schedule.email_accounts as any)?.email || "Unknown";
            return (
              <Card key={schedule.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Flame className={`h-4 w-4 ${schedule.status === "active" ? "text-success" : "text-muted-foreground"}`} />
                        <p className="text-sm font-medium">{accountEmail}</p>
                        <Badge variant={schedule.status === "active" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {schedule.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                        <span>Day {schedule.days_active}</span>
                        <span>{schedule.current_daily_limit}/{schedule.target_daily_limit} daily</span>
                        <span>+{schedule.ramp_increment}/day</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-[11px] text-muted-foreground w-8">{Math.round(progress)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toggleStatus(schedule.id, schedule.status)}>
                        {schedule.status === "active" ? <><Pause className="mr-1 h-3 w-3" /> Pause</> : <><Play className="mr-1 h-3 w-3" /> Resume</>}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteSchedule(schedule.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Warmup Schedule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Email Account</Label>
              <Select value={newSchedule.email_account_id} onValueChange={(v) => setNewSchedule({ ...newSchedule, email_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{emailAccounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Target Daily Limit</Label><Input type="number" value={newSchedule.target_daily_limit} onChange={(e) => setNewSchedule({ ...newSchedule, target_daily_limit: parseInt(e.target.value) || 50 })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Ramp +/day</Label><Input type="number" value={newSchedule.ramp_increment} onChange={(e) => setNewSchedule({ ...newSchedule, ramp_increment: parseInt(e.target.value) || 3 })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={createSchedule} disabled={!newSchedule.email_account_id}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
