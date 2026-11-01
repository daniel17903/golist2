-- Lists are either shopping lists (icon grid, the original GoList behaviour)
-- or todo lists (the former DoList app). Existing lists are shopping lists.
ALTER TABLE shared_lists
ADD COLUMN IF NOT EXISTS list_type TEXT NOT NULL DEFAULT 'shopping'
  CHECK (list_type IN ('shopping', 'todo'));

-- Todo-only item fields. All nullable: shopping items leave them unset, and a
-- list that switches type keeps them.
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS points INTEGER CHECK (points > 0 AND points <= 1000);
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS recurrence TEXT;
