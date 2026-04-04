import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Edit, Trash2, Plus } from 'lucide-react';
import { useServiceRequiredPlatforms, ServiceRequiredPlatform } from '@/6-1-dashboard/hook/useServiceRequiredPlatforms';
import { ServiceRequiredPlatformsModal } from '../modal/ServiceRequiredPlatformsModal';
import { useSettingsServicesQuery } from '../hooks/useSettingsServicesQuery';

export const ContentSchedulingSection: React.FC = () => {
  const { data: services = [], isPending: servicesPending } = useSettingsServicesQuery();
  const {
    requiredPlatforms,
    isPending: platformsPending,
    canManage,
    deleteRequiredPlatform,
    toggleRequiredPlatformStatus,
    isToggling,
  } = useServiceRequiredPlatforms();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<ServiceRequiredPlatform | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Group required platforms by service (include both active and inactive)
  // Sort: active platforms first, then inactive, then by platform name
  const platformsByService = services.reduce((acc, service) => {
    const platforms = requiredPlatforms
      .filter(rp => rp.service_id === service.id)
      .sort((a, b) => {
        // Active platforms first
        if (a.is_active !== b.is_active) {
          return a.is_active ? -1 : 1;
        }
        // Then sort by platform name
        return a.platform.localeCompare(b.platform);
      });
    if (platforms.length > 0 || canManage) {
      acc[service.id] = platforms;
    }
    return acc;
  }, {} as Record<string, ServiceRequiredPlatform[]>);

  const handleAdd = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setEditingPlatform(null);
    setIsModalOpen(true);
  };

  const handleEdit = (platform: ServiceRequiredPlatform) => {
    setSelectedServiceId(platform.service_id);
    setEditingPlatform(platform);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this required platform?')) {
      deleteRequiredPlatform(id);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingPlatform(null);
    setSelectedServiceId(null);
  };

  const getPlatformDisplayName = (platform: ServiceRequiredPlatform): string => {
    if (platform.social_media_name) {
      return `${platform.platform} - ${platform.social_media_name.name}`;
    }
    return `${platform.platform} - ${platform.custom_platform_name || 'Custom'}`;
  };

  if (servicesPending || platformsPending) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Service Required Platforms</h3>
          <p className="text-sm text-muted-foreground">
            Configure required platforms for each service. Plans will only be marked as done when all required platforms have links filled.
          </p>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No services found. Please create services first.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {services.map((service) => {
            const platforms = platformsByService[service.id] || [];
            return (
              <div key={service.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-base">{service.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {platforms.filter(p => p.is_active).length} active required platform{platforms.filter(p => p.is_active).length !== 1 ? 's' : ''} 
                      {platforms.filter(p => !p.is_active).length > 0 && (
                        <span className="text-muted-foreground/70">
                          {' '}({platforms.filter(p => !p.is_active).length} inactive)
                        </span>
                      )}
                    </p>
                  </div>
                  {canManage && (
                    <Button
                      onClick={() => handleAdd(service.id)}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Platform
                    </Button>
                  )}
                </div>

                {platforms.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Social Media Name</TableHead>
                        <TableHead>Status</TableHead>
                        {canManage && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {platforms.map((platform) => (
                        <TableRow 
                          key={platform.id}
                          className={platform.is_active ? '' : 'opacity-60'}
                        >
                          <TableCell className="font-medium">
                            {platform.platform}
                          </TableCell>
                          <TableCell>
                            {platform.social_media_name ? (
                              <Badge variant="outline">
                                {platform.social_media_name.name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {platform.custom_platform_name || 'Custom'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {canManage ? (
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={platform.is_active}
                                  onCheckedChange={(checked) => {
                                    toggleRequiredPlatformStatus({
                                      id: platform.id,
                                      isActive: checked
                                    });
                                  }}
                                  disabled={isToggling}
                                />
                                <span className="text-sm text-muted-foreground">
                                  {platform.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            ) : (
                              <Badge variant={platform.is_active ? 'default' : 'secondary'}>
                                {platform.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            )}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex justify-end items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(platform)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(platform.id)}
                                  className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm">No required platforms configured for this service.</p>
                    {canManage && (
                      <Button
                        onClick={() => handleAdd(service.id)}
                        variant="outline"
                        size="sm"
                        className="mt-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Platform
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ServiceRequiredPlatformsModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        serviceId={selectedServiceId}
        editingPlatform={editingPlatform}
      />
    </div>
  );
};

