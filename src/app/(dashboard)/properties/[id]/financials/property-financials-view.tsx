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

interface PropertyFinancialsViewProps {
  property: Property | null;
  transactions: Transaction[];
}

export function PropertyFinancialsView({
  property,
  transactions,
}: PropertyFinancialsViewProps) {
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

  const incomeTransactions = periodTransactions.filter((t) => t.type === "income");
  const expenseTransactions = periodTransactions.filter((t) => t.type === "expense");
  const incomeByCategory = groupByCategory(incomeTransactions);
  const expenseByCategory = groupByCategory(expenseTransactions);
  const totalRevenue = incomeTransactions.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenseTransactions.reduce((s, t) => s + t.amount, 0);
  const noi = totalRevenue - totalExpenses;

  // Balance sheet
  const propertyValue = property?.current_value ?? 0;
  const totalMortgage = transactions
    .filter((t) => t.type === "expense" && t.category === "mortgage")
    .reduce((s, t) => s + t.amount, 0);
  const equity = propertyValue - totalMortgage;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financials</h1>
        <p className="text-muted-foreground">{property?.name ?? "Property"}</p>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl">Profit &amp; Loss</TabsTrigger>
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl" className="space-y-4">
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
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(incomeByCategory).map(([cat, amount]) => (
                    <TableRow key={cat}>
                      <TableCell className="capitalize">
                        {cat.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {Object.keys(incomeByCategory).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        No revenue in this period.
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell>Total Revenue</TableCell>
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
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(expenseByCategory).map(([cat, amount]) => (
                    <TableRow key={cat}>
                      <TableCell className="capitalize">
                        {cat.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {Object.keys(expenseByCategory).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        No expenses in this period.
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell>Total Expenses</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalExpenses)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* NOI */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">Net Operating Income</span>
                <span
                  className={`text-2xl font-bold ${
                    noi >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(noi)}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Balance Sheet</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Assets */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold">
                      Assets
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Property Value</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(propertyValue)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-semibold border-t">
                    <TableCell className="pl-4">Total Assets</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(propertyValue)}
                    </TableCell>
                  </TableRow>

                  {/* Liabilities */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold">
                      Liabilities
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Mortgage Payments (cumulative)</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalMortgage)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-semibold border-t">
                    <TableCell className="pl-4">Total Liabilities</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalMortgage)}
                    </TableCell>
                  </TableRow>

                  {/* Equity */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold">
                      Equity
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold text-lg">
                    <TableCell className="pl-4">Net Equity</TableCell>
                    <TableCell
                      className={`text-right ${
                        equity >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(equity)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
