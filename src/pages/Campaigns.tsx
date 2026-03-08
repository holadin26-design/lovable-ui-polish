import { motion } from "framer-motion";
import {
  Zap,
  Plus,
  Play,
  Pause,
  Users,
  Mail,
  BarChart2,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const campaigns = [
  {
    id: 1,
    name: "Q1 Outreach Campaign",
    status: "active",
    leads: 150,
    sent: 89,
    replied: 23,
    progress: 59,
    createdAt: "Mar 1, 2026",
  },
  {
    id: 2,
    name: "Product Launch Follow-up",
    status: "active",
    leads: 75,
    sent: 75,
    replied: 31,
    progress: 100,
    createdAt: "Feb 20, 2026",
  },
  {
    id: 3,
    name: "Re-engagement Series",
    status: "paused",
    leads: 200,
    sent: 45,
    replied: 8,
    progress: 22,
    createdAt: "Mar 5, 2026",
  },
  {
    id: 4,
    name: "Partner Outreach",
    status: "draft",
    leads: 50,
    sent: 0,
    replied: 0,
    progress: 0,
    createdAt: "Mar 7, 2026",
  },
];

const statusBadge: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
  active: { variant: "default", label: "Active" },
  paused: { variant: "secondary", label: "Paused" },
  draft: { variant: "outline", label: "Draft" },
};

export default function Campaigns() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Campaigns
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage bulk email campaigns with automated follow-ups.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">
                {campaigns.filter((c) => c.status === "active").length}
              </p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <Mail className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">
                {campaigns.reduce((a, c) => a + c.sent, 0)}
              </p>
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
              <p className="text-2xl font-display font-bold">
                {Math.round(
                  (campaigns.reduce((a, c) => a + c.replied, 0) /
                    Math.max(campaigns.reduce((a, c) => a + c.sent, 0), 1)) *
                    100
                )}
                %
              </p>
              <p className="text-sm text-muted-foreground">Reply Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign List */}
      <div className="space-y-4">
        {campaigns.map((campaign, i) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display font-semibold text-lg">
                        {campaign.name}
                      </h3>
                      <Badge variant={statusBadge[campaign.status].variant}>
                        {statusBadge[campaign.status].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {campaign.leads} leads
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {campaign.sent} sent
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {campaign.replied} replies
                      </span>
                      <span>Created {campaign.createdAt}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={campaign.progress} className="h-2 flex-1" />
                      <span className="text-sm font-medium text-muted-foreground w-10">
                        {campaign.progress}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {campaign.status === "active" && (
                      <Button variant="outline" size="sm">
                        <Pause className="mr-1.5 h-3.5 w-3.5" />
                        Pause
                      </Button>
                    )}
                    {campaign.status === "paused" && (
                      <Button variant="outline" size="sm">
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Resume
                      </Button>
                    )}
                    {campaign.status === "draft" && (
                      <Button size="sm">
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Launch
                      </Button>
                    )}
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
