-- ============================================================================
-- Realtime: primary-key-only replica identity
-- ============================================================================
-- Realtime does not (cannot) evaluate RLS for DELETE events: the row is gone,
-- so the `old` record is broadcast to every subscriber of the table. With
-- REPLICA IDENTITY FULL that would leak amount/note/category of deleted
-- expenses to all authenticated users. DEFAULT sends only the primary key,
-- which is all the client needs to drop the row from its list.
alter table public.kharcha        replica identity default;
alter table public.kharcha_shares replica identity default;

-- Android gallery pickers report HEIF as image/heif (not image/heic).
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
 where id = 'receipts';
