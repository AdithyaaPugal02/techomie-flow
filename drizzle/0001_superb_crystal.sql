CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`due_at` text,
	`completed_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customer_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`city` text,
	`pincode` text,
	`maps_url` text,
	`contact_name` text,
	`contact_phone` text,
	`property_type` text,
	`floors` text,
	`survey_notes` text,
	`electrical_readiness` text,
	`network_details` text,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`vendor` text NOT NULL,
	`amount` real NOT NULL,
	`tax` real DEFAULT 0 NOT NULL,
	`mode` text NOT NULL,
	`notes` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_date` text NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`whatsapp` text,
	`email` text,
	`city` text,
	`address` text,
	`source` text,
	`requirement` text,
	`budget` text,
	`details` text,
	`assigned_to` text,
	`followup_at` text,
	`status` text DEFAULT 'New' NOT NULL,
	`notes` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`quotation_id` integer,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`mode` text NOT NULL,
	`reference` text NOT NULL,
	`received_by` text NOT NULL,
	`notes` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer NOT NULL,
	`site_id` text NOT NULL,
	`quotation_id` integer NOT NULL,
	`title` text NOT NULL,
	`manager_id` text,
	`status` text NOT NULL,
	`value` real NOT NULL,
	`planned_start` text,
	`planned_end` text,
	`notes` text,
	`checklist` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `customer_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
ALTER TABLE `customers` ADD `customer_type` text DEFAULT 'Individual' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `whatsapp` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `billing_address` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `assigned_to` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `customers` ADD `lead_source` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `subcategory` text;--> statement-breakpoint
ALTER TABLE `products` ADD `series` text;--> statement-breakpoint
ALTER TABLE `products` ADD `short_description` text;--> statement-breakpoint
ALTER TABLE `products` ADD `description` text;--> statement-breakpoint
ALTER TABLE `products` ADD `hsn` text;--> statement-breakpoint
ALTER TABLE `products` ADD `unit` text DEFAULT 'Nos';--> statement-breakpoint
ALTER TABLE `products` ADD `tax_rate` real DEFAULT 18;--> statement-breakpoint
ALTER TABLE `products` ADD `warranty` text;--> statement-breakpoint
ALTER TABLE `products` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `updated_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `password_salt` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_login` text;--> statement-breakpoint
ALTER TABLE `users` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `variants` ADD `attributes` text;--> statement-breakpoint
ALTER TABLE `variants` ADD `minimum_price` real;--> statement-breakpoint
ALTER TABLE `variants` ADD `hsn` text;--> statement-breakpoint
ALTER TABLE `variants` ADD `active` integer DEFAULT true NOT NULL;