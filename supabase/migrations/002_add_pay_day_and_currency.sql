-- Migration: Add pay_day and update default currency in profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pay_day INTEGER DEFAULT 28 CHECK (pay_day BETWEEN 1 AND 31);

ALTER TABLE profiles 
ALTER COLUMN currency SET DEFAULT 'FCFA';
