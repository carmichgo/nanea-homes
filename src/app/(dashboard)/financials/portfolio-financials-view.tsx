"use client";

import { useMemo, useState } from "react";
import { Transaction, Property } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type Period = "this_month" | "this_quarter" | "this_year" | "last_year" | "custom";

function getPeriodRange(period: Period, customFrom?: string, customTo?: string) {
  const now = new Date();
  let from: string;
  let to: string;

  switch (period) {
    case "this_month":
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      to = now.toISOString().split("T")[0];
      break;
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      from = `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, "0")}-01`;
      to = now.toISOString().split("T")[0];
      break;
    }
    case "this_year":
      from = `${now.getFullYear()}-01-01`;
      to = now.toISOString().split("T")[0];
      break;
    case "last_year":
      from = `${now.getFullYear() - 1}-01-01`;
      to = `${now.getFullYear() - 1}-12-31`;
      break;
    case "custom":
      from = customFrom || `${now.getFullYear()}-01-01`;
      to = customTo || now.toISOString().split("T")[0];
      break;
  }

  return { from, to };
}

function groupByCategory(transactions: Transaction[]) {
  const groups: Record<string, number> = {};
  for (const t of transactions) {
    const cat = t.category || "other";
    groups[cat] = (groups[cat] || 0) + t.amount;
  }
  return groups;
}

/** Collect all unique categories across a set of transactions */
function allCategories(transactions: Transaction[], type: "income" | "expense") {
  const cats = new Set<string>();
  for (const t of transactions) {
    if (t.type === type) cats.add(t.category || "other");
  }
  return Array.from(cats).sort();
}

interface PortfolioFinancialsViewProps {
  properties: Property[];
  transactions: Transaction[];
}

export function PortfolioFinancialsView({
  properties,
  transactions,
}: PortfolioFinancialsViewProps) {
  const [period, setPeriod] = useState<Period>("this_year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const periodTransactions = useMemo(
    () => transactions.filter((t) => t.date >= from && t.date <= to),
    [transactions, from, to]
  );

  // Portfolio totals
  const incomeTransactions = periodTransactions.filter((t) => t.type === "income");
  const expenseTransactions = periodTransactions.filter((t) => t.type === "expense");
  const incomeByCategory = groupByCategory(incomeTransactions);
  const expenseByCategory = groupByCategory(expenseTransactions);
  const totalRevenue = incomeTransactions.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenseTransactions.reduce((s, t) => s + t.amount, 0);
  const portfolioNoi = totalRevenue - totalExpenses;

  // Per-property breakdown
  const propertyMap = useMemo(() => {
    const map: Record<
      string,
      {
        property: Property;
        income: Transaction[];
        expense: Transaction[];
      }
    > = {};
    for (const p of properties) {
      map[p.id] = { property: p, income: [], expense: [] };
    }
    for (const t of periodTransactions) {
      if (!map[t.property_id]) continue;
      if (t.type === "income") map[t.property_id].income.push(t);
      else map[t.property_id].expense.push(t);
    }
    return map;
  }, [properties, periodTransactions]);

  const incomeCategories = allCategories(periodTransactions, "income");
  const expenseCategories = allCategories(periodTransactions, "expense");

  function propertyTotal(propertyId: string, type: "income" | "expense") {
    const items = type === "income" ? propertyMap[propertyId]?.income : propertyMap[propertyId]?.expense;
    return (items ?? []).reduce((s, t) => s + t.amount, 0);
  }

  function propertyCategoryTotal(propertyId: string, type: "income" | "expense", category: string) {
    const items = type === "income" ? propertyMap[propertyId]?.income : propertyMap[propertyId]?.expense;
    return (items ?? [])
      .filter((t) => (t.category || "other") === category)
      .reduce((s, t) => s + t.amount, 0);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio Financials</h1>
        <p className="text-muted-foreground">
          Consolidated view across {properties.length} propert{properties.length === 1 ? "y" : "ies"}
        </p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label className="text-xs">Period</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="last_year">Last Year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === "custom" && (
          <>
            <div className="grid gap-1.5">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                className="w-40"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                className="w-40"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Portfolio Overview</TabsTrigger>
          <TabsTrigger value="by_property">By Property</TabsTrigger>
        </TabsList>

        {/* ── Portfolio Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          {/* Revenue */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    {properties.map((p) => (
                      <TableHead key={p.id} className="text-right">
                        {p.name}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeCategories.map((cat) => (
                    <TableRow key={cat}>
                      <TableCell className="capitalize">
                        {cat.replace(/_/g, " ")}
                      </TableCell>
                      {properties.map((p) => {
                        const val = propertyCategoryTotal(p.id, "income", cat);
                        return (
                          <TableCell key={p.id} className="text-right">
                            {val > 0 ? formatCurrency(val) : "-"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-medium">
                        {formatCurrency(incomeByCategory[cat] ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {incomeCategories.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={properties.length + 2}
                        className="text-center text-muted-foreground"
                      >
                        No revenue in this period.
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell>Total Revenue</TableCell>
                    {properties.map((p) => (
                      <TableCell key={p.id} className="text-right">
                        {formatCurrency(propertyTotal(p.id, "income"))}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {formatCurrency(totalRevenue)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    {properties.map((p) => (
                      <TableHead key={p.id} className="text-right">
                        {p.name}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseCategories.map((cat) => (
                    <TableRow key={cat}>
                      <TableCell className="capitalize">
                        {cat.replace(/_/g, " ")}
                      </TableCell>
                      {properties.map((p) => {
                        const val = propertyCategoryTotal(p.id, "expense", cat);
                        return (
                          <TableCell key={p.id} className="text-right">
                            {val > 0 ? formatCurrency(val) : "-"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-medium">
                        {formatCurrency(expenseByCategory[cat] ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {expenseCategories.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={properties.length + 2}
                        className="text-center text-muted-foreground"
                      >
                        No expenses in this period.
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell>Total Expenses</TableCell>
                    {properties.map((p) => (
                      <TableCell key={p.id} className="text-right">
                        {formatCurrency(propertyTotal(p.id, "expense"))}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {formatCurrency(totalExpenses)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Portfolio NOI */}
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableBody>
                  <TableRow className="font-bold text-lg">
                    <TableCell>Net Operating Income</TableCell>
                    {properties.map((p) => {
                      const propNoi =
                        propertyTotal(p.id, "income") - propertyTotal(p.id, "expense");
                      return (
                        <TableCell
                          key={p.id}
                          className={`text-right ${
                            propNoi >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(propNoi)}
                        </TableCell>
                      );
                    })}
                    <TableCell
                      className={`text-right text-2xl ${
                        portfolioNoi >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(portfolioNoi)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── By Property Cards ── */}
        <TabsContent value="by_property" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map((p) => {
              const propIncome = propertyTotal(p.id, "income");
              const propExpense = propertyTotal(p.id, "expense");
              const propNoi = propIncome - propExpense;
              const propIncByCat = groupByCategory(
                propertyMap[p.id]?.income ?? []
              );
              const propExpByCat = groupByCategory(
                propertyMap[p.id]?.expense ?? []
              );

              return (
                <Card key={p.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge
                        className={
                          propNoi >= 0
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-red-100 text-red-800 hover:bg-red-100"
                        }
                      >
                        NOI: {formatCurrency(propNoi)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Revenue */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Revenue
                      </p>
                      <Table>
                        <TableBody>
                          {Object.entries(propIncByCat).map(([cat, amount]) => (
                            <TableRow key={cat}>
                              <TableCell className="capitalize py-1.5 text-sm">
                                {cat.replace(/_/g, " ")}
                              </TableCell>
                              <TableCell className="text-right py-1.5 text-sm">
                                {formatCurrency(amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {Object.keys(propIncByCat).length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={2}
                                className="text-center text-muted-foreground py-1.5 text-sm"
                              >
                                No revenue
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow className="font-semibold border-t">
                            <TableCell className="py-1.5 text-sm">Total</TableCell>
                            <TableCell className="text-right py-1.5 text-sm">
                              {formatCurrency(propIncome)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Expenses */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Expenses
                      </p>
                      <Table>
                        <TableBody>
                          {Object.entries(propExpByCat).map(([cat, amount]) => (
                            <TableRow key={cat}>
                              <TableCell className="capitalize py-1.5 text-sm">
                                {cat.replace(/_/g, " ")}
                              </TableCell>
                              <TableCell className="text-right py-1.5 text-sm">
                                {formatCurrency(amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {Object.keys(propExpByCat).length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={2}
                                className="text-center text-muted-foreground py-1.5 text-sm"
                              >
                                No expenses
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow className="font-semibold border-t">
                            <TableCell className="py-1.5 text-sm">Total</TableCell>
                            <TableCell className="text-right py-1.5 text-sm">
                              {formatCurrency(propExpense)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {properties.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No active properties found.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
