"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MaintenanceRecord,
  MaintenanceStatus,
  MaintenancePriority,
  Contractor,
} from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STATUSES: MaintenanceStatus[] = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
];
const PRIORITIES: MaintenancePriority[] = ["low", "medium", "high", "urgent"];

const statusColors: Record<MaintenanceStatus, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const priorityColors: Record<MaintenancePriority, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

function statusLabel(s: string) {
  return s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MaintenancePage() {
  const params = useParams();
  const propertyId = params.id as string;
  const supabase = createClient();

  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<MaintenanceRecord | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<MaintenancePriority>("medium");
  const [contractorId, setContractorId] = useState("");
  const [cost, setCost] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Edit form state
  const [editStatus, setEditStatus] = useState<MaintenanceStatus>("open");
  const [editCost, setEditCost] = useState("");
  const [editDateCompleted, setEditDateCompleted] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("maintenance_records")
      .select("*, contractor:contractors(*)")
      .eq("property_id", propertyId)
      .order("date_reported", { ascending: false });
    setRecords(data ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  const fetchContractors = useCallback(async () => {
    const { data } = await supabase
      .from("contractors")
      .select("*")
      .eq("is_active", true)
      .order("name");
    setContractors(data ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchRecords();
    fetchContractors();
  }, [fetchRecords, fetchContractors]);

  const resetCreateForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setContractorId("");
    setCost("");
    setFormNotes("");
  };

  const handleCreate = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("maintenance_records").insert({
      property_id: propertyId,
      user_id: user.id,
      title,
      description: description || null,
      priority,
      contractor_id: contractorId || null,
      cost: cost ? parseFloat(cost) : null,
      notes: formNotes || null,
      status: "open" as MaintenanceStatus,
      date_reported: new Date().toISOString().split("T")[0],
    });

    if (!error) {
      resetCreateForm();
      setCreateOpen(false);
      fetchRecords();
    }
  };

  const openEditDialog = (record: MaintenanceRecord) => {
    setEditRecord(record);
    setEditStatus(record.status);
    setEditCost(record.cost?.toString() ?? "");
    setEditDateCompleted(record.date_completed ?? "");
    setEditNotes(record.notes ?? "");
  };

  const handleUpdate = async () => {
    if (!editRecord) return;

    const { error } = await supabase
      .from("maintenance_records")
      .update({
        status: editStatus,
        cost: editCost ? parseFloat(editCost) : null,
        date_completed: editDateCompleted || null,
        notes: editNotes || null,
      })
      .eq("id", editRecord.id);

    if (!error) {
      setEditRecord(null);
      fetchRecords();
    }
  };

  const filteredRecords =
    filterStatus === "all"
      ? records
      : records.filter((r) => r.status === filterStatus);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading maintenance records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Maintenance</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetCreateForm()}>New Work Order</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Work Order</DialogTitle>
              <DialogDescription>
                Create a new maintenance work order.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Work order title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(val) =>
                    setPriority(val as MaintenancePriority)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contractor</Label>
                <Select value={contractorId} onValueChange={setContractorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contractor" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.company ? ` (${c.company})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-notes">Notes</Label>
                <Textarea
                  id="form-notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Additional notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!title}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <Label>Filter:</Label>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editRecord}
        onOpenChange={(open) => !open && setEditRecord(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Work Order</DialogTitle>
            <DialogDescription>
              Update the details of this work order.
            </DialogDescription>
          </DialogHeader>
          {editRecord && (
            <div className="space-y-4">
              <p className="font-medium">{editRecord.title}</p>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editStatus}
                  onValueChange={(val) =>
                    setEditStatus(val as MaintenanceStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cost">Cost</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  step="0.01"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date Completed</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editDateCompleted}
                  onChange={(e) => setEditDateCompleted(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {filteredRecords.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No maintenance records found.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Contractor</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Date Reported</TableHead>
              <TableHead>Date Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.map((record) => (
              <TableRow
                key={record.id}
                className="cursor-pointer"
                onClick={() => openEditDialog(record)}
              >
                <TableCell className="font-medium">{record.title}</TableCell>
                <TableCell>
                  <Badge className={statusColors[record.status]}>
                    {statusLabel(record.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={priorityColors[record.priority]}>
                    {record.priority.charAt(0).toUpperCase() +
                      record.priority.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {record.contractor?.name ?? "-"}
                </TableCell>
                <TableCell>
                  {record.cost != null ? formatCurrency(record.cost) : "-"}
                </TableCell>
                <TableCell>{formatDate(record.date_reported)}</TableCell>
                <TableCell>
                  {record.date_completed
                    ? formatDate(record.date_completed)
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
