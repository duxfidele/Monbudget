-- Migration: Add pay_day, notifications, and currency in profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'FCFA' NOT NULL;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pay_day INTEGER DEFAULT 28 CHECK (pay_day BETWEEN 1 AND 31);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notifications JSONB DEFAULT '{"budgetAlert": true, "budgetAlertThreshold": 80, "payDayReminder": true, "payDayReminderDays": 7, "weeklySummary": false}'::jsonb;

ALTER TABLE profiles 
ALTER COLUMN currency SET DEFAULT 'FCFA';

-- Set null currency profiles to FCFA
UPDATE profiles SET currency = 'FCFA' WHERE currency IS NULL;
