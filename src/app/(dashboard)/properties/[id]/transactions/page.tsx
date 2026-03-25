import { createClient } from "@/lib/supabase/server";
import { Transaction } from "@/types";
import { TransactionsView } from "./transactions-view";

interface Props {
  params: { id: string };
}

export default async function TransactionsPage({ params }: Props) {
  const supabase = createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("id", params.id)
    .single();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("property_id", params.id)
    .order("date", { ascending: false });

  return (
    <TransactionsView
      propertyId={params.id}
      propertyName={property?.name ?? "Property"}
      initialTransactions={(transactions as Transaction[]) ?? []}
    />
  );
}
