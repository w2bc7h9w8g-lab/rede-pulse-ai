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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          analyzed_at: string
          campaign_id: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          identified_participants_count: number
          leader_id: string
          network_size_snapshot: number
          participation_rate: number
          post_id: string | null
          shortcode: string | null
          source: string
          status: Database["public"]["Enums"]["analysis_status"]
          updated_at: string
          url: string
        }
        Insert: {
          analyzed_at?: string
          campaign_id: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          identified_participants_count?: number
          leader_id: string
          network_size_snapshot?: number
          participation_rate?: number
          post_id?: string | null
          shortcode?: string | null
          source?: string
          status?: Database["public"]["Enums"]["analysis_status"]
          updated_at?: string
          url: string
        }
        Update: {
          analyzed_at?: string
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          identified_participants_count?: number
          leader_id?: string
          network_size_snapshot?: number
          participation_rate?: number
          post_id?: string | null
          shortcode?: string | null
          source?: string
          status?: Database["public"]["Enums"]["analysis_status"]
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          campaign_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          campaign_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          campaign_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          candidate_name: string | null
          created_at: string
          id: string
          instagram_username: string | null
          is_demo: boolean
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          candidate_name?: string | null
          created_at?: string
          id?: string
          instagram_username?: string | null
          is_demo?: boolean
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          candidate_name?: string | null
          created_at?: string
          id?: string
          instagram_username?: string | null
          is_demo?: boolean
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      instagram_connections: {
        Row: {
          account_username: string | null
          campaign_id: string
          connected_at: string | null
          created_at: string
          expires_at: string | null
          external_account_id: string | null
          id: string
          provider: string
          status: string
          token_secret_name: string | null
          updated_at: string
        }
        Insert: {
          account_username?: string | null
          campaign_id: string
          connected_at?: string | null
          created_at?: string
          expires_at?: string | null
          external_account_id?: string | null
          id?: string
          provider?: string
          status?: string
          token_secret_name?: string | null
          updated_at?: string
        }
        Update: {
          account_username?: string | null
          campaign_id?: string
          connected_at?: string | null
          created_at?: string
          expires_at?: string | null
          external_account_id?: string | null
          id?: string
          provider?: string
          status?: string
          token_secret_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_connections_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_results: {
        Row: {
          analysis_id: string
          campaign_id: string
          comment_text: string | null
          created_at: string
          id: string
          instagram_username: string
          interacted_at: string | null
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          leader_id: string
          network_member_id: string | null
          raw_external_id: string | null
        }
        Insert: {
          analysis_id: string
          campaign_id: string
          comment_text?: string | null
          created_at?: string
          id?: string
          instagram_username: string
          interacted_at?: string | null
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          leader_id: string
          network_member_id?: string | null
          raw_external_id?: string | null
        }
        Update: {
          analysis_id?: string
          campaign_id?: string
          comment_text?: string | null
          created_at?: string
          id?: string
          instagram_username?: string
          interacted_at?: string | null
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          leader_id?: string
          network_member_id?: string | null
          raw_external_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interaction_results_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_results_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_results_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_results_network_member_id_fkey"
            columns: ["network_member_id"]
            isOneToOne: false
            referencedRelation: "network_members"
            referencedColumns: ["id"]
          },
        ]
      }
      leaders: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          invite_email: string | null
          is_demo: boolean
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          invite_email?: string | null
          is_demo?: boolean
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          invite_email?: string | null
          is_demo?: boolean
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      network_members: {
        Row: {
          active: boolean
          campaign_id: string
          created_at: string
          display_name: string | null
          id: string
          instagram_username: string
          leader_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          campaign_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          instagram_username: string
          leader_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          campaign_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          instagram_username?: string
          leader_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_members_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          campaign_id: string
          caption: string | null
          comments_count: number | null
          created_at: string
          external_post_id: string | null
          id: string
          impressions: number | null
          likes_count: number | null
          published_at: string | null
          reach: number | null
          shares_count: number | null
          shortcode: string | null
          updated_at: string
          url: string
        }
        Insert: {
          campaign_id: string
          caption?: string | null
          comments_count?: number | null
          created_at?: string
          external_post_id?: string | null
          id?: string
          impressions?: number | null
          likes_count?: number | null
          published_at?: string | null
          reach?: number | null
          shares_count?: number | null
          shortcode?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          campaign_id?: string
          caption?: string | null
          comments_count?: number | null
          created_at?: string
          external_post_id?: string | null
          id?: string
          impressions?: number | null
          likes_count?: number | null
          published_at?: string | null
          reach?: number | null
          shares_count?: number | null
          shortcode?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          campaign_id: string | null
          created_at: string
          email: string | null
          id: string
          must_change_password: boolean
          name: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          must_change_password?: boolean
          name?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          must_change_password?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_campaign_for_current_user: {
        Args: {
          _candidate_name?: string
          _instagram_username?: string
          _is_demo?: boolean
          _name: string
        }
        Returns: string
      }
      ensure_profile: { Args: { _name?: string }; Returns: undefined }
    }
    Enums: {
      analysis_status: "pending" | "running" | "completed" | "failed"
      app_role: "superadmin" | "coordinator" | "leader"
      entity_status: "active" | "inactive"
      interaction_type: "comment" | "mention" | "like" | "share"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      analysis_status: ["pending", "running", "completed", "failed"],
      app_role: ["superadmin", "coordinator", "leader"],
      entity_status: ["active", "inactive"],
      interaction_type: ["comment", "mention", "like", "share"],
    },
  },
} as const
