-- ============================================================================
-- Initial Schema Migration for Nanea Homes - Rental Property Management
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Enum Types
-- ============================================================================

CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE transaction_status AS ENUM ('pending', 'posted', 'reconciled');
CREATE TYPE maintenance_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE maintenance_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE document_category AS ENUM ('insurance', 'deed', 'lease', 'inspection', 'tax', 'permit', 'other');

-- ============================================================================
-- Tables
-- ============================================================================

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  property_type TEXT,
  units INTEGER DEFAULT 1,
  purchase_price NUMERIC(12, 2),
  purchase_date DATE,
  current_value NUMERIC(12, 2),
  monthly_rent NUMERIC(10, 2),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Contractors
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  specialty TEXT,
  service_areas TEXT[],
  hourly_rate NUMERIC(8, 2),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Plaid Connections
CREATE TABLE plaid_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plaid_item_id TEXT,
  plaid_access_token TEXT,
  institution_name TEXT,
  account_id TEXT,
  account_name TEXT,
  account_mask TEXT,
  cursor TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plaid_transaction_id TEXT UNIQUE,
  type transaction_type NOT NULL,
  status transaction_status DEFAULT 'posted',
  amount NUMERIC(10, 2) NOT NULL,
  category TEXT,
  subcategory TEXT,
  description TEXT,
  merchant_name TEXT,
  date DATE NOT NULL,
  is_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category document_category NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  notes TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Maintenance Records
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status maintenance_status DEFAULT 'open',
  priority maintenance_priority DEFAULT 'medium',
  cost NUMERIC(10, 2),
  date_reported DATE DEFAULT CURRENT_DATE,
  date_completed DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- Profiles policies (uses id = auth.uid())
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE USING (id = auth.uid());

-- Properties policies
CREATE POLICY "Users can view own properties"
  ON properties FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own properties"
  ON properties FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own properties"
  ON properties FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own properties"
  ON properties FOR DELETE USING (user_id = auth.uid());

-- Contractors policies
CREATE POLICY "Users can view own contractors"
  ON contractors FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own contractors"
  ON contractors FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own contractors"
  ON contractors FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own contractors"
  ON contractors FOR DELETE USING (user_id = auth.uid());

-- Plaid Connections policies
CREATE POLICY "Users can view own plaid connections"
  ON plaid_connections FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own plaid connections"
  ON plaid_connections FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own plaid connections"
  ON plaid_connections FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own plaid connections"
  ON plaid_connections FOR DELETE USING (user_id = auth.uid());

-- Transactions policies
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE USING (user_id = auth.uid());

-- Documents policies
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE USING (user_id = auth.uid());

-- Maintenance Records policies
CREATE POLICY "Users can view own maintenance records"
  ON maintenance_records FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own maintenance records"
  ON maintenance_records FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own maintenance records"
  ON maintenance_records FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own maintenance records"
  ON maintenance_records FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_transactions_property_id ON transactions(property_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_documents_property_id ON documents(property_id);
CREATE INDEX idx_maintenance_records_property_id ON maintenance_records(property_id);
CREATE INDEX idx_maintenance_records_status ON maintenance_records(status);
CREATE INDEX idx_contractors_specialty ON contractors(specialty);

-- ============================================================================
-- Trigger: Auto-create profile on new user signup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Storage Bucket Setup (Manual Step)
-- ============================================================================
-- You need to create a 'property-documents' storage bucket in the Supabase
-- dashboard (Storage > New Bucket). Configure it as follows:
--
--   1. Go to your Supabase project dashboard > Storage
--   2. Click "New bucket" and name it: property-documents
--   3. Set it to private (not public)
--   4. Enable Row Level Security on the bucket
--   5. Create the following storage policies:
--
--      SELECT policy (allow users to read their own files):
--        bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]
--
--      INSERT policy (allow users to upload to their own folder):
--        bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]
--
--      DELETE policy (allow users to delete their own files):
--        bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]
--
--   This assumes files are stored with the path: {user_id}/{property_id}/{filename}
-- ============================================================================
