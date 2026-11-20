-- Performance Advisor: Auth RLS Initialization Plan
-- Wrap auth.uid() as (SELECT auth.uid()) in CRM / Operations RLS policies.
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Regenerated from CREATE POLICY statements in:
--   20260430529500_crm_core_leads_tables_and_triggers.sql (RLS section)
--   20260430530000_operations_crm_reference_bundle.sql

DROP POLICY IF EXISTS "lead_statuses_select_org" ON public.lead_statuses;
CREATE POLICY "lead_statuses_select_org"
  ON public.lead_statuses FOR SELECT
  USING (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_statuses.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_statuses_mutate_org" ON public.lead_statuses;
CREATE POLICY "lead_statuses_mutate_org"
  ON public.lead_statuses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_statuses.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_statuses_update_org" ON public.lead_statuses;
CREATE POLICY "lead_statuses_update_org"
  ON public.lead_statuses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_statuses.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_statuses.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_statuses_delete_org" ON public.lead_statuses;
CREATE POLICY "lead_statuses_delete_org"
  ON public.lead_statuses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_statuses.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_sources_org" ON public.lead_sources;
CREATE POLICY "lead_sources_org"
  ON public.lead_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_sources.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_sources.organization_id
    )
  );

DROP POLICY IF EXISTS "leads_org" ON public.leads;
CREATE POLICY "leads_org"
  ON public.leads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = leads.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = leads.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_client_profiles_org" ON public.lead_client_profiles;
CREATE POLICY "lead_client_profiles_org"
  ON public.lead_client_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_client_profiles.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_client_profiles.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_follow_up_updates_org" ON public.lead_follow_up_updates;
CREATE POLICY "lead_follow_up_updates_org"
  ON public.lead_follow_up_updates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_follow_up_updates.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_follow_up_updates.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can view own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can view own org lead status history"
  ON public.lead_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_status_history.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can insert own org lead status history"
  ON public.lead_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_status_history.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can update own org lead status history"
  ON public.lead_status_history FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_status_history.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_status_history.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can delete own org lead status history"
  ON public.lead_status_history FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = lead_status_history.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can view own org meta config" ON public.organization_meta_config;
CREATE POLICY "Users can view own org meta config"
    ON public.organization_meta_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.active_organization_id = organization_meta_config.organization_id
        )
    );

DROP POLICY IF EXISTS "Users can insert own org meta config" ON public.organization_meta_config;
CREATE POLICY "Users can insert own org meta config"
    ON public.organization_meta_config FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.active_organization_id = organization_id
        )
    );

DROP POLICY IF EXISTS "Users can update own org meta config" ON public.organization_meta_config;
CREATE POLICY "Users can update own org meta config"
    ON public.organization_meta_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.active_organization_id = organization_meta_config.organization_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.active_organization_id = organization_id
        )
    );

DROP POLICY IF EXISTS "Users can delete own org meta config" ON public.organization_meta_config;
CREATE POLICY "Users can delete own org meta config"
    ON public.organization_meta_config FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.active_organization_id = organization_meta_config.organization_id
        )
    );

DROP POLICY IF EXISTS "Users can view own org whatsapp conversations" ON public.whatsapp_conversations;
CREATE POLICY "Users can view own org whatsapp conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversations.organization_id)
  );

DROP POLICY IF EXISTS "Users can insert own org whatsapp conversations" ON public.whatsapp_conversations;
CREATE POLICY "Users can insert own org whatsapp conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_id)
  );

DROP POLICY IF EXISTS "Users can update own org whatsapp conversations" ON public.whatsapp_conversations;
CREATE POLICY "Users can update own org whatsapp conversations"
  ON public.whatsapp_conversations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversations.organization_id)
  );

DROP POLICY IF EXISTS "Users can view own org whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can view own org whatsapp messages"
  ON public.whatsapp_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = whatsapp_messages.conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can insert own org whatsapp messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = whatsapp_messages.conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can view own org whatsapp accounts" ON public.organization_whatsapp_accounts;
CREATE POLICY "Users can view own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_whatsapp_accounts.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org whatsapp accounts" ON public.organization_whatsapp_accounts;
CREATE POLICY "Users can insert own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org whatsapp accounts" ON public.organization_whatsapp_accounts;
CREATE POLICY "Users can update own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_whatsapp_accounts.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org whatsapp accounts" ON public.organization_whatsapp_accounts;
CREATE POLICY "Users can delete own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_whatsapp_accounts.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can view own org email connections" ON public.organization_email_connections;
CREATE POLICY "Users can view own org email connections"
  ON public.organization_email_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_email_connections.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org email connections" ON public.organization_email_connections;
CREATE POLICY "Users can insert own org email connections"
  ON public.organization_email_connections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org email connections" ON public.organization_email_connections;
CREATE POLICY "Users can update own org email connections"
  ON public.organization_email_connections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_email_connections.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org email connections" ON public.organization_email_connections;
CREATE POLICY "Users can delete own org email connections"
  ON public.organization_email_connections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_email_connections.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can view own org email conversations" ON public.email_conversations;
CREATE POLICY "Users can view own org email conversations"
  ON public.email_conversations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = email_conversations.organization_id)
  );

DROP POLICY IF EXISTS "Users can insert own org email conversations" ON public.email_conversations;
CREATE POLICY "Users can insert own org email conversations"
  ON public.email_conversations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_id)
  );

DROP POLICY IF EXISTS "Users can update own org email conversations" ON public.email_conversations;
CREATE POLICY "Users can update own org email conversations"
  ON public.email_conversations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = email_conversations.organization_id)
  );

DROP POLICY IF EXISTS "Users can view own org email messages" ON public.email_messages;
CREATE POLICY "Users can view own org email messages"
  ON public.email_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = email_messages.conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org email messages" ON public.email_messages;
CREATE POLICY "Users can insert own org email messages"
  ON public.email_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = email_messages.conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can view own org whatsapp config" ON public.organization_whatsapp_config;
CREATE POLICY "Users can view own org whatsapp config"
    ON public.organization_whatsapp_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.active_organization_id = organization_whatsapp_config.organization_id
        )
    );

DROP POLICY IF EXISTS "Users can insert own org whatsapp config" ON public.organization_whatsapp_config;
CREATE POLICY "Users can insert own org whatsapp config"
    ON public.organization_whatsapp_config FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.active_organization_id = organization_id
        )
    );

DROP POLICY IF EXISTS "Users can update own org whatsapp config" ON public.organization_whatsapp_config;
CREATE POLICY "Users can update own org whatsapp config"
    ON public.organization_whatsapp_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.active_organization_id = organization_whatsapp_config.organization_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.active_organization_id = organization_id
        )
    );

DROP POLICY IF EXISTS "Users can delete own org whatsapp config" ON public.organization_whatsapp_config;
CREATE POLICY "Users can delete own org whatsapp config"
    ON public.organization_whatsapp_config FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.active_organization_id = organization_whatsapp_config.organization_id
        )
    );

DROP POLICY IF EXISTS "Users can delete own org whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can delete own org whatsapp messages"
  ON public.whatsapp_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = whatsapp_messages.conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can view own org whatsapp conversation client profiles" ON public.whatsapp_conversation_client_profiles;
CREATE POLICY "Users can view own org whatsapp conversation client profiles"
  ON public.whatsapp_conversation_client_profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversation_client_profiles.organization_id)
  );

DROP POLICY IF EXISTS "Users can insert own org whatsapp conversation client profiles" ON public.whatsapp_conversation_client_profiles;
CREATE POLICY "Users can insert own org whatsapp conversation client profiles"
  ON public.whatsapp_conversation_client_profiles FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversation_client_profiles.organization_id)
  );

DROP POLICY IF EXISTS "Users can update own org whatsapp conversation client profiles" ON public.whatsapp_conversation_client_profiles;
CREATE POLICY "Users can update own org whatsapp conversation client profiles"
  ON public.whatsapp_conversation_client_profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversation_client_profiles.organization_id)
  );

DROP POLICY IF EXISTS "Users can view own org whatsapp conversation cycles" ON public.whatsapp_conversation_cycles;
CREATE POLICY "Users can view own org whatsapp conversation cycles"
  ON public.whatsapp_conversation_cycles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = whatsapp_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org whatsapp conversation cycles" ON public.whatsapp_conversation_cycles;
CREATE POLICY "Users can insert own org whatsapp conversation cycles"
  ON public.whatsapp_conversation_cycles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = whatsapp_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org whatsapp conversation cycles" ON public.whatsapp_conversation_cycles;
CREATE POLICY "Users can update own org whatsapp conversation cycles"
  ON public.whatsapp_conversation_cycles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = whatsapp_conversation_cycles.conversation_id
    )
  );

-- Table may not exist: bundle migrates rows to lead_follow_up_updates then drops this table.
DO $policy_whatsapp_conversation_follow_up_updates$
BEGIN
  IF to_regclass('public.whatsapp_conversation_follow_up_updates') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $sql$
    DROP POLICY IF EXISTS "Users can view own org whatsapp conversation follow up updates" ON public.whatsapp_conversation_follow_up_updates
  $sql$;
  EXECUTE $sql$
    CREATE POLICY "Users can view own org whatsapp conversation follow up updates"
      ON public.whatsapp_conversation_follow_up_updates FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id)
      )
  $sql$;

  EXECUTE $sql$
    DROP POLICY IF EXISTS "Users can insert own org whatsapp conversation follow up updates" ON public.whatsapp_conversation_follow_up_updates
  $sql$;
  EXECUTE $sql$
    CREATE POLICY "Users can insert own org whatsapp conversation follow up updates"
      ON public.whatsapp_conversation_follow_up_updates FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id)
      )
  $sql$;

  EXECUTE $sql$
    DROP POLICY IF EXISTS "Users can update own org whatsapp conversation follow up updates" ON public.whatsapp_conversation_follow_up_updates
  $sql$;
  EXECUTE $sql$
    CREATE POLICY "Users can update own org whatsapp conversation follow up updates"
      ON public.whatsapp_conversation_follow_up_updates FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id)
      )
  $sql$;

  EXECUTE $sql$
    DROP POLICY IF EXISTS "Users can delete own org whatsapp conversation follow up updates" ON public.whatsapp_conversation_follow_up_updates
  $sql$;
  EXECUTE $sql$
    CREATE POLICY "Users can delete own org whatsapp conversation follow up updates"
      ON public.whatsapp_conversation_follow_up_updates FOR DELETE
      USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id)
      )
  $sql$;
END
$policy_whatsapp_conversation_follow_up_updates$;

DROP POLICY IF EXISTS "Users can view own org whatsapp conversation status history" ON public.whatsapp_conversation_status_history;
CREATE POLICY "Users can view own org whatsapp conversation status history"
  ON public.whatsapp_conversation_status_history FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversation_status_history.organization_id)
  );

DROP POLICY IF EXISTS "Users can insert own org whatsapp conversation status history" ON public.whatsapp_conversation_status_history;
CREATE POLICY "Users can insert own org whatsapp conversation status history"
  ON public.whatsapp_conversation_status_history FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = whatsapp_conversation_status_history.organization_id)
  );

DROP POLICY IF EXISTS "Users can view own org email conversation follow up updates" ON public.email_conversation_follow_up_updates;
CREATE POLICY "Users can view own org email conversation follow up updates"
  ON public.email_conversation_follow_up_updates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = email_conversation_follow_up_updates.organization_id)
  );

DROP POLICY IF EXISTS "Users can insert own org email conversation follow up updates" ON public.email_conversation_follow_up_updates;
CREATE POLICY "Users can insert own org email conversation follow up updates"
  ON public.email_conversation_follow_up_updates FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = email_conversation_follow_up_updates.organization_id)
  );

DROP POLICY IF EXISTS "Users can update own org email conversation follow up updates" ON public.email_conversation_follow_up_updates;
CREATE POLICY "Users can update own org email conversation follow up updates"
  ON public.email_conversation_follow_up_updates FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = email_conversation_follow_up_updates.organization_id)
  );

DROP POLICY IF EXISTS "Users can delete own org email conversation follow up updates" ON public.email_conversation_follow_up_updates;
CREATE POLICY "Users can delete own org email conversation follow up updates"
  ON public.email_conversation_follow_up_updates FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = email_conversation_follow_up_updates.organization_id)
  );

DROP POLICY IF EXISTS "Users can view own org instagram accounts" ON public.organization_instagram_accounts;
CREATE POLICY "Users can view own org instagram accounts"
  ON public.organization_instagram_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_instagram_accounts.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org instagram accounts" ON public.organization_instagram_accounts;
CREATE POLICY "Users can insert own org instagram accounts"
  ON public.organization_instagram_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org instagram accounts" ON public.organization_instagram_accounts;
CREATE POLICY "Users can update own org instagram accounts"
  ON public.organization_instagram_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_instagram_accounts.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org instagram accounts" ON public.organization_instagram_accounts;
CREATE POLICY "Users can delete own org instagram accounts"
  ON public.organization_instagram_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_instagram_accounts.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can view own org instagram conversations" ON public.instagram_conversations;
CREATE POLICY "Users can view own org instagram conversations"
  ON public.instagram_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = instagram_conversations.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org instagram conversations" ON public.instagram_conversations;
CREATE POLICY "Users can insert own org instagram conversations"
  ON public.instagram_conversations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org instagram conversations" ON public.instagram_conversations;
CREATE POLICY "Users can update own org instagram conversations"
  ON public.instagram_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = instagram_conversations.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org instagram conversations" ON public.instagram_conversations;
CREATE POLICY "Users can delete own org instagram conversations"
  ON public.instagram_conversations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id = instagram_conversations.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can view own org instagram messages" ON public.instagram_messages;
CREATE POLICY "Users can view own org instagram messages"
  ON public.instagram_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM instagram_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = instagram_messages.conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org instagram messages" ON public.instagram_messages;
CREATE POLICY "Users can insert own org instagram messages"
  ON public.instagram_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM instagram_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org instagram messages" ON public.instagram_messages;
CREATE POLICY "Users can update own org instagram messages"
  ON public.instagram_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM instagram_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = (SELECT auth.uid())
      WHERE c.id = instagram_messages.conversation_id
    )
  );
