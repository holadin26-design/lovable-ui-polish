import { motion } from "framer-motion";
import { Settings, Mail, Key, Clock, Bell, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your Gmail connection, scheduling preferences, and notifications.
        </p>
      </div>

      {/* Gmail Connection */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-display">Gmail Connection</CardTitle>
                <CardDescription>Manage your Gmail OAuth connection</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-success" />
                </div>
                <div>
                  <p className="font-medium">user@gmail.com</p>
                  <p className="text-sm text-muted-foreground">Connected via OAuth 2.0</p>
                </div>
              </div>
              <Badge variant="default" className="bg-success text-success-foreground">Connected</Badge>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">Reconnect</Button>
              <Button variant="destructive" className="ml-auto">Disconnect</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* API Keys */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
                <Key className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="font-display">API Configuration</CardTitle>
                <CardDescription>Set your Google Cloud OAuth credentials</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input type="password" value="••••••••••••••••" readOnly />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <Input type="password" value="••••••••••••" readOnly />
            </div>
            <Button variant="outline">Update Credentials</Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Scheduling */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <CardTitle className="font-display">Scheduling Preferences</CardTitle>
                <CardDescription>Configure default follow-up timing</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Follow-up Delay</Label>
              <div className="flex gap-2">
                {["24h", "48h", "3 days", "5 days", "1 week"].map((preset) => (
                  <Button
                    key={preset}
                    variant={preset === "48h" ? "default" : "outline"}
                    size="sm"
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-cancel on reply</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically cancel follow-ups when a reply is detected
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Business hours only</Label>
                <p className="text-sm text-muted-foreground">
                  Only send follow-ups during business hours (9 AM - 6 PM)
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <Bell className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="font-display">Notifications</CardTitle>
                <CardDescription>Configure how you receive alerts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email notifications</Label>
                <p className="text-sm text-muted-foreground">Get notified when replies are detected</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Missed follow-up alerts</Label>
                <p className="text-sm text-muted-foreground">Alert when follow-ups fail to send</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
