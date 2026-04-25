CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`uploader_phone` text NOT NULL,
	`filename` text NOT NULL,
	`description` text,
	`total_chunks` integer DEFAULT 0 NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `whitelist` (
	`phone` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`can_store_memory` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer
);
