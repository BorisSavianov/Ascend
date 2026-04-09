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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_insights_cache: {
        Row: {
          context_hash: string
          created_at: string
          id: string
          model: string
          question: string
          response: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          context_hash: string
          created_at?: string
          id?: string
          model: string
          question: string
          response: string
          tokens_used?: number | null
          user_id?: string
        }
        Update: {
          context_hash?: string
          created_at?: string
          id?: string
          model?: string
          question?: string
          response?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      body_metrics: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          id: string
          notes: string | null
          recorded_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          recorded_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          recorded_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          calories_burned: number | null
          category: string | null
          created_at: string
          duration_min: number | null
          id: string
          logged_at: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          calories_burned?: number | null
          category?: string | null
          created_at?: string
          duration_min?: number | null
          id?: string
          logged_at?: string
          name: string
          notes?: string | null
          user_id?: string
        }
        Update: {
          calories_burned?: number | null
          category?: string | null
          created_at?: string
          duration_min?: number | null
          id?: string
          logged_at?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fasting_logs: {
        Row: {
          actual_hours: number | null
          completed: boolean | null
          created_at: string
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string
          target_hours: number
          user_id: string
        }
        Insert: {
          actual_hours?: number | null
          completed?: boolean | null
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at: string
          target_hours?: number
          user_id?: string
        }
        Update: {
          actual_hours?: number | null
          completed?: boolean | null
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          target_hours?: number
          user_id?: string
        }
        Relationships: []
      }
      foods: {
        Row: {
          barcode: string | null
          brand: string | null
          calories_per_100g: number
          carbs_per_100g: number
          created_at: string
          fat_per_100g: number
          fiber_per_100g: number
          id: string
          is_custom: boolean
          name: string
          name_local: string | null
          notes: string | null
          protein_per_100g: number
          search_vector: unknown
          sodium_per_100g: number | null
          sugar_per_100g: number | null
          updated_at: string
          use_count: number
          user_id: string
          source: string | null
          external_id: string | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calories_per_100g: number
          carbs_per_100g?: number
          created_at?: string
          fat_per_100g?: number
          fiber_per_100g?: number
          id?: string
          is_custom?: boolean
          name: string
          name_local?: string | null
          notes?: string | null
          protein_per_100g?: number
          search_vector?: unknown
          sodium_per_100g?: number | null
          sugar_per_100g?: number | null
          updated_at?: string
          use_count?: number
          user_id?: string
          source?: string | null
          external_id?: string | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calories_per_100g?: number
          carbs_per_100g?: number
          created_at?: string
          fat_per_100g?: number
          fiber_per_100g?: number
          id?: string
          is_custom?: boolean
          name?: string
          name_local?: string | null
          notes?: string | null
          protein_per_100g?: number
          search_vector?: unknown
          sodium_per_100g?: number | null
          sugar_per_100g?: number | null
          updated_at?: string
          use_count?: number
          user_id?: string
          source?: string | null
          external_id?: string | null
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          amount_g: number | null
          calories: number
          carbs_g: number
          created_at: string
          fat_g: number
          fiber_g: number
          food_id: string | null
          food_name: string
          food_name_local: string | null
          id: string
          meal_id: string
          portion_desc: string | null
          protein_g: number
        }
        Insert: {
          amount_g?: number | null
          calories: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          food_id?: string | null
          food_name: string
          food_name_local?: string | null
          id?: string
          meal_id: string
          portion_desc?: string | null
          protein_g?: number
        }
        Update: {
          amount_g?: number | null
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          food_id?: string | null
          food_name?: string
          food_name_local?: string | null
          id?: string
          meal_id?: string
          portion_desc?: string | null
          protein_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          sort_order: number
          meal_label: string | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          sort_order?: number
          meal_label?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          sort_order?: number
          meal_label?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      daily_summaries: {
        Row: {
          calorie_density: number | null
          exercise_calories_burned: number | null
          first_meal_at: string | null
          last_meal_at: string | null
          log_date: string | null
          meal_count: number | null
          net_calories: number | null
          total_calories: number | null
          total_carbs_g: number | null
          total_fat_g: number | null
          total_fiber_g: number | null
          total_protein_g: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assemble_ai_context: {
        Args: { p_user_id: string; p_window_days?: number }
        Returns: Json
      }
      increment_food_use_count: {
        Args: { p_food_id: string }
        Returns: undefined
      }
      seed_personal_foods: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

// ─── Convenience row type aliases ─────────────────────────────────────────────

export type FoodRow = Tables<'foods'>;
export type MealRow = Tables<'meals'>;
export type MealItemRow = Tables<'meal_items'>;
export type DailySummaryRow = Tables<'daily_summaries'>;
export type FastingLog = Tables<'fasting_logs'>;
export type BodyMetricRow = Tables<'body_metrics'>;
export type ExerciseRow = Tables<'exercises'>;
