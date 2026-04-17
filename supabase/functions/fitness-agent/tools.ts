// supabase/functions/fitness-agent/tools.ts
import { type SupabaseClient } from "npm:@supabase/supabase-js";

export const TOOL_DECLARATIONS = [
  {
    name: "get_nutrition",
    description: "Get daily nutrition totals for the last N days",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "get_workouts",
    description: "Get workout sessions with exercises and sets for the last N days",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "get_body_metrics",
    description: "Get weight and body fat readings for the last N days",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "get_fasting",
    description: "Get fasting log entries for the last N days",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "compute_trends",
    description: "Compare average calories, protein, weight, or total workout volume (kg lifted) between two date ranges",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: ["calories", "protein", "weight", "volume"],
          description: "The metric to compare",
        },
        period_a_from: { type: "string", description: "Period A start date YYYY-MM-DD" },
        period_a_to:   { type: "string", description: "Period A end date YYYY-MM-DD" },
        period_b_from: { type: "string", description: "Period B start date YYYY-MM-DD" },
        period_b_to:   { type: "string", description: "Period B end date YYYY-MM-DD" },
      },
      required: ["metric", "period_a_from", "period_a_to", "period_b_from", "period_b_to"],
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  userId: string,
): Promise<unknown> {
  switch (name) {
    case "get_nutrition": {
      const days = Math.min(Math.max(1, Number(args.days) || 14), 90);
      const since = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("daily_summaries")
        .select("log_date,total_calories,total_protein_g,total_fat_g,total_carbs_g,total_fiber_g,meal_count")
        .eq("user_id", userId)
        .gte("log_date", since)
        .order("log_date", { ascending: false });
      return data ?? [];
    }

    case "get_workouts": {
      const days = Math.min(Math.max(1, Number(args.days) || 14), 90);
      const since = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("workout_sessions")
        .select(`
          date, started_at, ended_at, notes,
          workout_presets ( name ),
          logged_exercises (
            exercise_templates ( name, muscle_group ),
            logged_sets ( set_number, weight_kg, reps, rpe, is_completed )
          )
        `)
        .eq("user_id", userId)
        .gte("date", since)
        .order("date", { ascending: false });
      return data ?? [];
    }

    case "get_body_metrics": {
      const days = Math.min(Math.max(1, Number(args.days) || 30), 90);
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data } = await supabase
        .from("body_metrics")
        .select("recorded_at,weight_kg,body_fat_pct,notes")
        .eq("user_id", userId)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(10);
      return data ?? [];
    }

    case "get_fasting": {
      const days = Math.min(Math.max(1, Number(args.days) || 14), 90);
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data } = await supabase
        .from("fasting_logs")
        .select("started_at,ended_at,target_hours,actual_hours,completed")
        .eq("user_id", userId)
        .gte("started_at", since)
        .order("started_at", { ascending: false });
      return data ?? [];
    }

    case "compute_trends": {
      const metric = String(args.metric);
      if (metric === "calories" || metric === "protein") {
        const col = metric === "calories" ? "total_calories" : "total_protein_g";
        const [resA, resB] = await Promise.all([
          supabase
            .from("daily_summaries")
            .select(col)
            .eq("user_id", userId)
            .gte("log_date", String(args.period_a_from))
            .lte("log_date", String(args.period_a_to)),
          supabase
            .from("daily_summaries")
            .select(col)
            .eq("user_id", userId)
            .gte("log_date", String(args.period_b_from))
            .lte("log_date", String(args.period_b_to)),
        ]);
        const avg = (rows: Record<string, number>[], c: string) =>
          rows.length
            ? Math.round(rows.reduce((s, r) => s + (r[c] ?? 0), 0) / rows.length)
            : null;
        return {
          metric,
          period_a: {
            from: args.period_a_from,
            to: args.period_a_to,
            avg: avg((resA.data ?? []) as Record<string, number>[], col),
          },
          period_b: {
            from: args.period_b_from,
            to: args.period_b_to,
            avg: avg((resB.data ?? []) as Record<string, number>[], col),
          },
        };
      }
      if (metric === "weight") {
        // body_metrics.recorded_at is TIMESTAMPTZ; a bare YYYY-MM-DD upper bound
        // compares as midnight, excluding entries logged later that day.
        // Use start-of-next-day as the exclusive upper bound instead.
        const nextDayISO = (dateStr: string) => {
          const d = new Date(dateStr + "T00:00:00Z");
          d.setUTCDate(d.getUTCDate() + 1);
          return d.toISOString();
        };
        const [resA, resB] = await Promise.all([
          supabase
            .from("body_metrics")
            .select("weight_kg")
            .eq("user_id", userId)
            .gte("recorded_at", String(args.period_a_from))
            .lt("recorded_at", nextDayISO(String(args.period_a_to))),
          supabase
            .from("body_metrics")
            .select("weight_kg")
            .eq("user_id", userId)
            .gte("recorded_at", String(args.period_b_from))
            .lt("recorded_at", nextDayISO(String(args.period_b_to))),
        ]);
        const avg = (rows: { weight_kg: number | null }[]) => {
          const valid = rows.filter((r) => r.weight_kg != null);
          return valid.length
            ? Math.round((valid.reduce((s, r) => s + r.weight_kg!, 0) / valid.length) * 10) / 10
            : null;
        };
        return {
          metric,
          period_a: { avg: avg(resA.data ?? []) },
          period_b: { avg: avg(resB.data ?? []) },
        };
      }
      if (metric === "volume") {
        // Total kg lifted = sum(weight_kg * reps) across completed sets per period
        const computeVolume = async (fromDate: string, toDate: string) => {
          const { data } = await supabase
            .from("workout_sessions")
            .select("logged_exercises(logged_sets(weight_kg, reps, is_completed))")
            .eq("user_id", userId)
            .gte("date", fromDate)
            .lte("date", toDate);
          let total = 0;
          let sessions = 0;
          for (const s of (data ?? []) as { logged_exercises: { logged_sets: { weight_kg: number | null; reps: number | null; is_completed: boolean }[] }[] }[]) {
            sessions++;
            for (const ex of s.logged_exercises ?? []) {
              for (const set of ex.logged_sets ?? []) {
                if (set.is_completed) total += (set.weight_kg ?? 0) * (set.reps ?? 0);
              }
            }
          }
          return { total_kg: Math.round(total), sessions };
        };
        const [a, b] = await Promise.all([
          computeVolume(String(args.period_a_from), String(args.period_a_to)),
          computeVolume(String(args.period_b_from), String(args.period_b_to)),
        ]);
        return {
          metric: "volume",
          period_a: { from: args.period_a_from, to: args.period_a_to, ...a },
          period_b: { from: args.period_b_from, to: args.period_b_to, ...b },
        };
      }
      return { error: `Unsupported metric: ${metric}` };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
