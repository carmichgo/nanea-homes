import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const property_id = formData.get('property_id') as string;
    const category = formData.get('category') as string;
    const name = formData.get('name') as string;
    const notes = formData.get('notes') as string | null;
    const expiry_date = formData.get('expiry_date') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const filePath = `${property_id}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await adminClient.storage
      .from('property-documents')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    const { data: document, error: insertError } = await adminClient
      .from('documents')
      .insert({
        property_id,
        name,
        category,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        notes,
        expiry_date,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting document record:', insertError);
      // Attempt to clean up uploaded file
      await adminClient.storage.from('property-documents').remove([filePath]);
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
