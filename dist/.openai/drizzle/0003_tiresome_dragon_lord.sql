CREATE TABLE `invoice_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`mode` text NOT NULL,
	`reference` text NOT NULL,
	`notes` text,
	`received_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `tax_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoice_sequences` (
	`financial_year` text PRIMARY KEY NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_adjustment_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`invoice_id` text NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`reason` text NOT NULL,
	`taxable_value` real NOT NULL,
	`cgst` real DEFAULT 0 NOT NULL,
	`sgst` real DEFAULT 0 NOT NULL,
	`igst` real DEFAULT 0 NOT NULL,
	`total` real NOT NULL,
	`snapshot` text NOT NULL,
	`pdf_key` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `tax_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_adjustment_notes_number_unique` ON `tax_adjustment_notes` (`number`);--> statement-breakpoint
CREATE TABLE `tax_invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`description` text NOT NULL,
	`sku` text,
	`hsn_sac` text NOT NULL,
	`uqc` text NOT NULL,
	`quantity` real NOT NULL,
	`rate` real NOT NULL,
	`discount_rate` real DEFAULT 0 NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`taxable_value` real NOT NULL,
	`gst_rate` real NOT NULL,
	`cgst_amount` real DEFAULT 0 NOT NULL,
	`sgst_amount` real DEFAULT 0 NOT NULL,
	`igst_amount` real DEFAULT 0 NOT NULL,
	`total` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `tax_invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tax_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text,
	`financial_year` text NOT NULL,
	`quotation_id` integer,
	`project_id` text,
	`customer_id` integer NOT NULL,
	`site_id` text,
	`invoice_date` text,
	`due_date` text,
	`billing_address` text NOT NULL,
	`shipping_address` text,
	`customer_gstin` text,
	`place_of_supply` text NOT NULL,
	`place_of_supply_code` text NOT NULL,
	`supply_type` text NOT NULL,
	`pricing_mode` text DEFAULT 'exclusive' NOT NULL,
	`subtotal` real NOT NULL,
	`discount_total` real DEFAULT 0 NOT NULL,
	`taxable_total` real NOT NULL,
	`cgst_total` real DEFAULT 0 NOT NULL,
	`sgst_total` real DEFAULT 0 NOT NULL,
	`igst_total` real DEFAULT 0 NOT NULL,
	`round_off` real DEFAULT 0 NOT NULL,
	`grand_total` real NOT NULL,
	`amount_words` text NOT NULL,
	`payment_terms` text,
	`bank_details` text,
	`company_snapshot` text NOT NULL,
	`snapshot` text NOT NULL,
	`pdf_key` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`locked_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`cancelled_at` text,
	`cancel_reason` text,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `customer_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_invoices_number_unique` ON `tax_invoices` (`number`);