import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
import { Property, Transaction, MaintenanceRecord } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  DollarSign,
  FileText,
  Wrench,
  Landmark,
  ArrowRight,
  ArrowLeft,
  Pencil,
} from "lucide-react";

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({
  params,
}: PropertyDetailPageProps) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .single();

  if (!property) {
    notFound();
  }

  const typedProperty = property as Property;

  // Fetch recent transactions
  const { data: recentTransactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("property_id", id)
    .order("date", { ascending: false })
    .limit(5);

  const transactions = (recentTransactions as Transaction[]) ?? [];

  // Fetch open maintenance items count
  const { count: openMaintenanceCount } = await supabase
    .from("maintenance_records")
    .select("*", { count: "exact", head: true })
    .eq("property_id", id)
    .in("status", ["open", "in_progress"]);

  const propertyTypeLabels: Record<string, string> = {
    single_family: "Single Family",
    multi_family: "Multi Family",
    condo: "Condo",
    townhouse: "Townhouse",
  };

  const quickLinks = [
    {
      title: "Transactions",
      description: "View income and expenses",
      href: `/properties/${id}/transactions`,
      icon: DollarSign,
    },
    {
      title: "Financial Reports",
      description: "Revenue, expenses, and P&L",
      href: `/properties/${id}/financials`,
      icon: FileText,
    },
    {
      title: "Documents",
      description: "Leases, insurance, and more",
      href: `/properties/${id}/documents`,
      icon: FileText,
    },
    {
      title: "Maintenance",
      description: `${openMaintenanceCount ?? 0} open item${openMaintenanceCount !== 1 ? "s" : ""}`,
      href: `/properties/${id}/maintenance`,
      icon: Wrench,
    },
    {
      title: "Bank Connection",
      description: "Link bank accounts",
      href: `/properties/${id}/bank`,
      icon: Landmark,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/properties">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Properties
        </Link>
      </Button>

      {/* Property Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                {typedProperty.name}
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                {typedProperty.address_line1}
                {typedProperty.address_line2 &&
                  `, ${typedProperty.address_line2}`}
                <br />
                {typedProperty.city}, {typedProperty.state} {typedProperty.zip}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/properties/${id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Property
                </Link>
              </Button>
              <Badge variant="secondary">
                {propertyTypeLabels[typedProperty.property_type] ??
                  typedProperty.property_type}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Monthly Rent</p>
              <p className="text-lg font-semibold">
                {typedProperty.monthly_rent
                  ? formatCurrency(typedProperty.monthly_rent)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Value</p>
              <p className="text-lg font-semibold">
                {typedProperty.current_value
                  ? formatCurrency(typedProperty.current_value)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Units</p>
              <p className="text-lg font-semibold">{typedProperty.units}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Purchase Price</p>
              <p className="text-lg font-semibold">
                {typedProperty.purchase_price
                  ? formatCurrency(typedProperty.purchase_price)
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Manage</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.title} href={link.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <link.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{link.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/properties/${id}/transactions`}>
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No transactions recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {tx.description ?? tx.merchant_name ?? "Transaction"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(tx.date)}
                      {tx.category && ` · ${tx.category}`}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      tx.type === "income"
                        ? "text-green-600"
                        : tx.type === "internal"
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {tx.type === "income" ? "+" : tx.type === "internal" ? "~" : "-"}
                    {formatCurrency(Math.abs(tx.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
