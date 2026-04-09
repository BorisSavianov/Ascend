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
      exercise_templates: {
        Row: {
          created_at: string
          equipment: string
          id: string
          image_key: string | null
          muscle_group: string
          name: string
          target_reps_max: number
          target_reps_min: number
          target_sets: number
        }
        Insert: {
          created_at?: string
          equipment: string
          id?: string
          image_key?: string | null
          muscle_group: string
          name: string
          target_reps_max?: number
          target_reps_min?: number
          target_sets?: number
        }
        Update: {
          created_at?: string
          equipment?: string
          id?: string
          image_key?: string | null
          muscle_group?: string
          name?: string
          target_reps_max?: number
          target_reps_min?: number
          target_sets?: number
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
          external_id: string | null
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
          source: string | null
          sugar_per_100g: number | null
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calories_per_100g: number
          carbs_per_100g?: number
          created_at?: string
          external_id?: string | null
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
          source?: string | null
          sugar_per_100g?: number | null
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calories_per_100g?: number
          carbs_per_100g?: number
          created_at?: string
          external_id?: string | null
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
          source?: string | null
          sugar_per_100g?: number | null
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      logged_exercises: {
        Row: {
          exercise_template_id: string
          id: string
          session_id: string
          sort_order: number
        }
        Insert: {
          exercise_template_id: string
          id?: string
          session_id: string
          sort_order?: number
        }
        Update: {
          exercise_template_id?: string
          id?: string
          session_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "logged_exercises_exercise_template_id_fkey"
            columns: ["exercise_template_id"]
            isOneToOne: false
            referencedRelation: "exercise_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logged_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      logged_sets: {
        Row: {
          completed_at: string | null
          id: string
          is_completed: boolean
          logged_exercise_id: string
          notes: string | null
          reps: number | null
          rpe: number | null
          set_number: number
          weight_kg: number | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          logged_exercise_id: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          set_number: number
          weight_kg?: number | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          logged_exercise_id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          set_number?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logged_sets_logged_exercise_id_fkey"
            columns: ["logged_exercise_id"]
            isOneToOne: false
            referencedRelation: "logged_exercises"
            referencedColumns: ["id"]
          },
        ]
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
          meal_label: string | null
          notes: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          meal_label?: string | null
          notes?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          meal_label?: string | null
          notes?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_day_exercises: {
        Row: {
          exercise_template_id: string
          id: string
          sort_order: number
          target_reps_max: number | null
          target_reps_min: number | null
          target_sets: number | null
          workout_day_id: string
        }
        Insert: {
          exercise_template_id: string
          id?: string
          sort_order?: number
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_sets?: number | null
          workout_day_id: string
        }
        Update: {
          exercise_template_id?: string
          id?: string
          sort_order?: number
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_sets?: number | null
          workout_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_day_exercises_exercise_template_id_fkey"
            columns: ["exercise_template_id"]
            isOneToOne: false
            referencedRelation: "exercise_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_day_exercises_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_days: {
        Row: {
          day_of_week: number
          id: string
          is_rest_day: boolean
          name: string
          program_id: string
        }
        Insert: {
          day_of_week: number
          id?: string
          is_rest_day?: boolean
          name: string
          program_id: string
        }
        Update: {
          day_of_week?: number
          id?: string
          is_rest_day?: boolean
          name?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "workout_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_programs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          created_at: string
          date: string
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string
          user_id: string
          workout_day_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          user_id?: string
          workout_day_id: string
        }
        Update: {
          created_at?: string
          date?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          user_id?: string
          workout_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
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
      seed_workout_program: { Args: { p_user_id: string }; Returns: undefined }
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
  public: {
    Enums: {},
  },
} as const

export type FoodRow = Database['public']['Tables']['foods']['Row'];
export type MealRow = Database['public']['Tables']['meals']['Row'];
export type MealItemRow = Database['public']['Tables']['meal_items']['Row'];
export type DailySummaryRow = Database['public']['Views']['daily_summaries']['Row'];
export type ExerciseRow = Database['public']['Tables']['exercises']['Row'];
export type FastingLog = Database['public']['Tables']['fasting_logs']['Row'];
export type BodyMetricRow = Database['public']['Tables']['body_metrics']['Row'];
