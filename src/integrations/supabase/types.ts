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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      campaign_steps: {
        Row: {
          body: string
          campaign_id: string
          created_at: string
          delay_days: number
          id: string
          step_order: number
          subject: string
          updated_at: string
          user_id: string
          variant_label: string
        }
        Insert: {
          body?: string
          campaign_id: string
          created_at?: string
          delay_days?: number
          id?: string
          step_order: number
          subject?: string
          updated_at?: string
          user_id: string
          variant_label?: string
        }
        Update: {
          body?: string
          campaign_id?: string
          created_at?: string
          delay_days?: number
          id?: string
          step_order?: number
          subject?: string
          updated_at?: string
          user_id?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          email_account_id: string | null
          followup_delay_hours: number
          id: string
          max_followups: number
          name: string
          status: Database["public"]["Enums"]["campaign_status"]
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_account_id?: string | null
          followup_delay_hours?: number
          id?: string
          max_followups?: number
          name: string
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_account_id?: string | null
          followup_delay_hours?: number
          id?: string
          max_followups?: number
          name?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          app_password: string
          created_at: string
          daily_send_limit: number
          display_name: string | null
          email: string
          id: string
          imap_host: string
          imap_port: number
          is_primary: boolean
          sends_today: number
          smtp_host: string
          smtp_port: number
          updated_at: string
          user_id: string
          warmup_enabled: boolean
          warmup_level: number
        }
        Insert: {
          app_password: string
          created_at?: string
          daily_send_limit?: number
          display_name?: string | null
          email: string
          id?: string
          imap_host?: string
          imap_port?: number
          is_primary?: boolean
          sends_today?: number
          smtp_host?: string
          smtp_port?: number
          updated_at?: string
          user_id: string
          warmup_enabled?: boolean
          warmup_level?: number
        }
        Update: {
          app_password?: string
          created_at?: string
          daily_send_limit?: number
          display_name?: string | null
          email?: string
          id?: string
          imap_host?: string
          imap_port?: number
          is_primary?: boolean
          sends_today?: number
          smtp_host?: string
          smtp_port?: number
          updated_at?: string
          user_id?: string
          warmup_enabled?: boolean
          warmup_level?: number
        }
        Relationships: []
      }
      email_validations: {
        Row: {
          created_at: string
          email: string
          id: string
          is_catchall: boolean
          is_disposable: boolean
          lead_id: string
          mx_valid: boolean
          status: string
          syntax_valid: boolean
          updated_at: string
          user_id: string
          validated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_catchall?: boolean
          is_disposable?: boolean
          lead_id: string
          mx_valid?: boolean
          status: string
          syntax_valid?: boolean
          updated_at?: string
          user_id: string
          validated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_catchall?: boolean
          is_disposable?: boolean
          lead_id?: string
          mx_valid?: boolean
          status?: string
          syntax_valid?: boolean
          updated_at?: string
          user_id?: string
          validated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_validations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          attempt_number: number
          body: string
          bounce_reason: string | null
          bounce_type: string | null
          created_at: string
          email_account_id: string | null
          id: string
          lead_id: string | null
          max_attempts: number
          message_id: string | null
          recipient_email: string
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["followup_status"]
          subject: string
          thread_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_number?: number
          body: string
          bounce_reason?: string | null
          bounce_type?: string | null
          created_at?: string
          email_account_id?: string | null
          id?: string
          lead_id?: string | null
          max_attempts?: number
          message_id?: string | null
          recipient_email: string
          scheduled_for: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["followup_status"]
          subject: string
          thread_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_number?: number
          body?: string
          bounce_reason?: string | null
          bounce_type?: string | null
          created_at?: string
          email_account_id?: string | null
          id?: string
          lead_id?: string | null
          max_attempts?: number
          message_id?: string | null
          recipient_email?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["followup_status"]
          subject?: string
          thread_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_pain_points: string[]
          ai_personalized_line: string | null
          ai_relevancy_score: number | null
          ai_researched_at: string | null
          ai_summary: string | null
          campaign_id: string | null
          company: string | null
          created_at: string
          custom_fields: Json | null
          email: string
          id: string
          name: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          user_id: string
          validation_status: string | null
        }
        Insert: {
          ai_pain_points?: string[]
          ai_personalized_line?: string | null
          ai_relevancy_score?: number | null
          ai_researched_at?: string | null
          ai_summary?: string | null
          campaign_id?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json | null
          email: string
          id?: string
          name?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          user_id: string
          validation_status?: string | null
        }
        Update: {
          ai_pain_points?: string[]
          ai_personalized_line?: string | null
          ai_relevancy_score?: number | null
          ai_researched_at?: string | null
          ai_summary?: string | null
          campaign_id?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string
          id?: string
          name?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          user_id?: string
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          usage_count: number
          user_id: string
          variables: string[] | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
          usage_count?: number
          user_id: string
          variables?: string[] | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          created_at: string
          event_type: string
          followup_id: string
          id: string
          ip_address: string | null
          link_url: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          followup_id: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          followup_id?: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "followups"
            referencedColumns: ["id"]
          },
        ]
      }
      warmup_logs: {
        Row: {
          direction: string
          id: string
          partner_email: string
          sent_at: string
          subject: string | null
          user_id: string
          warmup_schedule_id: string
        }
        Insert: {
          direction: string
          id?: string
          partner_email: string
          sent_at?: string
          subject?: string | null
          user_id: string
          warmup_schedule_id: string
        }
        Update: {
          direction?: string
          id?: string
          partner_email?: string
          sent_at?: string
          subject?: string | null
          user_id?: string
          warmup_schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warmup_logs_warmup_schedule_id_fkey"
            columns: ["warmup_schedule_id"]
            isOneToOne: false
            referencedRelation: "warmup_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      warmup_schedules: {
        Row: {
          created_at: string
          current_daily_limit: number
          days_active: number
          email_account_id: string
          id: string
          ramp_increment: number
          status: Database["public"]["Enums"]["warmup_status"]
          target_daily_limit: number
          total_received: number
          total_sent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_daily_limit?: number
          days_active?: number
          email_account_id: string
          id?: string
          ramp_increment?: number
          status?: Database["public"]["Enums"]["warmup_status"]
          target_daily_limit?: number
          total_received?: number
          total_sent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_daily_limit?: number
          days_active?: number
          email_account_id?: string
          id?: string
          ramp_increment?: number
          status?: Database["public"]["Enums"]["warmup_status"]
          target_daily_limit?: number
          total_received?: number
          total_sent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warmup_schedules_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      campaign_status: "draft" | "active" | "paused" | "completed"
      followup_status: "pending" | "sent" | "cancelled" | "replied" | "failed"
      lead_status:
        | "imported"
        | "active"
        | "replied"
        | "bounced"
        | "unsubscribed"
        | "duplicate"
      warmup_status: "active" | "paused" | "completed"
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
      campaign_status: ["draft", "active", "paused", "completed"],
      followup_status: ["pending", "sent", "cancelled", "replied", "failed"],
      lead_status: [
        "imported",
        "active",
        "replied",
        "bounced",
        "unsubscribed",
        "duplicate",
      ],
      warmup_status: ["active", "paused", "completed"],
    },
  },
} as const
