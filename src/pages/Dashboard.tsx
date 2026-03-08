import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Send,
  Clock,
  CheckCircle,
  Plus,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  sent: { label: "Sent", variant: "secondary" },
  replied: { label: "Replied", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [followups, setFollowups] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, replied: 0, sent: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const { data: fups } = await supabase
        .from("followups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      setFollowups(fups || []);

      const { count: total } = await supabase.from("followups").select("*", { count: "exact", head: true });
      const { count: pending } = await supabase.from("followups").select("*", { count: "exact", head: true }).eq("status", "pending");
      const { count: replied } = await supabase.from("followups").select("*", { count: "exact", head: true }).eq("status", "replied");
      const { count: sent } = await supabase.from("followups").select("*", { count: "exact", head: true }).eq("status", "sent");

      setStats({
        total: total || 0,
        pending: pending || 0,
        replied: replied || 0,
        sent: sent || 0,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const missedFollowups = followups.filter(
    (f) => f.status === "pending" && new Date(f.scheduled_for) < new Date()
  );

  const statCards = [
    { label: "Total Follow-ups", value: stats.total, icon: Send, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "Replies Received", value: stats.replied, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
    { label: "Sent", value: stats.sent, icon: TrendingUp, color: "text-accent-foreground", bg: "bg-accent/20" },
  ];

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor your email follow-ups and track replies.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/followups")}>
            <Clock className="mr-2 h-4 w-4" /> View Follow-ups
          </Button>
          <Button onClick={() => navigate("/followups")}>
            <Plus className="mr-2 h-4 w-4" /> New Follow-up
          </Button>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-display font-bold">{loading ? "—" : stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {missedFollowups.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">{missedFollowups.length} Overdue Follow-ups</h3>
                <div className="mt-2 space-y-1">
                  {missedFollowups.slice(0, 3).map((m) => (
                    <p key={m.id} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{m.recipient_email}</span> — {m.subject}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-display">Recent Follow-ups</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate("/followups")}>
              View All <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground">Loading...</div>
              ) : followups.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No follow-ups yet. Create your first one!</p>
                </div>
              ) : (
                followups.map((fup) => (
                  <div key={fup.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {fup.recipient_email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{fup.recipient_email}</p>
                        <Badge variant={statusConfig[fup.status]?.variant || "outline"}>
                          {statusConfig[fup.status]?.label || fup.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{fup.subject}</p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">
                        {new Date(fup.scheduled_for).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-primary font-medium">
                        Attempt #{fup.attempt_number}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
