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

    const response = await plaidClient.transactionsSync({
      access_token: connection.plaid_access_token,
      cursor: connection.cursor || undefined,
    });

    const { added, modified, removed, next_cursor } = response.data;

    // Process added and modified transactions
    const transactionsToUpsert = [...added, ...modified].map((txn) => {
      const isExpense = txn.amount > 0;
      return {
        property_id,
        plaid_transaction_id: txn.transaction_id,
        type: isExpense ? 'expense' : 'income',
        amount: Math.abs(txn.amount),
        category:
          txn.personal_finance_category?.primary ||
          (txn.category ? txn.category[0] : 'Other'),
        description: txn.name,
        date: txn.date,
        is_manual: false,
      };
    });

    if (transactionsToUpsert.length > 0) {
      const { error: upsertError } = await adminClient
        .from('transactions')
        .upsert(transactionsToUpsert, {
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

    // Update connection cursor and last_synced_at
    await adminClient
      .from('plaid_connections')
      .update({
        cursor: next_cursor,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return NextResponse.json({
      added: added.length,
      modified: modified.length,
      removed: removed.length,
    });
  } catch (error) {
    console.error('Error syncing transactions:', error);
    return NextResponse.json(
      { error: 'Failed to sync transactions' },
      { status: 500 }
    );
  }
}
