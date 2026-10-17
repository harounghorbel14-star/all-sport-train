-- Earlier seeds stamped "reviewed" dates on content that no one had reviewed.
-- Review dates are only set when an admin publishes after checking.
UPDATE "Ruleset" SET "reviewedAt" = NULL WHERE "verification" <> 'summary';
UPDATE "Sport" SET "reviewedAt" = NULL WHERE "isCustom" = false;
