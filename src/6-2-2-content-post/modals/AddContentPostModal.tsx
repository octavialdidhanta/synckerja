import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import type { CreateContentPostWithPaymentPayload } from "@/shared/types/content-post";
import {
  KOL_CONTENT_PLATFORM_OPTIONS,
  KOL_CONTENT_TYPE_OPTIONS,
  kolContentPlatformSchema,
  kolContentTypeSchema,
} from "@/shared/constants/kolContentPostOptions";
import { useKOLRates } from "@/6-2-1-dashboard/kol-management/hooks/useKOLProfiles";
import {
  formatIdrThousandsFromDigits,
  idrDigitsOnly,
  parseIdrInputToNumber,
} from "@/shared/lib/idrInputFormat";
import { Award, DollarSign, Handshake, Plus, Target, Trash2 } from "lucide-react";
import {
  getThresholdFieldHint,
  getThresholdFieldLabel,
} from "@/6-2-1-dashboard/kol-management/utils/campaignTargets";

const milestoneSchema = z.object({
  milestone_name: z.string().min(1, "Milestone name is required"),
  payment_percentage: z
    .number()
    .min(0.01, "Percentage must be greater than 0")
    .max(100, "Percentage cannot exceed 100"),
  due_date: z.string().optional(),
  description: z.string().optional(),
  invoice_file: z.any().optional(),
});

const performanceThresholdSchema = z.object({
  metric: z.enum(["reach", "engagement", "conversion"]),
  threshold: z.number().min(1, "Threshold must be greater than 0"),
  bonus_percentage: z
    .number()
    .min(0, "Bonus percentage must be non-negative")
    .max(100, "Bonus cannot exceed 100%"),
});

const schema = z
  .object({
    campaign_assignment_id: z.string().min(1, "Campaign assignment is required"),
    title: z.string().min(1, "Title is required"),
    platform: kolContentPlatformSchema,
    content_type: kolContentTypeSchema,
    post_url: z.string().url("Invalid URL").optional().or(z.literal("")),
    post_date: z.string().optional(),
    caption: z.string().optional(),
    hashtags: z.string().optional(),
    mentions: z.string().optional(),
    status: z.enum(["draft", "posted", "archived"]).default("draft"),
    payment_model: z.enum(["fixed", "performance_based", "barter_plus_fee"]).default("fixed"),
    base_amount: z.string().min(1, "Base amount is required"),
    barter_value: z.string().optional(),
    payment_schedule: z
      .enum(["immediate", "net_30", "net_60", "milestone_based"])
      .default("milestone_based"),
    milestones: z.array(milestoneSchema).default([]),
    performance_thresholds: z.array(performanceThresholdSchema).default([]),
  })
  .refine(
    (data) => {
      if (data.milestones.length > 0) {
        const totalPercentage = data.milestones.reduce((sum, m) => sum + m.payment_percentage, 0);
        return Math.abs(totalPercentage - 100) < 0.01;
      }
      return true;
    },
    {
      message: "Total milestone percentages must equal 100%",
      path: ["milestones"],
    },
  )
  .refine(
    (data) => {
      const n = parseIdrInputToNumber(data.base_amount);
      return Number.isFinite(n) && n > 0;
    },
    { message: "Base amount must be greater than 0", path: ["base_amount"] },
  )
  .refine(
    (data) => {
      if (!data.barter_value?.trim()) return true;
      const n = parseIdrInputToNumber(data.barter_value);
      return Number.isFinite(n) && n >= 0;
    },
    { message: "Invalid barter value", path: ["barter_value"] },
  );

type FormData = z.infer<typeof schema>;

interface AddContentPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: Array<any>;
  onSubmit: (payload: Omit<CreateContentPostWithPaymentPayload, "organization_id">) => Promise<void>;
  isLoading: boolean;
}

const AddContentPostModal = ({
  open,
  onOpenChange,
  assignments,
  onSubmit,
  isLoading,
}: AddContentPostModalProps) => {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      campaign_assignment_id: "",
      title: "",
      platform: "" as FormData["platform"],
      content_type: "" as FormData["content_type"],
      post_url: "",
      post_date: "",
      caption: "",
      hashtags: "",
      mentions: "",
      status: "draft",
      payment_model: "fixed",
      base_amount: "",
      barter_value: "",
      payment_schedule: "milestone_based",
      milestones: [
        {
          milestone_name: "Milestone 1",
          payment_percentage: 100,
          due_date: "",
          description: "",
          invoice_file: undefined,
        },
      ],
      performance_thresholds: [],
    },
  });

  const {
    fields: milestoneFields,
    append: appendMilestone,
    remove: removeMilestone,
  } = useFieldArray({
    control: form.control,
    name: "milestones",
  });

  const {
    fields: thresholdFields,
    append: appendThreshold,
    remove: removeThreshold,
  } = useFieldArray({
    control: form.control,
    name: "performance_thresholds",
  });

  const paymentModel = form.watch("payment_model");
  const selectedAssignmentId = form.watch("campaign_assignment_id");
  const selectedPlatform = form.watch("platform");
  const selectedContentType = form.watch("content_type");
  const baseAmountStr = form.watch("base_amount");
  const milestonesWatch = form.watch("milestones");
  const watchedThresholds = form.watch("performance_thresholds");

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === selectedAssignmentId),
    [assignments, selectedAssignmentId],
  );

  const { findRate } = useKOLRates(selectedAssignment?.kol_profile_id);

  // Hanya isi otomatis dari kol_rates bila ada pasangan platform+type; jangan kosongkan field
  // tiap render — `findRate` kini stabil (useCallback) agar effect tidak membatalkan input user.
  useEffect(() => {
    if (!selectedAssignment?.id || !selectedPlatform || !selectedContentType) {
      return;
    }
    const matchingRate = findRate(selectedPlatform, selectedContentType);
    if (!matchingRate) {
      return;
    }
    const formatted = formatIdrThousandsFromDigits(
      idrDigitsOnly(String(matchingRate.rate_amount)),
    );
    if (form.getValues("base_amount") !== formatted) {
      form.setValue("base_amount", formatted);
    }
  }, [selectedAssignment?.id, selectedPlatform, selectedContentType, findRate]);

  const totalPercentage = milestonesWatch.reduce((sum, m) => sum + (m.payment_percentage || 0), 0);

  const campaignAssignmentIdW = form.watch("campaign_assignment_id");
  const titleW = form.watch("title");
  const platformW = form.watch("platform");
  const contentTypeW = form.watch("content_type");
  const baseAmountWatch = form.watch("base_amount");

  const isFormValid = useMemo(() => {
    const baseNum = parseIdrInputToNumber(baseAmountWatch || "");
    const hasRequiredFields = Boolean(
      campaignAssignmentIdW &&
        titleW &&
        platformW &&
        contentTypeW &&
        Number.isFinite(baseNum) &&
        baseNum > 0,
    );

    const isMilestoneValid =
      milestonesWatch.length > 0 &&
      Math.abs(totalPercentage - 100) < 0.01 &&
      milestonesWatch.every((m) => m.milestone_name && m.payment_percentage > 0);

    return hasRequiredFields && isMilestoneValid;
  }, [
    campaignAssignmentIdW,
    titleW,
    platformW,
    contentTypeW,
    baseAmountWatch,
    milestonesWatch,
    totalPercentage,
  ]);

  /** Alasan tombol submit nonaktif — ditampilkan agar user tidak bingung. */
  const submitDisabledHint = useMemo(() => {
    if (isLoading) return null;
    const baseNum = parseIdrInputToNumber(baseAmountWatch || "");
    if (!campaignAssignmentIdW) return "Pilih Campaign Assignment.";
    if (!titleW?.trim()) return "Isi judul konten.";
    if (!platformW) return "Pilih platform.";
    if (!contentTypeW) return "Pilih tipe konten.";
    if (!Number.isFinite(baseNum) || baseNum <= 0) return "Isi Base Amount (minimal Rp 1).";
    if (milestonesWatch.length === 0) return "Tambah minimal satu payment milestone.";
    if (milestonesWatch.some((m) => !String(m.milestone_name ?? "").trim())) {
      return "Isi nama untuk setiap milestone.";
    }
    if (milestonesWatch.some((m) => !m.payment_percentage || m.payment_percentage <= 0)) {
      return "Setiap milestone harus punya persentase lebih dari 0.";
    }
    if (Math.abs(totalPercentage - 100) >= 0.01) {
      return `Total persentase milestone harus 100% (saat ini ${totalPercentage.toFixed(1)}%).`;
    }
    return null;
  }, [
    isLoading,
    campaignAssignmentIdW,
    titleW,
    platformW,
    contentTypeW,
    baseAmountWatch,
    milestonesWatch,
    totalPercentage,
  ]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const calculateMilestoneAmount = (percentage: number) => {
    const baseAmountNum = parseIdrInputToNumber(baseAmountStr || "") || 0;
    return (baseAmountNum * percentage) / 100;
  };

  const handleAddMilestone = () => {
    appendMilestone({
      milestone_name: "",
      payment_percentage: 0,
      due_date: "",
      description: "",
      invoice_file: undefined,
    });
  };

  const handleAddThreshold = () => {
    appendThreshold({
      metric: "reach",
      threshold: 0,
      bonus_percentage: 0,
    });
  };

  const handleSubmit = async (data: FormData) => {
    const selected = assignments.find((a) => a.id === data.campaign_assignment_id);
    if (!selected) return;

    await onSubmit({
      campaign_assignment_id: data.campaign_assignment_id,
      campaign_id: selected.campaign_id,
      kol_profile_id: selected.kol_profile_id,
      title: data.title,
      platform: data.platform,
      content_type: data.content_type,
      status: data.status,
      post_url: data.post_url || null,
      post_date: data.post_date ? new Date(data.post_date).toISOString() : null,
      caption: data.caption || null,
      hashtags: data.hashtags ? data.hashtags.split(" ").filter((tag) => tag.trim()) : null,
      mentions: data.mentions ? data.mentions.split(" ").filter((mention) => mention.trim()) : null,
      paymentTermsData: {
        type: "content_post",
        payment_model: data.payment_model,
        base_amount: parseIdrInputToNumber(data.base_amount),
        barter_value:
          data.barter_value?.trim() !== ""
            ? parseIdrInputToNumber(data.barter_value || "")
            : null,
        payment_schedule: data.payment_schedule,
        kol_profile_id: selected.kol_profile_id,
        milestones: data.milestones.map((m, index) => ({
          milestone_name: m.milestone_name,
          payment_percentage: m.payment_percentage,
          amount: calculateMilestoneAmount(m.payment_percentage),
          due_date: m.due_date || null,
          milestone_description: m.description || null,
          milestone_order: index + 1,
          status: "pending",
          trigger_condition: "manual",
          invoice_file: m.invoice_file || null,
        })),
        performance_thresholds: data.performance_thresholds,
      },
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88vmin,720px,90vh,95vw)] w-[min(88vmin,720px,90vh,95vw)] max-h-[90vh] max-w-[min(88vmin,720px,90vh,95vw)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="sticky top-0 z-10 flex-shrink-0 border-b bg-background px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Create Content Post & Payment Agreement
          </DialogTitle>
          <DialogDescription>
            Create a new content post with integrated payment terms and milestones for KOL collaboration.
          </DialogDescription>
        </DialogHeader>

        <div className="seamless-scroll flex-1 min-h-0 overflow-y-auto px-6 pt-4">
          <Form {...form}>
            <form id="content-post-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pb-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Content Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="campaign_assignment_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Campaign Assignment</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select assignment" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {assignments.map((assignment) => (
                                <SelectItem key={assignment.id} value={assignment.id}>
                                  {assignment.kol_profile?.name ?? "-"} — {assignment.campaign?.name ?? "-"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Content Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter content title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platform</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih platform" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[min(360px,70vh)]">
                              {KOL_CONTENT_PLATFORM_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="items-start py-2.5">
                                  <span className="block text-left">
                                    <span className="font-medium leading-tight">{opt.label}</span>
                                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                                      {opt.description}
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="content_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Content Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih tipe konten" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[min(360px,70vh)]">
                              {KOL_CONTENT_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="items-start py-2.5">
                                  <span className="block text-left">
                                    <span className="font-medium leading-tight">{opt.label}</span>
                                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                                      {opt.description}
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="posted">Posted</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="post_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Post URL (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="post_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Post Date (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="caption"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Caption (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter caption" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="hashtags"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hashtags (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="#hashtag1 #hashtag2" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mentions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mentions (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="@username1 @username2" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Separator />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Handshake className="h-5 w-5" />
                    Payment Agreement
                  </CardTitle>
                  <CardDescription>
                    Set up payment terms and milestones for this content collaboration.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="payment_model"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base font-medium">Payment Model</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid grid-cols-3 gap-4"
                          >
                            <div className="flex items-center space-x-2 rounded-lg border p-3">
                              <RadioGroupItem value="fixed" id="cp-fixed" />
                              <Label htmlFor="cp-fixed" className="cursor-pointer">
                                <div>
                                  <div className="font-medium">Fixed Payment</div>
                                  <div className="text-sm text-muted-foreground">
                                    Set amount regardless of performance
                                  </div>
                                </div>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 rounded-lg border p-3">
                              <RadioGroupItem value="performance_based" id="cp-performance" />
                              <Label htmlFor="cp-performance" className="cursor-pointer">
                                <div>
                                  <div className="font-medium">Performance-Based</div>
                                  <div className="text-sm text-muted-foreground">
                                    Payment based on metrics achieved
                                  </div>
                                </div>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 rounded-lg border p-3">
                              <RadioGroupItem value="barter_plus_fee" id="cp-barter" />
                              <Label htmlFor="cp-barter" className="cursor-pointer">
                                <div>
                                  <div className="font-medium">Barter + Fee</div>
                                  <div className="text-sm text-muted-foreground">
                                    Product/service exchange + cash
                                  </div>
                                </div>
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="base_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Amount (IDR)</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              autoComplete="off"
                              placeholder="Mis. 1.500.000"
                              value={field.value}
                              onChange={(e) => {
                                const digits = idrDigitsOnly(e.target.value);
                                field.onChange(
                                  digits === "" ? "" : formatIdrThousandsFromDigits(digits),
                                );
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {paymentModel === "barter_plus_fee" ? (
                      <FormField
                        control={form.control}
                        name="barter_value"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Barter Value (IDR)</FormLabel>
                            <FormControl>
                              <Input
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="Mis. 500.000"
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  const digits = idrDigitsOnly(e.target.value);
                                  field.onChange(
                                    digits === "" ? "" : formatIdrThousandsFromDigits(digits),
                                  );
                                }}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}
                  </div>

                  <FormField
                    control={form.control}
                    name="payment_schedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Schedule</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select schedule" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="immediate">Immediate</SelectItem>
                            <SelectItem value="net_30">Net 30</SelectItem>
                            <SelectItem value="net_60">Net 60</SelectItem>
                            <SelectItem value="milestone_based">Milestone Based</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Payment Milestones
                  </CardTitle>
                  <CardDescription>
                    Define payment milestones based on percentage of base amount. Total must equal 100%.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {milestoneFields.length > 0 ? (
                    <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                      <span className="text-sm font-medium">Total Percentage:</span>
                      <Badge variant={Math.abs(totalPercentage - 100) < 0.01 ? "default" : "destructive"}>
                        {totalPercentage.toFixed(1)}%
                      </Badge>
                    </div>
                  ) : null}

                  {milestoneFields.map((field, index) => (
                    <Card key={field.id} className="border-l-4 border-l-primary/30">
                      <CardContent className="p-4">
                        <div className="mb-3 flex items-start justify-between">
                          <h4 className="font-medium">Milestone {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMilestone(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mb-3 grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name={`milestones.${index}.milestone_name`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormLabel>Milestone Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Down Payment" {...f} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`milestones.${index}.payment_percentage`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormLabel>Percentage (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    {...f}
                                    onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {(parseIdrInputToNumber(baseAmountStr || "") || 0) > 0 &&
                        (form.watch(`milestones.${index}.payment_percentage`) || 0) > 0 ? (
                          <div className="mb-3 rounded bg-muted/50 p-2">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <span className="text-sm text-muted-foreground">Amount: </span>
                                <span className="font-medium">
                                  {formatCurrency(
                                    calculateMilestoneAmount(
                                      form.watch(`milestones.${index}.payment_percentage`) || 0,
                                    ),
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="text-sm text-muted-foreground">Remaining: </span>
                                <span className="font-medium">
                                  {formatCurrency(
                                    (() => {
                                      const currentMilestones = form.watch("milestones") || [];
                                      const totalPercentageUpToCurrent = currentMilestones
                                        .slice(0, index + 1)
                                        .reduce(
                                          (sum, m) =>
                                            sum + (parseFloat(String(m.payment_percentage ?? "0")) || 0),
                                          0,
                                        );
                                      const baseAmountNum =
                                        parseIdrInputToNumber(String(baseAmountStr || "")) || 0;
                                      const totalPaidAmount = (baseAmountNum * totalPercentageUpToCurrent) / 100;
                                      return Math.max(0, baseAmountNum - totalPaidAmount);
                                    })(),
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name={`milestones.${index}.due_date`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormLabel>Due Date (Optional)</FormLabel>
                                <FormControl>
                                  <Input type="date" {...f} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`milestones.${index}.description`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Payment conditions" {...f} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`milestones.${index}.invoice_file`}
                            render={({ field: f }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Invoice Upload (Optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      f.onChange(file);
                                    }}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Upload invoice to automatically mark milestone as completed
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <Button type="button" variant="outline" onClick={handleAddMilestone} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Milestone
                  </Button>
                </CardContent>
              </Card>

              {paymentModel === "performance_based" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Performance Thresholds
                    </CardTitle>
                    <CardDescription>Set performance targets that trigger bonus payments.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {thresholdFields.map((field, index) => (
                      <Card key={field.id} className="border-l-4 border-l-blue-500/30">
                        <CardContent className="p-4">
                          <div className="mb-3 flex items-start justify-between">
                            <h4 className="font-medium">Threshold {index + 1}</h4>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeThreshold(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <FormField
                              control={form.control}
                              name={`performance_thresholds.${index}.metric`}
                              render={({ field: f }) => (
                                <FormItem>
                                  <FormLabel>Metric</FormLabel>
                                  <Select onValueChange={f.onChange} value={f.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select metric" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="reach">Reach</SelectItem>
                                      <SelectItem value="engagement">Engagement</SelectItem>
                                      <SelectItem value="conversion">Conversion</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`performance_thresholds.${index}.threshold`}
                              render={({ field: f }) => {
                                const metric = watchedThresholds?.[index]?.metric || "reach";
                                const hint = getThresholdFieldHint(metric);
                                return (
                                  <FormItem>
                                    <FormLabel>{getThresholdFieldLabel(metric)}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        placeholder={metric === "engagement" ? "5000" : "100000"}
                                        {...f}
                                        onChange={(e) =>
                                          f.onChange(parseFloat(e.target.value) || 0)
                                        }
                                      />
                                    </FormControl>
                                    {hint ? (
                                      <FormDescription className="text-xs">{hint}</FormDescription>
                                    ) : null}
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />

                            <FormField
                              control={form.control}
                              name={`performance_thresholds.${index}.bonus_percentage`}
                              render={({ field: f }) => (
                                <FormItem>
                                  <FormLabel>Bonus (%)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder="0"
                                      {...f}
                                      onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    <Button type="button" variant="outline" onClick={handleAddThreshold} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Performance Threshold
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </form>
          </Form>
        </div>

        <DialogFooter className="sticky bottom-0 z-10 flex-shrink-0 flex-col items-stretch gap-2 border-t bg-background px-6 py-3 sm:flex-row sm:items-center sm:justify-end">
          {submitDisabledHint ? (
            <p className="order-2 w-full text-center text-xs text-muted-foreground sm:order-1 sm:mr-auto sm:w-auto sm:text-left">
              {submitDisabledHint}
            </p>
          ) : null}
          <div className="order-1 flex w-full gap-2 sm:order-2 sm:w-auto">
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="content-post-form"
              disabled={isLoading || !isFormValid}
              className={`flex-1 bg-brand-blue text-white hover:bg-brand-blue/90 sm:flex-none ${!isFormValid ? "cursor-not-allowed opacity-50" : ""}`}
              aria-disabled={isLoading || !isFormValid}
            >
              {isLoading ? "Creating..." : "Create Content Post & Agreement"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddContentPostModal;
