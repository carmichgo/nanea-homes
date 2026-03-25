"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/api";
import { Contractor } from "@/types";
import { formatCurrency } from "@/lib/utils";
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

const SPECIALTIES = [
  "plumbing",
  "electrical",
  "hvac",
  "general",
  "roofing",
  "painting",
  "landscaping",
  "other",
];

interface ContractorFormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  specialty: string;
  serviceAreas: string;
  hourlyRate: string;
  notes: string;
}

const emptyForm: ContractorFormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  specialty: "general",
  serviceAreas: "",
  hourlyRate: "",
  notes: "",
};

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editContractor, setEditContractor] = useState<Contractor | null>(null);
  const [form, setForm] = useState<ContractorFormState>(emptyForm);

  const fetchContractors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.query("contractors", { order: "name" });
      setContractors(data ?? []);
    } catch (err) {
      console.error("Failed to fetch contractors:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContractors();
  }, [fetchContractors]);

  const updateField = (field: keyof ContractorFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openAddDialog = () => {
    setForm(emptyForm);
    setAddOpen(true);
  };

  const openEditDialog = (contractor: Contractor) => {
    setEditContractor(contractor);
    setForm({
      name: contractor.name,
      company: contractor.company ?? "",
      email: contractor.email ?? "",
      phone: contractor.phone ?? "",
      specialty: contractor.specialty ?? "general",
      serviceAreas: contractor.service_areas?.join(", ") ?? "",
      hourlyRate: contractor.hourly_rate?.toString() ?? "",
      notes: contractor.notes ?? "",
    });
  };

  const buildPayload = () => {
    const serviceAreasArray = form.serviceAreas
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      name: form.name,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      specialty: form.specialty || null,
      service_areas: serviceAreasArray.length > 0 ? serviceAreasArray : null,
      hourly_rate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
      notes: form.notes || null,
    };
  };

  const handleAdd = async () => {
    const payload = buildPayload();
    try {
      await db.insert("contractors", { ...payload, is_active: true });
      setAddOpen(false);
      setForm(emptyForm);
      fetchContractors();
    } catch (err) {
      console.error("Failed to add contractor:", err);
    }
  };

  const handleEdit = async () => {
    if (!editContractor) return;
    const payload = buildPayload();
    try {
      await db.update("contractors", editContractor.id, payload);
      setEditContractor(null);
      setForm(emptyForm);
      fetchContractors();
    } catch (err) {
      console.error("Failed to update contractor:", err);
    }
  };

  const toggleActive = async (contractor: Contractor) => {
    try {
      await db.update("contractors", contractor.id, { is_active: !contractor.is_active });
      fetchContractors();
    } catch (err) {
      console.error("Failed to toggle contractor status:", err);
    }
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="c-name">Name</Label>
        <Input
          id="c-name"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="Contractor name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-company">Company</Label>
        <Input
          id="c-company"
          value={form.company}
          onChange={(e) => updateField("company", e.target.value)}
          placeholder="Company name"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="c-email">Email</Label>
          <Input
            id="c-email"
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-phone">Phone</Label>
          <Input
            id="c-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="(555) 555-5555"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Specialty</Label>
        <Select
          value={form.specialty}
          onValueChange={(val) => updateField("specialty", val)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPECIALTIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-areas">Service Areas</Label>
        <Input
          id="c-areas"
          value={form.serviceAreas}
          onChange={(e) => updateField("serviceAreas", e.target.value)}
          placeholder="Area1, Area2, Area3"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated list of service areas
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-rate">Hourly Rate</Label>
        <Input
          id="c-rate"
          type="number"
          step="0.01"
          value={form.hourlyRate}
          onChange={(e) => updateField("hourlyRate", e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-notes">Notes</Label>
        <Textarea
          id="c-notes"
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Additional notes"
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading contractors...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contractors</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>Add Contractor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Contractor</DialogTitle>
              <DialogDescription>
                Add a new contractor to your list.
              </DialogDescription>
            </DialogHeader>
            {renderForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!form.name}>
                Add Contractor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editContractor}
        onOpenChange={(open) => !open && setEditContractor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contractor</DialogTitle>
            <DialogDescription>
              Update contractor information.
            </DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContractor(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!form.name}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {contractors.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No contractors added yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Service Areas</TableHead>
              <TableHead>Hourly Rate</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contractors.map((contractor) => (
              <TableRow key={contractor.id}>
                <TableCell className="font-medium">
                  <span
                    className={
                      !contractor.is_active ? "text-muted-foreground" : ""
                    }
                  >
                    {contractor.name}
                  </span>
                  {!contractor.is_active && (
                    <Badge variant="outline" className="ml-2">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{contractor.company ?? "-"}</TableCell>
                <TableCell>
                  {contractor.specialty ? (
                    <Badge variant="secondary">
                      {contractor.specialty.charAt(0).toUpperCase() +
                        contractor.specialty.slice(1)}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{contractor.phone ?? "-"}</TableCell>
                <TableCell>{contractor.email ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {contractor.service_areas?.map((area) => (
                      <Badge key={area} variant="outline" className="text-xs">
                        {area}
                      </Badge>
                    )) ?? "-"}
                  </div>
                </TableCell>
                <TableCell>
                  {contractor.hourly_rate != null
                    ? formatCurrency(contractor.hourly_rate)
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(contractor)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(contractor)}
                    >
                      {contractor.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
