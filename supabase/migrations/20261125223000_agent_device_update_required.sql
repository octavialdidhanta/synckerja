-- The Office Agent page reads this flag. agent-api sets it on heartbeat when the
-- reported version is below AGENT_MIN_VERSION. The floor stays 0.0.0 until a
-- self-updating release is installed, so existing rows stay false.

ALTER TABLE public.agent_devices
  ADD COLUMN update_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agent_devices.update_required IS
  'True when the last heartbeat was older than the Agent floor. Footage and render calls are refused until the laptop installs a new enough release.';
