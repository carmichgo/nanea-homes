"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/api";
import { Transaction, TransactionType } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Sparkles } from "lucide-react";

const CATEGORIES = [
  "rent",
  "repair",
  "insurance",
  "mortgage",
  "utilities",
  "management_fee",
  "tax",
  "supplies",
  "cleaning",
  "advertising",
  "legal",
  "transfer",
  "other",
] as const;

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface TransactionsViewProps {
  propertyId: string;
  propertyName: string;
  initialTransactions: Transaction[];
}

export function TransactionsView({
  propertyId,
  propertyName,
  initialTransactions,
}: TransactionsViewProps) {
  const router = useRouter();

  // Filter state
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [categorizingId, setCategorizingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editType, setEditType] = useState<TransactionType>("expense");

  // Form state
  const [formType, setFormType] = useState<TransactionType>("income");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("rent");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const filteredTransactions = useMemo(() => {
    return initialTransactions.filter((t) => {
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (
        categoryFilter &&
        !(t.category ?? "").toLowerCase().includes(categoryFilter.toLowerCase())
      )
        return false;
      return true;
    });
  }, [initialTransactions, dateFrom, dateTo, typeFilter, categoryFilter]);

  async function handleAddTransaction() {
    if (!formAmount || !formDate) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          type: formType,
          amount: parseFloat(formAmount),
          category: formCategory,
          description: formDescription,
          date: formDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add transaction");
      }

      setDialogOpen(false);
      setFormAmount("");
      setFormDescription("");
      setFormDate(new Date().toISOString().split("T")[0]);
      router.refresh();
    } catch (err) {
      console.error("Failed to add transaction:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSyncFromBank() {
    setSyncing(true);
    try {
      await fetch("/api/plaid/sync-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId }),
      });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function handleAICategorize(t: Transaction) {
    setCategorizingId(t.id);
    try {
      const res = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: t.id,
          description: t.description || "",
          merchant_name: t.merchant_name || "",
          amount: t.amount,
          direction: t.type === "income" ? "incoming" : "outgoing",
        }),
      });
      const data = await res.json();
      if (!data.error) {
        router.refresh();
      }
    } catch {
      // silent fail
    } finally {
      setCategorizingId(null);
    }
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setEditCategory(t.category || "other");
    setEditType(t.type);
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      await db.update("transactions", editingId, {
        category: editCategory,
        type: editType,
      });
      setEditingId(null);
      router.refresh();
    } catch (err) {
      console.error("Failed to update transaction:", err);
    }
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    try {
      await db.remove("transactions", id);
      router.refresh();
    } catch (err) {
      console.error("Failed to delete transaction:", err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">{propertyName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSyncFromBank} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync from Bank"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add Transaction</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Transaction</DialogTitle>
                <DialogDescription>
                  Manually add a new transaction for this property.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formType}
                    onValueChange={(v) => setFormType(v as TransactionType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="internal">Internal Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formCategory}
                    onValueChange={setFormCategory}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {formatCategory(cat)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddTransaction} disabled={submitting}>
                  {submitting ? "Adding..." : "Add Transaction"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
        <div className="grid gap-1.5">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            className="w-40"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            className="w-40"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Type</Label>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as "all" | TransactionType)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Category</Label>
          <Input
            placeholder="Filter by category"
            className="w-48"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(t.date)}
                  </TableCell>
                  <TableCell>{t.description || t.merchant_name || "-"}</TableCell>
                  <TableCell>
                    {editingId === t.id ? (
                      <Select value={editCategory} onValueChange={setEditCategory}>
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {formatCategory(cat)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="capitalize">
                        {formatCategory(t.category ?? "other")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === t.id ? (
                      <Select
                        value={editType}
                        onValueChange={(v) => setEditType(v as TransactionType)}
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="internal">Internal</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        className={
                          t.type === "income"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : t.type === "internal"
                            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                            : "bg-red-100 text-red-800 hover:bg-red-100"
                        }
                      >
                        {t.type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatCurrency(t.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {editingId === t.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={saveEdit}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-purple-500 hover:text-purple-700"
                          onClick={() => handleAICategorize(t)}
                          disabled={categorizingId === t.id}
                          title="AI categorize"
                        >
                          <Sparkles className={`h-3.5 w-3.5 ${categorizingId === t.id ? "animate-pulse" : ""}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => startEdit(t)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(t.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
