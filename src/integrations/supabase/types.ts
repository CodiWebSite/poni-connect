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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          is_pinned: boolean | null
          priority: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          priority?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          priority?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audiences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          host_id: string
          id: string
          notes: string | null
          requester_email: string | null
          requester_name: string
          requester_organization: string | null
          requester_phone: string | null
          scheduled_date: string
          status: Database["public"]["Enums"]["audience_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          host_id: string
          id?: string
          notes?: string | null
          requester_email?: string | null
          requester_name: string
          requester_organization?: string | null
          requester_phone?: string | null
          scheduled_date: string
          status?: Database["public"]["Enums"]["audience_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          host_id?: string
          id?: string
          notes?: string | null
          requester_email?: string | null
          requester_name?: string
          requester_organization?: string | null
          requester_phone?: string | null
          scheduled_date?: string
          status?: Database["public"]["Enums"]["audience_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_holidays: {
        Row: {
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          holiday_date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          holiday_date?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      data_correction_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          current_value: string | null
          field_name: string
          id: string
          reason: string | null
          requested_value: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          current_value?: string | null
          field_name: string
          id?: string
          reason?: string | null
          requested_value: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          current_value?: string | null
          field_name?: string
          id?: string
          reason?: string | null
          requested_value?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_registry: {
        Row: {
          category: string | null
          created_at: string
          direction: Database["public"]["Enums"]["document_direction"]
          document_date: string
          file_url: string | null
          id: string
          notes: string | null
          recipient: string | null
          registered_by: string | null
          registration_number: string
          resolved_at: string | null
          resolved_by: string | null
          sender: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["document_direction"]
          document_date?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          recipient?: string | null
          registered_by?: string | null
          registration_number: string
          resolved_at?: string | null
          resolved_by?: string | null
          sender?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["document_direction"]
          document_date?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          recipient?: string | null
          registered_by?: string | null
          registration_number?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sender?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string
          description: string | null
          document_type: string
          file_url: string | null
          id: string
          name: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_type: string
          file_url?: string | null
          id?: string
          name: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          name?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      employee_personal_data: {
        Row: {
          address_apartment: string | null
          address_block: string | null
          address_city: string | null
          address_county: string | null
          address_floor: string | null
          address_number: string | null
          address_street: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          ci_expiry_date: string | null
          ci_issued_by: string | null
          ci_issued_date: string | null
          ci_number: string | null
          ci_scan_uploaded_at: string | null
          ci_scan_url: string | null
          ci_series: string | null
          cnp: string
          contract_type: string | null
          created_at: string
          department: string | null
          email: string
          employee_record_id: string | null
          employment_date: string
          first_name: string
          id: string
          is_archived: boolean
          last_name: string
          last_updated_by: string | null
          original_id: string | null
          position: string | null
          total_leave_days: number | null
          updated_at: string
          used_leave_days: number | null
        }
        Insert: {
          address_apartment?: string | null
          address_block?: string | null
          address_city?: string | null
          address_county?: string | null
          address_floor?: string | null
          address_number?: string | null
          address_street?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          ci_expiry_date?: string | null
          ci_issued_by?: string | null
          ci_issued_date?: string | null
          ci_number?: string | null
          ci_scan_uploaded_at?: string | null
          ci_scan_url?: string | null
          ci_series?: string | null
          cnp: string
          contract_type?: string | null
          created_at?: string
          department?: string | null
          email: string
          employee_record_id?: string | null
          employment_date: string
          first_name: string
          id?: string
          is_archived?: boolean
          last_name: string
          last_updated_by?: string | null
          original_id?: string | null
          position?: string | null
          total_leave_days?: number | null
          updated_at?: string
          used_leave_days?: number | null
        }
        Update: {
          address_apartment?: string | null
          address_block?: string | null
          address_city?: string | null
          address_county?: string | null
          address_floor?: string | null
          address_number?: string | null
          address_street?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          ci_expiry_date?: string | null
          ci_issued_by?: string | null
          ci_issued_date?: string | null
          ci_number?: string | null
          ci_scan_uploaded_at?: string | null
          ci_scan_url?: string | null
          ci_series?: string | null
          cnp?: string
          contract_type?: string | null
          created_at?: string
          department?: string | null
          email?: string
          employee_record_id?: string | null
          employment_date?: string
          first_name?: string
          id?: string
          is_archived?: boolean
          last_name?: string
          last_updated_by?: string | null
          original_id?: string | null
          position?: string | null
          total_leave_days?: number | null
          updated_at?: string
          used_leave_days?: number | null
        }
        Relationships: []
      }
      employee_records: {
        Row: {
          contract_type: string | null
          created_at: string
          hire_date: string | null
          id: string
          remaining_leave_days: number | null
          total_leave_days: number
          updated_at: string
          used_leave_days: number
          user_id: string
        }
        Insert: {
          contract_type?: string | null
          created_at?: string
          hire_date?: string | null
          id?: string
          remaining_leave_days?: number | null
          total_leave_days?: number
          updated_at?: string
          used_leave_days?: number
          user_id: string
        }
        Update: {
          contract_type?: string | null
          created_at?: string
          hire_date?: string | null
          id?: string
          remaining_leave_days?: number | null
          total_leave_days?: number
          updated_at?: string
          used_leave_days?: number
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          start_date: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          start_date: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          start_date?: string
          title?: string
        }
        Relationships: []
      }
      hr_requests: {
        Row: {
          approver_id: string | null
          approver_notes: string | null
          created_at: string
          department_head_id: string | null
          department_head_signature: string | null
          department_head_signed_at: string | null
          details: Json
          employee_signature: string | null
          employee_signed_at: string | null
          generated_content: string | null
          id: string
          request_type: Database["public"]["Enums"]["hr_request_type"]
          status: Database["public"]["Enums"]["hr_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approver_id?: string | null
          approver_notes?: string | null
          created_at?: string
          department_head_id?: string | null
          department_head_signature?: string | null
          department_head_signed_at?: string | null
          details?: Json
          employee_signature?: string | null
          employee_signed_at?: string | null
          generated_content?: string | null
          id?: string
          request_type: Database["public"]["Enums"]["hr_request_type"]
          status?: Database["public"]["Enums"]["hr_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approver_id?: string | null
          approver_notes?: string | null
          created_at?: string
          department_head_id?: string | null
          department_head_signature?: string | null
          department_head_signed_at?: string | null
          details?: Json
          employee_signature?: string | null
          employee_signed_at?: string | null
          generated_content?: string | null
          id?: string
          request_type?: Database["public"]["Enums"]["hr_request_type"]
          status?: Database["public"]["Enums"]["hr_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      procurement_requests: {
        Row: {
          approver_signature: string | null
          approver_signed_at: string | null
          budget_source: string | null
          category: Database["public"]["Enums"]["procurement_category"]
          cfp_approved_at: string | null
          cfp_notes: string | null
          cfp_officer_id: string | null
          created_at: string
          currency: string
          department: string
          department_head_approved_at: string | null
          department_head_id: string | null
          department_head_notes: string | null
          description: string
          director_approved_at: string | null
          director_id: string | null
          director_notes: string | null
          employee_signature: string | null
          employee_signed_at: string | null
          estimated_value: number
          id: string
          items: Json
          justification: string
          procurement_approved_at: string | null
          procurement_notes: string | null
          procurement_officer_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          request_number: string
          status: Database["public"]["Enums"]["procurement_status"]
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["procurement_urgency"]
          user_id: string
        }
        Insert: {
          approver_signature?: string | null
          approver_signed_at?: string | null
          budget_source?: string | null
          category?: Database["public"]["Enums"]["procurement_category"]
          cfp_approved_at?: string | null
          cfp_notes?: string | null
          cfp_officer_id?: string | null
          created_at?: string
          currency?: string
          department: string
          department_head_approved_at?: string | null
          department_head_id?: string | null
          department_head_notes?: string | null
          description: string
          director_approved_at?: string | null
          director_id?: string | null
          director_notes?: string | null
          employee_signature?: string | null
          employee_signed_at?: string | null
          estimated_value: number
          id?: string
          items?: Json
          justification: string
          procurement_approved_at?: string | null
          procurement_notes?: string | null
          procurement_officer_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_number: string
          status?: Database["public"]["Enums"]["procurement_status"]
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["procurement_urgency"]
          user_id: string
        }
        Update: {
          approver_signature?: string | null
          approver_signed_at?: string | null
          budget_source?: string | null
          category?: Database["public"]["Enums"]["procurement_category"]
          cfp_approved_at?: string | null
          cfp_notes?: string | null
          cfp_officer_id?: string | null
          created_at?: string
          currency?: string
          department?: string
          department_head_approved_at?: string | null
          department_head_id?: string | null
          department_head_notes?: string | null
          description?: string
          director_approved_at?: string | null
          director_id?: string | null
          director_notes?: string | null
          employee_signature?: string | null
          employee_signed_at?: string | null
          estimated_value?: number
          id?: string
          items?: Json
          justification?: string
          procurement_approved_at?: string | null
          procurement_notes?: string | null
          procurement_officer_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_number?: string
          status?: Database["public"]["Enums"]["procurement_status"]
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["procurement_urgency"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          department: string | null
          full_name: string
          id: string
          phone: string | null
          position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          department?: string | null
          full_name: string
          id?: string
          phone?: string | null
          position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          position?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          admin_response: string | null
          category: string
          created_at: string
          description: string
          id: string
          responded_at: string | null
          responded_by: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          badge_number: string | null
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          expected_date: string
          full_name: string
          host_department: string | null
          host_name: string
          id: string
          id_document_number: string | null
          id_document_type: string | null
          notes: string | null
          organization: string | null
          purpose: string
          registered_by: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          updated_at: string
        }
        Insert: {
          badge_number?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          expected_date: string
          full_name: string
          host_department?: string | null
          host_name: string
          id?: string
          id_document_number?: string | null
          id_document_type?: string | null
          notes?: string | null
          organization?: string | null
          purpose: string
          registered_by?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          updated_at?: string
        }
        Update: {
          badge_number?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          expected_date?: string
          full_name?: string
          host_department?: string | null
          host_name?: string
          id?: string
          id_document_number?: string | null
          id_document_type?: string | null
          notes?: string | null
          organization?: string | null
          purpose?: string
          registered_by?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      employee_directory: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string | null
          department: string | null
          full_name: string | null
          id: string | null
          position: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string | null
          department?: string | null
          full_name?: string | null
          id?: string | null
          position?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string | null
          department?: string | null
          full_name?: string | null
          id?: string | null
          position?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_manage_content: { Args: { _user_id: string }; Returns: boolean }
      can_manage_hr: { Args: { _user_id: string }; Returns: boolean }
      can_manage_procurement: { Args: { _user_id: string }; Returns: boolean }
      can_manage_secretariat: { Args: { _user_id: string }; Returns: boolean }
      can_view_sensitive_profile_data: {
        Args: { _profile_user_id: string; _viewer_id: string }
        Returns: boolean
      }
      generate_procurement_request_number: { Args: never; Returns: string }
      generate_registration_number: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          _action: string
          _details?: Json
          _entity_id?: string
          _entity_type?: string
          _user_id: string
        }
        Returns: undefined
      }
      sync_existing_employees: {
        Args: never
        Returns: {
          emails_matched: string[]
          synced_count: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "super_admin"
        | "department_head"
        | "secretariat"
        | "director"
        | "hr"
        | "achizitii_contabilitate"
      audience_status: "pending" | "confirmed" | "completed" | "cancelled"
      document_direction: "incoming" | "outgoing"
      hr_request_status: "pending" | "approved" | "rejected"
      hr_request_type: "concediu" | "adeverinta" | "delegatie" | "demisie"
      procurement_category:
        | "consumabile_laborator"
        | "echipamente_it"
        | "birotica"
        | "echipamente_cercetare"
        | "servicii"
        | "mobilier"
        | "altele"
      procurement_status:
        | "draft"
        | "pending_department_head"
        | "pending_procurement"
        | "pending_director"
        | "pending_cfp"
        | "approved"
        | "rejected"
      procurement_urgency: "normal" | "urgent" | "foarte_urgent"
      visitor_status: "expected" | "checked_in" | "checked_out" | "cancelled"
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
      app_role: [
        "admin",
        "user",
        "super_admin",
        "department_head",
        "secretariat",
        "director",
        "hr",
        "achizitii_contabilitate",
      ],
      audience_status: ["pending", "confirmed", "completed", "cancelled"],
      document_direction: ["incoming", "outgoing"],
      hr_request_status: ["pending", "approved", "rejected"],
      hr_request_type: ["concediu", "adeverinta", "delegatie", "demisie"],
      procurement_category: [
        "consumabile_laborator",
        "echipamente_it",
        "birotica",
        "echipamente_cercetare",
        "servicii",
        "mobilier",
        "altele",
      ],
      procurement_status: [
        "draft",
        "pending_department_head",
        "pending_procurement",
        "pending_director",
        "pending_cfp",
        "approved",
        "rejected",
      ],
      procurement_urgency: ["normal", "urgent", "foarte_urgent"],
      visitor_status: ["expected", "checked_in", "checked_out", "cancelled"],
    },
  },
} as const
