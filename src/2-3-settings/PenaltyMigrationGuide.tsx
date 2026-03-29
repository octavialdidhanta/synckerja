
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { AlertTriangle, Database, CheckCircle, Copy } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const PenaltyMigrationGuide = () => {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const migrationSQL = `-- Create penalty_rules table for configurable penalty rules
CREATE TABLE public.penalty_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('late_arrival', 'early_departure', 'no_checkout', 'invalid_location')),
  threshold_minutes integer NOT NULL DEFAULT 0,
  penalty_amount numeric(10,2) NOT NULL DEFAULT 0,
  penalty_type text NOT NULL DEFAULT 'deduction' CHECK (penalty_type IN ('deduction', 'warning', 'points')),
  is_active boolean DEFAULT true,
  applies_to_all boolean DEFAULT true,
  specific_departments uuid[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Create attendance_penalties table to track applied penalties
CREATE TABLE public.attendance_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  penalty_rule_id uuid NOT NULL,
  penalty_amount numeric(10,2) NOT NULL DEFAULT 0,
  penalty_reason text NOT NULL,
  applied_date timestamp with time zone DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'waived', 'appealed')),
  waived_by uuid,
  waived_at timestamp with time zone,
  waiver_reason text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.penalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_penalties ENABLE ROW LEVEL SECURITY;

-- RLS policies for penalty_rules
CREATE POLICY "Users can view penalty rules in their organization"
ON public.penalty_rules FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM user_organizations 
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "HR can manage penalty rules"
ON public.penalty_rules FOR ALL
USING (organization_id IN (
  SELECT uo.organization_id FROM user_organizations uo
  JOIN user_roles ur ON ur.user_id = uo.user_id AND ur.organization_id = uo.organization_id
  WHERE uo.user_id = auth.uid() AND uo.is_active = true 
  AND ur.role IN ('owner', 'admin', 'hr')
));

-- RLS policies for attendance_penalties
CREATE POLICY "Users can view penalties in their organization"
ON public.attendance_penalties FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM user_organizations 
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "HR can manage penalties"
ON public.attendance_penalties FOR ALL
USING (organization_id IN (
  SELECT uo.organization_id FROM user_organizations uo
  JOIN user_roles ur ON ur.user_id = uo.user_id AND ur.organization_id = uo.organization_id
  WHERE uo.user_id = auth.uid() AND uo.is_active = true 
  AND ur.role IN ('owner', 'admin', 'hr')
));`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(migrationSQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-orange-200 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>Database Migration Required</strong>
          <br />
          The penalty system requires additional database tables. Please run the migration below to enable penalty features.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Step 1: Run Database Migration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Copy and run the following SQL migration in your Supabase SQL Editor to create the penalty system tables:
          </p>
          
          <div className="relative">
            <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-64 border">
              <code>{migrationSQL}</code>
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={copyToClipboard}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy SQL
                </>
              )}
            </Button>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Instructions:</strong>
            </p>
            <ol className="text-sm text-blue-700 mt-1 space-y-1 ml-4">
              <li>1. Open your Supabase dashboard</li>
              <li>2. Go to SQL Editor</li>
              <li>3. Paste the migration SQL above</li>
              <li>4. Click "Run" to execute the migration</li>
              <li>5. Muat ulang data aplikasi (tombol di bawah) untuk mengaktifkan fitur penalty</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Refresh Application</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Setelah migrasi dijalankan, invalidasi cache query agar aplikasi mengambil skema terbaru tanpa reload halaman penuh.
          </p>
          <Button type="button" onClick={() => void queryClient.invalidateQueries()}>
            Muat ulang data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
