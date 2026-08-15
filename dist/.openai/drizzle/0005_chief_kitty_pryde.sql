CREATE TABLE `customer_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer NOT NULL,
	`name` text NOT NULL,
	`designation` text,
	`phone` text NOT NULL,
	`whatsapp` text,
	`email` text,
	`primary_contact` integer DEFAULT false NOT NULL,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customer_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer NOT NULL,
	`site_id` text,
	`content` text NOT NULL,
	`private` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `customer_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `customer_sites` ADD `site_code` text;--> statement-breakpoint
ALTER TABLE `customer_sites` ADD `state` text DEFAULT 'Tamil Nadu';--> statement-breakpoint
ALTER TABLE `customer_sites` ADD `construction_stage` text;--> statement-breakpoint
ALTER TABLE `customer_sites` ADD `neutral_wire` text;--> statement-breakpoint
ALTER TABLE `customer_sites` ADD `access_requirements` text;--> statement-breakpoint
ALTER TABLE `customer_sites` ADD `status` text DEFAULT 'Active';--> statement-breakpoint
CREATE UNIQUE INDEX `customer_sites_site_code_unique` ON `customer_sites` (`site_code`);--> statement-breakpoint
ALTER TABLE `customers` ADD `customer_code` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `primary_contact` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `alternate_phone` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `pan` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `city` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `state` text DEFAULT 'Tamil Nadu';--> statement-breakpoint
ALTER TABLE `customers` ADD `pincode` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `country` text DEFAULT 'India';--> statement-breakpoint
ALTER TABLE `customers` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `status` text DEFAULT 'Prospect';--> statement-breakpoint
CREATE UNIQUE INDEX `customers_customer_code_unique` ON `customers` (`customer_code`);