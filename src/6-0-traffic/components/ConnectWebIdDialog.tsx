import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useToast } from "@/shared/components/ui/use-toast";
import { supabase } from "@/shared/lib/supabaseClient";

const ALLOWED_WEB_IDS = ["synckerja", "vialdi", "vialdi-wedding"] as const;

export function ConnectWebIdDialog({
  open,
  onOpenChange,
  organizationId,
  existingWebIds,
  onConnected,
  onRequestSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null | undefined;
  existingWebIds: string[];
  onConnected: (webId: string) => void;
  onRequestSubmitted?: () => void;
}) {
  const { toast } = useToast();
  const [webIdInput, setWebIdInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const normalized = webIdInput.trim().toLowerCase();
  const isAlreadyConnected = useMemo(
    () => existingWebIds.some((w) => w.toLowerCase() === normalized),
    [existingWebIds, normalized],
  );
  const isAllowed = useMemo(
    () => ALLOWED_WEB_IDS.includes(normalized as (typeof ALLOWED_WEB_IDS)[number]),
    [normalized],
  );

  async function handleConnect() {
    if (!organizationId) {
      toast({
        title: "Organization required",
        description: "Pilih active organization dulu sebelum connect web_id.",
        variant: "destructive",
      });
      return;
    }
    if (!normalized) return;
    if (!isAllowed) {
      toast({
        title: "Invalid web_id",
        description: `web_id harus salah satu dari: ${ALLOWED_WEB_IDS.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    if (isAlreadyConnected) {
      toast({
        title: "Already connected",
        description: "web_id ini sudah terhubung.",
      });
      onConnected(normalized);
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("analytics_web_access").insert({
      organization_id: organizationId,
      web_id: normalized,
      is_approved: false,
    });
    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Request already exists",
          description: "Request web_id ini sudah ada dan menunggu approval.",
        });
        onRequestSubmitted?.();
        setWebIdInput("");
        onOpenChange(false);
        return;
      }
      toast({
        title: "Connect failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request submitted",
      description: `web_id "${normalized}" menunggu approval sebelum bisa dipakai.`,
    });
    onRequestSubmitted?.();
    setWebIdInput("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect web_id</DialogTitle>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="webId">web_id</Label>
          <Input
            id="webId"
            value={webIdInput}
            onChange={(e) => setWebIdInput(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={submitting || !normalized}>
            {submitting ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

