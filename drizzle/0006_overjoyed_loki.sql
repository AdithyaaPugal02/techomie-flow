CREATE TABLE `project_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`due_condition` text,
	`due_date` text,
	`amount` real NOT NULL,
	`received` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_team` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`assigned_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scope_variations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`reason` text NOT NULL,
	`value_impact` real NOT NULL,
	`payment_impact` text,
	`status` text DEFAULT 'Pending Approval' NOT NULL,
	`quotation_revision` integer,
	`snapshot` text,
	`created_by` text NOT NULL,
	`approved_by` text,
	`created_at` text NOT NULL,
	`approved_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`floor_room` text,
	`category` text DEFAULT 'Other',
	`assigned_to` text,
	`priority` text DEFAULT 'Normal',
	`status` text DEFAULT 'To Do' NOT NULL,
	`due_at` text,
	`mandatory` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`completion_proof` text,
	`notes` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_project_tasks`("id", "project_id", "title", "floor_room", "category", "assigned_to", "priority", "status", "due_at", "mandatory", "completed_at", "completion_proof", "notes", "sort_order", "created_at") SELECT "id", "project_id", "title", "floor_room", "category", "assigned_to", "priority", "status", "due_at", "mandatory", "completed_at", "completion_proof", "notes", "sort_order", "created_at" FROM `project_tasks`;--> statement-breakpoint
DROP TABLE `project_tasks`;--> statement-breakpoint
ALTER TABLE `__new_project_tasks` RENAME TO `project_tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer NOT NULL,
	`site_id` text NOT NULL,
	`quotation_id` integer,
	`quotation_revision` integer DEFAULT 0,
	`lead_id` text,
	`site_visit_id` text,
	`title` text NOT NULL,
	`category` text DEFAULT 'Smart Home Automation',
	`scope` text,
	`scope_snapshot` text,
	`direct_reason` text,
	`primary_contact` text,
	`manager_id` text,
	`sales_id` text,
	`status` text NOT NULL,
	`health` text DEFAULT 'On Track',
	`value` real NOT NULL,
	`payment_plan` text,
	`planned_start` text,
	`planned_end` text,
	`actual_start` text,
	`actual_end` text,
	`installation_at` text,
	`testing_at` text,
	`handover_at` text,
	`customer_notes` text,
	`notes` text,
	`checklist` text,
	`site_readiness` text,
	`testing_checklist` text,
	`handover` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `customer_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_visit_id`) REFERENCES `site_visits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "customer_id", "site_id", "quotation_id", "quotation_revision", "lead_id", "site_visit_id", "title", "category", "scope", "scope_snapshot", "direct_reason", "primary_contact", "manager_id", "sales_id", "status", "health", "value", "payment_plan", "planned_start", "planned_end", "actual_start", "actual_end", "installation_at", "testing_at", "handover_at", "customer_notes", "notes", "checklist", "site_readiness", "testing_checklist", "handover", "archived", "created_at", "updated_at") SELECT "id", "customer_id", "site_id", "quotation_id", "quotation_revision", "lead_id", "site_visit_id", "title", "category", "scope", "scope_snapshot", "direct_reason", "primary_contact", "manager_id", "sales_id", "status", "health", "value", "payment_plan", "planned_start", "planned_end", "actual_start", "actual_end", "installation_at", "testing_at", "handover_at", "customer_notes", "notes", "checklist", "site_readiness", "testing_checklist", "handover", "archived", "created_at", "updated_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
ALTER TABLE `project_materials` ADD `at_site_qty` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `project_materials` ADD `installed_qty` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `project_materials` ADD `actual_received` text;