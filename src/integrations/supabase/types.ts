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
      ads_history: {
        Row: {
          id: string
          provider: string | null
          reward: number
          user_id: string
          watched_at: string
        }
        Insert: {
          id?: string
          provider?: string | null
          reward: number
          user_id: string
          watched_at?: string
        }
        Update: {
          id?: string
          provider?: string | null
          reward?: number
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          pinned: boolean
          title: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          pinned?: boolean
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          claimed_date: string
          created_at: string
          id: string
          reward: number
          streak_day: number
          user_id: string
        }
        Insert: {
          claimed_date?: string
          created_at?: string
          id?: string
          reward: number
          streak_day: number
          user_id: string
        }
        Update: {
          claimed_date?: string
          created_at?: string
          id?: string
          reward?: number
          streak_day?: number
          user_id?: string
        }
        Relationships: []
      }
      mining_claims: {
        Row: {
          amount: number
          created_at: string
          id: string
          package_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          package_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          package_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_claims_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "mining_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mining_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_packages: {
        Row: {
          active: boolean
          ads_required: number
          cooldown_seconds: number
          created_at: string
          daily_claim_limit: number
          hourly_reward: number
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          ads_required?: number
          cooldown_seconds?: number
          created_at?: string
          daily_claim_limit?: number
          hourly_reward: number
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          ads_required?: number
          cooldown_seconds?: number
          created_at?: string
          daily_claim_limit?: number
          hourly_reward?: number
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          banned: boolean
          created_at: string
          first_name: string | null
          id: string
          is_premium: boolean | null
          language_code: string | null
          last_checkin_date: string | null
          last_ip: string | null
          last_name: string | null
          last_open_bonus_at: string | null
          photo_url: string | null
          referred_by: string | null
          signup_ip: string | null
          streak_day: number
          suspend_reason: string | null
          suspended: boolean
          telegram_id: number
          today_date: string | null
          today_earned: number
          total_earned: number
          updated_at: string
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          balance?: number
          banned?: boolean
          created_at?: string
          first_name?: string | null
          id: string
          is_premium?: boolean | null
          language_code?: string | null
          last_checkin_date?: string | null
          last_ip?: string | null
          last_name?: string | null
          last_open_bonus_at?: string | null
          photo_url?: string | null
          referred_by?: string | null
          signup_ip?: string | null
          streak_day?: number
          suspend_reason?: string | null
          suspended?: boolean
          telegram_id: number
          today_date?: string | null
          today_earned?: number
          total_earned?: number
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          balance?: number
          banned?: boolean
          created_at?: string
          first_name?: string | null
          id?: string
          is_premium?: boolean | null
          language_code?: string | null
          last_checkin_date?: string | null
          last_ip?: string | null
          last_name?: string | null
          last_open_bonus_at?: string | null
          photo_url?: string | null
          referred_by?: string | null
          signup_ip?: string | null
          streak_day?: number
          suspend_reason?: string | null
          suspended?: boolean
          telegram_id?: number
          today_date?: string | null
          today_earned?: number
          total_earned?: number
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          bonus_amount: number
          bonus_paid: boolean
          commission_pending: number
          created_at: string
          day1_bonus: number
          day1_paid: boolean
          day2_bonus: number
          day2_paid: boolean
          id: string
          join_bonus: number
          join_paid: boolean
          lifetime_commission: number
          referred_id: string
          referred_joined_date: string
          referrer_id: string
        }
        Insert: {
          bonus_amount?: number
          bonus_paid?: boolean
          commission_pending?: number
          created_at?: string
          day1_bonus?: number
          day1_paid?: boolean
          day2_bonus?: number
          day2_paid?: boolean
          id?: string
          join_bonus?: number
          join_paid?: boolean
          lifetime_commission?: number
          referred_id: string
          referred_joined_date?: string
          referrer_id: string
        }
        Update: {
          bonus_amount?: number
          bonus_paid?: boolean
          commission_pending?: number
          created_at?: string
          day1_bonus?: number
          day1_paid?: boolean
          day2_bonus?: number
          day2_paid?: boolean
          id?: string
          join_bonus?: number
          join_paid?: boolean
          lifetime_commission?: number
          referred_id?: string
          referred_joined_date?: string
          referrer_id?: string
        }
        Relationships: []
      }
      reward_code_claims: {
        Row: {
          claimed_at: string
          code_id: string
          id: string
          reward: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          code_id: string
          id?: string
          reward?: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          code_id?: string
          id?: string
          reward?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_code_claims_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "reward_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_claims: number | null
          per_user_limit: number
          reward: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_claims?: number | null
          per_user_limit?: number
          reward?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_claims?: number | null
          per_user_limit?: number
          reward?: number
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          created_at: string
          id: string
          reward: number
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reward?: number
          status?: Database["public"]["Enums"]["task_status"]
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reward?: number
          status?: Database["public"]["Enums"]["task_status"]
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          priority: number | null
          reward: number
          target_chat: string | null
          target_url: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          verification_type: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          priority?: number | null
          reward: number
          target_chat?: string | null
          target_url?: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          verification_type?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          priority?: number | null
          reward?: number
          target_chat?: string | null
          target_url?: string | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          verification_type?: string | null
        }
        Relationships: []
      }
      user_mining: {
        Row: {
          ads_watched: number
          claims_date: string
          claims_today: number
          created_at: string
          id: string
          last_claim_at: string | null
          next_claim_at: string | null
          notified_ready: boolean
          package_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ads_watched?: number
          claims_date?: string
          claims_today?: number
          created_at?: string
          id?: string
          last_claim_at?: string | null
          next_claim_at?: string | null
          notified_ready?: boolean
          package_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ads_watched?: number
          claims_date?: string
          claims_today?: number
          created_at?: string
          id?: string
          last_claim_at?: string | null
          next_claim_at?: string | null
          notified_ready?: boolean
          package_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mining_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "mining_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mining_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount_flames: number
          amount_usdt: number
          created_at: string
          fee_usdt: number
          id: string
          net_usdt: number | null
          network: string
          status: Database["public"]["Enums"]["withdraw_status"]
          tx_hash: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          admin_note?: string | null
          amount_flames: number
          amount_usdt: number
          created_at?: string
          fee_usdt?: number
          id?: string
          net_usdt?: number | null
          network?: string
          status?: Database["public"]["Enums"]["withdraw_status"]
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          admin_note?: string | null
          amount_flames?: number
          amount_usdt?: number
          created_at?: string
          fee_usdt?: number
          id?: string
          net_usdt?: number | null
          network?: string
          status?: Database["public"]["Enums"]["withdraw_status"]
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      task_status: "pending" | "approved" | "rejected"
      task_type:
        | "telegram_join"
        | "telegram_group"
        | "bot_start"
        | "website"
        | "social_follow"
        | "youtube"
        | "quiz"
        | "survey"
        | "app_download"
      withdraw_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "moderator", "user"],
      task_status: ["pending", "approved", "rejected"],
      task_type: [
        "telegram_join",
        "telegram_group",
        "bot_start",
        "website",
        "social_follow",
        "youtube",
        "quiz",
        "survey",
        "app_download",
      ],
      withdraw_status: ["pending", "approved", "rejected"],
    },
  },
} as const
