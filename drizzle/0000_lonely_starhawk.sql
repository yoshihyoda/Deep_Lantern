CREATE TABLE `votes` (
	`session` text NOT NULL,
	`voter` text NOT NULL,
	`candidate` text NOT NULL,
	`minutes` integer DEFAULT 60 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`session`, `voter`)
);
