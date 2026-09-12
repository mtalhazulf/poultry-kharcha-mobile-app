/**
 * Read-only edit history for an expense. Rows are written only by the
 * `kharcha_snapshot_history` trigger (supabase/migrations); RLS scopes reads
 * to active members of the expense's organization.
 */
import { AppError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { Tables } from '../types/database';
import { toKharchaHistoryEntry, toProfileSummary, type KharchaHistoryEntry } from '../types/models';

const COLUMNS =
  'id, kharcha_id, version, amount, category, category_icon, note, expense_date, receipt_path, edited_by, edited_at, editor:profiles!kharcha_history_edited_by_fkey(id, email, display_name, avatar_url)';

/** Newest version first. */
export async function listKharchaHistory(kharchaId: string): Promise<KharchaHistoryEntry[]> {
  const { data, error } = await supabase
    .from('kharcha_history')
    .select(COLUMNS)
    .eq('kharcha_id', kharchaId)
    .order('version', { ascending: false });
  if (error) {
    throw AppError.from(error);
  }
  return (data as Array<Tables<'kharcha_history'> & { editor: Parameters<typeof toProfileSummary>[0] | null }>).map(
    row => ({
      ...toKharchaHistoryEntry(row),
      editor: row.editor ? toProfileSummary(row.editor) : null,
    }),
  );
}
