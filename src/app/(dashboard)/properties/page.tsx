import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
import { Property } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, ArrowRight } from "lucide-react";

export default async function PropertiesPage() {
  const supabase = createAdminClient();

  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const propertyList = (properties as Property[]) ?? [];

  const propertyTypeLabels: Record<string, string> = {
    single_family: "Single Family",
    multi_family: "Multi Family",
    condo: "Condo",
    townhouse: "Townhouse",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground">
            Manage your rental properties
          </p>
        </div>
        <Button asChild>
          <Link href="/properties/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </Link>
        </Button>
      </div>

      {propertyList.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No properties yet</h2>
          <p className="text-muted-foreground mb-6">
            Get started by adding your first rental property.
          </p>
          <Button asChild>
            <Link href="/properties/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {propertyList.map((property) => (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{property.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {property.address_line1}
                    {property.address_line2 && `, ${property.address_line2}`}
                    <br />
                    {property.city}, {property.state} {property.zip}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Monthly Rent</p>
                      <p className="font-semibold">
                        {property.monthly_rent
                          ? formatCurrency(property.monthly_rent)
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Units</p>
                      <p className="font-semibold">{property.units}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-semibold">
                        {propertyTypeLabels[property.property_type] ??
                          property.property_type}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-primary">
                    View Details
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
