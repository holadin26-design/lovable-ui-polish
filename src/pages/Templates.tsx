import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, FileText, Edit2, Trash2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const mockTemplates = [
  {
    id: 1,
    name: "Initial Outreach",
    subject: "Quick question about {{company}}",
    body: "Hi {{name}},\n\nI came across {{company}} and was impressed by your work in {{industry}}. I'd love to connect and discuss how we might collaborate.\n\nBest,\n{{sender}}",
    variables: ["name", "company", "industry", "sender"],
    usageCount: 24,
  },
  {
    id: 2,
    name: "Gentle Reminder",
    subject: "Re: {{originalSubject}}",
    body: "Hi {{name}},\n\nJust wanted to follow up on my previous email. I know things can get busy, so I wanted to make sure this didn't slip through the cracks.\n\nLooking forward to hearing from you.\n\nBest,\n{{sender}}",
    variables: ["name", "originalSubject", "sender"],
    usageCount: 56,
  },
  {
    id: 3,
    name: "Meeting Request",
    subject: "Let's schedule a call - {{topic}}",
    body: "Hi {{name}},\n\nI'd love to schedule a quick 15-minute call to discuss {{topic}}. Would any of these times work for you?\n\n- {{time1}}\n- {{time2}}\n- {{time3}}\n\nBest,\n{{sender}}",
    variables: ["name", "topic", "time1", "time2", "time3", "sender"],
    usageCount: 18,
  },
];

export default function Templates() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Create reusable email templates with dynamic variables.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockTemplates.map((template, i) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-display">
                        {template.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Used {template.usageCount} times
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-sm font-medium text-foreground/80 mb-2">
                  Subject: {template.subject}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                  {template.body}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {template.variables.map((v) => (
                    <Badge key={v} variant="secondary" className="text-xs">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-4 pt-4 border-t">
                  <Button variant="ghost" size="sm" className="flex-1">
                    <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1">
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Create Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input placeholder="e.g., Initial Outreach" />
            </div>
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input placeholder="Use {{variable}} for dynamic content" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                placeholder="Write your template body here. Use {{variable}} for personalization."
                className="min-h-[160px]"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: Use double curly braces like {"{{name}}"} for variables that will be replaced with actual values.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowCreateDialog(false)}>
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
