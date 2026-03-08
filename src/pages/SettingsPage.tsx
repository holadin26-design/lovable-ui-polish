import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, Key, Clock, Bell, Plus, Trash2, CheckCircle, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showValidateDialog, setShowValidateDialog] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [newAccount, setNewAccount] = useState({
    email: "",
    display_name: "",
    app_password: "",
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    imap_host: "imap.gmail.com",
    imap_port: 993,
  });

  useEffect(() => {
    if (user) loadAccounts();
  }, [user]);

  const loadAccounts = async () => {
    const { data } = await supabase.from("email_accounts").select("*").order("created_at", { ascending: false });
    setEmailAccounts(data || []);
    setLoading(false);
  };

  const addAccount = async () => {
    if (!user) return;
    const { error } = await supabase.from("email_accounts").insert({
      user_id: user.id,
      email: newAccount.email,
      display_name: newAccount.display_name || null,
      app_password: newAccount.app_password,
      smtp_host: newAccount.smtp_host,
      smtp_port: newAccount.smtp_port,
      imap_host: newAccount.imap_host,
      imap_port: newAccount.imap_port,
      is_primary: emailAccounts.length === 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Email account added!");
    setShowAddDialog(false);
    setNewAccount({ email: "", display_name: "", app_password: "", smtp_host: "smtp.gmail.com", smtp_port: 587, imap_host: "imap.gmail.com", imap_port: 993 });
    loadAccounts();
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.from("email_accounts").delete().eq("id", id);
    if (!error) { toast.success("Account removed"); loadAccounts(); }
  };

  const validateAccount = async (accountId: string) => {
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-email", {
        body: { email_account_id: accountId },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("SMTP/IMAP connection validated successfully!");
      } else {
        toast.error(data?.error || "Validation failed");
      }
    } catch (error: any) {
      toast.error("Validation error: " + error.message);
    } finally {
      setValidating(false);
      setShowValidateDialog(null);
    }
  };

  const setPrimary = async (id: string) => {
    // Reset all to non-primary
    await supabase.from("email_accounts").update({ is_primary: false }).eq("user_id", user!.id);
    await supabase.from("email_accounts").update({ is_primary: true }).eq("id", id);
    toast.success("Primary account updated");
    loadAccounts();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure email accounts with SMTP/IMAP credentials.</p>
      </div>

      {/* Auth Info */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                <Shield className="h-5 w-5 text-success" />
              </div>
              <div>
                <CardTitle className="font-display">Google Account</CardTitle>
                <CardDescription>Authenticated via Google OAuth</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-success" />
                </div>
                <div>
                  <p className="font-medium">{user?.email}</p>
                  <p className="text-sm text-muted-foreground">Signed in via Google</p>
                </div>
              </div>
              <Badge variant="default" className="bg-success text-success-foreground">Connected</Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Email Accounts */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-display">Email Accounts (SMTP/IMAP)</CardTitle>
                <CardDescription>Add email accounts for sending and receiving follow-ups</CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Account
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-muted-foreground text-center py-6">Loading...</p>
            ) : emailAccounts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Mail className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p>No email accounts added yet.</p>
                <p className="text-xs mt-1">Add a Gmail account with an App Password to start sending emails.</p>
              </div>
            ) : (
              emailAccounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {acc.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{acc.email}</p>
                        {acc.is_primary && <Badge variant="default" className="text-xs">Primary</Badge>}
                        {acc.warmup_enabled && <Badge variant="secondary" className="text-xs">Warming up</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        SMTP: {acc.smtp_host}:{acc.smtp_port} · IMAP: {acc.imap_host}:{acc.imap_port}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => validateAccount(acc.id)} disabled={validating}>
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Validate
                    </Button>
                    {!acc.is_primary && (
                      <Button variant="ghost" size="sm" onClick={() => setPrimary(acc.id)}>Set Primary</Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteAccount(acc.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}

            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                <strong>Gmail users:</strong> Use an App Password instead of your regular password.
                Go to Google Account → Security → 2-Step Verification → App Passwords.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Account Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Add Email Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Email Address *</Label>
                <Input placeholder="your@gmail.com" value={newAccount.email} onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Display Name</Label>
                <Input placeholder="Your Name" value={newAccount.display_name} onChange={(e) => setNewAccount({ ...newAccount, display_name: e.target.value })} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>App Password *</Label>
                <Input type="password" placeholder="Google App Password" value={newAccount.app_password} onChange={(e) => setNewAccount({ ...newAccount, app_password: e.target.value })} />
              </div>
            </div>
            <Separator />
            <p className="text-sm font-medium">SMTP Settings (Outgoing)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input value={newAccount.smtp_host} onChange={(e) => setNewAccount({ ...newAccount, smtp_host: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SMTP Port</Label>
                <Input type="number" value={newAccount.smtp_port} onChange={(e) => setNewAccount({ ...newAccount, smtp_port: parseInt(e.target.value) || 587 })} />
              </div>
            </div>
            <p className="text-sm font-medium">IMAP Settings (Incoming)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IMAP Host</Label>
                <Input value={newAccount.imap_host} onChange={(e) => setNewAccount({ ...newAccount, imap_host: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>IMAP Port</Label>
                <Input type="number" value={newAccount.imap_port} onChange={(e) => setNewAccount({ ...newAccount, imap_port: parseInt(e.target.value) || 993 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={addAccount} disabled={!newAccount.email || !newAccount.app_password}>Add Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
