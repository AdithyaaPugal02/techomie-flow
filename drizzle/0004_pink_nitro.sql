CREATE TABLE `lead_followups` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`assigned_to` text NOT NULL,
	`action_type` text NOT NULL,
	`status` text DEFAULT 'Upcoming' NOT NULL,
	`outcome` text,
	`discussion_note` text,
	`next_action` text,
	`next_followup_at` text,
	`updated_stage` text,
	`completed_at` text,
	`cancel_reason` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `site_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`assigned_to` text NOT NULL,
	`status` text DEFAULT 'Scheduled' NOT NULL,
	`maps_url` text,
	`visit_notes` text,
	`requirement_confirmation` text,
	`budget_confirmation` text,
	`expected_quote_date` text,
	`next_action` text,
	`next_followup_at` text,
	`survey` text,
	`completed_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `leads` ADD `customer_type` text DEFAULT 'Individual';--> statement-breakpoint
ALTER TABLE `leads` ADD `preferred_communication` text DEFAULT 'Call';--> statement-breakpoint
ALTER TABLE `leads` ADD `existing_customer` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `customer_id` integer REFERENCES customers(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `site_id` text REFERENCES customer_sites(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `site_name` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `pincode` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `maps_url` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `site_contact_name` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `site_contact_phone` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `property_type` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `construction_stage` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `project_timeline` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `requirement_categories` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `estimated_value` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `leads` ADD `priority` text DEFAULT 'Warm';--> statement-breakpoint
ALTER TABLE `leads` ADD `decision_maker` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `decision_contact` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `decision_maker_count` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `leads` ADD `expected_decision_date` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `competitor` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `lead_owner` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `next_action` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `lost_reason` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `lost_note` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `future_reminder` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `last_activity_at` text;