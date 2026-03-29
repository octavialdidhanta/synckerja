import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { FileUpload } from "@/shared/components/ui/file-upload";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/components/ui/form";
import { useCreateReprimand } from "../hooks/useReprimands";
import { useEmployees } from "../hooks/useEmployees";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { toast } from "sonner";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type ReprimandFormValues = {
  employee_id: string;
  reprimand_type: "verbal_warning" | "written_warning" | "final_warning" | "suspension" | "termination";
  severity_level: "low" | "medium" | "high" | "critical";
  violation_category:
    | "attendance"
    | "performance"
    | "conduct"
    | "safety"
    | "policy_violation"
    | "insubordination"
    | "other";
  incident_date: string;
  incident_time: string;
  incident_location: string;
  violation_description: string;
  evidence_details: string;
  witness_names: string;
  previous_warnings_count: number;
  corrective_action_plan: string;
  improvement_deadline: string;
  follow_up_date: string;
  acknowledgment_required: boolean;
  is_formal: boolean;
  impact_on_performance_review: boolean;
  notes: string;
  document_path: string;
};

export const AddReprimandDialog = () => {
  const [open, setOpen] = useState(false);
  const { employees, isLoading: employeesLoading } = useEmployees();
  const createReprimand = useCreateReprimand();
  const { user } = useCurrentUser();
  const { t } = useAppTranslation();

  const reprimandSchema = useMemo(
    () =>
      z.object({
        employee_id: z.string().min(1, t("reprimands.form.validation.employeeRequired", "Please select an employee")),
        reprimand_type: z.enum(["verbal_warning", "written_warning", "final_warning", "suspension", "termination"]),
        severity_level: z.enum(["low", "medium", "high", "critical"]),
        violation_category: z.enum([
          "attendance",
          "performance",
          "conduct",
          "safety",
          "policy_violation",
          "insubordination",
          "other",
        ]),
        incident_date: z.string().min(1, t("reprimands.form.validation.incidentDateRequired", "Incident date is required")),
        incident_time: z.string().optional(),
        incident_location: z.string().optional(),
        violation_description: z.string().min(
          1,
          t("reprimands.form.validation.violationDescriptionRequired", "Violation description is required"),
        ),
        evidence_details: z.string().optional(),
        witness_names: z.string().optional(),
        previous_warnings_count: z.number().min(0).default(0),
        corrective_action_plan: z.string().optional(),
        improvement_deadline: z.string().optional(),
        follow_up_date: z.string().optional(),
        acknowledgment_required: z.boolean().default(true),
        is_formal: z.boolean().default(true),
        impact_on_performance_review: z.boolean().default(true),
        notes: z.string().optional(),
        document_path: z.string().optional(),
      }),
    [t],
  );

  const form = useForm<ReprimandFormValues>({
    resolver: zodResolver(reprimandSchema),
    defaultValues: {
      employee_id: "",
      reprimand_type: "verbal_warning",
      severity_level: "medium",
      violation_category: "conduct",
      incident_date: new Date().toISOString().split("T")[0],
      incident_time: "",
      incident_location: "",
      violation_description: "",
      evidence_details: "",
      witness_names: "",
      previous_warnings_count: 0,
      corrective_action_plan: "",
      improvement_deadline: "",
      follow_up_date: "",
      acknowledgment_required: true,
      is_formal: true,
      impact_on_performance_review: true,
      notes: "",
      document_path: "",
    },
  });

  const reprimandTypes = useMemo(
    () => [
      { value: "verbal_warning" as const, label: t("reprimands.dialog.typeVerbal", "Verbal Warning") },
      { value: "written_warning" as const, label: t("reprimands.dialog.typeWritten", "Written Warning") },
      { value: "final_warning" as const, label: t("reprimands.dialog.typeFinal", "Final Warning") },
      { value: "suspension" as const, label: t("reprimands.dialog.typeSuspension", "Suspension") },
      { value: "termination" as const, label: t("reprimands.dialog.typeTermination", "Termination") },
    ],
    [t],
  );

  const severityLevels = useMemo(
    () => [
      { value: "low" as const, label: t("reprimands.dialog.severityLow", "Low") },
      { value: "medium" as const, label: t("reprimands.dialog.severityMedium", "Medium") },
      { value: "high" as const, label: t("reprimands.dialog.severityHigh", "High") },
      { value: "critical" as const, label: t("reprimands.dialog.severityCritical", "Critical") },
    ],
    [t],
  );

  const violationCategories = useMemo(
    () => [
      { value: "attendance" as const, label: t("reprimands.dialog.catAttendance", "Attendance") },
      { value: "performance" as const, label: t("reprimands.dialog.catPerformance", "Performance") },
      { value: "conduct" as const, label: t("reprimands.dialog.catConduct", "Conduct") },
      { value: "safety" as const, label: t("reprimands.dialog.catSafety", "Safety") },
      { value: "policy_violation" as const, label: t("reprimands.dialog.catPolicy", "Policy Violation") },
      { value: "insubordination" as const, label: t("reprimands.dialog.catInsubordination", "Insubordination") },
      { value: "other" as const, label: t("reprimands.dialog.catOther", "Other") },
    ],
    [t],
  );

  const onSubmit = async (data: ReprimandFormValues) => {
    try {
      if (!user?.id) {
        toast.error(t("reprimands.toast.sessionInvalid", "Session invalid. Please sign in again."));
        return;
      }

      await createReprimand.mutateAsync(data);
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Failed to create reprimand:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-brand-blue hover:bg-brand-blue/90">
          <Plus className="mr-2 h-4 w-4" />
          {t("reprimands.dialog.trigger", "Add Reprimand")}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex h-[85vh] max-w-4xl flex-col overflow-hidden p-6 pb-2.5 pt-4"
        aria-describedby="add-reprimand-description"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-1">
          <DialogTitle>{t("reprimands.dialog.title", "Add New Reprimand")}</DialogTitle>
          <p id="add-reprimand-description" className="mt-1 text-sm text-muted-foreground">
            {t("reprimands.dialog.description", "Create a new disciplinary action record for an employee")}
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full min-h-0 flex-col">
            <div className="relative z-0 min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto bg-background px-6 py-4 seamless-scroll nested-scroll-touch-chain scrollbar-hide">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="employee_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reprimands.dialog.employee", "Employee *")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("reprimands.dialog.selectEmployee", "Select employee")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employeesLoading ? (
                            <SelectItem value="loading" disabled>
                              {t("reprimands.dialog.loadingEmployees", "Loading employees...")}
                            </SelectItem>
                          ) : employees.length > 0 ? (
                            employees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.full_name} (
                                {employee.employee_id || t("reprimands.dialog.noEmployeeId", "No ID")})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-employees" disabled>
                              {t("reprimands.dialog.noEmployees", "No employees found")}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reprimand_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reprimands.dialog.reprimandType", "Reprimand Type *")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t("reprimands.dialog.selectReprimandType", "Select reprimand type")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {reprimandTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
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
                  name="severity_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reprimands.dialog.severity", "Severity Level *")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("reprimands.dialog.selectSeverity", "Select severity level")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {severityLevels.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
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
                  name="violation_category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reprimands.dialog.violationCategory", "Violation Category *")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t("reprimands.dialog.selectViolationCategory", "Select violation category")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {violationCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
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
                  name="incident_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reprimands.dialog.incidentDate", "Incident Date *")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incident_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reprimands.dialog.incidentTime", "Incident Time")}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incident_location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reprimands.dialog.incidentLocation", "Incident Location")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("reprimands.dialog.incidentLocationPh", "Enter incident location")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="previous_warnings_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reprimands.dialog.previousWarnings", "Previous Warnings Count")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="improvement_deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reprimands.dialog.improvementDeadline", "Improvement Deadline")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="follow_up_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reprimands.dialog.followUpDate", "Follow Up Date")}</FormLabel>
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
                name="violation_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reprimands.dialog.violationDescription", "Violation Description *")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          "reprimands.dialog.violationDescriptionPh",
                          "Describe the violation in detail...",
                        )}
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="evidence_details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reprimands.dialog.evidenceDetails", "Evidence Details")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          "reprimands.dialog.evidenceDetailsPh",
                          "Describe any evidence supporting this reprimand...",
                        )}
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="witness_names"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reprimands.dialog.witnessNames", "Witness Names")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("reprimands.dialog.witnessNamesPh", "Enter witness names (comma separated)")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="corrective_action_plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reprimands.dialog.correctiveAction", "Corrective Action Plan")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          "reprimands.dialog.correctiveActionPh",
                          "Describe the corrective actions required...",
                        )}
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document_path"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reprimands.dialog.supportingDoc", "Supporting Document")}</FormLabel>
                    <FormControl>
                      <FileUpload
                        id="reprimand-document"
                        label={t("reprimands.dialog.uploadLabel", "Upload supporting document")}
                        value={field.value}
                        onChange={field.onChange}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        maxSize={10 * 1024 * 1024}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reprimands.dialog.notes", "Additional Notes")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("reprimands.dialog.notesPh", "Any additional notes or comments...")}
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="acknowledgment_required"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t("reprimands.dialog.ackRequired", "Acknowledgment Required")}</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_formal"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t("reprimands.dialog.formal", "Formal Reprimand")}</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="impact_on_performance_review"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t("reprimands.dialog.impactReview", "Impact Performance Review")}</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="relative z-20 flex-shrink-0 border-t bg-background px-6 pb-1 pt-3">
              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={createReprimand.isPending}
                  className="min-w-[100px]"
                >
                  {t("reprimands.dialog.cancel", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createReprimand.isPending}
                  className="min-w-[140px] bg-brand-blue hover:bg-brand-blue/90"
                >
                  {createReprimand.isPending
                    ? t("reprimands.dialog.submitting", "Creating...")
                    : t("reprimands.dialog.submit", "Create Reprimand")}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
