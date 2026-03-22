import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Cake, Briefcase, PartyPopper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CelebrationComments, { CelebrationCommentToggle } from "@/components/CelebrationComments";

interface Celebration {
  name: string;
  type: "birthday" | "anniversary";
  label: string;
  emoji: string;
  date: string;
  weekKey: string;
}

function getISOWeek(d: Date): string {
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getWeekRange(): { start: Date; end: Date; isoWeek: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday, isoWeek: getISOWeek(monday) };
}

function isDateInWeek(dateStr: string, weekStart: Date, weekEnd: Date): boolean {
  // Compare month-day only (ignoring year)
  const d = new Date(dateStr + "T00:00:00");
  const thisYear = weekStart.getFullYear();

  // Create a date this year with same month/day
  const thisYearDate = new Date(thisYear, d.getMonth(), d.getDate());

  return thisYearDate >= weekStart && thisYearDate <= weekEnd;
}

function formatBirthday(birthday: string): string {
  const d = new Date(birthday + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function getAnniversaryYears(startDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  // If the anniversary hasn't happened yet this year, subtract 1
  const thisYearAnniversary = new Date(now.getFullYear(), start.getMonth(), start.getDate());
  if (now < thisYearAnniversary) years--;
  return years;
}

export default function WeeklyCelebrations({ compact = false }: { compact?: boolean }) {
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const fetchCelebrations = useCallback(async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("full_name, birthday, start_date")
      .eq("is_hidden", false);

    if (!profiles) {
      setLoading(false);
      return;
    }

    const { start, end, isoWeek } = getWeekRange();
    const result: Celebration[] = [];

    for (const p of profiles as any[]) {
      if (!p.full_name) continue;

      // Check birthday
      if (p.birthday && isDateInWeek(p.birthday, start, end)) {
        result.push({
          name: p.full_name,
          type: "birthday",
          label: `Fyller år ${formatBirthday(p.birthday)}`,
          emoji: "🎂",
          date: p.birthday,
          weekKey: `birthday:${p.full_name}:${isoWeek}`,
        });
      }

      // Check work anniversary
      if (p.start_date && isDateInWeek(p.start_date, start, end)) {
        const years = getAnniversaryYears(p.start_date);
        if (years >= 1) {
          result.push({
            name: p.full_name,
            type: "anniversary",
            label: `${years} år på SHF`,
            emoji: years >= 10 ? "🏅" : years >= 5 ? "🎉" : "⭐",
            date: p.start_date,
            weekKey: `anniversary:${p.full_name}:${isoWeek}`,
          });
        }
      }
    }

    // Sort: birthdays first, then anniversaries
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === "birthday" ? -1 : 1;
      return a.name.localeCompare(b.name, "sv");
    });

    setCelebrations(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCelebrations();
  }, [fetchCelebrations]);

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="animate-pulse text-sm text-muted-foreground">Laddar jubilarer...</div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-1">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Cake className="w-5 h-5 text-accent" />
            Veckans jubilarer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {celebrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga jubilarer denna vecka</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-[40vh] overflow-y-auto scrollbar-hide">
              {celebrations.map((c, i) => (
                <div key={i} className="bg-accent/10 rounded-lg px-3 py-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{c.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground leading-tight">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground leading-tight">{c.label}</div>
                    </div>
                    <CelebrationCommentToggle
                      count={commentCounts[c.weekKey] || 0}
                      open={!!openComments[c.weekKey]}
                      onToggle={() => setOpenComments(prev => ({ ...prev, [c.weekKey]: !prev[c.weekKey] }))}
                    />
                  </div>
                  <CelebrationComments
                    weekKey={c.weekKey}
                    celebrationName={c.name}
                    celebrationEmoji={c.emoji}
                    open={!!openComments[c.weekKey]}
                    onOpenChange={(v) => setOpenComments(prev => ({ ...prev, [c.weekKey]: v }))}
                    onCountChange={(n) => setCommentCounts(prev => ({ ...prev, [c.weekKey]: n }))}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full Culture page version – wrapped in card like other sections
  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base flex items-center gap-2">
          <PartyPopper className="w-5 h-5 text-accent" />
          Veckans jubilarer
        </CardTitle>
      </CardHeader>
      <CardContent>
        {celebrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga jubilarer denna vecka 🎈</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto scrollbar-hide">
            {celebrations.map((c, i) => (
              <div
                key={i}
                className={`rounded-xl p-4 border-l-4 bg-accent/5 ${
                  c.type === "birthday"
                    ? "border-l-primary/60"
                    : "border-l-accent/60"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl shrink-0">{c.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      {c.type === "birthday" ? (
                        <Cake className="w-3 h-3 shrink-0" />
                      ) : (
                        <Briefcase className="w-3 h-3 shrink-0" />
                      )}
                      {c.label}
                    </div>
                  </div>
                  <CelebrationCommentToggle
                    count={commentCounts[c.weekKey] || 0}
                    open={!!openComments[c.weekKey]}
                    onToggle={() => setOpenComments(prev => ({ ...prev, [c.weekKey]: !prev[c.weekKey] }))}
                  />
                </div>
                <CelebrationComments
                  weekKey={c.weekKey}
                  celebrationName={c.name}
                  celebrationEmoji={c.emoji}
                  open={!!openComments[c.weekKey]}
                  onOpenChange={(v) => setOpenComments(prev => ({ ...prev, [c.weekKey]: v }))}
                  onCountChange={(n) => setCommentCounts(prev => ({ ...prev, [c.weekKey]: n }))}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
