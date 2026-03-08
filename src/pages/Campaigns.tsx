import { useState, useEffect } from "react";
import { Plus, Play, Pause, Users, Trash2, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      user_id: user.id, name: newCampaign.name,
      followup_delay_hours: newCampaign.followup_delay_hours,
      max_followups: newCampaign.max_followups,
    });
    if (error) { toast.error(error.message); return; }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your email outreach campaigns.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New Campaign
        </Button>
      </div>

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
                  <div className="flex items-center gap-1.5">
                    {campaign.status === "draft" && (
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => updateStatus(campaign.id, "active")}>
                        <Play className="mr-1 h-3 w-3" /> Launch
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
    </div>
  );
}
