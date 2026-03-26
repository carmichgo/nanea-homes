import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { plaidClient } from '@/lib/plaid/client';

function mapPlaidCategory(plaidCategory: string): string {
  const map: Record<string, string> = {
    'INCOME': 'rent',
    'RENT': 'rent',
    'TRANSFER_IN': 'transfer',
    'TRANSFER_OUT': 'transfer',
    'BANK_FEES': 'other',
    'LOAN_PAYMENTS': 'mortgage',
    'FOOD_AND_DRINK': 'other',
    'GENERAL_MERCHANDISE': 'supplies',
    'HOME_IMPROVEMENT': 'repair',
    'GENERAL_SERVICES': 'other',
    'GOVERNMENT_AND_NON_PROFIT': 'tax',
    'TRANSPORTATION': 'other',
    'TRAVEL': 'other',
    'ENTERTAINMENT': 'other',
    'PERSONAL_CARE': 'other',
    'MEDICAL': 'other',
    'UTILITIES': 'utilities',
    'INSURANCE': 'insurance',
    'TAX': 'tax',
  };
  return map[plaidCategory] || 'other';
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { property_id, full_sync } = await request.json();

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

    // If full_sync requested, reset cursor to pull everything from scratch
    let cursor = full_sync ? undefined : (connection.cursor || undefined);
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
        // Determine transaction type
        let type: string;
        const primaryCategory = txn.personal_finance_category?.primary || '';
        if (primaryCategory.startsWith('TRANSFER') || primaryCategory === 'BANK_FEES') {
          type = 'internal';
        } else if (txn.amount > 0) {
          type = 'expense';
        } else {
          type = 'income';
        }
        return {
          property_id,
          plaid_transaction_id: txn.transaction_id,
          type,
          status: txn.pending ? 'pending' : 'posted',
          amount: Math.abs(txn.amount),
          category: mapPlaidCategory(txn.personal_finance_category?.primary || ''),
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

    // Also fetch older history via transactionsGet for full coverage
    // transactionsSync only returns data from the initial sync window,
    // transactionsGet lets us specify an explicit date range
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);
    const endDate = new Date();

    let offset = 0;
    const batchSize = 500;
    let fetchMore = true;

    while (fetchMore) {
      try {
        const getResponse = await plaidClient.transactionsGet({
          access_token: connection.plaid_access_token,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          options: {
            count: batchSize,
            offset,
          },
        });

        const { transactions, total_transactions } = getResponse.data;

        if (transactions.length > 0) {
          const transactionsToUpsert = transactions.map((txn) => {
            // Determine transaction type
            let type: string;
            const primaryCategory = txn.personal_finance_category?.primary || '';
            if (primaryCategory.startsWith('TRANSFER') || primaryCategory === 'BANK_FEES') {
              type = 'internal';
            } else if (txn.amount > 0) {
              type = 'expense';
            } else {
              type = 'income';
            }
            return {
              property_id,
              plaid_transaction_id: txn.transaction_id,
              type,
              status: txn.pending ? 'pending' : 'posted',
              amount: Math.abs(txn.amount),
              category: mapPlaidCategory(txn.personal_finance_category?.primary || ''),
              subcategory:
                txn.personal_finance_category?.detailed || null,
              description: txn.name,
              merchant_name: txn.merchant_name || null,
              date: txn.date,
              is_manual: false,
            };
          });

          for (let i = 0; i < transactionsToUpsert.length; i += 500) {
            const batch = transactionsToUpsert.slice(i, i + 500);
            const { error: upsertError } = await adminClient
              .from('transactions')
              .upsert(batch, {
                onConflict: 'plaid_transaction_id',
              });
            if (upsertError) {
              console.error('Error upserting historical transactions:', upsertError);
            }
          }

          totalAdded += transactions.length;
        }

        offset += transactions.length;
        fetchMore = offset < total_transactions;
      } catch (err) {
        // transactionsGet may fail if not enough history - that's ok
        console.error('transactionsGet page error (may be normal):', err);
        fetchMore = false;
      }
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
