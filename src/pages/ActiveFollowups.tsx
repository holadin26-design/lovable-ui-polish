import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Trash2,
  Edit2,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "cancelled", label: "Cancelled" },
  { value: "replied", label: "Replied" },
];

const mockFollowups = [
  {
    id: 1,
    recipientEmail: "sarah@company.com",
    subject: "Partnership Proposal - Q1 2026",
    body: "Hi Sarah, just following up on my previous email about the partnership...",
    scheduledFor: "2026-03-09T10:00:00",
    status: "pending",
    attemptNumber: 1,
  },
  {
    id: 2,
    recipientEmail: "mike@startup.io",
    subject: "Follow up on our call",
    body: "Hey Mike, wanted to circle back on our conversation last week...",
    scheduledFor: "2026-03-08T14:00:00",
    status: "sent",
    attemptNumber: 2,
  },
  {
    id: 3,
    recipientEmail: "lisa@enterprise.co",
    subject: "Product Demo Request",
    body: "Hi Lisa, I noticed you haven't had a chance to review the demo...",
    scheduledFor: "2026-03-10T09:00:00",
    status: "pending",
    attemptNumber: 1,
  },
  {
    id: 4,
    recipientEmail: "alex@dev.co",
    subject: "API Integration Help",
    body: "Hi Alex, following up on the API documentation I sent...",
    scheduledFor: "2026-03-07T16:00:00",
    status: "replied",
    attemptNumber: 1,
  },
  {
    id: 5,
    recipientEmail: "nina@brand.com",
    subject: "Design Collaboration",
    body: "Hi Nina, just checking in about the design collaboration...",
    scheduledFor: "2026-03-06T11:00:00",
    status: "cancelled",
    attemptNumber: 3,
  },
];

const statusConfig: Record<string, { icon: typeof Clock; color: string; bgColor: string; label: string }> = {
  pending: { icon: Clock, color: "text-warning", bgColor: "bg-warning/10", label: "Pending" },
  sent: { icon: Send, color: "text-primary", bgColor: "bg-primary/10", label: "Sent" },
  replied: { icon: CheckCircle, color: "text-success", bgColor: "bg-success/10", label: "Replied" },
  cancelled: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10", label: "Cancelled" },
};

export default function ActiveFollowups() {
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = mockFollowups.filter((f) => {
    if (statusFilter && f.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        f.recipientEmail.toLowerCase().includes(q) ||
        f.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = mockFollowups.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Active Follow-ups
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage and track all your scheduled follow-up emails.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(statusConfig).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="cursor-pointer"
              onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
            >
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((sf) => (
            <Button
              key={sf.value}
              variant={statusFilter === sf.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(sf.value)}
              className="text-xs"
            >
              {sf.label}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Filter className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>No follow-ups found matching your filters.</p>
              </div>
            ) : (
              filtered.map((followup, i) => {
                const config = statusConfig[followup.status];
                const Icon = config.icon;
                return (
                  <motion.div
                    key={followup.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-4 px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{followup.recipientEmail}</p>
                        <Badge variant="outline" className="text-xs">
                          Attempt #{followup.attemptNumber}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground/80 truncate">
                        {followup.subject}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {followup.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Scheduled: {new Date(followup.scheduledFor).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {followup.status === "pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
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
    </div>
  );
}
