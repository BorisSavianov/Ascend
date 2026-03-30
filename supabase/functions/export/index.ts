// supabase/functions/export/index.ts
import { createClient } from "npm:@supabase/supabase-js";

function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (error || !user) return new Response("Unauthorized", { status: 401 });

  let body: { format?: unknown; days?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const format: "markdown" | "csv" = body.format ?? "markdown";
  const days: number = typeof body.days === "number" && body.days > 0 && body.days <= 3650
    ? Math.floor(body.days)
    : 30;

  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [mealsRes, metricsRes] = await Promise.all([
    supabase
      .from("meals")
      .select("*, meal_items(*)")
      .eq("user_id", user.id)
      .gte("logged_at", since)
      .order("logged_at", { ascending: false }),
    supabase
      .from("body_metrics")
      .select("*")
      .eq("user_id", user.id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false }),
  ]);

  if (mealsRes.error) return new Response(`DB error: ${mealsRes.error.message}`, { status: 500 });
  if (metricsRes.error) return new Response(`DB error: ${metricsRes.error.message}`, { status: 500 });

  if (format === "csv") {
    const rows = ["date,meal,food,amount_g,portion,calories,protein_g,fat_g,carbs_g,fiber_g"];
    for (const meal of mealsRes.data ?? []) {
      for (const item of meal.meal_items ?? []) {
        rows.push([
          csvField(meal.logged_at.split("T")[0]),
          csvField(`Meal ${meal.meal_index}`),
          csvField(item.food_name),
          csvField(item.amount_g ?? ""),
          csvField(item.portion_desc ?? ""),
          csvField(item.calories),
          csvField(item.protein_g),
          csvField(item.fat_g),
          csvField(item.carbs_g),
          csvField(item.fiber_g),
        ].join(","));
      }
    }
    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nutrition-export.csv"`,
      },
    });
  }

  // Markdown format
  const lines: string[] = [
    "# Nutrition Log Export",
    `Generated: ${new Date().toISOString().split("T")[0]}`,
    `Period: last ${days} days`,
    "",
  ];

  const byDate = new Map<string, typeof mealsRes.data>();
  for (const meal of mealsRes.data ?? []) {
    const date = meal.logged_at.split("T")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(meal);
  }

  for (const [date, meals] of [...byDate.entries()].sort().reverse()) {
    lines.push(`## ${date}`);
    for (const meal of meals) {
      const time = meal.logged_at.split("T")[1].slice(0, 5);
      const mealCal = meal.meal_items?.reduce((s: number, i: { calories: number }) => s + i.calories, 0) ?? 0;
      lines.push(`### Meal ${meal.meal_index} · ${time} · ${Math.round(mealCal)} kcal`);
      for (const item of meal.meal_items ?? []) {
        const qty = item.amount_g ? `${item.amount_g}g` : item.portion_desc;
        lines.push(`- ${item.food_name} (${qty}) — ${Math.round(item.calories)} kcal`);
      }
      if (meal.notes) lines.push(`> ${meal.notes}`);
      lines.push("");
    }
  }

  if ((metricsRes.data ?? []).length > 0) {
    lines.push("## Body Metrics", "");
    lines.push("| Date | Weight (kg) | Body Fat (%) |");
    lines.push("|------|-------------|--------------|");
    for (const m of metricsRes.data ?? []) {
      lines.push(`| ${m.recorded_at.split("T")[0]} | ${m.weight_kg ?? "—"} | ${m.body_fat_pct ?? "—"} |`);
    }
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="nutrition-export.md"`,
    },
  });
});