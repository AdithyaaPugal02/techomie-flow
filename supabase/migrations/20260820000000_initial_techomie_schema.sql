-- Generated from the final Drizzle SQLite snapshot for Supabase PostgreSQL.

create extension if not exists pgcrypto;

CREATE TABLE IF NOT EXISTS "activities" (
  "id" serial NOT NULL PRIMARY KEY,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "type" text NOT NULL,
  "content" text NOT NULL,
  "due_at" text,
  "completed_at" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "amc_contracts" (
  "id" text NOT NULL PRIMARY KEY,
  "customer_id" integer NOT NULL,
  "site_id" text NOT NULL,
  "type" text NOT NULL,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "renewal_at" text,
  "status" text DEFAULT 'Active' NOT NULL,
  "notes" text,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "attachments" (
  "id" text NOT NULL PRIMARY KEY,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "kind" text NOT NULL,
  "file_key" text NOT NULL,
  "file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "size" integer NOT NULL,
  "uploaded_by" text NOT NULL,
  "archived" integer DEFAULT 0 NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" serial NOT NULL PRIMARY KEY,
  "user_id" text,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "customer_contacts" (
  "id" text NOT NULL PRIMARY KEY,
  "customer_id" integer NOT NULL,
  "name" text NOT NULL,
  "designation" text,
  "phone" text NOT NULL,
  "whatsapp" text,
  "email" text,
  "primary_contact" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "active" integer DEFAULT 1 NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "customer_notes" (
  "id" text NOT NULL PRIMARY KEY,
  "customer_id" integer NOT NULL,
  "site_id" text,
  "content" text NOT NULL,
  "private" integer DEFAULT 1 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "customer_sites" (
  "id" text NOT NULL PRIMARY KEY,
  "customer_id" integer NOT NULL,
  "site_code" text,
  "name" text NOT NULL,
  "address" text NOT NULL,
  "city" text,
  "state" text DEFAULT 'Tamil Nadu',
  "pincode" text,
  "maps_url" text,
  "contact_name" text,
  "contact_phone" text,
  "property_type" text,
  "construction_stage" text,
  "floors" text,
  "neutral_wire" text,
  "survey_notes" text,
  "electrical_readiness" text,
  "network_details" text,
  "access_requirements" text,
  "status" text DEFAULT 'Active',
  "archived" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "customers" (
  "id" serial NOT NULL PRIMARY KEY,
  "customer_code" text,
  "customer_type" text DEFAULT 'Individual' NOT NULL,
  "name" text NOT NULL,
  "display_name" text,
  "primary_contact" text,
  "phone" text NOT NULL,
  "whatsapp" text,
  "email" text,
  "alternate_phone" text,
  "gstin" text,
  "pan" text,
  "billing_address" text,
  "city" text,
  "state" text DEFAULT 'Tamil Nadu',
  "pincode" text,
  "country" text DEFAULT 'India',
  "notes" text,
  "tags" text,
  "status" text DEFAULT 'Prospect',
  "assigned_to" text,
  "lead_source" text,
  "archived" integer DEFAULT 0 NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "expense_history" (
  "id" text NOT NULL PRIMARY KEY,
  "expense_id" text NOT NULL,
  "action" text NOT NULL,
  "from_status" text,
  "to_status" text,
  "comment" text,
  "snapshot" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" text NOT NULL PRIMARY KEY,
  "expense_type" text DEFAULT 'Claim' NOT NULL,
  "project_id" text,
  "customer_id" integer,
  "site_id" text,
  "lead_id" text,
  "supplier_id" text,
  "cost_centre" text,
  "date" text NOT NULL,
  "category" text NOT NULL,
  "vendor" text DEFAULT '' NOT NULL,
  "amount" double precision NOT NULL,
  "approved_amount" double precision,
  "tax" double precision DEFAULT 0 NOT NULL,
  "gstin" text,
  "bill_number" text,
  "paid_by" text DEFAULT 'Employee Personal Money' NOT NULL,
  "mode" text NOT NULL,
  "description" text,
  "distance_km" double precision,
  "notes" text,
  "status" text DEFAULT 'Draft' NOT NULL,
  "approver_comment" text,
  "rejection_reason" text,
  "reimbursement_date" text,
  "reimbursement_mode" text,
  "reimbursement_reference" text,
  "payer" text,
  "duplicate_warning" integer DEFAULT 0 NOT NULL,
  "created_by" text,
  "approved_by" text,
  "submitted_at" text,
  "approved_at" text,
  "updated_at" text,
  "archived" integer DEFAULT 0 NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "invoice_payments" (
  "id" text NOT NULL PRIMARY KEY,
  "invoice_id" text NOT NULL,
  "date" text NOT NULL,
  "amount" double precision NOT NULL,
  "mode" text NOT NULL,
  "reference" text NOT NULL,
  "notes" text,
  "received_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "invoice_sequences" (
  "financial_year" text NOT NULL PRIMARY KEY,
  "last_number" integer DEFAULT 0 NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "lead_followups" (
  "id" text NOT NULL PRIMARY KEY,
  "lead_id" text NOT NULL,
  "scheduled_at" text NOT NULL,
  "assigned_to" text NOT NULL,
  "action_type" text NOT NULL,
  "status" text DEFAULT 'Upcoming' NOT NULL,
  "outcome" text,
  "discussion_note" text,
  "next_action" text,
  "next_followup_at" text,
  "updated_stage" text,
  "completed_at" text,
  "cancel_reason" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "leads" (
  "id" text NOT NULL PRIMARY KEY,
  "lead_date" text NOT NULL,
  "customer_name" text NOT NULL,
  "customer_type" text DEFAULT 'Individual',
  "phone" text NOT NULL,
  "whatsapp" text,
  "email" text,
  "preferred_communication" text DEFAULT 'Call',
  "existing_customer" integer DEFAULT 0,
  "customer_id" integer,
  "site_id" text,
  "site_name" text,
  "city" text,
  "pincode" text,
  "address" text,
  "maps_url" text,
  "site_contact_name" text,
  "site_contact_phone" text,
  "property_type" text,
  "construction_stage" text,
  "project_timeline" text,
  "source" text,
  "requirement" text,
  "requirement_categories" text,
  "budget" text,
  "estimated_value" double precision DEFAULT 0,
  "priority" text DEFAULT 'Warm',
  "details" text,
  "decision_maker" text,
  "decision_contact" text,
  "decision_maker_count" integer DEFAULT 1,
  "expected_decision_date" text,
  "competitor" text,
  "assigned_to" text,
  "lead_owner" text,
  "followup_at" text,
  "next_action" text,
  "status" text DEFAULT 'New' NOT NULL,
  "lost_reason" text,
  "lost_note" text,
  "future_reminder" text,
  "last_activity_at" text,
  "notes" text,
  "archived" integer DEFAULT 0 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text NOT NULL PRIMARY KEY,
  "user_id" text,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "due_at" text,
  "read_at" text,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" text NOT NULL PRIMARY KEY,
  "project_id" text,
  "quotation_id" integer,
  "date" text NOT NULL,
  "amount" double precision NOT NULL,
  "mode" text NOT NULL,
  "reference" text NOT NULL,
  "received_by" text NOT NULL,
  "notes" text,
  "archived" integer DEFAULT 0 NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" serial NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "subcategory" text,
  "series" text,
  "brand" text DEFAULT 'Noviq',
  "short_description" text,
  "description" text,
  "hsn" text,
  "unit" text DEFAULT 'Nos',
  "tax_rate" double precision DEFAULT 18,
  "warranty" text,
  "active" integer DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "project_materials" (
  "id" text NOT NULL PRIMARY KEY,
  "project_id" text NOT NULL,
  "quotation_item_id" text,
  "name" text NOT NULL,
  "sku" text,
  "required_qty" double precision NOT NULL,
  "ordered_qty" double precision DEFAULT 0 NOT NULL,
  "received_qty" double precision DEFAULT 0 NOT NULL,
  "at_site_qty" double precision DEFAULT 0 NOT NULL,
  "installed_qty" double precision DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'Required' NOT NULL,
  "vendor_id" text,
  "buying_price" double precision,
  "freight" double precision DEFAULT 0,
  "purchase_reference" text,
  "expected_delivery" text,
  "actual_received" text,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "project_milestones" (
  "id" text NOT NULL PRIMARY KEY,
  "project_id" text NOT NULL,
  "name" text NOT NULL,
  "due_condition" text,
  "due_date" text,
  "amount" double precision NOT NULL,
  "received" double precision DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'Pending' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "project_tasks" (
  "id" text NOT NULL PRIMARY KEY,
  "project_id" text NOT NULL,
  "title" text NOT NULL,
  "floor_room" text,
  "category" text DEFAULT 'Other',
  "assigned_to" text,
  "priority" text DEFAULT 'Normal',
  "status" text DEFAULT 'To Do' NOT NULL,
  "due_at" text,
  "mandatory" integer DEFAULT 0 NOT NULL,
  "completed_at" text,
  "completion_proof" text,
  "notes" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "project_team" (
  "id" text NOT NULL PRIMARY KEY,
  "project_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "active" integer DEFAULT 1 NOT NULL,
  "assigned_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" text NOT NULL PRIMARY KEY,
  "customer_id" integer NOT NULL,
  "site_id" text NOT NULL,
  "quotation_id" integer,
  "quotation_revision" integer DEFAULT 0,
  "lead_id" text,
  "site_visit_id" text,
  "title" text NOT NULL,
  "category" text DEFAULT 'Smart Home Automation',
  "scope" text,
  "scope_snapshot" text,
  "direct_reason" text,
  "primary_contact" text,
  "manager_id" text,
  "sales_id" text,
  "status" text NOT NULL,
  "health" text DEFAULT 'On Track',
  "value" double precision NOT NULL,
  "payment_plan" text,
  "planned_start" text,
  "planned_end" text,
  "actual_start" text,
  "actual_end" text,
  "installation_at" text,
  "testing_at" text,
  "handover_at" text,
  "customer_notes" text,
  "notes" text,
  "checklist" text,
  "site_readiness" text,
  "testing_checklist" text,
  "handover" text,
  "archived" integer DEFAULT 0 NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "quotation_acceptances" (
  "id" text NOT NULL PRIMARY KEY,
  "quotation_id" integer NOT NULL,
  "revision" integer NOT NULL,
  "decision" text NOT NULL,
  "customer_name" text,
  "comment" text,
  "ip_address" text,
  "user_agent" text,
  "snapshot" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "quotation_files" (
  "id" text NOT NULL PRIMARY KEY,
  "quotation_id" integer NOT NULL,
  "revision" integer DEFAULT 0 NOT NULL,
  "kind" text NOT NULL,
  "file_name" text NOT NULL,
  "file_key" text NOT NULL,
  "content_type" text,
  "size" integer,
  "permanent" integer DEFAULT 0 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "quotation_floors" (
  "id" text NOT NULL PRIMARY KEY,
  "quotation_id" integer NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "quotation_items" (
  "id" text NOT NULL PRIMARY KEY,
  "quotation_id" integer NOT NULL,
  "room_id" text NOT NULL,
  "product_id" integer,
  "variant_id" integer,
  "snapshot" text NOT NULL,
  "quantity" double precision NOT NULL,
  "unit_price" double precision NOT NULL,
  "discount" double precision DEFAULT 0 NOT NULL,
  "tax_rate" double precision DEFAULT 18 NOT NULL,
  "tax_mode" text DEFAULT 'GST' NOT NULL,
  "installation" double precision DEFAULT 0 NOT NULL,
  "note" text,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "quotation_milestones" (
  "id" text NOT NULL PRIMARY KEY,
  "quotation_id" integer NOT NULL,
  "revision" integer DEFAULT 0 NOT NULL,
  "name" text NOT NULL,
  "percentage" double precision,
  "fixed_amount" double precision,
  "due_trigger" text,
  "due_date" text,
  "notes" text,
  "amount" double precision DEFAULT 0 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "quotation_revisions" (
  "id" text NOT NULL PRIMARY KEY,
  "quotation_id" integer NOT NULL,
  "revision" integer NOT NULL,
  "snapshot" text NOT NULL,
  "pdf_key" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "quotation_rooms" (
  "id" text NOT NULL PRIMARY KEY,
  "floor_id" text NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "quotations" (
  "id" serial NOT NULL PRIMARY KEY,
  "number" text NOT NULL,
  "revision" integer DEFAULT 0,
  "customer_id" integer,
  "site_id" text,
  "title" text,
  "quote_type" text DEFAULT 'Standard Product Quotation',
  "category" text,
  "quote_date" text,
  "valid_until" text,
  "status" text DEFAULT 'Draft',
  "snapshot" text NOT NULL,
  "total" double precision NOT NULL,
  "sent_amount" double precision DEFAULT 0,
  "accepted_amount" double precision DEFAULT 0,
  "sales_id" text,
  "last_followup" text,
  "pdf_key" text,
  "archived" integer DEFAULT 0 NOT NULL,
  "created_by" text,
  "created_at" text NOT NULL,
  "updated_at" text
);

CREATE TABLE IF NOT EXISTS "scope_variations" (
  "id" text NOT NULL PRIMARY KEY,
  "project_id" text NOT NULL,
  "reason" text NOT NULL,
  "value_impact" double precision NOT NULL,
  "payment_impact" text,
  "status" text DEFAULT 'Pending Approval' NOT NULL,
  "quotation_revision" integer,
  "snapshot" text,
  "created_by" text NOT NULL,
  "approved_by" text,
  "created_at" text NOT NULL,
  "approved_at" text
);

CREATE TABLE IF NOT EXISTS "service_tickets" (
  "id" text NOT NULL PRIMARY KEY,
  "customer_id" integer NOT NULL,
  "site_id" text NOT NULL,
  "project_id" text,
  "warranty_id" text,
  "problem" text NOT NULL,
  "priority" text DEFAULT 'Normal' NOT NULL,
  "assigned_to" text,
  "scheduled_at" text,
  "resolution" text,
  "parts_replaced" text,
  "status" text DEFAULT 'Open' NOT NULL,
  "archived" integer DEFAULT 0 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text NOT NULL PRIMARY KEY,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "settings" (
  "key" text NOT NULL PRIMARY KEY,
  "value" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_visits" (
  "id" text NOT NULL PRIMARY KEY,
  "lead_id" text NOT NULL,
  "scheduled_at" text NOT NULL,
  "assigned_to" text NOT NULL,
  "status" text DEFAULT 'Scheduled' NOT NULL,
  "maps_url" text,
  "visit_notes" text,
  "requirement_confirmation" text,
  "budget_confirmation" text,
  "expected_quote_date" text,
  "next_action" text,
  "next_followup_at" text,
  "survey" text,
  "completed_at" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "sites" (
  "id" serial NOT NULL PRIMARY KEY,
  "customer_id" integer NOT NULL,
  "name" text NOT NULL,
  "address" text NOT NULL,
  "building_type" text
);

CREATE TABLE IF NOT EXISTS "tax_adjustment_notes" (
  "id" text NOT NULL PRIMARY KEY,
  "number" text NOT NULL,
  "invoice_id" text NOT NULL,
  "type" text NOT NULL,
  "date" text NOT NULL,
  "reason" text NOT NULL,
  "taxable_value" double precision NOT NULL,
  "cgst" double precision DEFAULT 0 NOT NULL,
  "sgst" double precision DEFAULT 0 NOT NULL,
  "igst" double precision DEFAULT 0 NOT NULL,
  "total" double precision NOT NULL,
  "snapshot" text NOT NULL,
  "pdf_key" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "tax_invoice_items" (
  "id" text NOT NULL PRIMARY KEY,
  "invoice_id" text NOT NULL,
  "description" text NOT NULL,
  "sku" text,
  "hsn_sac" text NOT NULL,
  "uqc" text NOT NULL,
  "quantity" double precision NOT NULL,
  "rate" double precision NOT NULL,
  "discount_rate" double precision DEFAULT 0 NOT NULL,
  "discount_amount" double precision DEFAULT 0 NOT NULL,
  "taxable_value" double precision NOT NULL,
  "gst_rate" double precision NOT NULL,
  "cgst_amount" double precision DEFAULT 0 NOT NULL,
  "sgst_amount" double precision DEFAULT 0 NOT NULL,
  "igst_amount" double precision DEFAULT 0 NOT NULL,
  "total" double precision NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "tax_invoices" (
  "id" text NOT NULL PRIMARY KEY,
  "number" text,
  "financial_year" text NOT NULL,
  "quotation_id" integer,
  "project_id" text,
  "customer_id" integer NOT NULL,
  "site_id" text,
  "invoice_date" text,
  "due_date" text,
  "billing_address" text NOT NULL,
  "shipping_address" text,
  "customer_gstin" text,
  "place_of_supply" text NOT NULL,
  "place_of_supply_code" text NOT NULL,
  "supply_type" text NOT NULL,
  "pricing_mode" text DEFAULT 'exclusive' NOT NULL,
  "subtotal" double precision NOT NULL,
  "discount_total" double precision DEFAULT 0 NOT NULL,
  "taxable_total" double precision NOT NULL,
  "cgst_total" double precision DEFAULT 0 NOT NULL,
  "sgst_total" double precision DEFAULT 0 NOT NULL,
  "igst_total" double precision DEFAULT 0 NOT NULL,
  "round_off" double precision DEFAULT 0 NOT NULL,
  "grand_total" double precision NOT NULL,
  "amount_words" text NOT NULL,
  "payment_terms" text,
  "bank_details" text,
  "company_snapshot" text NOT NULL,
  "snapshot" text NOT NULL,
  "pdf_key" text,
  "status" text DEFAULT 'Draft' NOT NULL,
  "locked_at" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "cancelled_at" text,
  "cancel_reason" text
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" text NOT NULL PRIMARY KEY,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "profile_image" text,
  "notification_preferences" text,
  "permissions" text,
  "role" text NOT NULL,
  "password_hash" text NOT NULL,
  "password_salt" text NOT NULL,
  "active" integer DEFAULT 1 NOT NULL,
  "last_login" text,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "variants" (
  "id" serial NOT NULL PRIMARY KEY,
  "product_id" integer NOT NULL,
  "sku" text NOT NULL,
  "name" text NOT NULL,
  "attributes" text,
  "selling_price" double precision NOT NULL,
  "minimum_price" double precision,
  "purchase_cost" double precision NOT NULL,
  "tax_rate" double precision DEFAULT 18,
  "hsn" text,
  "warranty" text,
  "image_key" text,
  "active" integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS "vendors" (
  "id" text NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "phone" text,
  "email" text,
  "gstin" text,
  "address" text,
  "archived" integer DEFAULT 0 NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "warranties" (
  "id" text NOT NULL PRIMARY KEY,
  "project_id" text NOT NULL,
  "customer_id" integer NOT NULL,
  "site_id" text NOT NULL,
  "product_snapshot" text NOT NULL,
  "serial_number" text,
  "installation_date" text NOT NULL,
  "start_date" text NOT NULL,
  "replacement_end" text,
  "service_end" text,
  "status" text DEFAULT 'Active' NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "zoho_invoices" (
  "id" text NOT NULL PRIMARY KEY,
  "project_id" text,
  "quotation_id" integer,
  "zoho_invoice_id" text,
  "invoice_number" text,
  "invoice_date" text,
  "pdf_key" text,
  "external_url" text,
  "status" text DEFAULT 'Not Required' NOT NULL,
  "balance_due" double precision DEFAULT 0,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "amc_contracts" ADD CONSTRAINT "amc_contracts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "amc_contracts" ADD CONSTRAINT "amc_contracts_site_id_customer_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "customer_sites" ("id");

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id");

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_site_id_customer_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "customer_sites" ("id");

ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "customer_sites" ADD CONSTRAINT "customer_sites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_sites_site_code_unique" ON "customer_sites" ("site_code");

ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "customers_customer_code_unique" ON "customers" ("customer_code");

ALTER TABLE "expense_history" ADD CONSTRAINT "expense_history_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "expenses" ("id");

ALTER TABLE "expense_history" ADD CONSTRAINT "expense_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_site_id_customer_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "customer_sites" ("id");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_vendors_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "vendors" ("id");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users" ("id");

ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_tax_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "tax_invoices" ("id");

ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "users" ("id");

ALTER TABLE "lead_followups" ADD CONSTRAINT "lead_followups_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id");

ALTER TABLE "lead_followups" ADD CONSTRAINT "lead_followups_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id");

ALTER TABLE "lead_followups" ADD CONSTRAINT "lead_followups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "leads" ADD CONSTRAINT "leads_site_id_customer_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "customer_sites" ("id");

ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id");

ALTER TABLE "leads" ADD CONSTRAINT "leads_lead_owner_users_id_fk" FOREIGN KEY ("lead_owner") REFERENCES "users" ("id");

ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "payments" ADD CONSTRAINT "payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "payments" ADD CONSTRAINT "payments_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id");

ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "users" ("id");

ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_quotation_item_id_quotation_items_id_fk" FOREIGN KEY ("quotation_item_id") REFERENCES "quotation_items" ("id");

ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id");

ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id");

ALTER TABLE "project_team" ADD CONSTRAINT "project_team_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "project_team" ADD CONSTRAINT "project_team_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_site_id_customer_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "customer_sites" ("id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_site_visit_id_site_visits_id_fk" FOREIGN KEY ("site_visit_id") REFERENCES "site_visits" ("id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "users" ("id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "users" ("id");

ALTER TABLE "quotation_acceptances" ADD CONSTRAINT "quotation_acceptances_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id");

ALTER TABLE "quotation_files" ADD CONSTRAINT "quotation_files_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id");

ALTER TABLE "quotation_files" ADD CONSTRAINT "quotation_files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "quotation_floors" ADD CONSTRAINT "quotation_floors_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id");

ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id");

ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_room_id_quotation_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "quotation_rooms" ("id");

ALTER TABLE "quotation_milestones" ADD CONSTRAINT "quotation_milestones_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id");

ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id");

ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "quotation_rooms" ADD CONSTRAINT "quotation_rooms_floor_id_quotation_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "quotation_floors" ("id");

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_site_id_customer_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "customer_sites" ("id");

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "users" ("id");

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "quotations_number_unique" ON "quotations" ("number");

ALTER TABLE "scope_variations" ADD CONSTRAINT "scope_variations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "scope_variations" ADD CONSTRAINT "scope_variations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "scope_variations" ADD CONSTRAINT "scope_variations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users" ("id");

ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_site_id_customer_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "customer_sites" ("id");

ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_warranty_id_warranties_id_fk" FOREIGN KEY ("warranty_id") REFERENCES "warranties" ("id");

ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id");

ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_unique" ON "sessions" ("token_hash");

ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users" ("id");

ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id");

ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id");

ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

ALTER TABLE "sites" ADD CONSTRAINT "sites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "tax_adjustment_notes" ADD CONSTRAINT "tax_adjustment_notes_invoice_id_tax_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "tax_invoices" ("id");

ALTER TABLE "tax_adjustment_notes" ADD CONSTRAINT "tax_adjustment_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "tax_adjustment_notes_number_unique" ON "tax_adjustment_notes" ("number");

ALTER TABLE "tax_invoice_items" ADD CONSTRAINT "tax_invoice_items_invoice_id_tax_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "tax_invoices" ("id");

ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id");

ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_site_id_customer_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "customer_sites" ("id");

ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "tax_invoices_number_unique" ON "tax_invoices" ("number");

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email");

ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products" ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "variants_sku_unique" ON "variants" ("sku");

ALTER TABLE "warranties" ADD CONSTRAINT "warranties_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "warranties" ADD CONSTRAINT "warranties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");

ALTER TABLE "warranties" ADD CONSTRAINT "warranties_site_id_customer_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "customer_sites" ("id");

ALTER TABLE "zoho_invoices" ADD CONSTRAINT "zoho_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id");

ALTER TABLE "zoho_invoices" ADD CONSTRAINT "zoho_invoices_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id");

ALTER TABLE "zoho_invoices" ADD CONSTRAINT "zoho_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "zoho_invoices_zoho_invoice_id_unique" ON "zoho_invoices" ("zoho_invoice_id");

CREATE UNIQUE INDEX IF NOT EXISTS "zoho_invoices_invoice_number_unique" ON "zoho_invoices" ("invoice_number");

INSERT INTO storage.buckets (id, name, public) VALUES ('techomie-files', 'techomie-files', false) ON CONFLICT (id) DO NOTHING;
