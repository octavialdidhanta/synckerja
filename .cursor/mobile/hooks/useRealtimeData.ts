import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/config/logger';
import { useToast } from '@/mobile/components/ui/use-toast';

interface RealtimeConfig {
  table: string;
  filter?: {
    column: string;
    eq?: string | number;
    in?: (string | number)[];
  };
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

export const useRealtimeData = (configs: RealtimeConfig[]) => {
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  // Memoize configurations by primitive deps (table + filter) so effect only re-runs when these change.
  // Store latest configs in a ref so channel callbacks always see current handlers without re-subscribing.
  const configDeps = configs.map(c => `${c.table}:${c.filter?.column ?? ''}:${c.filter?.eq ?? ''}:${(c.filter?.in ?? []).join(',')}`).join('|');
  const configsRef = useRef<RealtimeConfig[]>(configs);
  configsRef.current = configs;

  const stableConfigsForEffect = useMemo(() => {
    return configs.map(config => ({
      table: config.table,
      filter: config.filter,
      // Callbacks are read from configsRef.current in the effect
    }));
  }, [configDeps]);

  // Stable error handler
  const handleError = useCallback((table: string, error: any) => {
    logger.error(`Error handling realtime event for ${table}:`, error);
    toast({
      title: "Real-time Error",
      description: `Failed to process update for ${table}`,
      variant: "destructive"
    });
  }, [toast]);

  // Stable connection error handler (debug only; realtime is optional - app works with initial fetch + refetch)
  const handleConnectionError = useCallback((table: string) => {
    logger.debug(
      `Real-time connection failed for ${table}. ` +
      'Ensure the table is in the Supabase Realtime publication if you need live updates.'
    );
  }, []);

  useEffect(() => {
    const currentConfigs = configsRef.current;
    if (!currentConfigs.length) return;

    logger.realtime('Setting up realtime channels for tables:', stableConfigsForEffect.map(c => c.table));

    const channels = stableConfigsForEffect.map((config, index) => {
      const channelName = `realtime-${config.table}-${index}-${Date.now()}`;
      logger.realtime(`Setting up realtime for table: ${config.table}`);
      
      let channelBuilder = supabase.channel(channelName);

      const changeConfig: any = {
        event: '*',
        schema: 'public',
        table: config.table
      };

      if (config.filter) {
        if (config.filter.eq !== undefined && config.filter.eq !== null && config.filter.eq !== 'null' && config.filter.eq !== '') {
          changeConfig.filter = `${config.filter.column}=eq.${config.filter.eq}`;
        } else if (config.filter.in && config.filter.in.length > 0) {
          const validValues = config.filter.in.filter(val => val !== null && val !== 'null' && val !== '' && val !== undefined);
          if (validValues.length > 0) {
            changeConfig.filter = `${config.filter.column}=in.(${validValues.join(',')})`;
          }
        }
      }

      const fullConfig = currentConfigs[index];
      if (!fullConfig) return channelBuilder.subscribe(() => {});

      channelBuilder = channelBuilder.on('postgres_changes', changeConfig, (payload) => {
        const latest = configsRef.current[index];
        if (!latest) return;
        logger.realtime(`Realtime event for ${latest.table}:`, payload);
        try {
          switch (payload.eventType) {
            case 'INSERT':
              latest.onInsert?.(payload);
              break;
            case 'UPDATE':
              latest.onUpdate?.(payload);
              break;
            case 'DELETE':
              latest.onDelete?.(payload);
              break;
          }
        } catch (error) {
          handleError(latest.table, error);
        }
      });

      return channelBuilder.subscribe((status) => {
        logger.realtime(`Realtime status for ${config.table}:`, status);
        setIsConnected(status === 'SUBSCRIBED');

        if (status === 'SUBSCRIBED') {
          logger.realtime(`Real-time connected for ${config.table}`);
        } else if (status === 'CHANNEL_ERROR') {
          handleConnectionError(config.table);
        }
      });
    });

    return () => {
      logger.realtime('Cleaning up realtime channels');
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      setIsConnected(false);
    };
  }, [stableConfigsForEffect, handleError, handleConnectionError]);

  return { isConnected };
};

// Hook khusus untuk attendance data
export const useRealtimeAttendance = (organizationId: string, onDataChange?: () => void) => {
  const stableOnDataChange = useCallback(() => {
    onDataChange?.();
  }, [onDataChange]);

  // Validasi organizationId untuk mencegah error realtime
  const isValidUUID = organizationId && 
    typeof organizationId === 'string' &&
    organizationId !== 'null' && 
    organizationId !== 'undefined' && 
    organizationId !== 'skip' &&
    organizationId !== '' &&
    organizationId.length > 0 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId);

  const configs = useMemo(() => {
    if (!isValidUUID) {
      // Only warn for actual invalid UUIDs, not placeholder values
      if (organizationId && organizationId !== 'skip' && organizationId !== 'null' && organizationId !== 'undefined') {
        logger.warn('Invalid organizationId for realtime attendance:', organizationId);
      }
      return [];
    }
    
    return [
    {
      table: 'attendance_records',
      filter: { column: 'organization_id', eq: organizationId },
      onInsert: (payload: any) => {
        logger.realtime('New attendance record:', payload.new);
        stableOnDataChange();
      },
      onUpdate: (payload: any) => {
        logger.realtime('Updated attendance record:', payload.new);
        stableOnDataChange();
      },
      onDelete: (payload: any) => {
        logger.realtime('Deleted attendance record:', payload.old);
        stableOnDataChange();
      }
    },
    {
      table: 'attendance_penalties',
      filter: { column: 'organization_id', eq: organizationId },
      onInsert: (payload: any) => {
        logger.realtime('New penalty:', payload.new);
        stableOnDataChange();
      },
      onUpdate: (payload: any) => {
        logger.realtime('Updated penalty:', payload.new);
        stableOnDataChange();
      },
      onDelete: (payload: any) => {
        logger.realtime('Deleted penalty:', payload.old);
        stableOnDataChange();
      }
    }
    ];
  }, [organizationId, stableOnDataChange, isValidUUID]);

  return useRealtimeData(configs);
};

// Hook khusus untuk employee data
export const useRealtimeEmployees = (organizationId: string, onDataChange?: () => void) => {
  const stableOnDataChange = useCallback(() => {
    onDataChange?.();
  }, [onDataChange]);

  // Validasi organizationId untuk mencegah error realtime
  const isValidUUID = organizationId && 
    typeof organizationId === 'string' &&
    organizationId !== 'null' && 
    organizationId !== 'undefined' && 
    organizationId !== 'skip' &&
    organizationId !== '' &&
    organizationId.length > 0 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId);

  const configs = useMemo(() => {
    if (!isValidUUID) {
      // Only warn for actual invalid UUIDs, not placeholder values
      if (organizationId && organizationId !== 'skip' && organizationId !== 'null' && organizationId !== 'undefined') {
        logger.warn('Invalid organizationId for realtime employees:', organizationId);
      }
      return [];
    }
    
    return [
    {
      table: 'employees',
      filter: { column: 'organization_id', eq: organizationId },
      onInsert: (payload: any) => {
        logger.realtime('New employee:', payload.new);
        stableOnDataChange();
      },
      onUpdate: (payload: any) => {
        logger.realtime('Updated employee:', payload.new);
        stableOnDataChange();
      },
      onDelete: (payload: any) => {
        logger.realtime('Deleted employee:', payload.old);
        stableOnDataChange();
      }
    }
    ];
  }, [organizationId, stableOnDataChange, isValidUUID]);

  return useRealtimeData(configs);
};

// Hook khusus untuk organization data
export const useRealtimeOrganization = (organizationId: string, onDataChange?: () => void) => {
  const stableOnDataChange = useCallback(() => {
    onDataChange?.();
  }, [onDataChange]);

  // Validasi organizationId untuk mencegah error realtime
  const isValidUUID = organizationId && 
    typeof organizationId === 'string' &&
    organizationId !== 'null' && 
    organizationId !== 'undefined' && 
    organizationId !== 'skip' &&
    organizationId !== '' &&
    organizationId.length > 0 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId);

  const configs = useMemo(() => {
    if (!isValidUUID) {
      // Only warn for actual invalid UUIDs, not placeholder values
      if (organizationId && organizationId !== 'skip' && organizationId !== 'null' && organizationId !== 'undefined') {
        logger.warn('Invalid organizationId for realtime organization:', organizationId);
      }
      return [];
    }
    
    return [
    {
      table: 'organizations',
      filter: { column: 'id', eq: organizationId },
      onUpdate: (payload: any) => {
        logger.realtime('Updated organization:', payload.new);
        stableOnDataChange();
      }
    },
    {
      table: 'profiles',
      filter: { column: 'active_organization_id', eq: organizationId },
      onUpdate: (payload: any) => {
        logger.realtime('Updated profile:', payload.new);
        stableOnDataChange();
      }
    }
    ];
  }, [organizationId, stableOnDataChange, isValidUUID]);

  return useRealtimeData(configs);
};