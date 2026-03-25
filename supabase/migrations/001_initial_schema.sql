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

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Plaid Connections (one per property bank account)
CREATE TABLE plaid_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
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
-- Storage Bucket Setup (Manual Step)
-- ============================================================================
-- Create a 'property-documents' storage bucket in the Supabase dashboard:
--
--   1. Go to your Supabase project dashboard > Storage
--   2. Click "New bucket" and name it: property-documents
--   3. Set it to private (not public)
--   4. No RLS needed - app uses service role key for all storage operations
--   5. Files are stored at path: {property_id}/{filename}
-- ============================================================================
