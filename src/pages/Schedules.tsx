import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Trash2, Clock, Pencil } from "lucide-react";

interface Schedule {
  id: string;
  name: string;
  playlist_id: string;
  screen_id: string | null;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface Playlist { id: string; name: string; }
interface Screen { id: string; name: string; }

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Schedules() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [name, setName] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [screenId, setScreenId] = useState("");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("22:00");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { toast } = useToast();

  const fetchAll = async () => {
    if (!profile?.organization_id) return;
    const orgId = profile.organization_id;
    const [sched, pl, sc] = await Promise.all([
      supabase.from("schedules").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("playlists").select("id, name").eq("organization_id", orgId),
      supabase.from("screens").select("id, name").eq("organization_id", orgId),
    ]);
    setSchedules((sched.data as Schedule[]) ?? []);
    setPlaylists((pl.data as Playlist[]) ?? []);
    setScreens((sc.data as Screen[]) ?? []);
  };

  useEffect(() => { fetchAll(); }, [profile?.organization_id]);

  const toggleDay = (d: number) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const resetForm = () => {
    setName(""); setPlaylistId(""); setScreenId(""); setDays([0,1,2,3,4,5,6]); setStartTime("08:00"); setEndTime("22:00"); setStartDate(""); setEndDate("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !playlistId) return;
    const { error } = await supabase.from("schedules").insert({
      organization_id: profile.organization_id,
      name,
      playlist_id: playlistId,
      screen_id: screenId && screenId !== "all" ? screenId : null,
      days_of_week: days,
      start_time: startTime,
      end_time: endTime,
      start_date: startDate || null,
      end_date: endDate || null,
      created_by: profile.id,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Agendamento criado!" });
    setOpen(false);
    resetForm();
    fetchAll();
  };

  const openEdit = (s: Schedule) => {
    setEditSchedule(s);
    setName(s.name);
    setPlaylistId(s.playlist_id);
    setScreenId(s.screen_id ?? "all");
    setDays([...s.days_of_week]);
    setStartTime(s.start_time);
    setEndTime(s.end_time);
    setStartDate(s.start_date ?? "");
    setEndDate(s.end_date ?? "");
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSchedule || !playlistId) return;
    const { error } = await supabase.from("schedules").update({
      name,
      playlist_id: playlistId,
      screen_id: screenId && screenId !== "all" ? screenId : null,
      days_of_week: days,
      start_time: startTime,
      end_time: endTime,
      start_date: startDate || null,
      end_date: endDate || null,
    }).eq("id", editSchedule.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Agendamento atualizado!" });
    setEditOpen(false);
    resetForm();
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("schedules").delete().eq("id", id);
    fetchAll();
  };

  const ScheduleForm = ({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent) => void; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Promoção manhã" /></div>
      <div className="space-y-2">
        <Label>Playlist</Label>
        <Select value={playlistId} onValueChange={setPlaylistId}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>{playlists.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Tela (opcional)</Label>
        <Select value={screenId} onValueChange={setScreenId}>
          <SelectTrigger><SelectValue placeholder="Todas as telas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {screens.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Dias da semana</Label>
        <div className="flex gap-2 flex-wrap">
          {dayNames.map((d, i) => (
            <Button key={i} type="button" size="sm" variant={days.includes(i) ? "default" : "outline"} onClick={() => toggleDay(i)} className="w-11 h-9">
              {d}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Início</Label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
        <div className="space-y-2"><Label>Fim</Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Data início (opcional)</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div className="space-y-2"><Label>Data fim (opcional)</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>
      <Button type="submit" className="w-full">{submitLabel}</Button>
    </form>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Agendamento</h1>
          <p className="text-muted-foreground">Programe a exibição de playlists por horário e dia</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Agendamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Criar Agendamento</DialogTitle></DialogHeader>
            <ScheduleForm onSubmit={handleCreate} submitLabel="Criar Agendamento" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Agendamento</DialogTitle></DialogHeader>
          <ScheduleForm onSubmit={handleEdit} submitLabel="Salvar" />
        </DialogContent>
      </Dialog>

      {schedules.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhum agendamento criado</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {schedules.map(s => (
            <Card key={s.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Ativo" : "Inativo"}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{s.start_time} — {s.end_time}</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {s.days_of_week.map(d => (
                    <Badge key={d} variant="outline" className="text-xs">{dayNames[d]}</Badge>
                  ))}
                </div>
                {(s.start_date || s.end_date) && (
                  <p className="text-xs text-muted-foreground">{s.start_date ?? "..."} → {s.end_date ?? "..."}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}