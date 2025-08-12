-- Fix polygon_id field length from VARCHAR(50) to VARCHAR(100)
-- This prevents data truncation for long Polygon API IDs

DO $$ 
BEGIN
    -- Check if polygon_id column exists and is too short
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dividends' 
        AND column_name = 'polygon_id' 
        AND character_maximum_length = 50
    ) THEN
        -- Extend the column length
        ALTER TABLE dividends ALTER COLUMN polygon_id TYPE VARCHAR(100);
        RAISE NOTICE 'Extended polygon_id column from VARCHAR(50) to VARCHAR(100)';
    ELSE
        RAISE NOTICE 'polygon_id column already correct length or does not exist';
    END IF;
END $$;