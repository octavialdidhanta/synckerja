import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useOrganizationOmnichannelStaff } from "@/shared/hooks/useOrganizationOmnichannelStaff";
import { devLog } from "@/shared/lib/logger";

export type OmnichannelStaffPresencePayload = {
  user_id: string;
  employee_id: string;
  full_name: string;
  online_at: string;
};

export type PresenceByUserId = Record<string, OmnichannelStaffPresencePayload>;

const PRESENCE_HEARTBEAT_MS = 45_000;
const PRESENCE_FRESH_MS = 3 * 60_000;

type OmnichannelStaffPresenceContextValue = {
  presenceByUserId: PresenceByUserId;
  isUserOnline: (userId: string | null | undefined) => boolean;
  isConnected: boolean;
};

const OmnichannelStaffPresenceContext = createContext<OmnichannelStaffPresenceContextValue>({
  presenceByUserId: {},
  isUserOnline: () => false,
  isConnected: false,
});

function parsePresenceState(
  state: Record<string, OmnichannelStaffPresencePayload[]>,
): PresenceByUserId {
  const map: PresenceByUserId = {};
  for (const presences of Object.values(state)) {
    for (const p of presences) {
      if (p?.user_id) map[p.user_id] = p;
    }
  }
  return map;
}

function OmnichannelStaffPresenceProviderInner({ children }: { children: ReactNode }) {
  const { organizationId } = useCurrentOrg();
  const { employee } = useCentralizedUserData();
  const { data: roster = [] } = useOrganizationOmnichannelStaff();

  const [presenceByUserId, setPresenceByUserId] = useState<PresenceByUserId>({});
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const rosterEntry = useMemo(() => {
    if (!employee?.id) return null;
    return roster.find((r) => r.employee_id === employee.id) ?? null;
  }, [employee?.id, roster]);

  const canTrack = Boolean(
    organizationId &&
      employee?.id &&
      rosterEntry &&
      rosterEntry.employees?.user_id,
  );

  const trackPayload = useMemo((): OmnichannelStaffPresencePayload | null => {
    const userId = rosterEntry?.employees?.user_id;
    if (!canTrack || !userId || !employee) return null;
    return {
      user_id: userId,
      employee_id: employee.id,
      full_name: rosterEntry?.employees?.full_name ?? employee.full_name ?? "",
      online_at: new Date().toISOString(),
    };
  }, [canTrack, rosterEntry, employee]);

  useEffect(() => {
    if (!organizationId) {
      setPresenceByUserId({});
      setIsConnected(false);
      return;
    }

    const channelName = `omnichannel-staff-presence:${organizationId}`;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState() as Record<string, OmnichannelStaffPresencePayload[]>;
      setPresenceByUserId(parsePresenceState(state));
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe(async (status) => {
        devLog.debug("Omnichannel staff presence status:", status);
        setIsConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED" && trackPayload) {
          await channel.track({
            ...trackPayload,
            online_at: new Date().toISOString(),
          });
        }
        syncPresence();
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      setPresenceByUserId({});
    };
  }, [organizationId]);

  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !isConnected) return;
    if (trackPayload) {
      void ch.track({ ...trackPayload, online_at: new Date().toISOString() });
    } else {
      void ch.untrack();
    }
  }, [trackPayload, isConnected]);

  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !isConnected || !trackPayload) return;

    const id = window.setInterval(() => {
      void ch.track({ ...trackPayload, online_at: new Date().toISOString() });
    }, PRESENCE_HEARTBEAT_MS);

    return () => window.clearInterval(id);
  }, [isConnected, trackPayload]);

  const isUserOnline = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return false;
      const p = presenceByUserId[userId];
      if (!p) return false;

      const ts = new Date(p.online_at).getTime();
      if (!Number.isFinite(ts) || ts <= 0) return true;

      return Date.now() - ts <= PRESENCE_FRESH_MS;
    },
    [presenceByUserId],
  );

  const value = useMemo(
    () => ({ presenceByUserId, isUserOnline, isConnected }),
    [presenceByUserId, isUserOnline, isConnected],
  );

  return (
    <OmnichannelStaffPresenceContext.Provider value={value}>
      {children}
    </OmnichannelStaffPresenceContext.Provider>
  );
}

/** Shared omnichannel presence (subscribe + track while logged in + active org + on roster). */
export function OmnichannelStaffPresenceProvider({ children }: { children: ReactNode }) {
  return <OmnichannelStaffPresenceProviderInner>{children}</OmnichannelStaffPresenceProviderInner>;
}

export function useOmnichannelStaffPresence() {
  return useContext(OmnichannelStaffPresenceContext);
}

/** Tracking is handled inside `OmnichannelStaffPresenceProvider` via pathname. */
export function useOmnichannelStaffPresenceTracker() {
  // no-op — mount `OmnichannelStaffPresenceProvider` in app shell
}
