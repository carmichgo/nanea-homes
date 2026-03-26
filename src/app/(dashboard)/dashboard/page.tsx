import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
import { Property, Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  DollarSign,
  ArrowRight,
  Wrench,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = createAdminClient();

  // Fetch all properties
  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .eq("is_active", true)
    .order("name");

  const propertyList = (properties as Property[]) ?? [];

  // Current month date range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  // Fetch all transactions for current month
  const { data: monthTransactions } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", startOfMonth)
    .lte("date", endOfMonth);

  const transactions = (monthTransactions as Transaction[]) ?? [];

  // Calculate totals
  const monthlyIncome = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const monthlyExpenses = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const noi = monthlyIncome - monthlyExpenses;

  // Count open maintenance records
  const { count: openMaintenanceCount } = await supabase
    .from("maintenance_records")
    .select("*", { count: "exact", head: true })
    .in("status", ["open", "in_progress"]);

  // Per-property transaction summaries
  const propertyTransactionMap = new Map<
    string,
    { income: number; expenses: number }
  >();

  for (const tx of transactions) {
    const existing = propertyTransactionMap.get(tx.property_id) ?? {
      income: 0,
      expenses: 0,
    };
    if (tx.type === "income") {
      existing.income += tx.amount;
    } else if (tx.type === "expense") {
      existing.expenses += tx.amount;
    }
    propertyTransactionMap.set(tx.property_id, existing);
  }

  const kpiCards = [
    {
      title: "Total Properties",
      value: propertyList.length.toString(),
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Monthly Revenue",
      value: formatCurrency(monthlyIncome),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Monthly Expenses",
      value: formatCurrency(monthlyExpenses),
      icon: DollarSign,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Net Operating Income",
      value: formatCurrency(noi),
      icon: DollarSign,
      color: noi >= 0 ? "text-green-600" : "text-red-600",
      bgColor: noi >= 0 ? "bg-green-50" : "bg-red-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your rental property portfolio
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="flex items-center gap-4 p-6">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${kpi.bgColor}`}
              >
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{kpi.title}</p>
                <p className="text-2xl font-bold">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Open Maintenance Banner */}
      {(openMaintenanceCount ?? 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5 text-orange-600" />
              <p className="text-sm font-medium text-orange-800">
                {openMaintenanceCount} open maintenance{" "}
                {openMaintenanceCount === 1 ? "item" : "items"} requiring
                attention
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Properties List with Monthly Summaries */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Properties</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/properties">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {propertyList.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              No properties added yet
            </p>
            <Button asChild>
              <Link href="/properties/new">Add Your First Property</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {propertyList.map((property) => {
              const summary = propertyTransactionMap.get(property.id) ?? {
                income: 0,
                expenses: 0,
              };
              const propertyNoi = summary.income - summary.expenses;

              return (
                <Link key={property.id} href={`/properties/${property.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="flex items-center justify-between p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{property.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {property.address_line1}, {property.city},{" "}
                            {property.state}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-sm">
                        <div className="text-right">
                          <p className="text-muted-foreground">Income</p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(summary.income)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Expenses</p>
                          <p className="font-semibold text-red-600">
                            {formatCurrency(summary.expenses)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">NOI</p>
                          <p
                            className={`font-semibold ${
                              propertyNoi >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(propertyNoi)}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
