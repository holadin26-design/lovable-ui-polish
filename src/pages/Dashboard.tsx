import { useState } from "react";
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

const stats = [
  {
    label: "Total Sent",
    value: "142",
    change: "+12%",
    icon: Send,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    label: "Follow-ups Pending",
    value: "28",
    change: "+3",
    icon: Clock,
    color: "text-warning",
    bg: "bg-warning/10",
  },
  {
    label: "Replies Received",
    value: "67",
    change: "+8%",
    icon: CheckCircle,
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    label: "Today's Sends",
    value: "9",
    change: "3 first, 6 follow-ups",
    icon: TrendingUp,
    color: "text-accent-foreground",
    bg: "bg-accent/20",
  },
];

const recentEmails = [
  {
    id: 1,
    to: "sarah@company.com",
    subject: "Partnership Proposal - Q1 2026",
    sentAt: "2 hours ago",
    status: "pending",
    followups: 2,
  },
  {
    id: 2,
    to: "mike@startup.io",
    subject: "Follow up on our call",
    sentAt: "5 hours ago",
    status: "replied",
    followups: 1,
  },
  {
    id: 3,
    to: "lisa@enterprise.co",
    subject: "Product Demo Request",
    sentAt: "1 day ago",
    status: "pending",
    followups: 3,
  },
  {
    id: 4,
    to: "john@agency.net",
    subject: "Invoice #1234 - March 2026",
    sentAt: "2 days ago",
    status: "sent",
    followups: 0,
  },
  {
    id: 5,
    to: "team@client.com",
    subject: "Project kickoff materials",
    sentAt: "3 days ago",
    status: "replied",
    followups: 1,
  },
];

const missedFollowups = [
  { to: "alex@dev.co", subject: "API Integration", overdue: "2 hours" },
  { to: "nina@brand.com", subject: "Design Review", overdue: "5 hours" },
];

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  sent: { label: "Sent", variant: "secondary" },
  replied: { label: "Replied", variant: "default" },
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor your email follow-ups and track replies.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Compose
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Follow-up
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {stat.change}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-display font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Missed Follow-ups Alert */}
      {missedFollowups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive">
                    {missedFollowups.length} Missed Follow-ups
                  </h3>
                  <div className="mt-2 space-y-1">
                    {missedFollowups.map((m, i) => (
                      <p key={i} className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{m.to}</span>
                        {" — "}{m.subject} (overdue by {m.overdue})
                      </p>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="destructive">
                  Send Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Emails */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-display">Recent Sent Emails</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary">
              View All <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentEmails.map((email) => (
                <div
                  key={email.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {email.to[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{email.to}</p>
                      <Badge variant={statusConfig[email.status]?.variant || "outline"}>
                        {statusConfig[email.status]?.label || email.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {email.subject}
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      {email.sentAt}
                    </span>
                    {email.followups > 0 && (
                      <span className="text-xs text-primary font-medium">
                        {email.followups} follow-up{email.followups > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
