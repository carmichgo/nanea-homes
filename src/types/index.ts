export type TransactionType = "income" | "expense" | "internal";
export type TransactionStatus = "pending" | "posted" | "reconciled";
export type MaintenanceStatus = "open" | "in_progress" | "completed" | "cancelled";
export type MaintenancePriority = "low" | "medium" | "high" | "urgent";
export type DocumentCategory = "insurance" | "deed" | "lease" | "inspection" | "tax" | "permit" | "other";

export interface Property {
  id: string;
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  property_type: string;
  units: number;
  purchase_price?: number;
  purchase_date?: string;
  current_value?: number;
  monthly_rent?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  property_id: string;
  plaid_transaction_id?: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  category?: string;
  subcategory?: string;
  description?: string;
  merchant_name?: string;
  date: string;
  is_manual: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaidConnection {
  id: string;
  property_id: string;
  institution_name?: string;
  account_name?: string;
  account_mask?: string;
  last_synced_at?: string;
  created_at: string;
}

export interface Document {
  id: string;
  property_id: string;
  category: DocumentCategory;
  name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  notes?: string;
  expiry_date?: string;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  property_id: string;
  contractor_id?: string;
  title: string;
  description?: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  cost?: number;
  date_reported: string;
  date_completed?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  contractor?: Contractor;
}

export interface Contractor {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  specialty?: string;
  service_areas?: string[];
  hourly_rate?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
