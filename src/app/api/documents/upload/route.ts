import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const filePath = `${user.id}/${property_id}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('property-documents')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert({
        property_id,
        user_id: user.id,
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
      await supabase.storage.from('property-documents').remove([filePath]);
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
