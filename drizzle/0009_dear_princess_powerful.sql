CREATE TABLE `quotation_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` integer NOT NULL,
	`revision` integer NOT NULL,
	`decision` text NOT NULL,
	`customer_name` text,
	`comment` text,
	`ip_address` text,
	`user_agent` text,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotation_files` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`file_key` text NOT NULL,
	`content_type` text,
	`size` integer,
	`permanent` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotation_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`percentage` real,
	`fixed_amount` real,
	`due_trigger` text,
	`due_date` text,
	`notes` text,
	`amount` real DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action
);
