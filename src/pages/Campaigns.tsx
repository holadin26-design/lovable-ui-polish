import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Plus, Play, Pause, Users, Mail, BarChart2, ArrowUpRight, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusBadge: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
  active: { variant: "default", label: "Active" },
  paused: { variant: "secondary", label: "Paused" },
  draft: { variant: "outline", label: "Draft" },
  completed: { variant: "default", label: "Completed" },
};

export default function Campaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", followup_delay_hours: 48, max_followups: 3 });
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns(data || []);

    // Get lead counts per campaign
    if (data && data.length > 0) {
      const counts: Record<string, number> = {};
      for (const c of data) {
        const { count } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("campaign_id", c.id);
        counts[c.id] = count || 0;
      }
      setLeadCounts(counts);
    }
    setLoading(false);
  };

  const createCampaign = async () => {
    if (!user) return;
    const { error } = await supabase.from("campaigns").insert({
      user_id: user.id,
      name: newCampaign.name,
      followup_delay_hours: newCampaign.followup_delay_hours,
      max_followups: newCampaign.max_followups,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Campaign created!");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Create and manage bulk email campaigns.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Campaign
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Zap className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>No campaigns yet. Create your first one!</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign, i) => (
            <motion.div key={campaign.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-display font-semibold text-lg">{campaign.name}</h3>
                        <Badge variant={statusBadge[campaign.status]?.variant || "outline"}>
                          {statusBadge[campaign.status]?.label || campaign.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{leadCounts[campaign.id] || 0} leads</span>
                        <span>Delay: {campaign.followup_delay_hours}h</span>
                        <span>Max {campaign.max_followups} follow-ups</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {campaign.status === "draft" && <Button size="sm" onClick={() => updateStatus(campaign.id, "active")}><Play className="mr-1.5 h-3.5 w-3.5" /> Launch</Button>}
                      {campaign.status === "active" && <Button variant="outline" size="sm" onClick={() => updateStatus(campaign.id, "paused")}><Pause className="mr-1.5 h-3.5 w-3.5" /> Pause</Button>}
                      {campaign.status === "paused" && <Button variant="outline" size="sm" onClick={() => updateStatus(campaign.id, "active")}><Play className="mr-1.5 h-3.5 w-3.5" /> Resume</Button>}
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteCampaign(campaign.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Create Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Campaign Name</Label><Input placeholder="e.g., Q1 Outreach" value={newCampaign.name} onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Follow-up Delay (hours)</Label><Input type="number" value={newCampaign.followup_delay_hours} onChange={(e) => setNewCampaign({ ...newCampaign, followup_delay_hours: parseInt(e.target.value) || 48 })} /></div>
            <div className="space-y-2"><Label>Max Follow-ups</Label><Input type="number" value={newCampaign.max_followups} onChange={(e) => setNewCampaign({ ...newCampaign, max_followups: parseInt(e.target.value) || 3 })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={createCampaign} disabled={!newCampaign.name}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
