import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { plaidClient } from '@/lib/plaid/client';

export async function POST(request: NextRequest) {
  try {
    const { property_id } = await request.json();

    const adminClient = createAdminClient();

    const { data: connection, error: connError } = await adminClient
      .from('plaid_connections')
      .select('*')
      .eq('property_id', property_id)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'No Plaid connection found for this property' },
        { status: 404 }
      );
    }

    let cursor = connection.cursor || undefined;
    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;
    let hasMore = true;

    // Keep paginating until all transactions are synced
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: connection.plaid_access_token,
        cursor,
        count: 500,
      });

      const { added, modified, removed, next_cursor, has_more } = response.data;

      // Process added and modified transactions
      const transactionsToUpsert = [...added, ...modified].map((txn) => {
        const isExpense = txn.amount > 0;
        return {
          property_id,
          plaid_transaction_id: txn.transaction_id,
          type: isExpense ? 'expense' : 'income',
          status: txn.pending ? 'pending' : 'posted',
          amount: Math.abs(txn.amount),
          category:
            txn.personal_finance_category?.primary ||
            (txn.category ? txn.category[0] : 'Other'),
          subcategory:
            txn.personal_finance_category?.detailed || null,
          description: txn.name,
          merchant_name: txn.merchant_name || null,
          date: txn.date,
          is_manual: false,
        };
      });

      // Upsert in batches of 500 to avoid payload limits
      for (let i = 0; i < transactionsToUpsert.length; i += 500) {
        const batch = transactionsToUpsert.slice(i, i + 500);
        const { error: upsertError } = await adminClient
          .from('transactions')
          .upsert(batch, {
            onConflict: 'plaid_transaction_id',
          });

        if (upsertError) {
          console.error('Error upserting transactions:', upsertError);
        }
      }

      // Process removed transactions
      if (removed.length > 0) {
        const removedIds = removed.map((txn) => txn.transaction_id);
        const { error: deleteError } = await adminClient
          .from('transactions')
          .delete()
          .in('plaid_transaction_id', removedIds);

        if (deleteError) {
          console.error('Error deleting removed transactions:', deleteError);
        }
      }

      totalAdded += added.length;
      totalModified += modified.length;
      totalRemoved += removed.length;
      cursor = next_cursor;
      hasMore = has_more;
    }

    // Update connection cursor and last_synced_at
    await adminClient
      .from('plaid_connections')
      .update({
        cursor,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return NextResponse.json({
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
    });
  } catch (error) {
    console.error('Error syncing transactions:', error);
    return NextResponse.json(
      { error: 'Failed to sync transactions' },
      { status: 500 }
    );
  }
}
