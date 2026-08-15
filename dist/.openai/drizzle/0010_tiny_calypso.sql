CREATE TABLE `expense_history` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`comment` text,
	`snapshot` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_type` text DEFAULT 'Claim' NOT NULL,
	`project_id` text,
	`customer_id` integer,
	`site_id` text,
	`lead_id` text,
	`supplier_id` text,
	`cost_centre` text,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`vendor` text DEFAULT '' NOT NULL,
	`amount` real NOT NULL,
	`approved_amount` real,
	`tax` real DEFAULT 0 NOT NULL,
	`gstin` text,
	`bill_number` text,
	`paid_by` text DEFAULT 'Employee Personal Money' NOT NULL,
	`mode` text NOT NULL,
	`description` text,
	`distance_km` real,
	`notes` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`approver_comment` text,
	`rejection_reason` text,
	`reimbursement_date` text,
	`reimbursement_mode` text,
	`reimbursement_reference` text,
	`payer` text,
	`duplicate_warning` integer DEFAULT false NOT NULL,
	`created_by` text,
	`approved_by` text,
	`submitted_at` text,
	`approved_at` text,
	`updated_at` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `customer_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_expenses`("id", "project_id", "date", "category", "vendor", "amount", "tax", "mode", "notes", "archived", "created_at") SELECT "id", "project_id", "date", "category", "vendor", "amount", "tax", "mode", "notes", "archived", "created_at" FROM `expenses`;--> statement-breakpoint
DROP TABLE `expenses`;--> statement-breakpoint
ALTER TABLE `__new_expenses` RENAME TO `expenses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_expenses_creator_status_date` ON `expenses` (`created_by`,`status`,`date`);--> statement-breakpoint
CREATE INDEX `idx_expenses_project_date` ON `expenses` (`project_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_expense_history_expense` ON `expense_history` (`expense_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
