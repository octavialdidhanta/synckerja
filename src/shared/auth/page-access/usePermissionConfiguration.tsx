import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { supabase } from "@/shared/lib/supabaseClient";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { clearAccessCache } from "./departmentPageAccessCache";

export interface PermissionConfiguration {
  id: string;
  organization_id: string | null;
  page_path: string;
  page_title: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  roles_allowed?: string[];
  job_levels_allowed?: string[];
  exceptions?: string[];
  exception_paths?: string[];
}

const APP_CONFIG_CACHE = new Map<
  string,
  {
    data: PermissionConfiguration[];
    timestamp: number;
    organizationId: string | null;
  }
>();
const CACHE_TTL = 30000;
const CACHE_KEY_PREFIX = "perm_config_";

export type PermissionConfigurationContextValue = {
  configurations: PermissionConfiguration[];
  loading: boolean;
  /** True only on cold start (no rows yet for current org) — not on background refetch. */
  configBootstrapPending: boolean;
  createPermissionConfiguration: (
    config: Omit<PermissionConfiguration, "id" | "created_at" | "updated_at">
  ) => Promise<{ success: boolean; data?: PermissionConfiguration; error?: string }>;
  updatePermissionConfiguration: (
    id: string,
    updates: Partial<PermissionConfiguration>
  ) => Promise<{ success: boolean; data?: PermissionConfiguration | null; error?: string }>;
  deletePermissionConfiguration: (id: string) => Promise<{ success: boolean; error?: string }>;
  duplicatePermissionConfiguration: (id: string) => Promise<{ success: boolean; error?: string }>;
  debugPermissions: (pagePath: string, userRole: string) => void;
};

const PermissionConfigurationContext = createContext<PermissionConfigurationContextValue | null>(
  null
);

export function PermissionConfigurationProvider({ children }: { children: ReactNode }) {
  const { organization, loading: centralLoading, hasOrganization } = useCentralizedUserData();
  const { user, loading: authLoading } = useAuth();
  const identityStillResolving = authLoading || centralLoading;
  const [configurations, setConfigurations] = useState<PermissionConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const configurationsRef = useRef(configurations);
  configurationsRef.current = configurations;
  const lastHydratedOrgIdRef = useRef<string | null>(null);
  const prevOrgIdRef = useRef<string | undefined>(organization?.id);
  const prevUserIdRef = useRef<string | undefined>(user?.id);

  useLayoutEffect(() => {
    const orgId = organization?.id;
    const uid = user?.id;
    const cacheKey = `${CACHE_KEY_PREFIX}${orgId || "null"}`;
    const cached = APP_CONFIG_CACHE.get(cacheKey);

    if (cached && orgId && cached.organizationId === orgId) {
      if (configurationsRef.current.length === 0) {
        setConfigurations(cached.data);
      }
      setLoading(false);
      lastHydratedOrgIdRef.current = orgId;
      return;
    }

    if (!uid) {
      if (identityStillResolving) {
        return;
      }
      lastHydratedOrgIdRef.current = null;
      setConfigurations([]);
      setLoading(false);
      return;
    }

    if (!orgId) {
      if (identityStillResolving || hasOrganization) {
        return;
      }
      setConfigurations([]);
      setLoading(false);
      return;
    }

    if (lastHydratedOrgIdRef.current === orgId) {
      const data = configurationsRef.current;
      APP_CONFIG_CACHE.set(cacheKey, {
        data,
        timestamp: Date.now(),
        organizationId: orgId,
      });
      setLoading(false);
      return;
    }

    const snapshot = configurationsRef.current;
    if (snapshot.length > 0 && snapshot.every((c) => c.organization_id === orgId)) {
      lastHydratedOrgIdRef.current = orgId;
      APP_CONFIG_CACHE.set(cacheKey, {
        data: snapshot,
        timestamp: Date.now(),
        organizationId: orgId,
      });
      setLoading(false);
      return;
    }

    if (cached && orgId && cached.organizationId === orgId && cached.data.length > 0) {
      if (configurationsRef.current.length === 0) {
        setConfigurations(cached.data);
      }
      setLoading(false);
      lastHydratedOrgIdRef.current = orgId;
      return;
    }

    setLoading(true);
  }, [organization?.id, user?.id, authLoading, centralLoading, hasOrganization]);

  useEffect(() => {
    const fetchConfigurations = async () => {
      const cacheKey = `${CACHE_KEY_PREFIX}${organization?.id || "null"}`;
      const cached = APP_CONFIG_CACHE.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setConfigurations(cached.data);
        setLoading(false);
        if (organization?.id) {
          lastHydratedOrgIdRef.current = organization.id;
        }
        return;
      }
      if (!organization?.id) {
        if (identityStillResolving || hasOrganization) {
          return;
        }
        setConfigurations([]);
        setLoading(false);
        return;
      }

      try {
        const staleEntry = APP_CONFIG_CACHE.get(cacheKey);
        const hasStaleForOrg =
          !!staleEntry && !!organization.id && staleEntry.organizationId === organization.id;
        if (configurationsRef.current.length === 0 && !hasStaleForOrg) {
          setLoading(true);
        }

        const { data: fetchedConfigs, error } = await supabase
          .from("permission_configurations")
          .select("*")
          .eq("organization_id", organization.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("Permission configurations table error:", error.message);
          const emptyConfigs: PermissionConfiguration[] = [];
          setConfigurations(emptyConfigs);
          APP_CONFIG_CACHE.set(cacheKey, {
            data: emptyConfigs,
            timestamp: Date.now(),
            organizationId: organization.id,
          });
        } else {
          const configs = (fetchedConfigs || []) as PermissionConfiguration[];
          const mergedByPath = new Map<string, PermissionConfiguration>();
          for (const cfg of configs) {
            const existing = mergedByPath.get(cfg.page_path);
            if (!existing || new Date(cfg.updated_at) > new Date(existing.updated_at)) {
              mergedByPath.set(cfg.page_path, cfg);
            }
          }
          const resolvedConfigs = Array.from(mergedByPath.values());
          setConfigurations(resolvedConfigs);
          APP_CONFIG_CACHE.set(cacheKey, {
            data: resolvedConfigs,
            timestamp: Date.now(),
            organizationId: organization.id,
          });
        }
      } catch (e) {
        console.error("Error fetching permission configurations:", e);
        setConfigurations([]);
      } finally {
        setLoading(false);
        if (organization?.id) {
          lastHydratedOrgIdRef.current = organization.id;
        }
      }
    };

    const orgIdChanged = prevOrgIdRef.current !== organization?.id;
    if (orgIdChanged) {
      lastHydratedOrgIdRef.current = null;
    }
    prevOrgIdRef.current = organization?.id;
    prevUserIdRef.current = user?.id;

    void fetchConfigurations();
  }, [organization?.id, user?.id, identityStillResolving, hasOrganization]);

  const createPermissionConfiguration = useCallback(
    async (config: Omit<PermissionConfiguration, "id" | "created_at" | "updated_at">) => {
      try {
        if (!organization?.id) {
          throw new Error("No organization found");
        }

        const newConfig = {
          ...config,
          organization_id: organization.id,
          created_by: user?.id || null,
        };

        const { data, error } = await supabase
          .from("permission_configurations")
          .insert([newConfig])
          .select()
          .single();

        if (error) {
          console.error("Database save failed:", error);
          return { success: false, error: error.message };
        }

        clearAccessCache();
        setConfigurations((prev) => [...prev, data as PermissionConfiguration]);
        return { success: true, data: data as PermissionConfiguration };
      } catch (error) {
        console.error("Error creating permission configuration:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [organization?.id, user?.id]
  );

  const updatePermissionConfiguration = useCallback(
    async (id: string, updates: Partial<PermissionConfiguration>) => {
      try {
        if (!organization?.id) {
          return { success: false, error: "No organization found" };
        }

        const row = configurationsRef.current.find((c) => c.id === id);
        if (!row) {
          return { success: false, error: "Configuration not found" };
        }

        if (
          row.organization_id !== null &&
          row.organization_id !== organization.id
        ) {
          return { success: false, error: "Cannot edit another organization's configuration" };
        }

        const patch = {
          ...updates,
          updated_at: new Date().toISOString(),
        };

        // System defaults (`organization_id` NULL) are read-only under RLS. Toggles must create
        // or update an org-scoped row for the same `page_path` (see migrations: unique per org+path).
        if (row.organization_id === null) {
          const { data: orgRow, error: orgLookupError } = await supabase
            .from("permission_configurations")
            .select("*")
            .eq("organization_id", organization.id)
            .eq("page_path", row.page_path)
            .maybeSingle();

          if (orgLookupError) {
            console.error("permission_configurations org lookup:", orgLookupError);
            return { success: false, error: orgLookupError.message };
          }

          if (orgRow) {
            const { data, error } = await supabase
              .from("permission_configurations")
              .update(patch)
              .eq("id", orgRow.id)
              .eq("organization_id", organization.id)
              .select()
              .single();

            if (error) {
              return { success: false, error: error.message };
            }
            clearAccessCache();
            setConfigurations((prev) =>
              prev.map((c) =>
                c.page_path === row.page_path ? (data as PermissionConfiguration) : c,
              ),
            );
            APP_CONFIG_CACHE.delete(`${CACHE_KEY_PREFIX}${organization.id}`);
            return { success: true, data: data as PermissionConfiguration };
          }

          const insertPayload = {
            organization_id: organization.id,
            page_path: row.page_path,
            page_title: patch.page_title ?? row.page_title,
            is_active: patch.is_active ?? row.is_active,
            roles_allowed: patch.roles_allowed ?? row.roles_allowed ?? [],
            job_levels_allowed: patch.job_levels_allowed ?? row.job_levels_allowed ?? [],
            exceptions: patch.exceptions ?? row.exceptions ?? [],
            exception_paths: patch.exception_paths ?? row.exception_paths ?? [],
            created_by: user?.id ?? null,
          };

          const { data: inserted, error: insertError } = await supabase
            .from("permission_configurations")
            .insert([insertPayload])
            .select()
            .single();

          if (insertError) {
            return { success: false, error: insertError.message };
          }
          clearAccessCache();
          setConfigurations((prev) =>
            prev.map((c) =>
              c.page_path === row.page_path ? (inserted as PermissionConfiguration) : c,
            ),
          );
          APP_CONFIG_CACHE.delete(`${CACHE_KEY_PREFIX}${organization.id}`);
          return { success: true, data: inserted as PermissionConfiguration };
        }

        const { data, error } = await supabase
          .from("permission_configurations")
          .update(patch)
          .eq("id", id)
          .eq("organization_id", organization.id)
          .select()
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        clearAccessCache();
        setConfigurations((prev) =>
          prev.map((c) => (c.id === id ? (data as PermissionConfiguration) : c)),
        );
        APP_CONFIG_CACHE.delete(`${CACHE_KEY_PREFIX}${organization.id}`);
        return { success: true, data: data as PermissionConfiguration };
      } catch (error) {
        console.error("Error updating permission configuration:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [organization?.id, user?.id]
  );

  const deletePermissionConfiguration = useCallback(
    async (id: string) => {
      try {
        if (!organization?.id) {
          throw new Error("No organization found");
        }

        const { error } = await supabase
          .from("permission_configurations")
          .delete()
          .eq("id", id)
          .eq("organization_id", organization.id);

        if (error) {
          console.warn("Could not delete from database, removing from local state:", error.message);
        }

        clearAccessCache();
        setConfigurations((prev) => prev.filter((c) => c.id !== id));
        return { success: true };
      } catch (error) {
        console.error("Error deleting permission configuration:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [organization?.id]
  );

  const duplicatePermissionConfiguration = useCallback(
    async (id: string) => {
      try {
        const originalConfig = configurations.find((c) => c.id === id);
        if (!originalConfig) {
          throw new Error("Configuration not found");
        }

        const duplicatedConfig = {
          page_path: `${originalConfig.page_path}-copy`,
          page_title: `${originalConfig.page_title} (Copy)`,
          roles_allowed: originalConfig.roles_allowed,
          exceptions: originalConfig.exceptions,
          exception_paths: originalConfig.exception_paths,
          is_active: originalConfig.is_active,
          organization_id: organization?.id || null,
        };

        const result = await createPermissionConfiguration(duplicatedConfig);
        if (result.success) {
          clearAccessCache();
        }
        return result;
      } catch (error) {
        console.error("Error duplicating permission configuration:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [configurations, organization?.id, createPermissionConfiguration]
  );

  const debugPermissions = useCallback(
    (pagePath: string, userRole: string) => {
      console.group(`Debug Permissions for ${pagePath}`);
      console.log("Current configurations:", configurations);
      console.log("User role:", userRole);
      console.log("Organization ID:", organization?.id);

      const normalize = (p?: string) => {
        if (!p) return "/";
        let s = p.trim();
        if (!s.startsWith("/")) s = "/" + s;
        if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
        return s.toLowerCase();
      };

      const matchingConfigs = configurations
        .filter((c) => {
          const base = normalize(c.page_path);
          const current = normalize(pagePath);
          return current === base || current.startsWith(base + "/");
        })
        .sort((a, b) => normalize(b.page_path).length - normalize(a.page_path).length);

      console.log("Matching configurations:", matchingConfigs);

      const prioritizedConfig = matchingConfigs[0];
      console.log("Prioritized configuration:", prioritizedConfig);

      if (prioritizedConfig) {
        console.log("Roles allowed:", prioritizedConfig.roles_allowed);
        console.log(
          "User has access:",
          (prioritizedConfig.roles_allowed || []).includes(userRole)
        );
      }

      console.groupEnd();
    },
    [configurations, organization?.id]
  );

  const configBootstrapPending = useMemo(
    () => loading && configurations.length === 0,
    [loading, configurations.length],
  );

  const value = useMemo(
    () => ({
      configurations,
      loading,
      configBootstrapPending,
      createPermissionConfiguration,
      updatePermissionConfiguration,
      deletePermissionConfiguration,
      duplicatePermissionConfiguration,
      debugPermissions,
    }),
    [
      configurations,
      loading,
      configBootstrapPending,
      createPermissionConfiguration,
      updatePermissionConfiguration,
      deletePermissionConfiguration,
      duplicatePermissionConfiguration,
      debugPermissions,
    ]
  );

  return (
    <PermissionConfigurationContext.Provider value={value}>
      {children}
    </PermissionConfigurationContext.Provider>
  );
}

export function usePermissionConfiguration(): PermissionConfigurationContextValue {
  const ctx = useContext(PermissionConfigurationContext);
  if (!ctx) {
    throw new Error(
      "usePermissionConfiguration must be used within PermissionConfigurationProvider"
    );
  }
  return ctx;
}
