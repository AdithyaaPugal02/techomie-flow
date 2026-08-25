CREATE TABLE `base_products` (
	`id` text PRIMARY KEY NOT NULL,
	`internal_code` text NOT NULL,
	`procurement_name` text NOT NULL,
	`customer_name` text NOT NULL,
	`category_id` text,
	`subcategory_id` text,
	`customer_brand_id` text,
	`preferred_supplier_id` text,
	`series` text,
	`description` text,
	`internal_notes` text,
	`unit` text DEFAULT 'Nos' NOT NULL,
	`pricing_method` text DEFAULT 'Fixed variant price' NOT NULL,
	`measurement_unit` text,
	`warranty_template_id` text,
	`tax_code_id` text,
	`availability` text DEFAULT 'Available' NOT NULL,
	`review_status` text DEFAULT 'Imported' NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `item_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subcategory_id`) REFERENCES `item_subcategories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_brand_id`) REFERENCES `item_brands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`preferred_supplier_id`) REFERENCES `item_suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`warranty_template_id`) REFERENCES `warranty_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tax_code_id`) REFERENCES `item_tax_codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `base_products_internal_code_unique` ON `base_products` (`internal_code`);--> statement-breakpoint
CREATE TABLE `bundle_components` (
	`id` text PRIMARY KEY NOT NULL,
	`bundle_variant_id` text NOT NULL,
	`component_variant_id` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`customer_visible` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`bundle_variant_id`) REFERENCES `sellable_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`component_variant_id`) REFERENCES `sellable_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `compatible_accessories` (
	`id` text PRIMARY KEY NOT NULL,
	`base_product_id` text NOT NULL,
	`accessory_variant_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`required_for_procurement` integer DEFAULT false NOT NULL,
	`customer_visibility` text DEFAULT 'Separate' NOT NULL,
	`notes` text,
	FOREIGN KEY (`base_product_id`) REFERENCES `base_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accessory_variant_id`) REFERENCES `sellable_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customer_brand_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`base_product_id` text NOT NULL,
	`supplier_id` text,
	`supplier_model` text,
	`brand_id` text,
	`customer_name` text NOT NULL,
	`visibility` text DEFAULT 'Customer-facing' NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`base_product_id`) REFERENCES `base_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `item_suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`brand_id`) REFERENCES `item_brands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `item_audit_history` (
	`id` text PRIMARY KEY NOT NULL,
	`base_product_id` text,
	`variant_id` text,
	`action` text NOT NULL,
	`before_snapshot` text,
	`after_snapshot` text,
	`created_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`base_product_id`) REFERENCES `base_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `sellable_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `item_brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand_type` text DEFAULT 'Customer-facing' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_brands_name_unique` ON `item_brands` (`name`);--> statement-breakpoint
CREATE TABLE `item_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_categories_name_unique` ON `item_categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_categories_code_unique` ON `item_categories` (`code`);--> statement-breakpoint
CREATE TABLE `item_import_errors` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`severity` text NOT NULL,
	`code` text NOT NULL,
	`message` text NOT NULL,
	`source_sheet` text,
	`source_page` integer,
	`source_row` integer,
	`source_data` text,
	`resolved` integer DEFAULT false NOT NULL,
	`resolved_by` text,
	`resolved_at` text,
	FOREIGN KEY (`job_id`) REFERENCES `item_import_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `item_import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text,
	`source_file` text NOT NULL,
	`source_hash` text,
	`status` text DEFAULT 'Imported' NOT NULL,
	`summary` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_by` text,
	`approved_by` text,
	`approved_at` text,
	FOREIGN KEY (`supplier_id`) REFERENCES `item_suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `item_price_modifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`base_product_id` text NOT NULL,
	`variant_id` text,
	`name` text NOT NULL,
	`modifier_type` text NOT NULL,
	`amount` real NOT NULL,
	`conditions` text,
	`customer_visible` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`base_product_id`) REFERENCES `base_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `sellable_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `item_subcategories` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `item_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `item_suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`gstin` text,
	`contact` text,
	`email` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_suppliers_name_unique` ON `item_suppliers` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_suppliers_code_unique` ON `item_suppliers` (`code`);--> statement-breakpoint
CREATE TABLE `item_tax_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`hsn_sac` text NOT NULL,
	`description` text,
	`gst_rate` real NOT NULL,
	`unit_code` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`base_product_id` text NOT NULL,
	`configuration_code` text NOT NULL,
	`module_size` text,
	`light_switches` integer,
	`switches_6a` integer,
	`switches_16a` integer,
	`fan_controls` integer,
	`curtains` integer,
	`sockets` integer,
	`usb_socket` integer,
	`scenes` integer,
	`dimmer_type` text,
	`doorbell_control` integer,
	`knob_control` integer,
	`load_rating` text,
	`layout_code` text,
	`fixed_technology` text,
	`specifications` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`base_product_id`) REFERENCES `base_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_media` (
	`id` text PRIMARY KEY NOT NULL,
	`base_product_id` text,
	`variant_id` text,
	`supplier_item_id` text,
	`kind` text NOT NULL,
	`file_key` text NOT NULL,
	`source` text NOT NULL,
	`review_status` text DEFAULT 'Needs Review' NOT NULL,
	`review_issue` text,
	`customer_approved` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`base_product_id`) REFERENCES `base_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `sellable_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_item_id`) REFERENCES `supplier_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_cost_history` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`supplier_item_id` text,
	`price_book_id` text,
	`cost` real NOT NULL,
	`tier_name` text,
	`effective_date` text NOT NULL,
	`recorded_at` text NOT NULL,
	`recorded_by` text,
	FOREIGN KEY (`variant_id`) REFERENCES `sellable_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_item_id`) REFERENCES `supplier_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`price_book_id`) REFERENCES `supplier_price_books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quantity_price_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_item_id` text NOT NULL,
	`name` text NOT NULL,
	`min_quantity` real NOT NULL,
	`max_quantity` real,
	`unit_price` real NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`supplier_item_id`) REFERENCES `supplier_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sellable_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`base_product_id` text NOT NULL,
	`configuration_id` text,
	`internal_item_id` text NOT NULL,
	`customer_name` text,
	`technology` text,
	`material` text,
	`finish` text,
	`panel_colour` text,
	`frame_colour` text,
	`availability` text DEFAULT 'Available' NOT NULL,
	`selling_price` real,
	`selling_method` text DEFAULT 'Manual fixed selling price' NOT NULL,
	`markup_percent` real,
	`target_margin_percent` real,
	`warranty_template_id` text,
	`tax_code_id` text,
	`review_status` text DEFAULT 'Imported' NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`base_product_id`) REFERENCES `base_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`configuration_id`) REFERENCES `product_configurations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`warranty_template_id`) REFERENCES `warranty_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tax_code_id`) REFERENCES `item_tax_codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sellable_variants_internal_item_id_unique` ON `sellable_variants` (`internal_item_id`);--> statement-breakpoint
CREATE TABLE `selling_price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`price` real NOT NULL,
	`method` text NOT NULL,
	`effective_date` text NOT NULL,
	`customer_id` integer,
	`project_id` text,
	`approved_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `sellable_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `supplier_items` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`price_book_id` text NOT NULL,
	`variant_id` text,
	`supplier_product_name` text NOT NULL,
	`supplier_model` text,
	`source_list_price` real,
	`discount_percent` real,
	`net_buying_price` real,
	`currency` text DEFAULT 'INR' NOT NULL,
	`gst_status` text NOT NULL,
	`source_sheet` text,
	`source_page` integer,
	`source_row` integer,
	`source_data` text,
	`review_status` text DEFAULT 'Imported' NOT NULL,
	`imported_at` text NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `item_suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`price_book_id`) REFERENCES `supplier_price_books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `sellable_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `supplier_price_books` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`effective_date` text NOT NULL,
	`gst_status` text NOT NULL,
	`default_tier` text DEFAULT 'Distributor' NOT NULL,
	`source_file` text NOT NULL,
	`status` text DEFAULT 'Imported' NOT NULL,
	`imported_at` text NOT NULL,
	`created_by` text,
	FOREIGN KEY (`supplier_id`) REFERENCES `item_suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `variant_attribute_values` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`attribute_id` text NOT NULL,
	`value_text` text,
	`value_number` real,
	`value_boolean` integer,
	FOREIGN KEY (`variant_id`) REFERENCES `sellable_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attribute_id`) REFERENCES `variant_attributes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `variant_attributes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`label` text NOT NULL,
	`data_type` text DEFAULT 'text' NOT NULL,
	`applicable_categories` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variant_attributes_name_unique` ON `variant_attributes` (`name`);--> statement-breakpoint
CREATE TABLE `warranty_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`customer_text` text NOT NULL,
	`duration_months` integer,
	`replacement_months` integer,
	`terms` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warranty_templates_name_unique` ON `warranty_templates` (`name`);