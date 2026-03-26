import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { plaidClient } from '@/lib/plaid/client';

export async function POST(request: NextRequest) {
  try {
    const {
      public_token,
      property_id,
      institution_name,
      account_name,
      account_mask,
      account_id,
    } = await request.json();

    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = response.data;

    const adminClient = createAdminClient();
    const { error: insertError } = await adminClient
      .from('plaid_connections')
      .insert({
        property_id,
        plaid_item_id: item_id,
        plaid_access_token: access_token,
        institution_name,
        account_id,
        account_name,
        account_mask,
      });

    if (insertError) {
      console.error('Error inserting plaid connection:', insertError);
      return NextResponse.json(
        { error: 'Failed to store connection' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error exchanging token:', error);
    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
