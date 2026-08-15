CREATE TABLE `amc_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer NOT NULL,
	`site_id` text NOT NULL,
	`type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`renewal_at` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `customer_sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`kind` text NOT NULL,
	`file_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`due_at` text,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`quotation_item_id` text,
	`name` text NOT NULL,
	`sku` text,
	`required_qty` real NOT NULL,
	`ordered_qty` real DEFAULT 0 NOT NULL,
	`received_qty` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Required' NOT NULL,
	`vendor_id` text,
	`buying_price` real,
	`freight` real DEFAULT 0,
	`purchase_reference` text,
	`expected_delivery` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quotation_item_id`) REFERENCES `quotation_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`assigned_to` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`due_at` text,
	`mandatory` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`notes` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotation_floors` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` integer NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` integer NOT NULL,
	`room_id` text NOT NULL,
	`product_id` integer,
	`variant_id` integer,
	`snapshot` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price` real NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`tax_rate` real DEFAULT 18 NOT NULL,
	`tax_mode` text DEFAULT 'GST' NOT NULL,
	`installation` real DEFAULT 0 NOT NULL,
	`note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `quotation_rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotation_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` integer NOT NULL,
	`revision` integer NOT NULL,
	`snapshot` text NOT NULL,
	`pdf_key` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotation_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`floor_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`floor_id`) REFERENCES `quotation_floors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer NOT NULL,
	`site_id` text NOT NULL,
	`project_id` text,
	`warranty_id` text,
	`problem` text NOT NULL,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`assigned_to` text,
	`scheduled_at` text,
	`resolution` text,
	`parts_replaced` text,
	`status` text DEFAULT 'Open' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `customer_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`warranty_id`) REFERENCES `warranties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`gstin` text,
	`address` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `warranties` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`customer_id` integer NOT NULL,
	`site_id` text NOT NULL,
	`product_snapshot` text NOT NULL,
	`serial_number` text,
	`installation_date` text NOT NULL,
	`start_date` text NOT NULL,
	`replacement_end` text,
	`service_end` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `customer_sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `zoho_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`quotation_id` integer,
	`zoho_invoice_id` text,
	`invoice_number` text,
	`invoice_date` text,
	`pdf_key` text,
	`external_url` text,
	`status` text DEFAULT 'Not Required' NOT NULL,
	`balance_due` real DEFAULT 0,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `zoho_invoices_zoho_invoice_id_unique` ON `zoho_invoices` (`zoho_invoice_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `zoho_invoices_invoice_number_unique` ON `zoho_invoices` (`invoice_number`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`series` text,
	`brand` text DEFAULT 'Noviq',
	`short_description` text,
	`description` text,
	`hsn` text,
	`unit` text DEFAULT 'Nos',
	`tax_rate` real DEFAULT 18,
	`warranty` text,
	`active` integer DEFAULT true,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "category", "subcategory", "series", "brand", "short_description", "description", "hsn", "unit", "tax_rate", "warranty", "active", "created_at", "updated_at") SELECT "id", "name", "category", "subcategory", "series", "brand", "short_description", "description", "hsn", "unit", "tax_rate", "warranty", "active", "created_at", "updated_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
PRAGMA foreign_keys=ON;