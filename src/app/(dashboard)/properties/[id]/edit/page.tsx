"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

export default function EditPropertyPage() {
  const router = useRouter();
  const { id: propertyId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip: "",
    property_type: "",
    units: 1,
    purchase_price: "",
    purchase_date: "",
    current_value: "",
    monthly_rent: "",
    notes: "",
  });

  useEffect(() => {
    async function fetchProperty() {
      try {
        const data = await db.query("properties", {
          filters: { id: propertyId },
          single: true,
        });
        setForm({
          name: data.name || "",
          address_line1: data.address_line1 || "",
          address_line2: data.address_line2 || "",
          city: data.city || "",
          state: data.state || "",
          zip: data.zip || "",
          property_type: data.property_type || "",
          units: data.units || 1,
          purchase_price: data.purchase_price != null ? String(data.purchase_price) : "",
          purchase_date: data.purchase_date || "",
          current_value: data.current_value != null ? String(data.current_value) : "",
          monthly_rent: data.monthly_rent != null ? String(data.monthly_rent) : "",
          notes: data.notes || "",
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load property");
      } finally {
        setFetching(false);
      }
    }
    fetchProperty();
  }, [propertyId]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await db.update("properties", propertyId, {
        name: form.name,
        address_line1: form.address_line1,
        address_line2: form.address_line2 || null,
        city: form.city,
        state: form.state,
        zip: form.zip,
        property_type: form.property_type,
        units: Number(form.units),
        purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
        purchase_date: form.purchase_date || null,
        current_value: form.current_value ? Number(form.current_value) : null,
        monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : null,
        notes: form.notes || null,
      });
      router.push(`/properties/${propertyId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update property");
      setLoading(false);
      return;
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this property? This action cannot be undone.")) {
      return;
    }
    setDeleting(true);
    setError(null);

    try {
      await db.remove("properties", propertyId);
      router.push("/properties");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete property");
      setDeleting(false);
    }
  }

  if (fetching) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Property</h1>
          <p className="text-muted-foreground">Loading property details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Property</h1>
        <p className="text-muted-foreground">
          Update the details of your rental property
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5" />
            Property Details
          </CardTitle>
          <CardDescription>
            Update the details of your rental property
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Property Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Property Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Beach House Rental"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            {/* Address */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address_line1">Address Line 1 *</Label>
                <Input
                  id="address_line1"
                  name="address_line1"
                  placeholder="Street address"
                  value={form.address_line1}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  name="address_line2"
                  placeholder="Apt, suite, unit, etc."
                  value={form.address_line2}
                  onChange={handleChange}
                />
              </div>
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="City"
                    value={form.city}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder="HI"
                    maxLength={2}
                    value={form.state}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="zip">ZIP *</Label>
                  <Input
                    id="zip"
                    name="zip"
                    placeholder="96740"
                    value={form.zip}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Property Type & Units */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property_type">Property Type *</Label>
                <Select
                  value={form.property_type}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, property_type: value }))
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_family">Single Family</SelectItem>
                    <SelectItem value="multi_family">Multi Family</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="units">Units *</Label>
                <Input
                  id="units"
                  name="units"
                  type="number"
                  min={1}
                  value={form.units}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Financial Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Purchase Price</Label>
                <Input
                  id="purchase_price"
                  name="purchase_price"
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  value={form.purchase_price}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input
                  id="purchase_date"
                  name="purchase_date"
                  type="date"
                  value={form.purchase_date}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_value">Current Value</Label>
                <Input
                  id="current_value"
                  name="current_value"
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  value={form.current_value}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly_rent">Monthly Rent</Label>
                <Input
                  id="monthly_rent"
                  name="monthly_rent"
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  value={form.monthly_rent}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Any additional notes about this property..."
                value={form.notes}
                onChange={handleChange}
                rows={3}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/properties/${propertyId}`)}
              >
                Cancel
              </Button>
              <div className="flex-1" />
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting..." : "Delete Property"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
