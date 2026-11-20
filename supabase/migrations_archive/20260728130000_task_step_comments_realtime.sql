-- Enable Supabase Realtime for step comment tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_step_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_step_comment_reactions;
