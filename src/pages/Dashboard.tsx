import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, ListVideo, Calendar, Image, CheckCircle, XCircle } from "lucide-react";

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ screens: 0, onlineScreens: 0, playlists: 0, schedules: 0, media: 0 });

  useEffect(() => {
    if (!profile?.organization_id) return;
    const orgId = profile.organization_id;

    Promise.all([
      supabase.from("screens").select("id, is_online", { count: "exact" }).eq("organization_id", orgId),
      supabase.from("playlists").select("id", { count: "exact" }).eq("organization_id", orgId),
      supabase.from("schedules").select("id", { count: "exact" }).eq("organization_id", orgId),
      supabase.from("media").select("id", { count: "exact" }).eq("organization_id", orgId),
    ]).then(([screensRes, playlistsRes, schedulesRes, mediaRes]) => {
      const onlineScreens = screensRes.data?.filter(s => s.is_online).length ?? 0;
      setStats({
        screens: screensRes.count ?? 0,
        onlineScreens,
        playlists: playlistsRes.count ?? 0,
        schedules: schedulesRes.count ?? 0,
        media: mediaRes.count ?? 0,
      });
    });
  }, [profile?.organization_id]);

  const cards = [
    { title: "Telas", value: stats.screens, sub: `${stats.onlineScreens} online`, icon: Monitor, color: "text-primary" },
    { title: "Playlists", value: stats.playlists, icon: ListVideo, color: "text-accent" },
    { title: "Agendamentos", value: stats.schedules, icon: Calendar, color: "text-warning" },
    { title: "Mídias", value: stats.media, icon: Image, color: "text-success" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu sistema de sinalização digital</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{card.value}</div>
              {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
