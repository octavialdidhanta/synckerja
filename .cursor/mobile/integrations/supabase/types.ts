export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          actual_hours: number | null
          assigned_by: string
          company_objective_id: string | null
          completion_date: string | null
          created_at: string
          created_by: string
          department_objective_id: string | null
          description: string | null
          due_date: string | null
          employee_id: string
          estimated_hours: number | null
          id: string
          individual_objective_id: string | null
          objective_id: string
          organization_id: string
          priority: string
          progress_percentage: number
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_type?: string
          actual_hours?: number | null
          assigned_by: string
          company_objective_id?: string | null
          completion_date?: string | null
          created_at?: string
          created_by: string
          department_objective_id?: string | null
          description?: string | null
          due_date?: string | null
          employee_id: string
          estimated_hours?: number | null
          id?: string
          individual_objective_id?: string | null
          objective_id: string
          organization_id: string
          priority?: string
          progress_percentage?: number
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          actual_hours?: number | null
          assigned_by?: string
          company_objective_id?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string
          department_objective_id?: string | null
          description?: string | null
          due_date?: string | null
          employee_id?: string
          estimated_hours?: number | null
          id?: string
          individual_objective_id?: string | null
          objective_id?: string
          organization_id?: string
          priority?: string
          progress_percentage?: number
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_objective_id_fkey"
            columns: ["company_objective_id"]
            isOneToOne: false
            referencedRelation: "company_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_department_objective_fkey"
            columns: ["department_objective_id"]
            isOneToOne: false
            referencedRelation: "department_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_department_objective_id_fkey"
            columns: ["department_objective_id"]
            isOneToOne: false
            referencedRelation: "department_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_individual_objective_fkey"
            columns: ["individual_objective_id"]
            isOneToOne: false
            referencedRelation: "individual_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_individual_objective_id_fkey"
            columns: ["individual_objective_id"]
            isOneToOne: false
            referencedRelation: "individual_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_comments: {
        Row: {
          activity_id: string
          attachment_url: string | null
          comment_text: string
          created_at: string
          employee_id: string
          id: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          attachment_url?: string | null
          comment_text: string
          created_at?: string
          employee_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          attachment_url?: string | null
          comment_text?: string
          created_at?: string
          employee_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_comments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_ip_addresses: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          ip_address: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          ip_address: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          ip_address?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allowed_ip_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_access_configurations: {
        Row: {
          allowed_roles: string[]
          column_name: string
          column_type: string
          created_at: string
          created_by: string | null
          exceptions: string[] | null
          id: string
          is_active: boolean | null
          organization_id: string
          show_refresh_icon: boolean | null
          updated_at: string
        }
        Insert: {
          allowed_roles?: string[]
          column_name: string
          column_type: string
          created_at?: string
          created_by?: string | null
          exceptions?: string[] | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          show_refresh_icon?: boolean | null
          updated_at?: string
        }
        Update: {
          allowed_roles?: string[]
          column_name?: string
          column_type?: string
          created_at?: string
          created_by?: string | null
          exceptions?: string[] | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          show_refresh_icon?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      attendance_notifications: {
        Row: {
          attendance_record_id: string | null
          created_at: string
          employee_id: string
          id: string
          is_read: boolean
          message: string
          notification_type: string
          organization_id: string
          title: string
        }
        Insert: {
          attendance_record_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          is_read?: boolean
          message: string
          notification_type: string
          organization_id: string
          title: string
        }
        Update: {
          attendance_record_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          organization_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_notifications_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_notifications_attendance_record"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_notifications_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_notifications_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_penalties: {
        Row: {
          appeal_notes: string | null
          applied_date: string
          attendance_record_id: string | null
          auto_generated: boolean | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          organization_id: string
          payment_date: string | null
          payroll_periods_id: string | null
          penalty_amount: number
          penalty_reason: string
          penalty_rule_id: string
          status: string
          updated_at: string
          violation_details: Json | null
          waived_at: string | null
          waived_by: string | null
          waiver_reason: string | null
        }
        Insert: {
          appeal_notes?: string | null
          applied_date?: string
          attendance_record_id?: string | null
          auto_generated?: boolean | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          organization_id: string
          payment_date?: string | null
          payroll_periods_id?: string | null
          penalty_amount: number
          penalty_reason: string
          penalty_rule_id: string
          status?: string
          updated_at?: string
          violation_details?: Json | null
          waived_at?: string | null
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Update: {
          appeal_notes?: string | null
          applied_date?: string
          attendance_record_id?: string | null
          auto_generated?: boolean | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string | null
          payroll_periods_id?: string | null
          penalty_amount?: number
          penalty_reason?: string
          penalty_rule_id?: string
          status?: string
          updated_at?: string
          violation_details?: Json | null
          waived_at?: string | null
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_penalties_payroll_periods_id_fkey"
            columns: ["payroll_periods_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_penalties_penalty_rule_id_fkey"
            columns: ["penalty_rule_id"]
            isOneToOne: false
            referencedRelation: "penalty_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_penalties_attendance_record"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_penalties_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_penalties_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          check_in_location: Json | null
          check_in_photo_path: string | null
          check_in_time: string | null
          check_out_location: Json | null
          check_out_photo_path: string | null
          check_out_time: string | null
          created_at: string | null
          employee_id: string
          id: string
          is_late: boolean | null
          late_minutes: number | null
          notes: string | null
          office_location_id: string
          organization_id: string
          payroll_periods_id: string | null
          shift_id: string | null
          status: string | null
          updated_at: string | null
          work_schedule_id: string | null
          working_hours_minutes: number | null
        }
        Insert: {
          attendance_date: string
          check_in_location?: Json | null
          check_in_photo_path?: string | null
          check_in_time?: string | null
          check_out_location?: Json | null
          check_out_photo_path?: string | null
          check_out_time?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          is_late?: boolean | null
          late_minutes?: number | null
          notes?: string | null
          office_location_id: string
          organization_id: string
          payroll_periods_id?: string | null
          shift_id?: string | null
          status?: string | null
          updated_at?: string | null
          work_schedule_id?: string | null
          working_hours_minutes?: number | null
        }
        Update: {
          attendance_date?: string
          check_in_location?: Json | null
          check_in_photo_path?: string | null
          check_in_time?: string | null
          check_out_location?: Json | null
          check_out_photo_path?: string | null
          check_out_time?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          is_late?: boolean | null
          late_minutes?: number | null
          notes?: string | null
          office_location_id?: string
          organization_id?: string
          payroll_periods_id?: string | null
          shift_id?: string | null
          status?: string | null
          updated_at?: string | null
          work_schedule_id?: string | null
          working_hours_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_office_location_id_fkey"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_payroll_periods_id_fkey"
            columns: ["payroll_periods_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedule_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_records_shift"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_validations: {
        Row: {
          attendance_record_id: string | null
          created_at: string | null
          id: string
          organization_id: string
          updated_at: string | null
          validated_at: string | null
          validation_details: Json | null
          validation_status: string
          validation_type: string
        }
        Insert: {
          attendance_record_id?: string | null
          created_at?: string | null
          id?: string
          organization_id: string
          updated_at?: string | null
          validated_at?: string | null
          validation_details?: Json | null
          validation_status?: string
          validation_type: string
        }
        Update: {
          attendance_record_id?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          updated_at?: string | null
          validated_at?: string | null
          validation_details?: Json | null
          validation_status?: string
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_validations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_validations_attendance_record"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_kpis: {
        Row: {
          achieved_at: string | null
          campaign_id: string
          created_at: string | null
          current_value: number | null
          id: string
          kol_profile_id: string | null
          kpi_name: string
          kpi_type: string
          last_updated_at: string | null
          measurement_period: string | null
          organization_id: string
          status: string | null
          target_value: number
          threshold_green: number | null
          threshold_red: number | null
          threshold_yellow: number | null
          tracking_end_date: string | null
          tracking_start_date: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          achieved_at?: string | null
          campaign_id: string
          created_at?: string | null
          current_value?: number | null
          id?: string
          kol_profile_id?: string | null
          kpi_name: string
          kpi_type: string
          last_updated_at?: string | null
          measurement_period?: string | null
          organization_id: string
          status?: string | null
          target_value: number
          threshold_green?: number | null
          threshold_red?: number | null
          threshold_yellow?: number | null
          tracking_end_date?: string | null
          tracking_start_date?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          achieved_at?: string | null
          campaign_id?: string
          created_at?: string | null
          current_value?: number | null
          id?: string
          kol_profile_id?: string | null
          kpi_name?: string
          kpi_type?: string
          last_updated_at?: string | null
          measurement_period?: string | null
          organization_id?: string
          status?: string | null
          target_value?: number
          threshold_green?: number | null
          threshold_red?: number | null
          threshold_yellow?: number | null
          tracking_end_date?: string | null
          tracking_start_date?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_kpis_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "kol_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_kpis_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_kpis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_documents: {
        Row: {
          candidate_profile_id: string
          created_at: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_verified: boolean | null
          mime_type: string | null
          notes: string | null
          updated_at: string | null
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          notes?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          notes?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_documents_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_educations: {
        Row: {
          candidate_profile_id: string
          created_at: string | null
          degree: string
          description: string | null
          end_date: string | null
          field_of_study: string | null
          grade_gpa: string | null
          id: string
          institution_name: string
          is_current: boolean | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string | null
          degree: string
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          grade_gpa?: string | null
          id?: string
          institution_name: string
          is_current?: boolean | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string | null
          degree?: string
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          grade_gpa?: string | null
          id?: string
          institution_name?: string
          is_current?: boolean | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_educations_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_family_members: {
        Row: {
          address: string | null
          age: number | null
          birth_date: string | null
          candidate_profile_id: string
          created_at: string
          gender: string | null
          id: string
          is_emergency_contact: boolean
          name: string
          occupation: string | null
          phone_number: string | null
          relationship: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          birth_date?: string | null
          candidate_profile_id: string
          created_at?: string
          gender?: string | null
          id?: string
          is_emergency_contact?: boolean
          name: string
          occupation?: string | null
          phone_number?: string | null
          relationship: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          age?: number | null
          birth_date?: string | null
          candidate_profile_id?: string
          created_at?: string
          gender?: string | null
          id?: string
          is_emergency_contact?: boolean
          name?: string
          occupation?: string | null
          phone_number?: string | null
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_family_members_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_informal_educations: {
        Row: {
          candidate_profile_id: string
          certificate_number: string | null
          course_name: string
          created_at: string | null
          description: string | null
          end_date: string | null
          field_of_certification: string | null
          id: string
          provider: string | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_profile_id: string
          certificate_number?: string | null
          course_name: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          field_of_certification?: string | null
          id?: string
          provider?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_profile_id?: string
          certificate_number?: string | null
          course_name?: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          field_of_certification?: string | null
          id?: string
          provider?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_informal_educations_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          address: string | null
          birth_date: string | null
          birth_place: string | null
          blood_type: string | null
          branch_id: string | null
          citizen_address: string | null
          cover_letter: string | null
          created_at: string
          department_id: string | null
          email: string
          employee_status_id: string | null
          employment_status: string | null
          expected_salary: string | null
          experience_years: string | null
          full_name: string
          gender: string | null
          hire_date: string | null
          id: string
          job_level_id: string | null
          job_position_id: string | null
          join_date: string | null
          marital_status: string | null
          mobile_phone: string | null
          nationality: string | null
          nik: string | null
          organization_id: string | null
          photo_url: string | null
          postal_code: string | null
          profile_completed: boolean | null
          recruitment_token: string | null
          religion: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          blood_type?: string | null
          branch_id?: string | null
          citizen_address?: string | null
          cover_letter?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          employee_status_id?: string | null
          employment_status?: string | null
          expected_salary?: string | null
          experience_years?: string | null
          full_name: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          job_level_id?: string | null
          job_position_id?: string | null
          join_date?: string | null
          marital_status?: string | null
          mobile_phone?: string | null
          nationality?: string | null
          nik?: string | null
          organization_id?: string | null
          photo_url?: string | null
          postal_code?: string | null
          profile_completed?: boolean | null
          recruitment_token?: string | null
          religion?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          blood_type?: string | null
          branch_id?: string | null
          citizen_address?: string | null
          cover_letter?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          employee_status_id?: string | null
          employment_status?: string | null
          expected_salary?: string | null
          experience_years?: string | null
          full_name?: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          job_level_id?: string | null
          job_position_id?: string | null
          join_date?: string | null
          marital_status?: string | null
          mobile_phone?: string | null
          nationality?: string | null
          nik?: string | null
          organization_id?: string | null
          photo_url?: string | null
          postal_code?: string | null
          profile_completed?: boolean | null
          recruitment_token?: string | null
          religion?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_candidate_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_candidate_department"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_candidate_employee_status"
            columns: ["employee_status_id"]
            isOneToOne: false
            referencedRelation: "employee_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_candidate_job_level"
            columns: ["job_level_id"]
            isOneToOne: false
            referencedRelation: "job_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_candidate_job_position"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_reviews: {
        Row: {
          candidate_profile_id: string
          created_at: string | null
          id: string
          is_recommendation: boolean | null
          question_review_id: string | null
          rating: number
          review_category_id: string
          review_text: string | null
          reviewer_id: string
          reviewer_name: string
          updated_at: string | null
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string | null
          id?: string
          is_recommendation?: boolean | null
          question_review_id?: string | null
          rating: number
          review_category_id: string
          review_text?: string | null
          reviewer_id: string
          reviewer_name: string
          updated_at?: string | null
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string | null
          id?: string
          is_recommendation?: boolean | null
          question_review_id?: string | null
          rating?: number
          review_category_id?: string
          review_text?: string | null
          reviewer_id?: string
          reviewer_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_reviews_question_review_id_fkey"
            columns: ["question_review_id"]
            isOneToOne: false
            referencedRelation: "question_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_candidate_reviews_candidate"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_candidate_reviews_review_category"
            columns: ["review_category_id"]
            isOneToOne: false
            referencedRelation: "review_category"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_work_experiences: {
        Row: {
          candidate_profile_id: string
          company_name: string
          created_at: string
          end_date: string | null
          id: string
          is_current: boolean
          job_description: string | null
          location: string | null
          position: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          candidate_profile_id: string
          company_name: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          job_description?: string | null
          location?: string | null
          position: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          candidate_profile_id?: string
          company_name?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          job_description?: string | null
          location?: string | null
          position?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_work_experiences_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_visits: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_location: Json | null
          end_photo_path: string | null
          id: string
          lead_client_id: string
          location_validation_result: Json | null
          notes: string | null
          organization_id: string
          planned_end_time: string | null
          planned_start_time: string | null
          start_location: Json | null
          start_photo_path: string | null
          status: string
          updated_at: string
          validated_location_id: string | null
          validation_accuracy_meters: number | null
          visit_date: string
          visit_purpose: string
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_location?: Json | null
          end_photo_path?: string | null
          id?: string
          lead_client_id: string
          location_validation_result?: Json | null
          notes?: string | null
          organization_id: string
          planned_end_time?: string | null
          planned_start_time?: string | null
          start_location?: Json | null
          start_photo_path?: string | null
          status?: string
          updated_at?: string
          validated_location_id?: string | null
          validation_accuracy_meters?: number | null
          visit_date: string
          visit_purpose: string
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_location?: Json | null
          end_photo_path?: string | null
          id?: string
          lead_client_id?: string
          location_validation_result?: Json | null
          notes?: string | null
          organization_id?: string
          planned_end_time?: string | null
          planned_start_time?: string | null
          start_location?: Json | null
          start_photo_path?: string | null
          status?: string
          updated_at?: string
          validated_location_id?: string | null
          validation_accuracy_meters?: number | null
          visit_date?: string
          visit_purpose?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_visits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_visits_lead_client_id_fkey"
            columns: ["lead_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_visits_validated_location_id_fkey"
            columns: ["validated_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company_name: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          industry: string | null
          is_active: boolean | null
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          is_active?: boolean | null
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          is_active?: boolean | null
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_history: {
        Row: {
          average_engagement_rate: number | null
          campaign_id: string | null
          collaboration_end_date: string | null
          collaboration_start_date: string
          collaboration_status: string | null
          contract_completion_rate: number | null
          created_at: string | null
          id: string
          kol_profile_id: string
          notes: string | null
          organization_id: string
          payment_total: number | null
          performance_score: number | null
          total_content_created: number | null
          total_conversions: number | null
          total_engagement: number | null
          total_reach: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          average_engagement_rate?: number | null
          campaign_id?: string | null
          collaboration_end_date?: string | null
          collaboration_start_date: string
          collaboration_status?: string | null
          contract_completion_rate?: number | null
          created_at?: string | null
          id?: string
          kol_profile_id: string
          notes?: string | null
          organization_id: string
          payment_total?: number | null
          performance_score?: number | null
          total_content_created?: number | null
          total_conversions?: number | null
          total_engagement?: number | null
          total_reach?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          average_engagement_rate?: number | null
          campaign_id?: string | null
          collaboration_end_date?: string | null
          collaboration_start_date?: string
          collaboration_status?: string | null
          contract_completion_rate?: number | null
          created_at?: string | null
          id?: string
          kol_profile_id?: string
          notes?: string | null
          organization_id?: string
          payment_total?: number | null
          performance_score?: number | null
          total_content_created?: number | null
          total_conversions?: number | null
          total_engagement?: number | null
          total_reach?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "kol_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_history_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_assets: {
        Row: {
          asset_tag: string | null
          brand: string | null
          condition: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          asset_tag?: string | null
          brand?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          asset_tag?: string | null
          brand?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_files: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string | null
          file_category: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          organization_id: string
          original_name: string
          owner_id: string
          owner_name: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          file_category?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          organization_id: string
          original_name: string
          owner_id: string
          owner_name: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          file_category?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          organization_id?: string
          original_name?: string
          owner_id?: string
          owner_name?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      company_objectives: {
        Row: {
          created_at: string
          created_by: string
          cycle_id: string
          end_date: string | null
          id: string
          organization_id: string
          owner_id: string
          progress_percentage: number
          start_date: string | null
          status: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at: string
          weight: number | null
          why_important: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          cycle_id: string
          end_date?: string | null
          id?: string
          organization_id: string
          owner_id: string
          progress_percentage?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at?: string
          weight?: number | null
          why_important?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          cycle_id?: string
          end_date?: string | null
          id?: string
          organization_id?: string
          owner_id?: string
          progress_percentage?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title?: string
          updated_at?: string
          weight?: number | null
          why_important?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_objectives_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "okr_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_objectives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_values: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          sort_order: number | null
          updated_at: string
          value_text: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          sort_order?: number | null
          updated_at?: string
          value_text: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          sort_order?: number | null
          updated_at?: string
          value_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_approvals: {
        Row: {
          approval_level: number | null
          approved_at: string | null
          approved_by: string | null
          campaign_id: string
          content_description: string | null
          content_preview_url: string | null
          content_title: string
          content_type: string
          content_url: string | null
          created_at: string | null
          id: string
          kol_profile_id: string
          max_approval_level: number | null
          organization_id: string
          planned_post_date: string | null
          platform: string
          rejected_reason: string | null
          reviewer_notes: string | null
          revision_notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approval_level?: number | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_id: string
          content_description?: string | null
          content_preview_url?: string | null
          content_title: string
          content_type: string
          content_url?: string | null
          created_at?: string | null
          id?: string
          kol_profile_id: string
          max_approval_level?: number | null
          organization_id: string
          planned_post_date?: string | null
          platform: string
          rejected_reason?: string | null
          reviewer_notes?: string | null
          revision_notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_level?: number | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_id?: string
          content_description?: string | null
          content_preview_url?: string | null
          content_title?: string
          content_type?: string
          content_url?: string | null
          created_at?: string | null
          id?: string
          kol_profile_id?: string
          max_approval_level?: number | null
          organization_id?: string
          planned_post_date?: string | null
          platform?: string
          rejected_reason?: string | null
          reviewer_notes?: string | null
          revision_notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_approvals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "kol_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_approvals_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pillars: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          funnel_stage: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          funnel_stage?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          funnel_stage?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_pillars_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_types: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          value_type: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          value_type?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          value_type?: string | null
        }
        Relationships: []
      }
      cross_dept_dependencies: {
        Row: {
          created_at: string | null
          created_by: string
          dependency_kr_id: string
          dependency_type: string
          dependent_kr_id: string
          id: string
          impact_level: number | null
          organization_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          dependency_kr_id: string
          dependency_type: string
          dependent_kr_id: string
          id?: string
          impact_level?: number | null
          organization_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          dependency_kr_id?: string
          dependency_type?: string
          dependent_kr_id?: string
          id?: string
          impact_level?: number | null
          organization_id?: string
          status?: string | null
        }
        Relationships: []
      }
      customer_service_tickets: {
        Row: {
          assigned_to: string | null
          assignee_id: string | null
          category: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          priority: string
          status: string
          ticket_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          assignee_id?: string | null
          category?: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          priority?: string
          status?: string
          ticket_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          assignee_id?: string | null
          category?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: string
          status?: string
          ticket_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_service_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_service_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      department_key_result_contributions: {
        Row: {
          contribution_percentage: number
          contribution_value: number
          created_at: string
          created_by: string
          department_id: string
          id: string
          key_result_id: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          contribution_percentage?: number
          contribution_value?: number
          created_at?: string
          created_by: string
          department_id: string
          id?: string
          key_result_id: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          contribution_percentage?: number
          contribution_value?: number
          created_at?: string
          created_by?: string
          department_id?: string
          id?: string
          key_result_id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_key_result_contributions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_key_result_contributions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      department_objectives: {
        Row: {
          company_objective_id: string | null
          created_at: string
          created_by: string
          cycle_id: string
          department_id: string
          description: string | null
          end_date: string | null
          id: string
          organization_id: string
          owner_id: string
          progress_percentage: number
          start_date: string | null
          status: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at: string
          weight: number | null
          why_important: string | null
        }
        Insert: {
          company_objective_id?: string | null
          created_at?: string
          created_by: string
          cycle_id: string
          department_id: string
          description?: string | null
          end_date?: string | null
          id?: string
          organization_id: string
          owner_id: string
          progress_percentage?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at?: string
          weight?: number | null
          why_important?: string | null
        }
        Update: {
          company_objective_id?: string | null
          created_at?: string
          created_by?: string
          cycle_id?: string
          department_id?: string
          description?: string | null
          end_date?: string | null
          id?: string
          organization_id?: string
          owner_id?: string
          progress_percentage?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title?: string
          updated_at?: string
          weight?: number | null
          why_important?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_objectives_company_objective_id_fkey"
            columns: ["company_objective_id"]
            isOneToOne: false
            referencedRelation: "company_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_objectives_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "okr_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_objectives_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_objectives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dependency_health_scores: {
        Row: {
          blocker_owner: string | null
          calculated_at: string | null
          dependency_id: string
          estimated_delay_days: number | null
          health_score: number | null
          id: string
          impact_description: string | null
          organization_id: string
          risk_level: string
        }
        Insert: {
          blocker_owner?: string | null
          calculated_at?: string | null
          dependency_id: string
          estimated_delay_days?: number | null
          health_score?: number | null
          id?: string
          impact_description?: string | null
          organization_id: string
          risk_level: string
        }
        Update: {
          blocker_owner?: string | null
          calculated_at?: string | null
          dependency_id?: string
          estimated_delay_days?: number | null
          health_score?: number | null
          id?: string
          impact_description?: string | null
          organization_id?: string
          risk_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependency_health_scores_dependency_id_fkey"
            columns: ["dependency_id"]
            isOneToOne: false
            referencedRelation: "cross_dept_dependencies"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_weights: {
        Row: {
          adjustment_reason: string | null
          approved_at: string | null
          approved_by: string | null
          base_weight: number
          created_at: string | null
          created_by: string
          final_weight: number
          id: string
          key_result_id: string
          organization_id: string
          requested_weight: number | null
          status: Database["public"]["Enums"]["weight_status"] | null
        }
        Insert: {
          adjustment_reason?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_weight: number
          created_at?: string | null
          created_by: string
          final_weight: number
          id?: string
          key_result_id: string
          organization_id: string
          requested_weight?: number | null
          status?: Database["public"]["Enums"]["weight_status"] | null
        }
        Update: {
          adjustment_reason?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_weight?: number
          created_at?: string | null
          created_by?: string
          final_weight?: number
          id?: string
          key_result_id?: string
          organization_id?: string
          requested_weight?: number | null
          status?: Database["public"]["Enums"]["weight_status"] | null
        }
        Relationships: []
      }
      email_verification_tokens: {
        Row: {
          created_at: string
          email: string
          email_verified: boolean | null
          expires_at: string
          id: string
          token: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: boolean | null
          expires_at?: string
          id?: string
          token: string
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: boolean | null
          expires_at?: string
          id?: string
          token?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string | null
          document_type: string
          employee_id: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_verified: boolean | null
          mime_type: string | null
          notes: string | null
          updated_at: string | null
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          employee_id?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          notes?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          employee_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          notes?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_educations: {
        Row: {
          created_at: string
          degree: string
          description: string | null
          employee_id: string
          end_date: string | null
          field_of_study: string | null
          grade_gpa: string | null
          id: string
          institution_name: string
          is_current: boolean | null
          organization_id: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          degree: string
          description?: string | null
          employee_id: string
          end_date?: string | null
          field_of_study?: string | null
          grade_gpa?: string | null
          id?: string
          institution_name: string
          is_current?: boolean | null
          organization_id?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          degree?: string
          description?: string | null
          employee_id?: string
          end_date?: string | null
          field_of_study?: string | null
          grade_gpa?: string | null
          id?: string
          institution_name?: string
          is_current?: boolean | null
          organization_id?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_employee_educations_employee_id"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_face_registrations: {
        Row: {
          confidence_threshold: number | null
          created_at: string
          created_by: string | null
          employee_id: string
          face_encoding: string
          face_image_url: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          confidence_threshold?: number | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          face_encoding: string
          face_image_url?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          confidence_threshold?: number | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          face_encoding?: string
          face_image_url?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_face_registrations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_face_registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_family_members: {
        Row: {
          address: string | null
          age: number | null
          created_at: string
          employee_id: string
          gender: string | null
          id: string
          is_emergency_contact: boolean | null
          name: string
          occupation: string | null
          organization_id: string | null
          phone: string | null
          photo_url: string | null
          relationship: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          created_at?: string
          employee_id: string
          gender?: string | null
          id?: string
          is_emergency_contact?: boolean | null
          name: string
          occupation?: string | null
          organization_id?: string | null
          phone?: string | null
          photo_url?: string | null
          relationship: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          age?: number | null
          created_at?: string
          employee_id?: string
          gender?: string | null
          id?: string
          is_emergency_contact?: boolean | null
          name?: string
          occupation?: string | null
          organization_id?: string | null
          phone?: string | null
          photo_url?: string | null
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_employee_family_members_employee_id"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_informal_educations: {
        Row: {
          certificate_number: string | null
          course_name: string
          created_at: string
          description: string | null
          employee_id: string
          end_date: string | null
          field_of_certification: string | null
          id: string
          organization_id: string | null
          provider: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          certificate_number?: string | null
          course_name: string
          created_at?: string
          description?: string | null
          employee_id: string
          end_date?: string | null
          field_of_certification?: string | null
          id?: string
          organization_id?: string | null
          provider?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          certificate_number?: string | null
          course_name?: string
          created_at?: string
          description?: string | null
          employee_id?: string
          end_date?: string | null
          field_of_certification?: string | null
          id?: string
          organization_id?: string | null
          provider?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_employee_informal_educations_employee_id"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payroll_calculations: {
        Row: {
          actual_working_days: number | null
          annual_gross: number | null
          approved_at: string | null
          approved_by: string | null
          basic_salary: number | null
          bpjs_kesehatan_company: number | null
          bpjs_kesehatan_employee: number | null
          bpjs_pensiun_company: number | null
          bpjs_pensiun_employee: number | null
          calculated_by: string | null
          calculation_date: string | null
          calculation_details: string | null
          calculation_status: string | null
          can_process_payment: boolean | null
          company_total_cost: number | null
          created_at: string
          employee_id: string
          employee_payroll_info_id: string
          gross_pay: number | null
          has_allowance_components: boolean | null
          has_deduction_components: boolean | null
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          is_hr_approved: boolean | null
          is_manager_approved: boolean | null
          manager_approved_at: string | null
          manager_approved_by: string | null
          monthly_tax_amount: number | null
          net_income_before_tax: number | null
          net_pay: number | null
          non_taxable_allowance: number | null
          notes: string | null
          organization_id: string
          overtime_pay: number | null
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          payroll_period_id: string
          payroll_run_id: string
          pkp_amount: number | null
          professional_allowance: number | null
          prorated_salary: number | null
          ptkp_amount: number | null
          take_home_pay: number | null
          tax_bracket_details: Json | null
          tax_configuration_id: string
          total_absent_days: number | null
          total_allowances: number | null
          total_deductions: number | null
          total_late_minutes: number | null
          total_overtime_hours: number | null
          total_penalties: number | null
          total_present_days: number | null
          total_tax_deductions: number | null
          total_taxes: string | null
          total_working_days: number | null
          updated_at: string
        }
        Insert: {
          actual_working_days?: number | null
          annual_gross?: number | null
          approved_at?: string | null
          approved_by?: string | null
          basic_salary?: number | null
          bpjs_kesehatan_company?: number | null
          bpjs_kesehatan_employee?: number | null
          bpjs_pensiun_company?: number | null
          bpjs_pensiun_employee?: number | null
          calculated_by?: string | null
          calculation_date?: string | null
          calculation_details?: string | null
          calculation_status?: string | null
          can_process_payment?: boolean | null
          company_total_cost?: number | null
          created_at?: string
          employee_id: string
          employee_payroll_info_id: string
          gross_pay?: number | null
          has_allowance_components?: boolean | null
          has_deduction_components?: boolean | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          is_hr_approved?: boolean | null
          is_manager_approved?: boolean | null
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          monthly_tax_amount?: number | null
          net_income_before_tax?: number | null
          net_pay?: number | null
          non_taxable_allowance?: number | null
          notes?: string | null
          organization_id: string
          overtime_pay?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payroll_period_id: string
          payroll_run_id: string
          pkp_amount?: number | null
          professional_allowance?: number | null
          prorated_salary?: number | null
          ptkp_amount?: number | null
          take_home_pay?: number | null
          tax_bracket_details?: Json | null
          tax_configuration_id: string
          total_absent_days?: number | null
          total_allowances?: number | null
          total_deductions?: number | null
          total_late_minutes?: number | null
          total_overtime_hours?: number | null
          total_penalties?: number | null
          total_present_days?: number | null
          total_tax_deductions?: number | null
          total_taxes?: string | null
          total_working_days?: number | null
          updated_at?: string
        }
        Update: {
          actual_working_days?: number | null
          annual_gross?: number | null
          approved_at?: string | null
          approved_by?: string | null
          basic_salary?: number | null
          bpjs_kesehatan_company?: number | null
          bpjs_kesehatan_employee?: number | null
          bpjs_pensiun_company?: number | null
          bpjs_pensiun_employee?: number | null
          calculated_by?: string | null
          calculation_date?: string | null
          calculation_details?: string | null
          calculation_status?: string | null
          can_process_payment?: boolean | null
          company_total_cost?: number | null
          created_at?: string
          employee_id?: string
          employee_payroll_info_id?: string
          gross_pay?: number | null
          has_allowance_components?: boolean | null
          has_deduction_components?: boolean | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          is_hr_approved?: boolean | null
          is_manager_approved?: boolean | null
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          monthly_tax_amount?: number | null
          net_income_before_tax?: number | null
          net_pay?: number | null
          non_taxable_allowance?: number | null
          notes?: string | null
          organization_id?: string
          overtime_pay?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payroll_period_id?: string
          payroll_run_id?: string
          pkp_amount?: number | null
          professional_allowance?: number | null
          prorated_salary?: number | null
          ptkp_amount?: number | null
          take_home_pay?: number | null
          tax_bracket_details?: Json | null
          tax_configuration_id?: string
          total_absent_days?: number | null
          total_allowances?: number | null
          total_deductions?: number | null
          total_late_minutes?: number | null
          total_overtime_hours?: number | null
          total_penalties?: number | null
          total_present_days?: number | null
          total_tax_deductions?: number | null
          total_taxes?: string | null
          total_working_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_calculations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_calculations_employee_payroll_info_id_fkey"
            columns: ["employee_payroll_info_id"]
            isOneToOne: false
            referencedRelation: "employee_payroll_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_calculations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_calculations_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_calculations_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_calculations_tax_configuration_id_fkey"
            columns: ["tax_configuration_id"]
            isOneToOne: false
            referencedRelation: "tax_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payroll_components: {
        Row: {
          amount: number | null
          component_category: string
          component_name: string
          component_type: string
          created_at: string
          employee_payroll_info_id: string
          id: string
          is_active: boolean | null
          is_percentage: boolean | null
          is_recurring: boolean | null
          is_taxable: boolean | null
          organization_id: string
          payroll_period_id: string | null
          percentage_base: string | null
          tax_configuration_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          component_category: string
          component_name: string
          component_type: string
          created_at?: string
          employee_payroll_info_id: string
          id?: string
          is_active?: boolean | null
          is_percentage?: boolean | null
          is_recurring?: boolean | null
          is_taxable?: boolean | null
          organization_id: string
          payroll_period_id?: string | null
          percentage_base?: string | null
          tax_configuration_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          component_category?: string
          component_name?: string
          component_type?: string
          created_at?: string
          employee_payroll_info_id?: string
          id?: string
          is_active?: boolean | null
          is_percentage?: boolean | null
          is_recurring?: boolean | null
          is_taxable?: boolean | null
          organization_id?: string
          payroll_period_id?: string | null
          percentage_base?: string | null
          tax_configuration_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_components_employee_payroll_info_id_fkey"
            columns: ["employee_payroll_info_id"]
            isOneToOne: false
            referencedRelation: "employee_payroll_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_components_tax_configuration_id_fkey"
            columns: ["tax_configuration_id"]
            isOneToOne: false
            referencedRelation: "tax_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employee_payroll_components_payroll_period"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payroll_info: {
        Row: {
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_name: string | null
          basic_salary: number | null
          beginning_netto: number | null
          bpjs_kesehatan_configuration: string | null
          bpjs_kesehatan_date: string | null
          bpjs_kesehatan_family_members: number | null
          bpjs_kesehatan_number: string | null
          bpjs_ketenagakerjaan_date: string | null
          bpjs_ketenagakerjaan_number: string | null
          count_national_holiday_as_working_day: boolean | null
          created_at: string
          created_by: string | null
          currency: string | null
          employee_id: string
          employee_tax_status: string | null
          id: string
          jht_configuration: string | null
          npwp: string | null
          organization_id: string
          overtime_eligible: boolean | null
          pph21_paid: number | null
          prorate_based_on: string | null
          ptkp_status: string | null
          salary_configuration: string | null
          salary_type: string | null
          tax_configuration_id: string | null
          tax_method: string | null
          taxable_date: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          beginning_netto?: number | null
          bpjs_kesehatan_configuration?: string | null
          bpjs_kesehatan_date?: string | null
          bpjs_kesehatan_family_members?: number | null
          bpjs_kesehatan_number?: string | null
          bpjs_ketenagakerjaan_date?: string | null
          bpjs_ketenagakerjaan_number?: string | null
          count_national_holiday_as_working_day?: boolean | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          employee_id: string
          employee_tax_status?: string | null
          id?: string
          jht_configuration?: string | null
          npwp?: string | null
          organization_id: string
          overtime_eligible?: boolean | null
          pph21_paid?: number | null
          prorate_based_on?: string | null
          ptkp_status?: string | null
          salary_configuration?: string | null
          salary_type?: string | null
          tax_configuration_id?: string | null
          tax_method?: string | null
          taxable_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          beginning_netto?: number | null
          bpjs_kesehatan_configuration?: string | null
          bpjs_kesehatan_date?: string | null
          bpjs_kesehatan_family_members?: number | null
          bpjs_kesehatan_number?: string | null
          bpjs_ketenagakerjaan_date?: string | null
          bpjs_ketenagakerjaan_number?: string | null
          count_national_holiday_as_working_day?: boolean | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          employee_id?: string
          employee_tax_status?: string | null
          id?: string
          jht_configuration?: string | null
          npwp?: string | null
          organization_id?: string
          overtime_eligible?: boolean | null
          pph21_paid?: number | null
          prorate_based_on?: string | null
          ptkp_status?: string | null
          salary_configuration?: string | null
          salary_type?: string | null
          tax_configuration_id?: string | null
          tax_method?: string | null
          taxable_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_info_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_info_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_info_tax_configuration_id_fkey"
            columns: ["tax_configuration_id"]
            isOneToOne: false
            referencedRelation: "tax_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shifts: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_from_date: string
          effective_to_date: string | null
          employee_id: string
          id: string
          is_active: boolean | null
          organization_id: string
          shift_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_from_date?: string
          effective_to_date?: string | null
          employee_id: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          shift_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_from_date?: string
          effective_to_date?: string | null
          employee_id?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          shift_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_employee_shifts_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employee_shifts_shift"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_status: {
        Row: {
          created_at: string
          employee_id: string
          expires_at: string
          id: string
          location: string
          organization_id: string
          status_text: string
          status_type: Database["public"]["Enums"]["status_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          expires_at?: string
          id?: string
          location: string
          organization_id: string
          status_text: string
          status_type: Database["public"]["Enums"]["status_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          expires_at?: string
          id?: string
          location?: string
          organization_id?: string
          status_text?: string
          status_type?: Database["public"]["Enums"]["status_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_employee_status_employee_id"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employee_status_organization_id"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_statuses: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_targets: {
        Row: {
          created_at: string
          created_by: string
          current_value: number
          description: string | null
          employee_id: string
          end_date: string
          id: string
          metadata: Json | null
          organization_id: string
          progress_percentage: number
          start_date: string
          status: string
          target_category: string
          target_type: string
          target_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_value?: number
          description?: string | null
          employee_id: string
          end_date?: string
          id?: string
          metadata?: Json | null
          organization_id: string
          progress_percentage?: number
          start_date?: string
          status?: string
          target_category: string
          target_type: string
          target_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_value?: number
          description?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          progress_percentage?: number
          start_date?: string
          status?: string
          target_category?: string
          target_type?: string
          target_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_targets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_work_experiences: {
        Row: {
          company_name: string
          created_at: string
          employee_id: string
          end_date: string | null
          id: string
          is_current: boolean | null
          job_description: string | null
          location: string | null
          organization_id: string | null
          position: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          employee_id: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          job_description?: string | null
          location?: string | null
          organization_id?: string | null
          position: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          job_description?: string | null
          location?: string | null
          organization_id?: string | null
          position?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_employee_work_experiences_employee_id"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          birth_date: string | null
          birth_place: string | null
          branch_id: string | null
          certificate_files: string | null
          citizen_address: string | null
          contract_file: string | null
          created_at: string | null
          created_by: string | null
          cv_file: string | null
          department_id: string | null
          email: string | null
          employee_id: string | null
          employee_status_id: string | null
          family_card_file: string | null
          full_name: string
          gender: string | null
          hire_date: string | null
          id: string
          id_card_file: string | null
          job_level_id: string | null
          job_position_id: string | null
          join_date: string | null
          last_leave_calculation: string | null
          leave_balance: number | null
          leave_entitlement_date: string | null
          marital_status: string | null
          mobile_phone: string | null
          nationality: string | null
          nik: string | null
          organization_id: string | null
          photo_url: string | null
          postal_code: string | null
          probation_end_date: string | null
          profile_photo_url: string | null
          religion: string | null
          salary_structure_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          work_schedule_id: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          branch_id?: string | null
          certificate_files?: string | null
          citizen_address?: string | null
          contract_file?: string | null
          created_at?: string | null
          created_by?: string | null
          cv_file?: string | null
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          employee_status_id?: string | null
          family_card_file?: string | null
          full_name: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          id_card_file?: string | null
          job_level_id?: string | null
          job_position_id?: string | null
          join_date?: string | null
          last_leave_calculation?: string | null
          leave_balance?: number | null
          leave_entitlement_date?: string | null
          marital_status?: string | null
          mobile_phone?: string | null
          nationality?: string | null
          nik?: string | null
          organization_id?: string | null
          photo_url?: string | null
          postal_code?: string | null
          probation_end_date?: string | null
          profile_photo_url?: string | null
          religion?: string | null
          salary_structure_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          work_schedule_id?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          branch_id?: string | null
          certificate_files?: string | null
          citizen_address?: string | null
          contract_file?: string | null
          created_at?: string | null
          created_by?: string | null
          cv_file?: string | null
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          employee_status_id?: string | null
          family_card_file?: string | null
          full_name?: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          id_card_file?: string | null
          job_level_id?: string | null
          job_position_id?: string | null
          join_date?: string | null
          last_leave_calculation?: string | null
          leave_balance?: number | null
          leave_entitlement_date?: string | null
          marital_status?: string | null
          mobile_phone?: string | null
          nationality?: string | null
          nik?: string | null
          organization_id?: string | null
          photo_url?: string | null
          postal_code?: string | null
          probation_end_date?: string | null
          profile_photo_url?: string | null
          religion?: string | null
          salary_structure_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          work_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedule_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employees_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employees_department"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employees_employee_status"
            columns: ["employee_status_id"]
            isOneToOne: false
            referencedRelation: "employee_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employees_job_level"
            columns: ["job_level_id"]
            isOneToOne: false
            referencedRelation: "job_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employees_job_position"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employees_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          description: string | null
          expense_type_id: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expense_type_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expense_type_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_expense_type_id_fkey"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          create_date: string
          created_at: string
          created_by: string
          department: string | null
          description: string | null
          expense_category_id: string | null
          expense_name: string
          expense_type: string
          expense_type_id: string | null
          first_payment_date: string | null
          id: string
          is_recurring: boolean
          next_payment_date: string | null
          organization_id: string
          receipt_url: string | null
          receipt_urls: unknown | null
          recurring_frequency: string | null
          recurring_settlement_for_expense_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          create_date: string
          created_at?: string
          created_by: string
          department?: string | null
          description?: string | null
          expense_category_id?: string | null
          expense_name: string
          expense_type: string
          expense_type_id?: string | null
          first_payment_date?: string | null
          id?: string
          is_recurring?: boolean
          next_payment_date?: string | null
          organization_id: string
          receipt_url?: string | null
          receipt_urls?: unknown | null
          recurring_frequency?: string | null
          recurring_settlement_for_expense_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          create_date?: string
          created_at?: string
          created_by?: string
          department?: string | null
          description?: string | null
          expense_category_id?: string | null
          expense_name?: string
          expense_type?: string
          expense_type_id?: string | null
          first_payment_date?: string | null
          id?: string
          is_recurring?: boolean
          next_payment_date?: string | null
          organization_id?: string
          receipt_url?: string | null
          receipt_urls?: unknown | null
          recurring_frequency?: string | null
          recurring_settlement_for_expense_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_expense_type_id_fkey"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_points: {
        Row: {
          created_at: string | null
          cycle_id: string
          employee_id: string
          id: string
          key_result_id: string | null
          organization_id: string
          points: number
          reason: string
        }
        Insert: {
          created_at?: string | null
          cycle_id: string
          employee_id: string
          id?: string
          key_result_id?: string | null
          organization_id: string
          points: number
          reason: string
        }
        Update: {
          created_at?: string | null
          cycle_id?: string
          employee_id?: string
          id?: string
          key_result_id?: string | null
          organization_id?: string
          points?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_points_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "okr_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_accounts: {
        Row: {
          account_name: string | null
          account_status: string | null
          account_type: string | null
          auto_tagging_enabled: boolean | null
          connection_id: string
          created_at: string
          currency_code: string | null
          customer_id: string
          final_url_suffix: string | null
          id: string
          last_sync_at: string | null
          manager_account: boolean | null
          organization_id: string
          test_account: boolean | null
          time_zone: string | null
          tracking_url_template: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_status?: string | null
          account_type?: string | null
          auto_tagging_enabled?: boolean | null
          connection_id: string
          created_at?: string
          currency_code?: string | null
          customer_id: string
          final_url_suffix?: string | null
          id?: string
          last_sync_at?: string | null
          manager_account?: boolean | null
          organization_id: string
          test_account?: boolean | null
          time_zone?: string | null
          tracking_url_template?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_status?: string | null
          account_type?: string | null
          auto_tagging_enabled?: boolean | null
          connection_id?: string
          created_at?: string
          currency_code?: string | null
          customer_id?: string
          final_url_suffix?: string | null
          id?: string
          last_sync_at?: string | null
          manager_account?: boolean | null
          organization_id?: string
          test_account?: boolean | null
          time_zone?: string | null
          tracking_url_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_google_ads_accounts_connection"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_ads_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_ad_groups: {
        Row: {
          account_id: string
          ad_group_id: string
          ad_group_name: string
          ad_group_status: string
          ad_group_type: string | null
          campaign_id: string
          cpc_bid_micros: number | null
          cpm_bid_micros: number | null
          cpv_bid_micros: number | null
          created_at: string
          effective_target_cpa_micros: number | null
          id: string
          last_sync_at: string | null
          organization_id: string
          target_cpa_micros: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          ad_group_id: string
          ad_group_name: string
          ad_group_status: string
          ad_group_type?: string | null
          campaign_id: string
          cpc_bid_micros?: number | null
          cpm_bid_micros?: number | null
          cpv_bid_micros?: number | null
          created_at?: string
          effective_target_cpa_micros?: number | null
          id?: string
          last_sync_at?: string | null
          organization_id: string
          target_cpa_micros?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          ad_group_id?: string
          ad_group_name?: string
          ad_group_status?: string
          ad_group_type?: string | null
          campaign_id?: string
          cpc_bid_micros?: number | null
          cpm_bid_micros?: number | null
          cpv_bid_micros?: number | null
          created_at?: string
          effective_target_cpa_micros?: number | null
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          target_cpa_micros?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_google_ads_ad_groups_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "google_ads_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_auth_logs: {
        Row: {
          auth_url: string | null
          callback_code: string | null
          callback_error: string | null
          callback_state: string | null
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          organization_id: string
          redirect_uri: string | null
          step: string | null
          success: boolean
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth_url?: string | null
          callback_code?: string | null
          callback_error?: string | null
          callback_state?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          organization_id: string
          redirect_uri?: string | null
          step?: string | null
          success?: boolean
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth_url?: string | null
          callback_code?: string | null
          callback_error?: string | null
          callback_state?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string
          redirect_uri?: string | null
          step?: string | null
          success?: boolean
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      google_ads_campaigns: {
        Row: {
          account_id: string
          advertising_channel_sub_type: string | null
          advertising_channel_type: string | null
          bidding_strategy_type: string | null
          budget_amount_micros: number | null
          budget_delivery_method: string | null
          budget_id: string | null
          campaign_id: string
          campaign_name: string
          campaign_status: string
          created_at: string
          end_date: string | null
          id: string
          last_sync_at: string | null
          optimization_score: number | null
          organization_id: string
          serving_status: string | null
          start_date: string | null
          target_cpa_micros: number | null
          target_roas: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          advertising_channel_sub_type?: string | null
          advertising_channel_type?: string | null
          bidding_strategy_type?: string | null
          budget_amount_micros?: number | null
          budget_delivery_method?: string | null
          budget_id?: string | null
          campaign_id: string
          campaign_name: string
          campaign_status: string
          created_at?: string
          end_date?: string | null
          id?: string
          last_sync_at?: string | null
          optimization_score?: number | null
          organization_id: string
          serving_status?: string | null
          start_date?: string | null
          target_cpa_micros?: number | null
          target_roas?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          advertising_channel_sub_type?: string | null
          advertising_channel_type?: string | null
          bidding_strategy_type?: string | null
          budget_amount_micros?: number | null
          budget_delivery_method?: string | null
          budget_id?: string | null
          campaign_id?: string
          campaign_name?: string
          campaign_status?: string
          created_at?: string
          end_date?: string | null
          id?: string
          last_sync_at?: string | null
          optimization_score?: number | null
          organization_id?: string
          serving_status?: string | null
          start_date?: string | null
          target_cpa_micros?: number | null
          target_roas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_google_ads_campaigns_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_ads_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_connections: {
        Row: {
          access_token: string | null
          account_name: string | null
          connected_at: string | null
          created_at: string
          customer_id: string | null
          expires_at: string | null
          google_account_email: string | null
          google_account_id: string | null
          google_account_name: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          organization_id: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_name?: string | null
          connected_at?: string | null
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          google_account_email?: string | null
          google_account_id?: string | null
          google_account_name?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          organization_id: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_name?: string | null
          connected_at?: string | null
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          google_account_email?: string | null
          google_account_id?: string | null
          google_account_name?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          organization_id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_ads_keywords: {
        Row: {
          account_id: string
          ad_group_id: string
          campaign_id: string
          created_at: string
          final_mobile_urls: string[] | null
          final_urls: string[] | null
          first_page_cpc_micros: number | null
          id: string
          keyword_id: string
          keyword_match_type: string
          keyword_status: string
          keyword_text: string
          last_sync_at: string | null
          organization_id: string
          quality_score: number | null
          top_of_page_cpc_micros: number | null
          tracking_url_template: string | null
          updated_at: string
          url_custom_parameters: Json | null
        }
        Insert: {
          account_id: string
          ad_group_id: string
          campaign_id: string
          created_at?: string
          final_mobile_urls?: string[] | null
          final_urls?: string[] | null
          first_page_cpc_micros?: number | null
          id?: string
          keyword_id: string
          keyword_match_type: string
          keyword_status: string
          keyword_text: string
          last_sync_at?: string | null
          organization_id: string
          quality_score?: number | null
          top_of_page_cpc_micros?: number | null
          tracking_url_template?: string | null
          updated_at?: string
          url_custom_parameters?: Json | null
        }
        Update: {
          account_id?: string
          ad_group_id?: string
          campaign_id?: string
          created_at?: string
          final_mobile_urls?: string[] | null
          final_urls?: string[] | null
          first_page_cpc_micros?: number | null
          id?: string
          keyword_id?: string
          keyword_match_type?: string
          keyword_status?: string
          keyword_text?: string
          last_sync_at?: string | null
          organization_id?: string
          quality_score?: number | null
          top_of_page_cpc_micros?: number | null
          tracking_url_template?: string | null
          updated_at?: string
          url_custom_parameters?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_google_ads_keywords_ad_group"
            columns: ["ad_group_id"]
            isOneToOne: false
            referencedRelation: "google_ads_ad_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_metrics: {
        Row: {
          account_id: string
          average_cpc_micros: number | null
          average_cpm_micros: number | null
          average_cpv_micros: number | null
          average_time_on_site: number | null
          bounce_rate: number | null
          clicks: number | null
          conversion_value_micros: number | null
          conversions: number | null
          cost_micros: number | null
          created_at: string
          ctr: number | null
          entity_id: string
          entity_type: string
          id: string
          impressions: number | null
          metric_date: string
          organization_id: string
          updated_at: string
          video_quartile_p100_rate: number | null
          video_quartile_p25_rate: number | null
          video_quartile_p50_rate: number | null
          video_quartile_p75_rate: number | null
          video_view_rate: number | null
          video_views: number | null
          view_through_conversions: number | null
        }
        Insert: {
          account_id: string
          average_cpc_micros?: number | null
          average_cpm_micros?: number | null
          average_cpv_micros?: number | null
          average_time_on_site?: number | null
          bounce_rate?: number | null
          clicks?: number | null
          conversion_value_micros?: number | null
          conversions?: number | null
          cost_micros?: number | null
          created_at?: string
          ctr?: number | null
          entity_id: string
          entity_type: string
          id?: string
          impressions?: number | null
          metric_date: string
          organization_id: string
          updated_at?: string
          video_quartile_p100_rate?: number | null
          video_quartile_p25_rate?: number | null
          video_quartile_p50_rate?: number | null
          video_quartile_p75_rate?: number | null
          video_view_rate?: number | null
          video_views?: number | null
          view_through_conversions?: number | null
        }
        Update: {
          account_id?: string
          average_cpc_micros?: number | null
          average_cpm_micros?: number | null
          average_cpv_micros?: number | null
          average_time_on_site?: number | null
          bounce_rate?: number | null
          clicks?: number | null
          conversion_value_micros?: number | null
          conversions?: number | null
          cost_micros?: number | null
          created_at?: string
          ctr?: number | null
          entity_id?: string
          entity_type?: string
          id?: string
          impressions?: number | null
          metric_date?: string
          organization_id?: string
          updated_at?: string
          video_quartile_p100_rate?: number | null
          video_quartile_p25_rate?: number | null
          video_quartile_p50_rate?: number | null
          video_quartile_p75_rate?: number | null
          video_view_rate?: number | null
          video_views?: number | null
          view_through_conversions?: number | null
        }
        Relationships: []
      }
      google_drive_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          organization_id: string
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          organization_id: string
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          organization_id?: string
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_drive_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          id: string
          last_used_at: string | null
          organization_id: string
          refresh_token: string | null
          scope: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          id?: string
          last_used_at?: string | null
          organization_id: string
          refresh_token?: string | null
          scope?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          id?: string
          last_used_at?: string | null
          organization_id?: string
          refresh_token?: string | null
          scope?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_drive_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      income_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          income_types_id: string | null
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          income_types_id?: string | null
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          income_types_id?: string | null
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "income_categories_income_types_id_fkey"
            columns: ["income_types_id"]
            isOneToOne: false
            referencedRelation: "income_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      income_transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          created_by: string | null
          customer_name: string | null
          description: string | null
          id: string
          income_type_id: string | null
          is_recurring: boolean | null
          organization_id: string
          payment_method: string | null
          receipt_file_name: string | null
          receipt_file_path: string | null
          receipt_file_size: number | null
          receipt_mime_type: string | null
          recurring_frequency: string | null
          service_id: string | null
          status: string | null
          sub_service_id: string | null
          transaction_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          income_type_id?: string | null
          is_recurring?: boolean | null
          organization_id: string
          payment_method?: string | null
          receipt_file_name?: string | null
          receipt_file_path?: string | null
          receipt_file_size?: number | null
          receipt_mime_type?: string | null
          recurring_frequency?: string | null
          service_id?: string | null
          status?: string | null
          sub_service_id?: string | null
          transaction_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          income_type_id?: string | null
          is_recurring?: boolean | null
          organization_id?: string
          payment_method?: string | null
          receipt_file_name?: string | null
          receipt_file_path?: string | null
          receipt_file_size?: number | null
          receipt_mime_type?: string | null
          recurring_frequency?: string | null
          service_id?: string | null
          status?: string | null
          sub_service_id?: string | null
          transaction_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_transactions_income_type_id_fkey"
            columns: ["income_type_id"]
            isOneToOne: false
            referencedRelation: "income_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_transactions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_transactions_sub_service_id_fkey"
            columns: ["sub_service_id"]
            isOneToOne: false
            referencedRelation: "sub_services"
            referencedColumns: ["id"]
          },
        ]
      }
      income_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "income_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      individual_objectives: {
        Row: {
          company_objective_id: string | null
          created_at: string
          created_by: string
          cycle_id: string
          department_id: string | null
          department_objective_id: string | null
          description: string | null
          employee_id: string
          end_date: string | null
          id: string
          organization_id: string
          owner_id: string
          progress_percentage: number
          start_date: string | null
          status: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at: string
          weight: number | null
          why_important: string | null
        }
        Insert: {
          company_objective_id?: string | null
          created_at?: string
          created_by: string
          cycle_id: string
          department_id?: string | null
          department_objective_id?: string | null
          description?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          organization_id: string
          owner_id: string
          progress_percentage?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at?: string
          weight?: number | null
          why_important?: string | null
        }
        Update: {
          company_objective_id?: string | null
          created_at?: string
          created_by?: string
          cycle_id?: string
          department_id?: string | null
          department_objective_id?: string | null
          description?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          organization_id?: string
          owner_id?: string
          progress_percentage?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title?: string
          updated_at?: string
          weight?: number | null
          why_important?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "individual_objectives_company_objective_id_fkey"
            columns: ["company_objective_id"]
            isOneToOne: false
            referencedRelation: "company_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_objectives_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "okr_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_objectives_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_objectives_department_objective_id_fkey"
            columns: ["department_objective_id"]
            isOneToOne: false
            referencedRelation: "department_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_objectives_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_objectives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          created_at: string
          created_by: string
          id: string
          invoice_description: string | null
          is_active: boolean
          organization_id: string
          template_name: string
          updated_at: string
        }
        Insert: {
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          created_by: string
          id?: string
          invoice_description?: string | null
          is_active?: boolean
          organization_id: string
          template_name?: string
          updated_at?: string
        }
        Update: {
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          created_by?: string
          id?: string
          invoice_description?: string | null
          is_active?: boolean
          organization_id?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      it_support_tickets: {
        Row: {
          assigned_to: string | null
          assignee: string | null
          category: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          creator_email: string
          creator_name: string
          department: string
          description: string | null
          id: string
          organization_id: string
          priority: string
          related_asset: string | null
          status: string
          ticket_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          assignee?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          creator_email: string
          creator_name: string
          department?: string
          description?: string | null
          id?: string
          organization_id: string
          priority?: string
          related_asset?: string | null
          status?: string
          ticket_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          assignee?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          creator_email?: string
          creator_name?: string
          department?: string
          description?: string | null
          id?: string
          organization_id?: string
          priority?: string
          related_asset?: string | null
          status?: string
          ticket_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applicant_email: string
          applicant_name: string
          applicant_phone: string | null
          birth_date: string | null
          candidate_profile_id: string | null
          cover_letter: string | null
          created_at: string
          cv_file_path: string | null
          expected_salary: string | null
          experience_years: string | null
          gender: string | null
          id: string
          interview_date: string | null
          interview_location: string | null
          interview_notes: string | null
          interview_status: string | null
          interview_time: string | null
          interviewer_email: string | null
          interviewer_name: string | null
          job_opening_id: string
          nik: string | null
          organization_id: string | null
          recruitment_link_id: string | null
          recruitment_token: string | null
          skills: Json | null
          status: string | null
          updated_at: string
        }
        Insert: {
          applicant_email: string
          applicant_name: string
          applicant_phone?: string | null
          birth_date?: string | null
          candidate_profile_id?: string | null
          cover_letter?: string | null
          created_at?: string
          cv_file_path?: string | null
          expected_salary?: string | null
          experience_years?: string | null
          gender?: string | null
          id?: string
          interview_date?: string | null
          interview_location?: string | null
          interview_notes?: string | null
          interview_status?: string | null
          interview_time?: string | null
          interviewer_email?: string | null
          interviewer_name?: string | null
          job_opening_id: string
          nik?: string | null
          organization_id?: string | null
          recruitment_link_id?: string | null
          recruitment_token?: string | null
          skills?: Json | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          applicant_email?: string
          applicant_name?: string
          applicant_phone?: string | null
          birth_date?: string | null
          candidate_profile_id?: string | null
          cover_letter?: string | null
          created_at?: string
          cv_file_path?: string | null
          expected_salary?: string | null
          experience_years?: string | null
          gender?: string | null
          id?: string
          interview_date?: string | null
          interview_location?: string | null
          interview_notes?: string | null
          interview_status?: string | null
          interview_time?: string | null
          interviewer_email?: string | null
          interviewer_name?: string | null
          job_opening_id?: string
          nik?: string | null
          organization_id?: string | null
          recruitment_link_id?: string | null
          recruitment_token?: string | null
          skills?: Json | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_recruitment_link_id_fkey"
            columns: ["recruitment_link_id"]
            isOneToOne: false
            referencedRelation: "recruitment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      job_levels: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          level_order: number | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level_order?: number | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level_order?: number | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_levels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings: {
        Row: {
          benefits: Json | null
          clicks: number | null
          closing_date: string | null
          created_at: string
          created_by: string
          department_id: string | null
          employment_status_id: string | null
          id: string
          job_description: string | null
          job_level_id: string | null
          job_position_id: string | null
          job_title: string
          location: string | null
          organization_id: string | null
          posted_date: string | null
          required_skills: Json | null
          requirements: string | null
          responsibilities: string | null
          salary_max: number | null
          salary_min: number | null
          status: string
          submissions: number | null
          updated_at: string
        }
        Insert: {
          benefits?: Json | null
          clicks?: number | null
          closing_date?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          employment_status_id?: string | null
          id?: string
          job_description?: string | null
          job_level_id?: string | null
          job_position_id?: string | null
          job_title: string
          location?: string | null
          organization_id?: string | null
          posted_date?: string | null
          required_skills?: Json | null
          requirements?: string | null
          responsibilities?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          submissions?: number | null
          updated_at?: string
        }
        Update: {
          benefits?: Json | null
          clicks?: number | null
          closing_date?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          employment_status_id?: string | null
          id?: string
          job_description?: string | null
          job_level_id?: string | null
          job_position_id?: string | null
          job_title?: string
          location?: string | null
          organization_id?: string | null
          posted_date?: string | null
          required_skills?: Json | null
          requirements?: string | null
          responsibilities?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          submissions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_openings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_openings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_openings_employment_status_id_fkey"
            columns: ["employment_status_id"]
            isOneToOne: false
            referencedRelation: "employee_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_openings_job_level_id_fkey"
            columns: ["job_level_id"]
            isOneToOne: false
            referencedRelation: "job_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_openings_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_openings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_positions: {
        Row: {
          code: string | null
          created_at: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      key_result_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          key_result_id: string
          notes: string | null
          organization_id: string
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          key_result_id: string
          notes?: string | null
          organization_id: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          key_result_id?: string
          notes?: string | null
          organization_id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_result_approvals_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: true
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_result_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      key_results: {
        Row: {
          assigned_employee_id: string | null
          calculation_type: Database["public"]["Enums"]["kr_calculation_type"]
          company_objective_id: string | null
          conversion_date: string | null
          converted_to_objective_id: string | null
          created_at: string | null
          created_by: string
          created_by_department_id: string | null
          current_value: number | null
          department_id: string | null
          department_objective_id: string | null
          description: string | null
          employee_id: string | null
          id: string
          individual_objective_id: string | null
          is_inverse: boolean | null
          metric_type: Database["public"]["Enums"]["kr_metric_type"]
          organization_id: string
          owner_level: Database["public"]["Enums"]["okr_level"] | null
          progress_percentage: number | null
          start_value: number | null
          target_value: number
          title: string
          unit: string | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          assigned_employee_id?: string | null
          calculation_type: Database["public"]["Enums"]["kr_calculation_type"]
          company_objective_id?: string | null
          conversion_date?: string | null
          converted_to_objective_id?: string | null
          created_at?: string | null
          created_by: string
          created_by_department_id?: string | null
          current_value?: number | null
          department_id?: string | null
          department_objective_id?: string | null
          description?: string | null
          employee_id?: string | null
          id?: string
          individual_objective_id?: string | null
          is_inverse?: boolean | null
          metric_type: Database["public"]["Enums"]["kr_metric_type"]
          organization_id: string
          owner_level?: Database["public"]["Enums"]["okr_level"] | null
          progress_percentage?: number | null
          start_value?: number | null
          target_value: number
          title: string
          unit?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          assigned_employee_id?: string | null
          calculation_type?: Database["public"]["Enums"]["kr_calculation_type"]
          company_objective_id?: string | null
          conversion_date?: string | null
          converted_to_objective_id?: string | null
          created_at?: string | null
          created_by?: string
          created_by_department_id?: string | null
          current_value?: number | null
          department_id?: string | null
          department_objective_id?: string | null
          description?: string | null
          employee_id?: string | null
          id?: string
          individual_objective_id?: string | null
          is_inverse?: boolean | null
          metric_type?: Database["public"]["Enums"]["kr_metric_type"]
          organization_id?: string
          owner_level?: Database["public"]["Enums"]["okr_level"] | null
          progress_percentage?: number | null
          start_value?: number | null
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_key_results_company_objective"
            columns: ["company_objective_id"]
            isOneToOne: false
            referencedRelation: "company_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_key_results_department_objective"
            columns: ["department_objective_id"]
            isOneToOne: false
            referencedRelation: "department_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_key_results_individual_objective"
            columns: ["individual_objective_id"]
            isOneToOne: false
            referencedRelation: "individual_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_key_results_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_company_objective_id_fkey"
            columns: ["company_objective_id"]
            isOneToOne: false
            referencedRelation: "company_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_created_by_department_id_fkey"
            columns: ["created_by_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_department_objective_id_fkey"
            columns: ["department_objective_id"]
            isOneToOne: false
            referencedRelation: "department_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_individual_objective_id_fkey"
            columns: ["individual_objective_id"]
            isOneToOne: false
            referencedRelation: "individual_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_campaign_assignments: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          kol_profile_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          kol_profile_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          kol_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kol_campaign_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "kol_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_campaign_assignments_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_campaign_budget_allocations: {
        Row: {
          actual_payout: number | null
          allocated_budget: number
          base_budget: number | null
          bonus_budget: number | null
          budget_type: string | null
          budget_utilization_percentage: number | null
          campaign_id: string
          created_at: string | null
          id: string
          kol_profile_id: string
          milestone_completion_rate: number | null
          notes: string | null
          organization_id: string
          payment_model: string | null
          payment_terms_id: string | null
          performance_multiplier: number | null
          updated_at: string | null
        }
        Insert: {
          actual_payout?: number | null
          allocated_budget?: number
          base_budget?: number | null
          bonus_budget?: number | null
          budget_type?: string | null
          budget_utilization_percentage?: number | null
          campaign_id: string
          created_at?: string | null
          id?: string
          kol_profile_id: string
          milestone_completion_rate?: number | null
          notes?: string | null
          organization_id: string
          payment_model?: string | null
          payment_terms_id?: string | null
          performance_multiplier?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_payout?: number | null
          allocated_budget?: number
          base_budget?: number | null
          bonus_budget?: number | null
          budget_type?: string | null
          budget_utilization_percentage?: number | null
          campaign_id?: string
          created_at?: string | null
          id?: string
          kol_profile_id?: string
          milestone_completion_rate?: number | null
          notes?: string | null
          organization_id?: string
          payment_model?: string | null
          payment_terms_id?: string | null
          performance_multiplier?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_campaign_budget_allocations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "kol_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_campaign_budget_allocations_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_campaign_budget_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_campaign_budget_allocations_payment_terms_id_fkey"
            columns: ["payment_terms_id"]
            isOneToOne: false
            referencedRelation: "kol_payment_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_campaign_deliverables: {
        Row: {
          campaign_id: string
          content_type: string
          created_at: string | null
          deliverable_type: string | null
          description: string | null
          due_date: string | null
          id: string
          kol_profile_id: string | null
          organization_id: string
          platform: string
          price_per_deliverable: number | null
          quantity: number
          status: string | null
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          content_type: string
          created_at?: string | null
          deliverable_type?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          kol_profile_id?: string | null
          organization_id: string
          platform: string
          price_per_deliverable?: number | null
          quantity?: number
          status?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          content_type?: string
          created_at?: string | null
          deliverable_type?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          kol_profile_id?: string | null
          organization_id?: string
          platform?: string
          price_per_deliverable?: number | null
          quantity?: number
          status?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_campaign_deliverables_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "kol_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_campaign_deliverables_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_campaign_deliverables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_campaigns: {
        Row: {
          allocated_budget: number | null
          budget: number | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          objectives: string | null
          organization_id: string
          remaining_budget: number | null
          start_date: string | null
          status: string
          target_conversion: number | null
          target_engagement: number | null
          target_reach: number | null
          total_budget: number | null
          updated_at: string
        }
        Insert: {
          allocated_budget?: number | null
          budget?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          objectives?: string | null
          organization_id: string
          remaining_budget?: number | null
          start_date?: string | null
          status?: string
          target_conversion?: number | null
          target_engagement?: number | null
          target_reach?: number | null
          total_budget?: number | null
          updated_at?: string
        }
        Update: {
          allocated_budget?: number | null
          budget?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          objectives?: string | null
          organization_id?: string
          remaining_budget?: number | null
          start_date?: string | null
          status?: string
          target_conversion?: number | null
          target_engagement?: number | null
          target_reach?: number | null
          total_budget?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kol_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_content_posts: {
        Row: {
          campaign_assignment_id: string
          campaign_deliverable_id: string | null
          campaign_id: string | null
          caption: string | null
          content_text: string | null
          content_type: string | null
          created_at: string
          hashtags: string[] | null
          id: string
          kol_profile_id: string | null
          mentions: string[] | null
          organization_id: string | null
          platform: string
          post_date: string | null
          post_type: string | null
          post_url: string | null
          scheduled_date: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          campaign_assignment_id: string
          campaign_deliverable_id?: string | null
          campaign_id?: string | null
          caption?: string | null
          content_text?: string | null
          content_type?: string | null
          created_at?: string
          hashtags?: string[] | null
          id?: string
          kol_profile_id?: string | null
          mentions?: string[] | null
          organization_id?: string | null
          platform: string
          post_date?: string | null
          post_type?: string | null
          post_url?: string | null
          scheduled_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          campaign_assignment_id?: string
          campaign_deliverable_id?: string | null
          campaign_id?: string | null
          caption?: string | null
          content_text?: string | null
          content_type?: string | null
          created_at?: string
          hashtags?: string[] | null
          id?: string
          kol_profile_id?: string | null
          mentions?: string[] | null
          organization_id?: string | null
          platform?: string
          post_date?: string | null
          post_type?: string | null
          post_url?: string | null
          scheduled_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kol_content_posts_campaign_assignment_id_fkey"
            columns: ["campaign_assignment_id"]
            isOneToOne: false
            referencedRelation: "kol_campaign_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_content_posts_campaign_deliverable_id_fkey"
            columns: ["campaign_deliverable_id"]
            isOneToOne: false
            referencedRelation: "kol_campaign_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_content_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "kol_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_content_posts_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_content_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_contracts: {
        Row: {
          campaign_id: string
          company_signature_date: string | null
          company_signed_by: string | null
          content_requirements: Json | null
          contract_end_date: string | null
          contract_number: string
          contract_start_date: string | null
          contract_template_id: string | null
          contract_terms: Json
          created_at: string | null
          created_by: string | null
          deliverables: Json | null
          digital_signature_hash: string | null
          id: string
          kol_profile_id: string
          kol_signature_date: string | null
          kpi_metrics: Json
          organization_id: string
          penalties: Json | null
          posting_schedule: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          company_signature_date?: string | null
          company_signed_by?: string | null
          content_requirements?: Json | null
          contract_end_date?: string | null
          contract_number: string
          contract_start_date?: string | null
          contract_template_id?: string | null
          contract_terms?: Json
          created_at?: string | null
          created_by?: string | null
          deliverables?: Json | null
          digital_signature_hash?: string | null
          id?: string
          kol_profile_id: string
          kol_signature_date?: string | null
          kpi_metrics?: Json
          organization_id: string
          penalties?: Json | null
          posting_schedule?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          company_signature_date?: string | null
          company_signed_by?: string | null
          content_requirements?: Json | null
          contract_end_date?: string | null
          contract_number?: string
          contract_start_date?: string | null
          contract_template_id?: string | null
          contract_terms?: Json
          created_at?: string | null
          created_by?: string | null
          deliverables?: Json | null
          digital_signature_hash?: string | null
          id?: string
          kol_profile_id?: string
          kol_signature_date?: string | null
          kpi_metrics?: Json
          organization_id?: string
          penalties?: Json | null
          posting_schedule?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_contracts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "kol_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_contracts_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_conversions: {
        Row: {
          content_post_id: string
          conversion_date: string
          conversion_type: string
          conversion_value: number | null
          created_at: string
          id: string
          kol_profile_id: string | null
          organization_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          content_post_id: string
          conversion_date?: string
          conversion_type: string
          conversion_value?: number | null
          created_at?: string
          id?: string
          kol_profile_id?: string | null
          organization_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          content_post_id?: string
          conversion_date?: string
          conversion_type?: string
          conversion_value?: number | null
          created_at?: string
          id?: string
          kol_profile_id?: string | null
          organization_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_conversions_content_post_id_fkey"
            columns: ["content_post_id"]
            isOneToOne: false
            referencedRelation: "kol_content_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_conversions_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_payment_terms: {
        Row: {
          barter_value: number | null
          base_amount: number | null
          bonus_amount: number | null
          bonus_conditions: Json | null
          campaign_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          deduction_amount: number | null
          deduction_reason: string | null
          down_payment_amount: number | null
          down_payment_date: string | null
          effective_end_date: string | null
          effective_start_date: string | null
          final_payment_date: string | null
          id: string
          is_active: boolean
          kol_content_post_id: string | null
          kol_profile_id: string | null
          milestones: Json | null
          organization_id: string
          payment_model: string
          payment_schedule: string | null
          performance_thresholds: Json | null
          remaining_amount: number | null
          status: string | null
          template_name: string | null
          terms_and_conditions: string | null
          terms_version: number
          type: string
          updated_at: string | null
        }
        Insert: {
          barter_value?: number | null
          base_amount?: number | null
          bonus_amount?: number | null
          bonus_conditions?: Json | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deduction_amount?: number | null
          deduction_reason?: string | null
          down_payment_amount?: number | null
          down_payment_date?: string | null
          effective_end_date?: string | null
          effective_start_date?: string | null
          final_payment_date?: string | null
          id?: string
          is_active?: boolean
          kol_content_post_id?: string | null
          kol_profile_id?: string | null
          milestones?: Json | null
          organization_id: string
          payment_model?: string
          payment_schedule?: string | null
          performance_thresholds?: Json | null
          remaining_amount?: number | null
          status?: string | null
          template_name?: string | null
          terms_and_conditions?: string | null
          terms_version?: number
          type: string
          updated_at?: string | null
        }
        Update: {
          barter_value?: number | null
          base_amount?: number | null
          bonus_amount?: number | null
          bonus_conditions?: Json | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deduction_amount?: number | null
          deduction_reason?: string | null
          down_payment_amount?: number | null
          down_payment_date?: string | null
          effective_end_date?: string | null
          effective_start_date?: string | null
          final_payment_date?: string | null
          id?: string
          is_active?: boolean
          kol_content_post_id?: string | null
          kol_profile_id?: string | null
          milestones?: Json | null
          organization_id?: string
          payment_model?: string
          payment_schedule?: string | null
          performance_thresholds?: Json | null
          remaining_amount?: number | null
          status?: string | null
          template_name?: string | null
          terms_and_conditions?: string | null
          terms_version?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_payment_terms_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "kol_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_payment_terms_kol_content_post_id_fkey"
            columns: ["kol_content_post_id"]
            isOneToOne: false
            referencedRelation: "kol_content_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_payment_terms_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_payment_terms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_performance_metrics: {
        Row: {
          clicks: number | null
          comments: number | null
          content_post_id: string
          conversion_rate: number | null
          created_at: string
          engagement_rate: number | null
          id: string
          impressions: number | null
          kol_profile_id: string
          likes: number | null
          organization_id: string | null
          reach: number | null
          recorded_at: string
          saves: number | null
          shares: number | null
          updated_at: string | null
          views: number | null
        }
        Insert: {
          clicks?: number | null
          comments?: number | null
          content_post_id: string
          conversion_rate?: number | null
          created_at?: string
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          kol_profile_id: string
          likes?: number | null
          organization_id?: string | null
          reach?: number | null
          recorded_at?: string
          saves?: number | null
          shares?: number | null
          updated_at?: string | null
          views?: number | null
        }
        Update: {
          clicks?: number | null
          comments?: number | null
          content_post_id?: string
          conversion_rate?: number | null
          created_at?: string
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          kol_profile_id?: string
          likes?: number | null
          organization_id?: string | null
          reach?: number | null
          recorded_at?: string
          saves?: number | null
          shares?: number | null
          updated_at?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_performance_metrics_content_post_id_fkey"
            columns: ["content_post_id"]
            isOneToOne: false
            referencedRelation: "kol_content_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_performance_metrics_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_performance_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_performance_thresholds: {
        Row: {
          achieved_at: string | null
          bonus_percentage: number | null
          campaign_id: string | null
          created_at: string | null
          current_value: number | null
          description: string | null
          id: string
          is_achieved: boolean | null
          is_active: boolean | null
          kol_content_post_id: string | null
          kol_profile_id: string | null
          metric_type: string
          organization_id: string
          payment_terms_id: string | null
          target_value: number
          updated_at: string | null
        }
        Insert: {
          achieved_at?: string | null
          bonus_percentage?: number | null
          campaign_id?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          is_achieved?: boolean | null
          is_active?: boolean | null
          kol_content_post_id?: string | null
          kol_profile_id?: string | null
          metric_type: string
          organization_id: string
          payment_terms_id?: string | null
          target_value: number
          updated_at?: string | null
        }
        Update: {
          achieved_at?: string | null
          bonus_percentage?: number | null
          campaign_id?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          is_achieved?: boolean | null
          is_active?: boolean | null
          kol_content_post_id?: string | null
          kol_profile_id?: string | null
          metric_type?: string
          organization_id?: string
          payment_terms_id?: string | null
          target_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      kol_profiles: {
        Row: {
          age: number | null
          average_views: number | null
          bio: string | null
          category: string | null
          created_at: string
          created_by: string | null
          email: string | null
          engagement_rate: number | null
          followers_count: number | null
          gender: string | null
          id: string
          languages_spoken: string | null
          location: string | null
          name: string
          niche: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          preferred_communication: string | null
          profile_photo_url: string | null
          specialties: string | null
          status: string
          total_posts: number | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          age?: number | null
          average_views?: number | null
          bio?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          engagement_rate?: number | null
          followers_count?: number | null
          gender?: string | null
          id?: string
          languages_spoken?: string | null
          location?: string | null
          name: string
          niche?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          preferred_communication?: string | null
          profile_photo_url?: string | null
          specialties?: string | null
          status?: string
          total_posts?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          age?: number | null
          average_views?: number | null
          bio?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          engagement_rate?: number | null
          followers_count?: number | null
          gender?: string | null
          id?: string
          languages_spoken?: string | null
          location?: string | null
          name?: string
          niche?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          preferred_communication?: string | null
          profile_photo_url?: string | null
          specialties?: string | null
          status?: string
          total_posts?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_rates: {
        Row: {
          content_type: string
          created_at: string
          currency: string | null
          id: string
          kol_profile_id: string
          platform: string
          rate_amount: number
          rate_type: string | null
          updated_at: string
        }
        Insert: {
          content_type: string
          created_at?: string
          currency?: string | null
          id?: string
          kol_profile_id: string
          platform: string
          rate_amount: number
          rate_type?: string | null
          updated_at?: string
        }
        Update: {
          content_type?: string
          created_at?: string
          currency?: string | null
          id?: string
          kol_profile_id?: string
          platform?: string
          rate_amount?: number
          rate_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kol_rates_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_ratings: {
        Row: {
          adherence_to_brief_rating: number | null
          areas_for_improvement: string | null
          audience_engagement_rating: number | null
          brand_alignment_rating: number | null
          campaign_id: string | null
          collaboration_highlights: string | null
          communication_rating: number | null
          content_quality_rating: number | null
          created_at: string | null
          feedback: string | null
          id: string
          kol_profile_id: string
          organization_id: string
          overall_rating: number
          professionalism_rating: number | null
          rated_by: string
          roi_rating: number | null
          satisfaction_rating: number | null
          updated_at: string | null
          would_collaborate_again: boolean | null
        }
        Insert: {
          adherence_to_brief_rating?: number | null
          areas_for_improvement?: string | null
          audience_engagement_rating?: number | null
          brand_alignment_rating?: number | null
          campaign_id?: string | null
          collaboration_highlights?: string | null
          communication_rating?: number | null
          content_quality_rating?: number | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          kol_profile_id: string
          organization_id: string
          overall_rating: number
          professionalism_rating?: number | null
          rated_by: string
          roi_rating?: number | null
          satisfaction_rating?: number | null
          updated_at?: string | null
          would_collaborate_again?: boolean | null
        }
        Update: {
          adherence_to_brief_rating?: number | null
          areas_for_improvement?: string | null
          audience_engagement_rating?: number | null
          brand_alignment_rating?: number | null
          campaign_id?: string | null
          collaboration_highlights?: string | null
          communication_rating?: number | null
          content_quality_rating?: number | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          kol_profile_id?: string
          organization_id?: string
          overall_rating?: number
          professionalism_rating?: number | null
          rated_by?: string
          roi_rating?: number | null
          satisfaction_rating?: number | null
          updated_at?: string | null
          would_collaborate_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_kol_ratings_kol_profile"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_kol_ratings_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_ratings_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_ratings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_social_media_accounts: {
        Row: {
          average_views: number | null
          created_at: string
          engagement_rate: number | null
          followers: number | null
          id: string
          is_verified: boolean | null
          kol_profile_id: string
          platform: string
          profile_url: string | null
          updated_at: string
          username: string
        }
        Insert: {
          average_views?: number | null
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          is_verified?: boolean | null
          kol_profile_id: string
          platform: string
          profile_url?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          average_views?: number | null
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          is_verified?: boolean | null
          kol_profile_id?: string
          platform?: string
          profile_url?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "kol_social_media_accounts_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_client_profiles: {
        Row: {
          age: number | null
          code: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          gender: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          lead_id: string
          location: string | null
          name: string
          notes: string | null
          occupation: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          code?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          gender?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          lead_id: string
          location?: string | null
          name: string
          notes?: string | null
          occupation?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          code?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          gender?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          lead_id?: string
          location?: string | null
          name?: string
          notes?: string | null
          occupation?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_client_profiles_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_client_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_follow_up_updates: {
        Row: {
          created_at: string
          created_by: string
          created_by_name: string
          id: string
          lead_id: string
          organization_id: string
          status: string | null
          update_details: string
        }
        Insert: {
          created_at?: string
          created_by: string
          created_by_name: string
          id?: string
          lead_id: string
          organization_id: string
          status?: string | null
          update_details: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_name?: string
          id?: string
          lead_id?: string
          organization_id?: string
          status?: string | null
          update_details?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_up_updates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          id: string
          lead_id: string
          new_status: string
          notes: string | null
          old_status: string | null
          organization_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          id?: string
          lead_id: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          organization_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_lead_status_history_lead"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_statuses: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assignee: string
          category: string
          client: string
          converted_at: string | null
          created_at: string
          created_by: string
          created_by_name: string
          followup: number | null
          fu_priority: string | null
          id: string
          organization_id: string
          services: string | null
          source: string | null
          status_id: string
          ticket_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee: string
          category: string
          client: string
          converted_at?: string | null
          created_at?: string
          created_by: string
          created_by_name: string
          followup?: number | null
          fu_priority?: string | null
          id?: string
          organization_id: string
          services?: string | null
          source?: string | null
          status_id: string
          ticket_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string
          category?: string
          client?: string
          converted_at?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string
          followup?: number | null
          fu_priority?: string | null
          id?: string
          organization_id?: string
          services?: string | null
          source?: string | null
          status_id?: string
          ticket_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_status_id"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_allocations: {
        Row: {
          allocation_date: string
          allocation_reason: string | null
          allocation_type: string
          created_at: string
          created_by: string | null
          days_allocated: number
          employee_id: string
          expires_at: string | null
          id: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          allocation_date?: string
          allocation_reason?: string | null
          allocation_type: string
          created_at?: string
          created_by?: string | null
          days_allocated?: number
          employee_id: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          allocation_date?: string
          allocation_reason?: string | null
          allocation_type?: string
          created_at?: string
          created_by?: string | null
          days_allocated?: number
          employee_id?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_policies: {
        Row: {
          annual_leave_days: number | null
          auto_grant_after_probation: boolean | null
          carry_over_expiry_months: number | null
          carry_over_limit: number | null
          created_at: string
          created_by: string | null
          effective_date: string | null
          id: string
          is_enabled: boolean
          leave_grant_after_months: number | null
          leave_strategy: string | null
          max_leave_balance: number | null
          organization_id: string
          policy_name: string
          policy_type: string
          probation_months: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          annual_leave_days?: number | null
          auto_grant_after_probation?: boolean | null
          carry_over_expiry_months?: number | null
          carry_over_limit?: number | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          is_enabled?: boolean
          leave_grant_after_months?: number | null
          leave_strategy?: string | null
          max_leave_balance?: number | null
          organization_id: string
          policy_name: string
          policy_type: string
          probation_months?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          annual_leave_days?: number | null
          auto_grant_after_probation?: boolean | null
          carry_over_expiry_months?: number | null
          carry_over_limit?: number | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          is_enabled?: boolean
          leave_grant_after_months?: number | null
          leave_strategy?: string | null
          max_leave_balance?: number | null
          organization_id?: string
          policy_name?: string
          policy_type?: string
          probation_months?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          emergency_contact: string
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          organization_id: string
          reason: string
          rejection_reason: string | null
          start_date: string
          status: string
          total_days: number
          updated_at: string
          work_handover: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          emergency_contact: string
          employee_id: string
          end_date: string
          id?: string
          leave_type: string
          organization_id: string
          reason: string
          rejection_reason?: string | null
          start_date: string
          status?: string
          total_days: number
          updated_at?: string
          work_handover: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          emergency_contact?: string
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          organization_id?: string
          reason?: string
          rejection_reason?: string | null
          start_date?: string
          status?: string
          total_days?: number
          updated_at?: string
          work_handover?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_leave_requests_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leave_requests_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      link_comments: {
        Row: {
          comment_text: string | null
          created_at: string | null
          created_by: string
          id: string
          link_url: string
          social_media_plan_id: string
          updated_at: string | null
        }
        Insert: {
          comment_text?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          link_url: string
          social_media_plan_id: string
          updated_at?: string | null
        }
        Update: {
          comment_text?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          link_url?: string
          social_media_plan_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_link_comments_social_media_plan"
            columns: ["social_media_plan_id"]
            isOneToOne: false
            referencedRelation: "social_media_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_comments_social_media_plan_id_fkey"
            columns: ["social_media_plan_id"]
            isOneToOne: false
            referencedRelation: "social_media_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      link_comments_images: {
        Row: {
          created_at: string
          created_by: string
          file_size: number | null
          id: string
          image_name: string
          image_path: string
          link_comments_id: string | null
          link_url: string
          mime_type: string
          social_media_plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_size?: number | null
          id?: string
          image_name: string
          image_path: string
          link_comments_id?: string | null
          link_url: string
          mime_type: string
          social_media_plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_size?: number | null
          id?: string
          image_name?: string
          image_path?: string
          link_comments_id?: string | null
          link_url?: string
          mime_type?: string
          social_media_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_link_comments_images_comment_id"
            columns: ["link_comments_id"]
            isOneToOne: false
            referencedRelation: "link_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      location_types: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_visits: {
        Row: {
          actual_check_in_time: string | null
          actual_check_out_time: string | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          created_at: string
          created_by: string | null
          distance_from_location_meters: number | null
          employee_id: string
          id: string
          office_location_id: string
          organization_id: string
          scheduled_end_time: string | null
          scheduled_start_time: string | null
          status: string | null
          updated_at: string
          visit_notes: string | null
          visit_purpose: string | null
        }
        Insert: {
          actual_check_in_time?: string | null
          actual_check_out_time?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          created_at?: string
          created_by?: string | null
          distance_from_location_meters?: number | null
          employee_id: string
          id?: string
          office_location_id: string
          organization_id: string
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          status?: string | null
          updated_at?: string
          visit_notes?: string | null
          visit_purpose?: string | null
        }
        Update: {
          actual_check_in_time?: string | null
          actual_check_out_time?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          created_at?: string
          created_by?: string | null
          distance_from_location_meters?: number | null
          employee_id?: string
          id?: string
          office_location_id?: string
          organization_id?: string
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          status?: string | null
          updated_at?: string
          visit_notes?: string | null
          visit_purpose?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_location_visits_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_location_visits_office_location"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_links: {
        Row: {
          created_at: string
          email: string
          email_verified: boolean
          expires_at: string
          id: string
          status: string
          token: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: boolean
          expires_at?: string
          id?: string
          status?: string
          token: string
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: boolean
          expires_at?: string
          id?: string
          status?: string
          token?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meeting_point_updates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          meeting_point_id: string
          organization_id: string
          update_details: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_point_id: string
          organization_id: string
          update_details: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_point_id?: string
          organization_id?: string
          update_details?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_point_updates_meeting_point_id_fkey"
            columns: ["meeting_point_id"]
            isOneToOne: false
            referencedRelation: "meeting_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_point_updates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_points: {
        Row: {
          created_at: string
          created_by: string | null
          discussion_point: string
          employee_id: string | null
          id: string
          meeting_date: string
          organization_id: string
          request_by: string | null
          status: string | null
          updated_at: string
          updates: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discussion_point: string
          employee_id?: string | null
          id?: string
          meeting_date?: string
          organization_id: string
          request_by?: string | null
          status?: string | null
          updated_at?: string
          updates?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discussion_point?: string
          employee_id?: string | null
          id?: string
          meeting_date?: string
          organization_id?: string
          request_by?: string | null
          status?: string | null
          updated_at?: string
          updates?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_meeting_points_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_points_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_deductions: {
        Row: {
          created_at: string | null
          created_by: string
          cycle_id: string
          deduction_amount: number
          deduction_type: Database["public"]["Enums"]["deduction_type"]
          employee_id: string
          id: string
          is_processed: boolean | null
          key_result_id: string | null
          month: number
          organization_id: string
          payroll_account_code: string | null
          processed_at: string | null
          reason: string
          year: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          cycle_id: string
          deduction_amount: number
          deduction_type: Database["public"]["Enums"]["deduction_type"]
          employee_id: string
          id?: string
          is_processed?: boolean | null
          key_result_id?: string | null
          month: number
          organization_id: string
          payroll_account_code?: string | null
          processed_at?: string | null
          reason: string
          year: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          cycle_id?: string
          deduction_amount?: number
          deduction_type?: Database["public"]["Enums"]["deduction_type"]
          employee_id?: string
          id?: string
          is_processed?: boolean | null
          key_result_id?: string | null
          month?: number
          organization_id?: string
          payroll_account_code?: string | null
          processed_at?: string | null
          reason?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_deductions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "okr_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_incentives: {
        Row: {
          achievement_percentage: number
          created_at: string | null
          created_by: string
          cycle_id: string
          employee_id: string
          id: string
          incentive_amount: number
          is_processed: boolean | null
          key_result_id: string | null
          month: number
          organization_id: string
          payroll_account_code: string | null
          processed_at: string | null
          reason: string
          year: number
        }
        Insert: {
          achievement_percentage: number
          created_at?: string | null
          created_by: string
          cycle_id: string
          employee_id: string
          id?: string
          incentive_amount: number
          is_processed?: boolean | null
          key_result_id?: string | null
          month: number
          organization_id: string
          payroll_account_code?: string | null
          processed_at?: string | null
          reason: string
          year: number
        }
        Update: {
          achievement_percentage?: number
          created_at?: string | null
          created_by?: string
          cycle_id?: string
          employee_id?: string
          id?: string
          incentive_amount?: number
          is_processed?: boolean | null
          key_result_id?: string | null
          month?: number
          organization_id?: string
          payroll_account_code?: string | null
          processed_at?: string | null
          reason?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_incentives_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "okr_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      motivation_likes: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          motivation_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          motivation_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          motivation_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_motivation_likes_motivation"
            columns: ["motivation_id"]
            isOneToOne: false
            referencedRelation: "motivations"
            referencedColumns: ["id"]
          },
        ]
      }
      motivations: {
        Row: {
          author_name: string
          content: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_anonymous: boolean
          organization_id: string
          published_at: string
          status: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          content: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_anonymous?: boolean
          organization_id: string
          published_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_anonymous?: boolean
          organization_id?: string
          published_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      national_holidays: {
        Row: {
          applies_to_attendance: boolean | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          name: string
          organization_id: string | null
          recurring_type: string | null
          updated_at: string | null
        }
        Insert: {
          applies_to_attendance?: boolean | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          name: string
          organization_id?: string | null
          recurring_type?: string | null
          updated_at?: string | null
        }
        Update: {
          applies_to_attendance?: boolean | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          name?: string
          organization_id?: string | null
          recurring_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "national_holidays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      office_locations: {
        Row: {
          address: string
          client_id: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          formatted_address: string | null
          google_place_id: string | null
          id: string
          is_active: boolean
          is_client_location: boolean | null
          last_verified: string | null
          latitude: number
          location_type_id: string
          longitude: number
          map_preferences: Json | null
          name: string
          notes: string | null
          organization_id: string
          planned_end_time: string
          planned_start_time: string
          radius_meters: number
          sales_person_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          client_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          formatted_address?: string | null
          google_place_id?: string | null
          id?: string
          is_active?: boolean
          is_client_location?: boolean | null
          last_verified?: string | null
          latitude: number
          location_type_id: string
          longitude: number
          map_preferences?: Json | null
          name: string
          notes?: string | null
          organization_id: string
          planned_end_time: string
          planned_start_time: string
          radius_meters?: number
          sales_person_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          client_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          formatted_address?: string | null
          google_place_id?: string | null
          id?: string
          is_active?: boolean
          is_client_location?: boolean | null
          last_verified?: string | null
          latitude?: number
          location_type_id?: string
          longitude?: number
          map_preferences?: Json | null
          name?: string
          notes?: string | null
          organization_id?: string
          planned_end_time?: string
          planned_start_time?: string
          radius_meters?: number
          sales_person_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_office_locations_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_office_locations_location_type"
            columns: ["location_type_id"]
            isOneToOne: false
            referencedRelation: "location_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_office_locations_sales_person"
            columns: ["sales_person_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_cycles: {
        Row: {
          created_at: string | null
          created_by: string
          end_date: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          period_type: Database["public"]["Enums"]["okr_period_type"]
          quarter: string | null
          start_date: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          end_date: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          period_type: Database["public"]["Enums"]["okr_period_type"]
          quarter?: string | null
          start_date: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          period_type?: Database["public"]["Enums"]["okr_period_type"]
          quarter?: string | null
          start_date?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "okr_cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          auto_renew: boolean
          billing_cycle: string
          created_at: string
          current_member: number | null
          id: string
          is_over_limit: boolean
          is_trial: boolean
          last_payment_id: string | null
          member_count: number
          organization_id: string
          start_date: string | null
          status: string
          subscription_end_date: string | null
          subscription_plan_id: string | null
          subscription_start_date: string | null
          subscription_type: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          billing_cycle?: string
          created_at?: string
          current_member?: number | null
          id?: string
          is_over_limit?: boolean
          is_trial?: boolean
          last_payment_id?: string | null
          member_count?: number
          organization_id: string
          start_date?: string | null
          status?: string
          subscription_end_date?: string | null
          subscription_plan_id?: string | null
          subscription_start_date?: string | null
          subscription_type?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          billing_cycle?: string
          created_at?: string
          current_member?: number | null
          id?: string
          is_over_limit?: boolean
          is_trial?: boolean
          last_payment_id?: string | null
          member_count?: number
          organization_id?: string
          start_date?: string | null
          status?: string
          subscription_end_date?: string | null
          subscription_plan_id?: string | null
          subscription_start_date?: string | null
          subscription_type?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_last_payment_id_fkey"
            columns: ["last_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          company_name: string
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          employee_count: string | null
          has_active_subscription: boolean | null
          id: string
          industry: string
          logo_url: string | null
          phone_number: string | null
          tax_id: string | null
          terms_accepted: boolean
          terms_accepted_at: string | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          employee_count?: string | null
          has_active_subscription?: boolean | null
          id?: string
          industry: string
          logo_url?: string | null
          phone_number?: string | null
          tax_id?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          employee_count?: string | null
          has_active_subscription?: boolean | null
          id?: string
          industry?: string
          logo_url?: string | null
          phone_number?: string | null
          tax_id?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      ownership_transfers: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          message: string | null
          organization_id: string
          status: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          message?: string | null
          organization_id: string
          status?: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string | null
          organization_id?: string
          status?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ownership_transfers_from_user"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_ownership_transfers_to_user"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ownership_transfers_from_user_id_fkey1"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      page_access_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          permission_configuration_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          permission_configuration_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          permission_configuration_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_access_exceptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_access_exceptions_permission_configuration_id_fkey"
            columns: ["permission_configuration_id"]
            isOneToOne: false
            referencedRelation: "permission_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_batch_details: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          error_message: string | null
          id: string
          organization_id: string
          payment_batch_id: string
          payroll_payment_id: string
          processed_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id: string
          error_message?: string | null
          id?: string
          organization_id: string
          payment_batch_id: string
          payroll_payment_id: string
          processed_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          payment_batch_id?: string
          payroll_payment_id?: string
          processed_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_milestones: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string | null
          id: string
          invoice_file_path: string | null
          invoice_upload_date: string | null
          invoice_uploaded: boolean | null
          milestone_description: string | null
          milestone_name: string
          milestone_order: number
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_reference: string | null
          payment_terms_id: string
          percentage: number | null
          remaining_amount: number | null
          status: string | null
          trigger_condition: string
          trigger_details: Json | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_file_path?: string | null
          invoice_upload_date?: string | null
          invoice_uploaded?: boolean | null
          milestone_description?: string | null
          milestone_name: string
          milestone_order?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_reference?: string | null
          payment_terms_id: string
          percentage?: number | null
          remaining_amount?: number | null
          status?: string | null
          trigger_condition?: string
          trigger_details?: Json | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_file_path?: string | null
          invoice_upload_date?: string | null
          invoice_uploaded?: boolean | null
          milestone_description?: string | null
          milestone_name?: string
          milestone_order?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_reference?: string | null
          payment_terms_id?: string
          percentage?: number | null
          remaining_amount?: number | null
          status?: string | null
          trigger_condition?: string
          trigger_details?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_milestones_payment_terms_id_fkey"
            columns: ["payment_terms_id"]
            isOneToOne: false
            referencedRelation: "kol_payment_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_notifications: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payment_id: string | null
          processed_at: string | null
          raw_data: Json
          signature: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payment_id?: string | null
          processed_at?: string | null
          raw_data: Json
          signature?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payment_id?: string | null
          processed_at?: string | null
          raw_data?: Json
          signature?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_notifications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhooks: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          order_id: string
          payment_id: string | null
          processing_status: string
          response_sent: Json | null
          signature_valid: boolean | null
          updated_at: string | null
          webhook_data: Json
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          order_id: string
          payment_id?: string | null
          processing_status?: string
          response_sent?: Json | null
          signature_valid?: boolean | null
          updated_at?: string | null
          webhook_data: Json
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          order_id?: string
          payment_id?: string | null
          processing_status?: string
          response_sent?: Json | null
          signature_valid?: boolean | null
          updated_at?: string | null
          webhook_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhooks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          approval_code: string | null
          bank: string | null
          billing_cycle: string
          channel_response_code: string | null
          created_at: string
          currency: string | null
          fraud_status: string | null
          id: string
          last_retry_at: string | null
          masked_card: string | null
          member_count: number
          midtrans_redirect_url: string | null
          midtrans_token: string | null
          notification_data: Json | null
          order_id: string
          organization_id: string
          payment_data: Json | null
          payment_method: string | null
          payment_type: string | null
          plan_id: string
          processed_at: string | null
          prorate_details: Json | null
          raw_notification: Json | null
          retry_count: number | null
          settlement_time: string | null
          signature_verified: boolean | null
          status: string
          transaction_id: string | null
          transaction_time: string | null
          updated_at: string
          user_id: string
          webhook_received_at: string | null
        }
        Insert: {
          amount: number
          approval_code?: string | null
          bank?: string | null
          billing_cycle: string
          channel_response_code?: string | null
          created_at?: string
          currency?: string | null
          fraud_status?: string | null
          id?: string
          last_retry_at?: string | null
          masked_card?: string | null
          member_count: number
          midtrans_redirect_url?: string | null
          midtrans_token?: string | null
          notification_data?: Json | null
          order_id: string
          organization_id: string
          payment_data?: Json | null
          payment_method?: string | null
          payment_type?: string | null
          plan_id: string
          processed_at?: string | null
          prorate_details?: Json | null
          raw_notification?: Json | null
          retry_count?: number | null
          settlement_time?: string | null
          signature_verified?: boolean | null
          status?: string
          transaction_id?: string | null
          transaction_time?: string | null
          updated_at?: string
          user_id: string
          webhook_received_at?: string | null
        }
        Update: {
          amount?: number
          approval_code?: string | null
          bank?: string | null
          billing_cycle?: string
          channel_response_code?: string | null
          created_at?: string
          currency?: string | null
          fraud_status?: string | null
          id?: string
          last_retry_at?: string | null
          masked_card?: string | null
          member_count?: number
          midtrans_redirect_url?: string | null
          midtrans_token?: string | null
          notification_data?: Json | null
          order_id?: string
          organization_id?: string
          payment_data?: Json | null
          payment_method?: string | null
          payment_type?: string | null
          plan_id?: string
          processed_at?: string | null
          prorate_details?: Json | null
          raw_notification?: Json | null
          retry_count?: number | null
          settlement_time?: string | null
          signature_verified?: boolean | null
          status?: string
          transaction_id?: string | null
          transaction_time?: string | null
          updated_at?: string
          user_id?: string
          webhook_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_integration_logs: {
        Row: {
          created_at: string | null
          deductions_total: number | null
          employee_id: string
          error_message: string | null
          id: string
          incentives_total: number | null
          integration_status: string
          month: number
          organization_id: string
          payroll_reference: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          deductions_total?: number | null
          employee_id: string
          error_message?: string | null
          id?: string
          incentives_total?: number | null
          integration_status: string
          month: number
          organization_id: string
          payroll_reference?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          deductions_total?: number | null
          employee_id?: string
          error_message?: string | null
          id?: string
          incentives_total?: number | null
          integration_status?: string
          month?: number
          organization_id?: string
          payroll_reference?: string | null
          year?: number
        }
        Relationships: []
      }
      payroll_items: {
        Row: {
          annual_gross: number | null
          attendance_record_id: string | null
          base_amount: number | null
          bpjs_kesehatan_company: number | null
          bpjs_kesehatan_employee: number | null
          bpjs_pensiun_company: number | null
          bpjs_pensiun_employee: number | null
          calculated_amount: number
          calculation_method: string | null
          component_id: string | null
          created_at: string
          description: string | null
          formula_used: string | null
          id: string
          is_taxable: boolean | null
          item_category: string | null
          item_description: string | null
          item_name: string
          item_type: string
          net_income_before_tax: number | null
          non_taxable_allowance: number | null
          notes: string | null
          organization_id: string | null
          payroll_calculation_id: string
          penalty_id: string | null
          percentage_rate: number | null
          pkp_amount: number | null
          professional_allowance: number | null
          ptkp_amount: number | null
          tax_bracket_info: Json | null
          tax_configuration_id: string | null
        }
        Insert: {
          annual_gross?: number | null
          attendance_record_id?: string | null
          base_amount?: number | null
          bpjs_kesehatan_company?: number | null
          bpjs_kesehatan_employee?: number | null
          bpjs_pensiun_company?: number | null
          bpjs_pensiun_employee?: number | null
          calculated_amount: number
          calculation_method?: string | null
          component_id?: string | null
          created_at?: string
          description?: string | null
          formula_used?: string | null
          id?: string
          is_taxable?: boolean | null
          item_category?: string | null
          item_description?: string | null
          item_name: string
          item_type: string
          net_income_before_tax?: number | null
          non_taxable_allowance?: number | null
          notes?: string | null
          organization_id?: string | null
          payroll_calculation_id: string
          penalty_id?: string | null
          percentage_rate?: number | null
          pkp_amount?: number | null
          professional_allowance?: number | null
          ptkp_amount?: number | null
          tax_bracket_info?: Json | null
          tax_configuration_id?: string | null
        }
        Update: {
          annual_gross?: number | null
          attendance_record_id?: string | null
          base_amount?: number | null
          bpjs_kesehatan_company?: number | null
          bpjs_kesehatan_employee?: number | null
          bpjs_pensiun_company?: number | null
          bpjs_pensiun_employee?: number | null
          calculated_amount?: number
          calculation_method?: string | null
          component_id?: string | null
          created_at?: string
          description?: string | null
          formula_used?: string | null
          id?: string
          is_taxable?: boolean | null
          item_category?: string | null
          item_description?: string | null
          item_name?: string
          item_type?: string
          net_income_before_tax?: number | null
          non_taxable_allowance?: number | null
          notes?: string | null
          organization_id?: string | null
          payroll_calculation_id?: string
          penalty_id?: string | null
          percentage_rate?: number | null
          pkp_amount?: number | null
          professional_allowance?: number | null
          ptkp_amount?: number | null
          tax_bracket_info?: Json | null
          tax_configuration_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "employee_payroll_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_calculation_id_fkey"
            columns: ["payroll_calculation_id"]
            isOneToOne: false
            referencedRelation: "employee_payroll_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_penalty_id_fkey"
            columns: ["penalty_id"]
            isOneToOne: false
            referencedRelation: "attendance_penalties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_tax_configuration_id_fkey"
            columns: ["tax_configuration_id"]
            isOneToOne: false
            referencedRelation: "tax_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          cut_off: string | null
          end_date: string
          id: string
          is_bonus_period: boolean | null
          notes: string | null
          organization_id: string
          pay_date: string
          period_name: string
          period_type: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          cut_off?: string | null
          end_date: string
          id?: string
          is_bonus_period?: boolean | null
          notes?: string | null
          organization_id: string
          pay_date: string
          period_name: string
          period_type?: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          cut_off?: string | null
          end_date?: string
          id?: string
          is_bonus_period?: boolean | null
          notes?: string | null
          organization_id?: string
          pay_date?: string
          period_name?: string
          period_type?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_report_history: {
        Row: {
          created_at: string
          email_recipients: string[] | null
          email_sent: boolean | null
          email_sent_at: string | null
          error_message: string | null
          file_format: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          generated_at: string
          generated_by: string | null
          generation_method: string | null
          id: string
          organization_id: string
          period_type: string
          report_config_id: string
          report_data: Json
          report_period_end: string
          report_period_start: string
          status: string | null
          summary_statistics: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_recipients?: string[] | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          error_message?: string | null
          file_format?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          generated_at?: string
          generated_by?: string | null
          generation_method?: string | null
          id?: string
          organization_id: string
          period_type: string
          report_config_id: string
          report_data: Json
          report_period_end: string
          report_period_start: string
          status?: string | null
          summary_statistics?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_recipients?: string[] | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          error_message?: string | null
          file_format?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          generated_at?: string
          generated_by?: string | null
          generation_method?: string | null
          id?: string
          organization_id?: string
          period_type?: string
          report_config_id?: string
          report_data?: Json
          report_period_end?: string
          report_period_start?: string
          status?: string | null
          summary_statistics?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payroll_report_history_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calculated_at: string | null
          calculated_by: string | null
          calculation_method: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          payroll_period_id: string
          run_date: string
          run_name: string
          status: string
          tax_configuration_id: string
          total_deductions: number | null
          total_employees: number | null
          total_gross_pay: number | null
          total_net_pay: number | null
          total_penalties: number | null
          total_taxes: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          calculated_by?: string | null
          calculation_method?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payroll_period_id: string
          run_date?: string
          run_name: string
          status?: string
          tax_configuration_id: string
          total_deductions?: number | null
          total_employees?: number | null
          total_gross_pay?: number | null
          total_net_pay?: number | null
          total_penalties?: number | null
          total_taxes?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          calculated_by?: string | null
          calculation_method?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payroll_period_id?: string
          run_date?: string
          run_name?: string
          status?: string
          tax_configuration_id?: string
          total_deductions?: number | null
          total_employees?: number | null
          total_gross_pay?: number | null
          total_net_pay?: number | null
          total_penalties?: number | null
          total_taxes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_tax_configuration_id_fkey"
            columns: ["tax_configuration_id"]
            isOneToOne: false
            referencedRelation: "tax_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_summaries: {
        Row: {
          average_gross_pay: number | null
          average_net_pay: number | null
          created_at: string
          id: string
          organization_id: string
          payroll_run_id: string
          reference_id: string | null
          reference_name: string | null
          summary_type: string
          tax_configuration_id: string | null
          total_allowances: number | null
          total_deductions: number | null
          total_employees: number | null
          total_gross_pay: number | null
          total_net_pay: number | null
          total_penalties: number | null
          total_taxes: number | null
          updated_at: string
        }
        Insert: {
          average_gross_pay?: number | null
          average_net_pay?: number | null
          created_at?: string
          id?: string
          organization_id: string
          payroll_run_id: string
          reference_id?: string | null
          reference_name?: string | null
          summary_type: string
          tax_configuration_id?: string | null
          total_allowances?: number | null
          total_deductions?: number | null
          total_employees?: number | null
          total_gross_pay?: number | null
          total_net_pay?: number | null
          total_penalties?: number | null
          total_taxes?: number | null
          updated_at?: string
        }
        Update: {
          average_gross_pay?: number | null
          average_net_pay?: number | null
          created_at?: string
          id?: string
          organization_id?: string
          payroll_run_id?: string
          reference_id?: string | null
          reference_name?: string | null
          summary_type?: string
          tax_configuration_id?: string | null
          total_allowances?: number | null
          total_deductions?: number | null
          total_employees?: number | null
          total_gross_pay?: number | null
          total_net_pay?: number | null
          total_penalties?: number | null
          total_taxes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_summaries_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_summaries_tax_configuration_id_fkey"
            columns: ["tax_configuration_id"]
            isOneToOne: false
            referencedRelation: "tax_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_exemptions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          conditions: Json | null
          created_at: string
          created_by: string
          employee_id: string
          end_date: string | null
          exemption_type: string
          id: string
          is_active: boolean
          organization_id: string
          penalty_rule_id: string | null
          reason: string
          start_date: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          conditions?: Json | null
          created_at?: string
          created_by: string
          employee_id: string
          end_date?: string | null
          exemption_type: string
          id?: string
          is_active?: boolean
          organization_id: string
          penalty_rule_id?: string | null
          reason: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          conditions?: Json | null
          created_at?: string
          created_by?: string
          employee_id?: string
          end_date?: string | null
          exemption_type?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          penalty_rule_id?: string | null
          reason?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "penalty_exemptions_penalty_rule_id_fkey"
            columns: ["penalty_rule_id"]
            isOneToOne: false
            referencedRelation: "penalty_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_rules: {
        Row: {
          applies_to_all: boolean | null
          calculation_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          max_penalty_per_month: number | null
          name: string
          organization_id: string
          penalty_amount: number | null
          penalty_type: string
          rule_type: string
          salary_percentage: number | null
          specific_departments: string[] | null
          threshold_minutes: number
          updated_at: string | null
        }
        Insert: {
          applies_to_all?: boolean | null
          calculation_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          max_penalty_per_month?: number | null
          name: string
          organization_id: string
          penalty_amount?: number | null
          penalty_type?: string
          rule_type: string
          salary_percentage?: number | null
          specific_departments?: string[] | null
          threshold_minutes?: number
          updated_at?: string | null
        }
        Update: {
          applies_to_all?: boolean | null
          calculation_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          max_penalty_per_month?: number | null
          name?: string
          organization_id?: string
          penalty_amount?: number | null
          penalty_type?: string
          rule_type?: string
          salary_percentage?: number | null
          specific_departments?: string[] | null
          threshold_minutes?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "penalty_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_settings: {
        Row: {
          created_at: string
          default_calculation_type: string | null
          default_hourly_rate: number | null
          default_salary_percentage: number | null
          enable_automatic_penalties: boolean
          enable_salary_based_calculation: boolean | null
          grace_settings: Json | null
          holiday_penalty_rules: Json | null
          id: string
          maximum_daily_penalty: number | null
          maximum_monthly_penalty: number | null
          minimum_penalty_amount: number | null
          notification_settings: Json | null
          organization_id: string
          penalty_calculation_timezone: string | null
          penalty_deduction_date: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_calculation_type?: string | null
          default_hourly_rate?: number | null
          default_salary_percentage?: number | null
          enable_automatic_penalties?: boolean
          enable_salary_based_calculation?: boolean | null
          grace_settings?: Json | null
          holiday_penalty_rules?: Json | null
          id?: string
          maximum_daily_penalty?: number | null
          maximum_monthly_penalty?: number | null
          minimum_penalty_amount?: number | null
          notification_settings?: Json | null
          organization_id: string
          penalty_calculation_timezone?: string | null
          penalty_deduction_date?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_calculation_type?: string | null
          default_hourly_rate?: number | null
          default_salary_percentage?: number | null
          enable_automatic_penalties?: boolean
          enable_salary_based_calculation?: boolean | null
          grace_settings?: Json | null
          holiday_penalty_rules?: Json | null
          id?: string
          maximum_daily_penalty?: number | null
          maximum_monthly_penalty?: number | null
          minimum_penalty_amount?: number | null
          notification_settings?: Json | null
          organization_id?: string
          penalty_calculation_timezone?: string | null
          penalty_deduction_date?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      permission_configuration_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          permission_configuration_id: string
          role: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          permission_configuration_id: string
          role: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          permission_configuration_id?: string
          role?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_permission_config_roles"
            columns: ["permission_configuration_id"]
            isOneToOne: false
            referencedRelation: "permission_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_configuration_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_configurations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          organization_id: string | null
          page_path: string
          page_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          page_path: string
          page_title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          page_path?: string
          page_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_path_exceptions: {
        Row: {
          created_at: string
          exception_path: string
          id: string
          permission_configuration_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exception_path: string
          id?: string
          permission_configuration_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exception_path?: string
          id?: string
          permission_configuration_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_path_exceptions_permission_configuration_id_fkey"
            columns: ["permission_configuration_id"]
            isOneToOne: false
            referencedRelation: "permission_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          min_stock_level: number | null
          name: string
          organization_id: string
          price: number | null
          sku: string | null
          status: string | null
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          min_stock_level?: number | null
          name: string
          organization_id: string
          price?: number | null
          sku?: string | null
          status?: string | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          min_stock_level?: number | null
          name?: string
          organization_id?: string
          price?: number | null
          sku?: string | null
          status?: string | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_organization_id: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          organization_created: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_organization_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          organization_created?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          active_organization_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          organization_created?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_calculations: {
        Row: {
          actual_progress: number
          calculation_date: string
          created_at: string | null
          expected_progress: number
          id: string
          is_on_track: boolean
          key_result_id: string
          organization_id: string
          variance: number
        }
        Insert: {
          actual_progress: number
          calculation_date: string
          created_at?: string | null
          expected_progress: number
          id?: string
          is_on_track: boolean
          key_result_id: string
          organization_id: string
          variance: number
        }
        Update: {
          actual_progress?: number
          calculation_date?: string
          created_at?: string | null
          expected_progress?: number
          id?: string
          is_on_track?: boolean
          key_result_id?: string
          organization_id?: string
          variance?: number
        }
        Relationships: []
      }
      purchase_request_documents: {
        Row: {
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          original_name: string
          purchase_request_id: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          original_name: string
          purchase_request_id: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          original_name?: string
          purchase_request_id?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_documents_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          account_password: string | null
          account_username: string | null
          amount_idr: number
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          approved_by_user_id: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          business_purpose: string | null
          company_benefit: string
          created_at: string | null
          created_by: string
          department_name: string | null
          description: string
          efficiency_impact: string | null
          exchange_rate: string | null
          expected_outcome: string | null
          expense_category_id: string | null
          expense_date: string | null
          expense_type_id: string | null
          id: string
          is_recurring: boolean | null
          merchant_name: string | null
          organization_id: string
          original_receipt_amount: string | null
          paid_at: string | null
          payment_status: string | null
          productivity_impact: string | null
          purchase_link: string | null
          purchase_type: string | null
          receipt_number: string | null
          recurring_frequency: string | null
          reimbursement_type: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejected_by_name: string | null
          rejected_by_user_id: string | null
          rejection_reason: string | null
          request_title: string
          request_type: string | null
          requester_id: string
          requester_name: string
          status: string
          submitted_at: string | null
          updated_at: string | null
          vendor_name: string | null
        }
        Insert: {
          account_password?: string | null
          account_username?: string | null
          amount_idr: number
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          approved_by_user_id?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          business_purpose?: string | null
          company_benefit: string
          created_at?: string | null
          created_by: string
          department_name?: string | null
          description: string
          efficiency_impact?: string | null
          exchange_rate?: string | null
          expected_outcome?: string | null
          expense_category_id?: string | null
          expense_date?: string | null
          expense_type_id?: string | null
          id?: string
          is_recurring?: boolean | null
          merchant_name?: string | null
          organization_id: string
          original_receipt_amount?: string | null
          paid_at?: string | null
          payment_status?: string | null
          productivity_impact?: string | null
          purchase_link?: string | null
          purchase_type?: string | null
          receipt_number?: string | null
          recurring_frequency?: string | null
          reimbursement_type?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_by_name?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          request_title: string
          request_type?: string | null
          requester_id: string
          requester_name: string
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Update: {
          account_password?: string | null
          account_username?: string | null
          amount_idr?: number
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          approved_by_user_id?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          business_purpose?: string | null
          company_benefit?: string
          created_at?: string | null
          created_by?: string
          department_name?: string | null
          description?: string
          efficiency_impact?: string | null
          exchange_rate?: string | null
          expected_outcome?: string | null
          expense_category_id?: string | null
          expense_date?: string | null
          expense_type_id?: string | null
          id?: string
          is_recurring?: boolean | null
          merchant_name?: string | null
          organization_id?: string
          original_receipt_amount?: string | null
          paid_at?: string | null
          payment_status?: string | null
          productivity_impact?: string | null
          purchase_link?: string | null
          purchase_type?: string | null
          receipt_number?: string | null
          recurring_frequency?: string | null
          reimbursement_type?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_by_name?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          request_title?: string
          request_type?: string | null
          requester_id?: string
          requester_name?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_requests_expense_category"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_purchase_requests_expense_type"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
        ]
      }
      question_review: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          organization_id: string | null
          question_text: string
          review_category_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          organization_id?: string | null
          question_text: string
          review_category_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          organization_id?: string | null
          question_text?: string
          review_category_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_question_review_category"
            columns: ["review_category_id"]
            isOneToOne: false
            referencedRelation: "review_category"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_links: {
        Row: {
          clicks: number | null
          created_at: string
          created_by: string | null
          department_id: string | null
          expires_at: string | null
          id: string
          job_opening_id: string
          organization_id: string
          preview_link: string | null
          status: string
          submissions: number | null
          token: string
          updated_at: string
        }
        Insert: {
          clicks?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          expires_at?: string | null
          id?: string
          job_opening_id: string
          organization_id: string
          preview_link?: string | null
          status?: string
          submissions?: number | null
          token: string
          updated_at?: string
        }
        Update: {
          clicks?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          expires_at?: string | null
          id?: string
          job_opening_id?: string
          organization_id?: string
          preview_link?: string | null
          status?: string
          submissions?: number | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_links_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_links_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_skills: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean | null
          job_opening_id: string
          organization_id: string | null
          skill_level: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          job_opening_id: string
          organization_id?: string | null
          skill_level?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          job_opening_id?: string
          organization_id?: string | null
          skill_level?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_skills_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_skills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_history: {
        Row: {
          assigned_to: string | null
          assignee: string
          category: string
          created_at: string
          creator_email: string
          creator_name: string
          department: string
          description: string | null
          id: string
          organization_id: string
          original_ticket_id: string
          priority: string
          related_asset: string | null
          resolution_notes: string | null
          resolution_time: string | null
          resolved_at: string
          resolved_by: string | null
          ticket_id: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          assignee: string
          category: string
          created_at: string
          creator_email: string
          creator_name: string
          department: string
          description?: string | null
          id?: string
          organization_id: string
          original_ticket_id: string
          priority: string
          related_asset?: string | null
          resolution_notes?: string | null
          resolution_time?: string | null
          resolved_at?: string
          resolved_by?: string | null
          ticket_id: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          assignee?: string
          category?: string
          created_at?: string
          creator_email?: string
          creator_name?: string
          department?: string
          description?: string | null
          id?: string
          organization_id?: string
          original_ticket_id?: string
          priority?: string
          related_asset?: string | null
          resolution_notes?: string | null
          resolution_time?: string | null
          resolved_at?: string
          resolved_by?: string | null
          ticket_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_history_original_ticket_id_fkey"
            columns: ["original_ticket_id"]
            isOneToOne: true
            referencedRelation: "it_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      reprimands: {
        Row: {
          acknowledgment_date: string | null
          acknowledgment_required: boolean | null
          acknowledgment_signature: string | null
          appeal_date: string | null
          appeal_notes: string | null
          appeal_status: string | null
          corrective_action_plan: string | null
          created_at: string
          created_by: string
          document_path: string | null
          employee_acknowledged: boolean | null
          employee_id: string
          evidence_details: string | null
          follow_up_date: string | null
          hr_approved_by: string | null
          hr_approved_date: string | null
          id: string
          impact_on_performance_review: boolean | null
          improvement_deadline: string | null
          incident_date: string
          incident_location: string | null
          incident_time: string | null
          is_formal: boolean | null
          issued_by: string
          issued_date: string
          notes: string | null
          organization_id: string
          previous_warnings_count: number | null
          reprimand_type: string
          reviewed_by: string | null
          reviewed_date: string | null
          severity_level: string
          status: string
          updated_at: string
          violation_category: string
          violation_description: string
          witness_names: string | null
        }
        Insert: {
          acknowledgment_date?: string | null
          acknowledgment_required?: boolean | null
          acknowledgment_signature?: string | null
          appeal_date?: string | null
          appeal_notes?: string | null
          appeal_status?: string | null
          corrective_action_plan?: string | null
          created_at?: string
          created_by: string
          document_path?: string | null
          employee_acknowledged?: boolean | null
          employee_id: string
          evidence_details?: string | null
          follow_up_date?: string | null
          hr_approved_by?: string | null
          hr_approved_date?: string | null
          id?: string
          impact_on_performance_review?: boolean | null
          improvement_deadline?: string | null
          incident_date: string
          incident_location?: string | null
          incident_time?: string | null
          is_formal?: boolean | null
          issued_by: string
          issued_date?: string
          notes?: string | null
          organization_id: string
          previous_warnings_count?: number | null
          reprimand_type: string
          reviewed_by?: string | null
          reviewed_date?: string | null
          severity_level?: string
          status?: string
          updated_at?: string
          violation_category: string
          violation_description: string
          witness_names?: string | null
        }
        Update: {
          acknowledgment_date?: string | null
          acknowledgment_required?: boolean | null
          acknowledgment_signature?: string | null
          appeal_date?: string | null
          appeal_notes?: string | null
          appeal_status?: string | null
          corrective_action_plan?: string | null
          created_at?: string
          created_by?: string
          document_path?: string | null
          employee_acknowledged?: boolean | null
          employee_id?: string
          evidence_details?: string | null
          follow_up_date?: string | null
          hr_approved_by?: string | null
          hr_approved_date?: string | null
          id?: string
          impact_on_performance_review?: boolean | null
          improvement_deadline?: string | null
          incident_date?: string
          incident_location?: string | null
          incident_time?: string | null
          is_formal?: boolean | null
          issued_by?: string
          issued_date?: string
          notes?: string | null
          organization_id?: string
          previous_warnings_count?: number | null
          reprimand_type?: string
          reviewed_by?: string | null
          reviewed_date?: string | null
          severity_level?: string
          status?: string
          updated_at?: string
          violation_category?: string
          violation_description?: string
          witness_names?: string | null
        }
        Relationships: []
      }
      review_category: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_category_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_activities: {
        Row: {
          activity_type: string
          amount: number | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          down_payment_amount: number | null
          follow_up_date: string | null
          id: string
          income_category_id: string | null
          income_type_id: string | null
          is_down_payment: boolean | null
          is_paid: boolean | null
          notes: string | null
          organization_id: string | null
          payment_method: string | null
          payment_status: string | null
          receipt_url: string | null
          remaining_amount: number | null
          service_id: string | null
          status: string
          sub_service_id: string | null
          total_amount: number | null
          total_paid_amount: number | null
          updated_at: string
        }
        Insert: {
          activity_type: string
          amount?: number | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          down_payment_amount?: number | null
          follow_up_date?: string | null
          id?: string
          income_category_id?: string | null
          income_type_id?: string | null
          is_down_payment?: boolean | null
          is_paid?: boolean | null
          notes?: string | null
          organization_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          receipt_url?: string | null
          remaining_amount?: number | null
          service_id?: string | null
          status?: string
          sub_service_id?: string | null
          total_amount?: number | null
          total_paid_amount?: number | null
          updated_at?: string
        }
        Update: {
          activity_type?: string
          amount?: number | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          down_payment_amount?: number | null
          follow_up_date?: string | null
          id?: string
          income_category_id?: string | null
          income_type_id?: string | null
          is_down_payment?: boolean | null
          is_paid?: boolean | null
          notes?: string | null
          organization_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          receipt_url?: string | null
          remaining_amount?: number | null
          service_id?: string | null
          status?: string
          sub_service_id?: string | null
          total_amount?: number | null
          total_paid_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_activities_income_category_id_fkey"
            columns: ["income_category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activities_income_type_id_fkey"
            columns: ["income_type_id"]
            isOneToOne: false
            referencedRelation: "income_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activities_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activities_sub_service_id_fkey"
            columns: ["sub_service_id"]
            isOneToOne: false
            referencedRelation: "sub_services"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_activity_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          quantity: number
          sales_activity_id: string
          service_id: string | null
          service_name: string
          sub_service_id: string | null
          sub_service_name: string | null
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          quantity?: number
          sales_activity_id: string
          service_id?: string | null
          service_name: string
          sub_service_id?: string | null
          sub_service_name?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          sales_activity_id?: string
          service_id?: string | null
          service_name?: string
          sub_service_id?: string | null
          sub_service_name?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      sales_activity_payments: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          organization_id: string
          payment_amount: number
          payment_date: string
          payment_method: string
          payment_sequence: number
          payment_type: string
          receipt_url: string | null
          sales_activity_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          organization_id: string
          payment_amount: number
          payment_date?: string
          payment_method?: string
          payment_sequence?: number
          payment_type?: string
          receipt_url?: string | null
          sales_activity_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          organization_id?: string
          payment_amount?: number
          payment_date?: string
          payment_method?: string
          payment_sequence?: number
          payment_type?: string
          receipt_url?: string | null
          sales_activity_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_activity_payments_sales_activity"
            columns: ["sales_activity_id"]
            isOneToOne: false
            referencedRelation: "sales_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string
          receipt_url: string | null
          sales_activity_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_date: string
          payment_method: string
          receipt_url?: string | null
          sales_activity_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string
          receipt_url?: string | null
          sales_activity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_payments_sales_activity_id_fkey"
            columns: ["sales_activity_id"]
            isOneToOne: false
            referencedRelation: "sales_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          created_at: string
          created_by: string
          current_value: number | null
          description: string | null
          end_date: string
          id: string
          organization_id: string
          progress_percentage: number | null
          service_id: string | null
          start_date: string
          status: string | null
          sub_service_id: string | null
          target_amount: number
          target_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_value?: number | null
          description?: string | null
          end_date: string
          id?: string
          organization_id: string
          progress_percentage?: number | null
          service_id?: string | null
          start_date: string
          status?: string | null
          sub_service_id?: string | null
          target_amount: number
          target_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_value?: number | null
          description?: string | null
          end_date?: string
          id?: string
          organization_id?: string
          progress_percentage?: number | null
          service_id?: string | null
          start_date?: string
          status?: string | null
          sub_service_id?: string | null
          target_amount?: number
          target_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_duration_minutes: number | null
          created_at: string | null
          description: string | null
          end_time: string
          id: string
          is_active: boolean | null
          late_tolerance_minutes: number | null
          name: string
          organization_id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          break_duration_minutes?: number | null
          created_at?: string | null
          description?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          late_tolerance_minutes?: number | null
          name: string
          organization_id: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          break_duration_minutes?: number | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          late_tolerance_minutes?: number | null
          name?: string
          organization_id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      social_media_links: {
        Row: {
          created_at: string
          id: string
          platform: string
          social_media_name: string
          social_media_plan_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          social_media_name: string
          social_media_plan_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          social_media_name?: string
          social_media_plan_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_social_media_links_plan"
            columns: ["social_media_plan_id"]
            isOneToOne: false
            referencedRelation: "social_media_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_names: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          platform: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          platform: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_media_plans: {
        Row: {
          actual_post_date: string | null
          approved: boolean | null
          brief: string | null
          brief_completion_date: string | null
          completion_date: string | null
          content_pillar_id: string | null
          content_type_id: string | null
          created_at: string | null
          done: boolean | null
          google_drive_link: string | null
          id: string
          on_time_status: string | null
          organization_id: string
          pic_id: string | null
          pic_production_id: string | null
          post_date: string | null
          post_link: Json | null
          production_approved: boolean | null
          production_approved_date: string | null
          production_completion_date: string | null
          production_revision_count: number | null
          production_status: string | null
          revision_count: number | null
          service_id: string | null
          status: string | null
          status_content: string | null
          sub_service_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          actual_post_date?: string | null
          approved?: boolean | null
          brief?: string | null
          brief_completion_date?: string | null
          completion_date?: string | null
          content_pillar_id?: string | null
          content_type_id?: string | null
          created_at?: string | null
          done?: boolean | null
          google_drive_link?: string | null
          id?: string
          on_time_status?: string | null
          organization_id: string
          pic_id?: string | null
          pic_production_id?: string | null
          post_date?: string | null
          post_link?: Json | null
          production_approved?: boolean | null
          production_approved_date?: string | null
          production_completion_date?: string | null
          production_revision_count?: number | null
          production_status?: string | null
          revision_count?: number | null
          service_id?: string | null
          status?: string | null
          status_content?: string | null
          sub_service_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_post_date?: string | null
          approved?: boolean | null
          brief?: string | null
          brief_completion_date?: string | null
          completion_date?: string | null
          content_pillar_id?: string | null
          content_type_id?: string | null
          created_at?: string | null
          done?: boolean | null
          google_drive_link?: string | null
          id?: string
          on_time_status?: string | null
          organization_id?: string
          pic_id?: string | null
          pic_production_id?: string | null
          post_date?: string | null
          post_link?: Json | null
          production_approved?: boolean | null
          production_approved_date?: string | null
          production_completion_date?: string | null
          production_revision_count?: number | null
          production_status?: string | null
          revision_count?: number | null
          service_id?: string | null
          status?: string | null
          status_content?: string | null
          sub_service_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_plans_content_pillar_id_fkey"
            columns: ["content_pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_plans_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_plans_pic_id_fkey"
            columns: ["pic_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_plans_pic_production_id_fkey"
            columns: ["pic_production_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_plans_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_plans_sub_service_id_fkey"
            columns: ["sub_service_id"]
            isOneToOne: false
            referencedRelation: "sub_services"
            referencedColumns: ["id"]
          },
        ]
      }
      software_projects: {
        Row: {
          actual_hours: number | null
          client_id: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          developer_id: string | null
          developer_name: string
          due_date: string
          estimated_hours: number
          id: string
          notes: string | null
          organization_id: string
          priority: string
          progress: number
          project_id: string
          project_name: string
          repository_url: string | null
          start_date: string
          status: string
          tech_stack: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          developer_id?: string | null
          developer_name: string
          due_date: string
          estimated_hours?: number
          id?: string
          notes?: string | null
          organization_id: string
          priority: string
          progress?: number
          project_id: string
          project_name: string
          repository_url?: string | null
          start_date: string
          status?: string
          tech_stack: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          developer_id?: string | null
          developer_name?: string
          due_date?: string
          estimated_hours?: number
          id?: string
          notes?: string | null
          organization_id?: string
          priority?: string
          progress?: number
          project_id?: string
          project_name?: string
          repository_url?: string | null
          start_date?: string
          status?: string
          tech_stack?: string
          updated_at?: string
        }
        Relationships: []
      }
      sub_services: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          service_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          service_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          service_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_change_requests: {
        Row: {
          applied_at: string | null
          change_type: string
          charge_now: boolean
          created_at: string
          current_member_count: number
          current_plan_id: string
          id: string
          notes: string | null
          organization_id: string
          prorate_amount: number
          requested_by: string
          scheduled_date: string
          status: string
          target_member_count: number
          target_plan_id: string
        }
        Insert: {
          applied_at?: string | null
          change_type: string
          charge_now?: boolean
          created_at?: string
          current_member_count: number
          current_plan_id: string
          id?: string
          notes?: string | null
          organization_id: string
          prorate_amount?: number
          requested_by: string
          scheduled_date: string
          status?: string
          target_member_count: number
          target_plan_id: string
        }
        Update: {
          applied_at?: string | null
          change_type?: string
          charge_now?: boolean
          created_at?: string
          current_member_count?: number
          current_plan_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          prorate_amount?: number
          requested_by?: string
          scheduled_date?: string
          status?: string
          target_member_count?: number
          target_plan_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          annual_discount_percentage: number | null
          base_price_per_member: number
          created_at: string
          demo_required: boolean
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          is_custom: boolean
          jumlah_hari_trial: number | null
          member_discount_tiers: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          annual_discount_percentage?: number | null
          base_price_per_member?: number
          created_at?: string
          demo_required?: boolean
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          jumlah_hari_trial?: number | null
          member_discount_tiers?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          annual_discount_percentage?: number | null
          base_price_per_member?: number
          created_at?: string
          demo_required?: boolean
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          jumlah_hari_trial?: number | null
          member_discount_tiers?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string | null
          error_details: string | null
          id: string
          log_type: string
          message: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          error_details?: string | null
          id?: string
          log_type: string
          message: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          error_details?: string | null
          id?: string
          log_type?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      target_progress_logs: {
        Row: {
          change_amount: number
          change_reason: string
          id: string
          logged_at: string
          logged_by: string
          new_value: number
          notes: string | null
          previous_value: number
          target_id: string
        }
        Insert: {
          change_amount: number
          change_reason: string
          id?: string
          logged_at?: string
          logged_by: string
          new_value: number
          notes?: string | null
          previous_value: number
          target_id: string
        }
        Update: {
          change_amount?: number
          change_reason?: string
          id?: string
          logged_at?: string
          logged_by?: string
          new_value?: number
          notes?: string | null
          previous_value?: number
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_progress_logs_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "employee_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_configurations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          effective_date: string | null
          id: string
          income_tax_rate: number | null
          is_active: boolean | null
          is_default: boolean | null
          name: string | null
          organization_id: string | null
          ptkp_amount: number
          ptkp_status: string
          tax_bracket_1_limit: number | null
          tax_bracket_1_rate: number | null
          tax_bracket_2_limit: number | null
          tax_bracket_2_rate: number | null
          tax_bracket_3_limit: number | null
          tax_bracket_3_rate: number | null
          tax_bracket_4_rate: number | null
          tax_rate: number
          tax_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_date?: string | null
          id?: string
          income_tax_rate?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string | null
          organization_id?: string | null
          ptkp_amount: number
          ptkp_status: string
          tax_bracket_1_limit?: number | null
          tax_bracket_1_rate?: number | null
          tax_bracket_2_limit?: number | null
          tax_bracket_2_rate?: number | null
          tax_bracket_3_limit?: number | null
          tax_bracket_3_rate?: number | null
          tax_bracket_4_rate?: number | null
          tax_rate?: number
          tax_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_date?: string | null
          id?: string
          income_tax_rate?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string | null
          organization_id?: string | null
          ptkp_amount?: number
          ptkp_status?: string
          tax_bracket_1_limit?: number | null
          tax_bracket_1_rate?: number | null
          tax_bracket_2_limit?: number | null
          tax_bracket_2_rate?: number | null
          tax_bracket_3_limit?: number | null
          tax_bracket_3_rate?: number | null
          tax_bracket_4_rate?: number | null
          tax_rate?: number
          tax_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_participants: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completion_date: string | null
          consent_checklist: Json | null
          created_at: string | null
          employee_id: string
          feedback: string | null
          id: string
          rating: number | null
          registered_by: string | null
          registration_reason: string | null
          status: string | null
          training_program_id: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completion_date?: string | null
          consent_checklist?: Json | null
          created_at?: string | null
          employee_id: string
          feedback?: string | null
          id?: string
          rating?: number | null
          registered_by?: string | null
          registration_reason?: string | null
          status?: string | null
          training_program_id: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completion_date?: string | null
          consent_checklist?: Json | null
          created_at?: string | null
          employee_id?: string
          feedback?: string | null
          id?: string
          rating?: number | null
          registered_by?: string | null
          registration_reason?: string | null
          status?: string | null
          training_program_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_participants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_participants_training_program_id_fkey"
            columns: ["training_program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          budget: number | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          location: string | null
          materials: string | null
          max_participants: number | null
          name: string
          objectives: string | null
          organization_id: string
          requirements: string | null
          start_date: string
          status: string | null
          trainer_name: string | null
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          location?: string | null
          materials?: string | null
          max_participants?: number | null
          name: string
          objectives?: string | null
          organization_id: string
          requirements?: string | null
          start_date: string
          status?: string | null
          trainer_name?: string | null
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          location?: string | null
          materials?: string | null
          max_participants?: number | null
          name?: string
          objectives?: string | null
          organization_id?: string
          requirements?: string | null
          start_date?: string
          status?: string | null
          trainer_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_organizations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          joined_at: string
          organization_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string
          organization_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string
          organization_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile_details: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          job_title: string | null
          location: string | null
          phone: string | null
          profile_id: string
          profile_photo_url: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          location?: string | null
          phone?: string | null
          profile_id: string
          profile_photo_url?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          location?: string | null
          phone?: string | null
          profile_id?: string
          profile_photo_url?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string
          id: string
          is_active: boolean | null
          notes: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string | null
          department: string | null
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          phone: string | null
          position: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_analytics: {
        Row: {
          analytics_date: string
          average_duration_minutes: number | null
          cancelled_visits: number
          client_id: string
          completed_visits: number
          created_at: string
          employee_id: string
          id: string
          organization_id: string
          total_duration_minutes: number
          total_visits: number
          updated_at: string
        }
        Insert: {
          analytics_date: string
          average_duration_minutes?: number | null
          cancelled_visits?: number
          client_id: string
          completed_visits?: number
          created_at?: string
          employee_id: string
          id?: string
          organization_id: string
          total_duration_minutes?: number
          total_visits?: number
          updated_at?: string
        }
        Update: {
          analytics_date?: string
          average_duration_minutes?: number | null
          cancelled_visits?: number
          client_id?: string
          completed_visits?: number
          created_at?: string
          employee_id?: string
          id?: string
          organization_id?: string
          total_duration_minutes?: number
          total_visits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_analytics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_analytics_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_analytics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_attachments: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_by: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_visit_attachments_visit"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "location_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_notifications: {
        Row: {
          client_visit_id: string
          created_at: string
          employee_id: string
          id: string
          is_read: boolean
          message: string
          notification_type: string
          organization_id: string
          scheduled_for: string
          sent_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_visit_id: string
          created_at?: string
          employee_id: string
          id?: string
          is_read?: boolean
          message: string
          notification_type: string
          organization_id: string
          scheduled_for: string
          sent_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_visit_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          organization_id?: string
          scheduled_for?: string
          sent_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_notifications_client_visit_id_fkey"
            columns: ["client_visit_id"]
            isOneToOne: false
            referencedRelation: "client_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_checkins: {
        Row: {
          blockers: string | null
          comments: string | null
          confidence_level: number | null
          created_at: string | null
          current_value: number
          employee_id: string
          id: string
          individual_objective_id: string | null
          key_result_id: string | null
          organization_id: string
          status: Database["public"]["Enums"]["checkin_status"]
          updated_at: string | null
          week_start_date: string
        }
        Insert: {
          blockers?: string | null
          comments?: string | null
          confidence_level?: number | null
          created_at?: string | null
          current_value: number
          employee_id: string
          id?: string
          individual_objective_id?: string | null
          key_result_id?: string | null
          organization_id: string
          status: Database["public"]["Enums"]["checkin_status"]
          updated_at?: string | null
          week_start_date: string
        }
        Update: {
          blockers?: string | null
          comments?: string | null
          confidence_level?: number | null
          created_at?: string | null
          current_value?: number
          employee_id?: string
          id?: string
          individual_objective_id?: string | null
          key_result_id?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["checkin_status"]
          updated_at?: string | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_checkins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_checkins_individual_objective_id_fkey"
            columns: ["individual_objective_id"]
            isOneToOne: false
            referencedRelation: "individual_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_checkins_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_checkins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedule_settings: {
        Row: {
          break_end_time: string | null
          break_start_time: string | null
          created_at: string | null
          created_by: string | null
          end_time: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          late_tolerance_minutes: number | null
          name: string
          organization_id: string
          overtime_threshold_minutes: number | null
          start_time: string
          timezone: string | null
          updated_at: string | null
          working_days: number[]
        }
        Insert: {
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string | null
          created_by?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          late_tolerance_minutes?: number | null
          name?: string
          organization_id: string
          overtime_threshold_minutes?: number | null
          start_time?: string
          timezone?: string | null
          updated_at?: string | null
          working_days?: number[]
        }
        Update: {
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string | null
          created_by?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          late_tolerance_minutes?: number | null
          name?: string
          organization_id?: string
          overtime_threshold_minutes?: number | null
          start_time?: string
          timezone?: string | null
          updated_at?: string | null
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "work_schedule_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      kol_conversion_aggregates: {
        Row: {
          avg_conversion_value: number | null
          content_post_id: string | null
          conversion_day: string | null
          conversion_types_count: number | null
          kol_profile_id: string | null
          total_conversion_value: number | null
          total_conversions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_conversions_content_post_id_fkey"
            columns: ["content_post_id"]
            isOneToOne: false
            referencedRelation: "kol_content_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_conversions_kol_profile_id_fkey"
            columns: ["kol_profile_id"]
            isOneToOne: false
            referencedRelation: "kol_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_jobs_status: {
        Row: {
          active: boolean | null
          command: string | null
          database: string | null
          jobid: number | null
          jobname: string | null
          nodename: string | null
          nodeport: number | null
          schedule: string | null
          username: string | null
        }
        Insert: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_ownership_transfer: {
        Args: { _transfer_id: string }
        Returns: boolean
      }
      activate_subscription_from_payment: {
        Args: { payment_transaction_id: string }
        Returns: boolean
      }
      apply_due_subscription_changes: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      auto_sync_payment_status: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      backfill_payment_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      calculate_current_members: {
        Args: { org_id: string }
        Returns: number
      }
      calculate_distance_meters: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_employee_leave_balance: {
        Args: { as_of_date?: string; employee_id_param: string }
        Returns: Json
      }
      calculate_leave_entitlement_date: {
        Args:
          | { hire_date_param: string; organization_id_param: string }
          | { hire_date_param: string; organization_id_param: string }
        Returns: string
      }
      calculate_member_pricing: {
        Args: {
          is_annual_param?: boolean
          member_count_param: number
          plan_id_param: string
        }
        Returns: Json
      }
      calculate_monthly_working_days: {
        Args: { month_param?: string; organization_id_param: string }
        Returns: {
          holiday_days: number
          month_date: string
          schedule_details: Json
          total_days: number
          weekend_days: number
          working_days: number
        }[]
      }
      calculate_payroll_run_totals: {
        Args: { run_id: string }
        Returns: undefined
      }
      calculate_pph21_monthly: {
        Args: {
          include_bpjs_kesehatan?: boolean
          include_bpjs_pensiun?: boolean
          monthly_gross: number
          ptkp_status?: string
        }
        Returns: number
      }
      calculate_pph21_progressive: {
        Args: {
          p_custom_ptkp?: number
          p_include_bpjs_kesehatan?: boolean
          p_include_bpjs_pensiun?: boolean
          p_monthly_gross: number
          p_non_taxable_allowance?: number
          p_ptkp_status?: string
        }
        Returns: Json
      }
      calculate_probation_end_date: {
        Args: { hire_date_param: string; organization_id_param: string }
        Returns: string
      }
      calculate_prorate_upgrade: {
        Args: {
          new_member_count: number
          org_id: string
          target_plan_id?: string
        }
        Returns: Json
      }
      calculate_resolution_time: {
        Args: { created_at: string; resolved_at: string }
        Returns: string
      }
      can_add_employee: {
        Args: { org_id: string }
        Returns: boolean
      }
      check_annual_leave_cron_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      check_data_integrity: {
        Args: { org_id: string }
        Returns: {
          check_type: string
          count: number
          description: string
        }[]
      }
      check_email_verification_status: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      check_payroll_period_conflicts: {
        Args: {
          end_date: string
          exclude_period_id?: string
          org_id: string
          start_date: string
        }
        Returns: boolean
      }
      cleanup_expired_employee_status: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_subscription_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_user_organization_data: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      cleanup_user_organization_data_safe: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      cleanup_user_organizations: {
        Args: { _user_id: string }
        Returns: undefined
      }
      create_attendance_notification: {
        Args: {
          attendance_record_id_param?: string
          employee_id_param: string
          message_param: string
          notification_type_param: string
          organization_id_param: string
          title_param: string
        }
        Returns: string
      }
      create_default_payment_terms: {
        Args: {
          p_base_budget?: number
          p_bonus_budget?: number
          p_campaign_id: string
          p_kol_profile_id: string
          p_organization_id: string
          p_payment_model?: string
        }
        Returns: string
      }
      create_default_tax_configuration: {
        Args: { org_id: string }
        Returns: string
      }
      create_organization_complete: {
        Args: {
          p_address?: string
          p_company_name: string
          p_description?: string
          p_employee_count: string
          p_industry: string
          p_phone_number?: string
          p_user_id: string
          p_website?: string
        }
        Returns: Json
      }
      create_organization_subscription: {
        Args: { org_id: string }
        Returns: undefined
      }
      create_organization_without_subscription: {
        Args: {
          p_address?: string
          p_company_name: string
          p_description?: string
          p_employee_count: string
          p_industry: string
          p_phone_number?: string
          p_user_id: string
          p_website?: string
        }
        Returns: Json
      }
      deactivate_face_registration: {
        Args: { registration_id: string }
        Returns: boolean
      }
      email_before_at: {
        Args: { _user_id: string }
        Returns: string
      }
      expire_old_motivations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      expire_previous_year_allocations: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      find_or_create_department_objective: {
        Args: {
          p_created_by: string
          p_cycle_id: string
          p_department_id: string
          p_description: string
          p_organization_id: string
          p_owner_id: string
          p_parent_objective_id: string
          p_title: string
          p_why_important: string
        }
        Returns: string
      }
      generate_candidate_recruitment_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_payroll_calculations_for_run: {
        Args: { run_id: string }
        Returns: undefined
      }
      generate_payroll_items_for_calculation: {
        Args: { calculation_id: string }
        Returns: undefined
      }
      get_active_payroll_period: {
        Args: { org_id: string }
        Returns: string
      }
      get_alignment_score: {
        Args: { obj_id: string }
        Returns: number
      }
      get_attendance_validation_summary: {
        Args: { attendance_record_id_param: string }
        Returns: Json
      }
      get_current_month_working_days_summary: {
        Args: { organization_id_param: string }
        Returns: Json
      }
      get_employee_face_registrations: {
        Args: { emp_id: string }
        Returns: {
          confidence_threshold: number
          created_at: string
          created_by: string
          employee_id: string
          face_encoding: string
          face_image_url: string
          id: string
          is_active: boolean
          organization_id: string
          updated_at: string
        }[]
      }
      get_enhanced_attendance_validation_summary: {
        Args: { attendance_log_id_param: string }
        Returns: Json
      }
      get_entity_descendants: {
        Args: { entity_id: string }
        Returns: {
          entity_type: string
          id: string
          level: number
          name: string
        }[]
      }
      get_entity_hierarchy: {
        Args: { org_id: string }
        Returns: {
          employee_id: string
          entity_type: string
          id: string
          level: number
          name: string
          parent_id: string
          path: string[]
        }[]
      }
      get_job_by_recruitment_token: {
        Args: { token_param: string }
        Returns: Json
      }
      get_month_start_end_dates: {
        Args: Record<PropertyKey, never>
        Returns: {
          end_date: string
          start_date: string
        }[]
      }
      get_organization_employee_count: {
        Args: { org_id: string }
        Returns: number
      }
      get_organization_from_payroll_calculation: {
        Args: { calc_employee_payroll_info_id: string }
        Returns: string
      }
      get_organization_members: {
        Args: { _organization_id: string }
        Returns: {
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_payroll_validation_summary: {
        Args: { org_id: string; period_end: string; period_start: string }
        Returns: Json
      }
      get_real_payroll_data: {
        Args: { org_id: string }
        Returns: {
          attendance_penalties: number
          basic_salary: number
          employee_id: string
          employee_name: string
          gross_pay: number
          net_pay: number
          tax_amount: number
          total_allowances: number
          total_deductions: number
        }[]
      }
      get_subscription_status: {
        Args: { org_id: string }
        Returns: {
          base_price_per_member: number
          billing_cycle: string
          days_remaining: number
          employee_count: number
          end_date: string
          is_active: boolean
          is_expired: boolean
          is_over_limit: boolean
          is_trial: boolean
          member_limit: number
          next_payment_date: string
          plan_name: string
          status: string
          subscription_end_date: string
          subscription_start_date: string
          trial_end_date: string
        }[]
      }
      get_user_active_org: {
        Args: { user_id_param: string }
        Returns: string
      }
      get_user_organization_role: {
        Args: { target_user_id: string }
        Returns: string
      }
      get_user_organizations: {
        Args: { _user_id?: string }
        Returns: {
          company_name: string
          is_active: boolean
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_role_in_active_org: {
        Args: { _user_id?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_role_in_org: {
        Args: { user_id_param: string }
        Returns: string
      }
      get_working_days_in_period: {
        Args: {
          end_date: string
          exclude_weekends?: boolean
          start_date: string
        }
        Returns: number
      }
      grant_annual_leave: {
        Args:
          | { allocation_year?: number; employee_id_param: string }
          | { days_to_grant?: number; employee_id_param: string }
        Returns: Json
      }
      grant_new_year_leave: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      handle_midtrans_webhook_improved: {
        Args: { webhook_payload: Json }
        Returns: Json
      }
      handle_subscription_payment_success: {
        Args: {
          p_billing_cycle: string
          p_order_id: string
          p_plan_id: string
          p_status: string
          p_user_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_job_clicks: {
        Args: { job_id: string }
        Returns: undefined
      }
      increment_job_submissions: {
        Args: { job_id: string }
        Returns: undefined
      }
      increment_payment_retry: {
        Args: { error_message_param?: string; payment_id_param: string }
        Returns: Json
      }
      increment_recruitment_link_clicks: {
        Args: { link_id: string }
        Returns: undefined
      }
      increment_recruitment_link_submissions: {
        Args: { link_id: string }
        Returns: undefined
      }
      insert_face_registration: {
        Args: {
          conf_threshold: number
          created_by_user: string
          emp_id: string
          face_enc: string
          img_url: string
          org_id: string
        }
        Returns: string
      }
      is_current_user_org_owner: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_organization_owner: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      is_user_admin_in_org: {
        Args: { org_id: string; user_id_param?: string }
        Returns: boolean
      }
      link_payroll_items_to_penalties: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      manual_fix_payment_status: {
        Args: {
          new_status?: string
          order_id_param: string
          transaction_id_param?: string
        }
        Returns: Json
      }
      migrate_post_links_to_table: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      process_completed_plan_change: {
        Args: { plan_change_id: string }
        Returns: undefined
      }
      process_midtrans_webhook: {
        Args: {
          gross_amount_param: number
          notification_body: Json
          order_id_param: string
          payment_type_param: string
          transaction_id_param: string
          transaction_status_param: string
        }
        Returns: Json
      }
      process_organization_payroll: {
        Args: { org_id: string; period_id: string }
        Returns: {
          processed_count: number
          processing_status: string
          total_gross_pay: number
          total_net_pay: number
        }[]
      }
      process_payment_data: {
        Args: { notification_data: Json }
        Returns: Json
      }
      process_payroll_batch: {
        Args:
          | Record<PropertyKey, never>
          | {
              employee_ids: string[]
              organization_id_param: string
              payroll_period_id_param: string
              period_end_param: string
              period_start_param: string
            }
          | { organization_id_param: string; payroll_period_id_param: string }
        Returns: Json
      }
      process_payroll_calculations: {
        Args: { payroll_run_uuid: string }
        Returns: Json
      }
      process_payroll_run: {
        Args: { run_id: string }
        Returns: Json
      }
      process_subscription_renewals: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      process_subscription_upgrade: {
        Args: {
          billing_cycle?: string
          new_member_count: number
          org_id: string
          payment_id?: string
        }
        Returns: Json
      }
      recalculate_attendance_late_status: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      recalculate_attendance_penalties: {
        Args: { attendance_record_uuid: string }
        Returns: undefined
      }
      record_attendance_with_timezone: {
        Args:
          | Record<PropertyKey, never>
          | {
              employee_id_param: string
              latitude_param: number
              local_checkin_time: string
              location_data: Json
              longitude_param: number
              organization_id_param: string
              photo_path_param: string
              timezone_param: string
            }
          | { timezone?: string; user_id: string }
        Returns: Json
      }
      recruitment_health_check: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      refresh_kol_conversion_aggregates: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_okr_dashboard_summary: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reset_user_auth_state: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      scheduled_payment_sync: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      switch_active_organization: {
        Args: { _organization_id: string }
        Returns: boolean
      }
      sync_subscription_from_latest_change: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sync_user_active_organization: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      transfer_ownership: {
        Args: { _message?: string; _to_user_id: string }
        Returns: string
      }
      trigger_annual_leave_grant: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      update_expired_subscriptions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_organization_over_limit_status: {
        Args: { org_id: string }
        Returns: undefined
      }
      update_payroll_run_totals_from_calculations: {
        Args: { run_id: string }
        Returns: boolean
      }
      user_can_access_payroll_calculation: {
        Args: { calc_employee_payroll_info_id: string }
        Returns: boolean
      }
      validate_attendance_completeness: {
        Args: { org_id: string; period_end: string; period_start: string }
        Returns: {
          actual_days: number
          attendance_rate: number
          employee_id: string
          employee_name: string
          expected_days: number
          is_complete: boolean
          validation_message: string
        }[]
      }
      validate_attendance_comprehensive: {
        Args: {
          employee_id_param: string
          face_image_data?: string
          latitude_param: number
          longitude_param: number
          organization_id_param: string
        }
        Returns: {
          allowed_radius: number
          can_attend: boolean
          distance_meters: number
          face_registered: boolean
          face_valid: boolean
          is_holiday: boolean
          is_late: boolean
          late_minutes: number
          location_valid: boolean
          no_duplicate: boolean
          office_location_id: string
          office_location_name: string
          schedule_valid: boolean
        }[]
      }
      validate_attendance_comprehensive_v2: {
        Args: {
          device_info_param?: Json
          employee_id_param: string
          face_image_data?: string
          latitude_param: number
          longitude_param: number
          organization_id_param: string
          wifi_info_param?: Json
        }
        Returns: Json
      }
      validate_attendance_simple_v2: {
        Args: {
          device_info_param?: Json
          employee_id_param: string
          face_image_data?: string
          latitude_param: number
          longitude_param: number
          organization_id_param: string
          wifi_info_param?: Json
        }
        Returns: Json
      }
      validate_client_visit_location: {
        Args: {
          client_id_param?: string
          organization_id_param?: string
          user_latitude: number
          user_longitude: number
        }
        Returns: Json
      }
      validate_employee_salary_structure: {
        Args: { org_id: string }
        Returns: {
          employee_id: string
          employee_name: string
          has_active_assignment: boolean
          has_salary_structure: boolean
          validation_message: string
        }[]
      }
      verify_organization_creation: {
        Args: { org_id: string }
        Returns: Json
      }
      verify_user_email: {
        Args: { user_id_param: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "employee" | "hr"
      checkin_status: "on_track" | "at_risk" | "off_track"
      deduction_type: "fixed_amount" | "percentage"
      kr_calculation_type: "increase" | "decrease" | "maintain"
      kr_metric_type: "percentage" | "number" | "currency" | "boolean"
      objective_level: "company" | "department" | "individual"
      objective_status:
        | "draft"
        | "active"
        | "paused"
        | "completed"
        | "cancelled"
      okr_level: "company" | "department" | "individual"
      okr_period_type: "yearly" | "half_yearly" | "quarterly"
      okr_status: "draft" | "active" | "completed" | "cancelled"
      payment_status:
        | "pending"
        | "success"
        | "failed"
        | "challenge"
        | "settlement"
        | "capture"
        | "refunded"
        | "expired"
      payment_status_enum:
        | "pending"
        | "settlement"
        | "capture"
        | "success"
        | "failed"
        | "challenge"
        | "refunded"
        | "expired"
        | "cancelled"
      payment_status_type:
        | "pending"
        | "payment_pending"
        | "payment_processing"
        | "payment_failed"
        | "completed"
        | "cancelled"
      status_type: "work" | "meeting" | "break" | "call" | "wfh"
      weight_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "employee", "hr"],
      checkin_status: ["on_track", "at_risk", "off_track"],
      deduction_type: ["fixed_amount", "percentage"],
      kr_calculation_type: ["increase", "decrease", "maintain"],
      kr_metric_type: ["percentage", "number", "currency", "boolean"],
      objective_level: ["company", "department", "individual"],
      objective_status: ["draft", "active", "paused", "completed", "cancelled"],
      okr_level: ["company", "department", "individual"],
      okr_period_type: ["yearly", "half_yearly", "quarterly"],
      okr_status: ["draft", "active", "completed", "cancelled"],
      payment_status: [
        "pending",
        "success",
        "failed",
        "challenge",
        "settlement",
        "capture",
        "refunded",
        "expired",
      ],
      payment_status_enum: [
        "pending",
        "settlement",
        "capture",
        "success",
        "failed",
        "challenge",
        "refunded",
        "expired",
        "cancelled",
      ],
      payment_status_type: [
        "pending",
        "payment_pending",
        "payment_processing",
        "payment_failed",
        "completed",
        "cancelled",
      ],
      status_type: ["work", "meeting", "break", "call", "wfh"],
      weight_status: ["pending", "approved", "rejected"],
    },
  },
} as const
