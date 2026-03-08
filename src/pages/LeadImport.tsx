import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Users, Download, Trash2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const mockLeads = [
  { id: 1, email: "sarah@company.com", name: "Sarah Chen", company: "TechCorp", status: "imported" },
  { id: 2, email: "mike@startup.io", name: "Mike Johnson", company: "StartupIO", status: "imported" },
  { id: 3, email: "lisa@enterprise.co", name: "Lisa Wang", company: "EnterpriseCo", status: "imported" },
  { id: 4, email: "alex@dev.co", name: "Alex Rivera", company: "DevCo", status: "imported" },
  { id: 5, email: "nina@brand.com", name: "Nina Patel", company: "BrandInc", status: "duplicate" },
];

export default function LeadImport() {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Bulk Import
        </h1>
        <p className="text-muted-foreground mt-1">
          Import leads from CSV files for bulk follow-up campaigns.
        </p>
      </div>

      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); }}
        >
          <CardContent className="py-12 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold mb-1">
              Drop your CSV file here
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse. Supports .csv files with email, name, company columns.
            </p>
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Browse Files
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">{mockLeads.length}</p>
              <p className="text-xs text-muted-foreground">Total Leads</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle className="h-4.5 w-4.5 text-success" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">
                {mockLeads.filter((l) => l.status === "imported").length}
              </p>
              <p className="text-xs text-muted-foreground">Imported</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
              <FileText className="h-4.5 w-4.5 text-warning" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">
                {mockLeads.filter((l) => l.status === "duplicate").length}
              </p>
              <p className="text-xs text-muted-foreground">Duplicates</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="font-display">Imported Leads</CardTitle>
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.email}</TableCell>
                  <TableCell>{lead.name}</TableCell>
                  <TableCell>{lead.company}</TableCell>
                  <TableCell>
                    <Badge
                      variant={lead.status === "imported" ? "default" : "secondary"}
                    >
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
