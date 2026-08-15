PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quotations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`revision` integer DEFAULT 0,
	`customer_id` integer,
	`site_id` text,
	`title` text,
	`quote_type` text DEFAULT 'Standard Product Quotation',
	`category` text,
	`quote_date` text,
	`valid_until` text,
	`status` text DEFAULT 'Draft',
	`snapshot` text NOT NULL,
	`total` real NOT NULL,
	`sent_amount` real DEFAULT 0,
	`accepted_amount` real DEFAULT 0,
	`sales_id` text,
	`last_followup` text,
	`pdf_key` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `customer_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_quotations`("id", "number", "revision", "customer_id", "site_id", "title", "quote_type", "category", "quote_date", "valid_until", "status", "snapshot", "total", "sent_amount", "accepted_amount", "sales_id", "last_followup", "pdf_key", "archived", "created_by", "created_at", "updated_at") SELECT "id", "number", "revision", "customer_id", "site_id", "title", "quote_type", "category", "quote_date", "valid_until", "status", "snapshot", "total", "sent_amount", "accepted_amount", "sales_id", "last_followup", "pdf_key", "archived", "created_by", "created_at", "updated_at" FROM `quotations`;--> statement-breakpoint
DROP TABLE `quotations`;--> statement-breakpoint
ALTER TABLE `__new_quotations` RENAME TO `quotations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_number_unique` ON `quotations` (`number`);