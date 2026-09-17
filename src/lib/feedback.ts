import { supabase } from './supabaseClient';

/** Table name is prefixed since this Supabase project is shared with another app —
 * keeps it unambiguous in the dashboard and avoids any collision. */
const TABLE = 'mapsyquest_feedback';

export type FeedbackCategory = 'thanks' | 'bug' | 'other';

export async function submitFeedback(params: {
  category: FeedbackCategory;
  message: string;
  contactEmail: string | null;
  userId: string | null;
}): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Feedback isn't set up yet — check back soon." };
  const { error } = await supabase.from(TABLE).insert({
    category: params.category,
    message: params.message,
    contact_email: params.contactEmail,
    user_id: params.userId,
  });
  return { error: error?.message ?? null };
}
