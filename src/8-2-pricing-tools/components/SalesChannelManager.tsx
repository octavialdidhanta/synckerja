import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Plus, Trash2, ShoppingCart, Store, Upload } from 'lucide-react';
import { Separator } from '@/shared/components/ui/separator';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { SalesChannel } from '../types/pricingTypes';
import { useSalesChannels } from '../hooks/useSalesChannels';

interface SalesChannelManagerProps {
  onChannelsChange: (channels: SalesChannel[]) => void;
  initialChannels?: SalesChannel[];
}

const DEFAULT_CHANNELS: SalesChannel[] = [
  {
    id: 'tokopedia',
    name: 'Tokopedia',
    type: 'online',
    commissionPercent: 1.5,
    paymentFeePercent: 0.7,
    adSpendPercent: 1,
    otherFeePercent: 0,
    totalFeePercent: 3.2,
    isActive: true,
    isDefault: true,
  },
  {
    id: 'shopee',
    name: 'Shopee',
    type: 'online',
    commissionPercent: 1.5,
    paymentFeePercent: 0.7,
    adSpendPercent: 1.5,
    otherFeePercent: 0,
    totalFeePercent: 3.7,
    isActive: true,
    isDefault: true,
  },
  {
    id: 'bukalapak',
    name: 'Bukalapak',
    type: 'online',
    commissionPercent: 1.5,
    paymentFeePercent: 0.7,
    adSpendPercent: 1,
    otherFeePercent: 0,
    totalFeePercent: 3.2,
    isActive: false,
    isDefault: true,
  },
  {
    id: 'offline-store',
    name: 'Offline Store',
    type: 'offline',
    commissionPercent: 0,
    paymentFeePercent: 0,
    adSpendPercent: 0,
    otherFeePercent: 5,
    totalFeePercent: 5,
    isActive: true,
    isDefault: true,
  },
];

export const SalesChannelManager = ({ onChannelsChange, initialChannels }: SalesChannelManagerProps) => {
  const [channels, setChannels] = useState<SalesChannel[]>(() => {
    return initialChannels || DEFAULT_CHANNELS;
  });
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'online' | 'offline'>('online');
  const { channels: savedChannels, isLoading: loadingChannels, saveMultipleChannels, isSavingMultiple } = useSalesChannels();

  // Template data takes priority over saved channels
  useEffect(() => {
    if (initialChannels && initialChannels.length > 0) {
      setChannels(initialChannels);
      return;
    }
    
    // Fallback to database
    if (savedChannels && savedChannels.length > 0) {
      // Merge default channels with saved channels (saved channels override defaults with same name)
      const merged: SalesChannel[] = [];
      const savedNames = new Set(savedChannels.map(c => c.name.toLowerCase()));
      
      // Add saved channels first
      savedChannels.forEach(ch => merged.push(ch));
      
      // Add default channels that don't have saved versions
      DEFAULT_CHANNELS.forEach(defaultCh => {
        if (!savedNames.has(defaultCh.name.toLowerCase())) {
          merged.push(defaultCh);
        }
      });
      
      setChannels(merged);
    } else if (savedChannels && savedChannels.length === 0 && !loadingChannels) {
      // If no saved channels, use defaults
      setChannels(DEFAULT_CHANNELS);
    }
  }, [initialChannels, savedChannels, loadingChannels]);

  useEffect(() => {
    onChannelsChange(channels);
  }, [channels, onChannelsChange]);

  const updateChannel = (id: string, field: keyof SalesChannel, value: any) => {
    setChannels(channels.map(channel => {
      if (channel.id === id) {
        const updated = { ...channel, [field]: value };
        
        // Recalculate totalFeePercent
        if (['commissionPercent', 'paymentFeePercent', 'adSpendPercent', 'otherFeePercent'].includes(field)) {
          updated.totalFeePercent = 
            (updated.commissionPercent || 0) +
            (updated.paymentFeePercent || 0) +
            (updated.adSpendPercent || 0) +
            (updated.otherFeePercent || 0);
        }
        
        return updated;
      }
      return channel;
    }));
  };

  const addCustomChannel = () => {
    if (!newChannelName.trim()) return;
    
    const newChannel: SalesChannel = {
      id: `custom-${Date.now()}`,
      name: newChannelName.trim(),
      type: newChannelType,
      commissionPercent: newChannelType === 'online' ? 1.5 : 0,
      paymentFeePercent: newChannelType === 'online' ? 0.7 : 0,
      adSpendPercent: newChannelType === 'online' ? 1 : 0,
      otherFeePercent: newChannelType === 'offline' ? 5 : 0,
      totalFeePercent: newChannelType === 'online' ? 3.2 : 5,
      isActive: true,
      isDefault: false,
    };
    
    setChannels([...channels, newChannel]);
    setNewChannelName('');
  };

  const removeChannel = (id: string) => {
    // Jangan hapus default channels, hanya nonaktifkan
    const channel = channels.find(c => c.id === id);
    if (channel && channel.isDefault) {
      updateChannel(id, 'isActive', false);
    } else {
      setChannels(channels.filter(c => c.id !== id));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingCart className="h-5 w-5 text-primary" />
          Sales Channels
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Custom Channel */}
        <div className="flex gap-2">
          <Input
            placeholder="Nama channel (e.g., Lazada, Instagram Shop)"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomChannel();
              }
            }}
            className="flex-1"
          />
          <Select value={newChannelType} onValueChange={(value: 'online' | 'offline') => setNewChannelType(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addCustomChannel} size="sm" variant="outline" disabled={!newChannelName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Tambah
          </Button>
        </div>

        {/* Save Channels Button */}
        {channels.length > 0 && (
          <Button
            onClick={async () => {
              // Save only non-default, active channels
              const channelsToSave = channels.filter(
                ch => !ch.isDefault && ch.isActive
              );
              if (channelsToSave.length > 0) {
                try {
                  await saveMultipleChannels(channelsToSave);
                } catch {
                  // Error shown via mutation onError toast
                }
              }
            }}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isSavingMultiple || channels.filter(ch => !ch.isDefault && ch.isActive).length === 0}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isSavingMultiple ? 'Saving...' : 'Save Channels'}
          </Button>
        )}

        {/* Channel List */}
        <div className="space-y-3">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`p-4 border rounded-lg space-y-3 transition-all ${
                channel.isActive ? 'border-border bg-card' : 'border-border bg-muted/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {channel.type === 'online' ? (
                    <ShoppingCart className="h-4 w-4 text-brand-blue" />
                  ) : (
                    <Store className="h-4 w-4 text-primary" />
                  )}
                  <span className="font-medium">{channel.name}</span>
                  <Badge variant={channel.type === 'online' ? 'default' : 'secondary'} className="text-xs">
                    {channel.type === 'online' ? 'Online' : 'Offline'}
                  </Badge>
                  {channel.isDefault && (
                    <Badge variant="outline" className="text-xs">
                      Default
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={channel.isActive}
                    onCheckedChange={(checked) => updateChannel(channel.id, 'isActive', checked as boolean)}
                  />
                  {!channel.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChannel(channel.id)}
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {channel.isActive && (
                <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
                  {channel.type === 'online' && (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">Commission (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={channel.commissionPercent || ''}
                          onChange={(e) => updateChannel(channel.id, 'commissionPercent', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm mt-1"
                          min="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Payment Fee (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={channel.paymentFeePercent || ''}
                          onChange={(e) => updateChannel(channel.id, 'paymentFeePercent', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm mt-1"
                          min="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Ad Spend (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={channel.adSpendPercent || ''}
                          onChange={(e) => updateChannel(channel.id, 'adSpendPercent', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm mt-1"
                          min="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Other Fee (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={channel.otherFeePercent || ''}
                          onChange={(e) => updateChannel(channel.id, 'otherFeePercent', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm mt-1"
                          min="0"
                        />
                      </div>
                    </>
                  )}
                  
                  {channel.type === 'offline' && (
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Other Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={channel.otherFeePercent || ''}
                        onChange={(e) => updateChannel(channel.id, 'otherFeePercent', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm mt-1"
                        min="0"
                      />
                    </div>
                  )}

                  <div className="col-span-2 pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">Total Fee:</span>
                      <Badge variant="secondary" className="text-sm font-bold">
                        {channel.totalFeePercent.toFixed(2)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {channels.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm">No channels added yet. Click "Tambah" to add a channel.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

