import { createAdminClient } from "@/lib/supabase/admin";
import { Transaction } from "@/types";
import { TransactionsView } from "./transactions-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TransactionsPage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("id", id)
    .single();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("property_id", id)
    .order("date", { ascending: false });

  return (
    <TransactionsView
      propertyId={id}
      propertyName={property?.name ?? "Property"}
      initialTransactions={(transactions as Transaction[]) ?? []}
    />
  );
}
