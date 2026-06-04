CREATE TABLE `galleries` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url_slug` text,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `galleries_url_slug_unique` ON `galleries` (`url_slug`);--> statement-breakpoint
CREATE TABLE `gallery_photos` (
	`gallery_id` text NOT NULL,
	`file_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`added_at` text NOT NULL,
	PRIMARY KEY(`gallery_id`, `file_id`),
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `photos`(`file_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gallery_photos_file_id_idx` ON `gallery_photos` (`file_id`);--> statement-breakpoint
CREATE TABLE `mood_clusters` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`photo_count` integer NOT NULL,
	`centroid_json` text NOT NULL,
	`preview_colors_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mood_clusters_version_slug_unique` ON `mood_clusters` (`version`,`slug`);--> statement-breakpoint
CREATE INDEX `mood_clusters_version_photo_count_idx` ON `mood_clusters` (`version`,`photo_count`);--> statement-breakpoint
CREATE TABLE `photo_mood_assignments` (
	`photo_id` text NOT NULL,
	`cluster_id` text NOT NULL,
	`version` integer NOT NULL,
	`confidence` real NOT NULL,
	`distance` real NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`photo_id`, `version`),
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`file_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cluster_id`) REFERENCES `mood_clusters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photo_mood_assignments_cluster_id_idx` ON `photo_mood_assignments` (`cluster_id`);--> statement-breakpoint
CREATE TABLE `photo_tags` (
	`file_id` text NOT NULL,
	`tag_kind` text NOT NULL,
	`tag_name` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`file_id`, `tag_kind`, `tag_name`),
	FOREIGN KEY (`file_id`) REFERENCES `photos`(`file_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_kind`,`tag_name`) REFERENCES `tags`(`kind`,`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`file_id` text PRIMARY KEY NOT NULL,
	`final_file_name` text NOT NULL,
	`original_file_name` text NOT NULL,
	`file_url` text NOT NULL,
	`thumbnail_file_id` text NOT NULL,
	`thumbnail_final_file_name` text NOT NULL,
	`thumbnail_file_url` text NOT NULL,
	`metadata_id` text,
	`capture_time` text,
	`upload_time` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`aspect_ratio` real NOT NULL,
	`orientation` text NOT NULL,
	`color_fingerprint_json` text NOT NULL,
	`exif_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_metadata_id_unique` ON `photos` (`metadata_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `photos_thumbnail_file_id_unique` ON `photos` (`thumbnail_file_id`);--> statement-breakpoint
CREATE INDEX `photos_capture_time_idx` ON `photos` (`capture_time`,`upload_time`);--> statement-breakpoint
CREATE TABLE `tags` (
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`kind`, `name`)
);
