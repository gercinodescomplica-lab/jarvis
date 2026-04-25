CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer
);
