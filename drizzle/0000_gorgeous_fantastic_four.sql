CREATE TABLE `photo_color_fingerprints` (
	`photo_id` text NOT NULL,
	`version` integer NOT NULL,
	`fingerprint_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`photo_id`, `version`),
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`original_file_name` text NOT NULL,
	`final_file_name` text NOT NULL,
	`file_id` text NOT NULL,
	`file_url` text NOT NULL,
	`capture_time` text,
	`upload_time` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`aspect_ratio` real NOT NULL,
	`orientation` text NOT NULL,
	`camera` text,
	`lens` text,
	`iso` integer,
	`aperture` text,
	`shutter` text,
	`focal_length` text,
	`manual_tags_json` text DEFAULT '[]' NOT NULL,
	`auto_mood_tags_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_file_id_unique` ON `photos` (`file_id`);--> statement-breakpoint
CREATE INDEX `photos_capture_time_idx` ON `photos` (`capture_time`,`upload_time`);