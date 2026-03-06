import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Monitor, Wifi, WifiOff, Copy, Trash2, Pencil, ExternalLink } from "lucide-react";

interface Screen {
  id: string;
  name: string;
  location: string | null;
  resolution: string | null;
  activation_code: string | null;
  is_active: boolean;
  is_online: boolean;
  playlist_id: string | null;
}

interface Playlist {
  id: string;
  name: string;
}

export default function Screens() {
  const { profile, role } = useAuth();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editScreen, setEditScreen] = useState<Screen | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editPlaylistId, setEditPlaylistId] = useState("");
  const [editIsActive, setEditIsActive] = useState(false);
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const fetchData = async () => {
    if (!profile?.organization_id) return;
    const [screenRes, playlistRes] = await Promise.all([
      supabase.from("screens").select("*").eq("organization_id", profile.organization_id).order("created_at", { ascending: false }),
      supabase.from("playlists").select("id, name").eq("organization_id", profile.organization_id),
    ]);
    setScreens((screenRes.data as Screen[]) ?? []);
    setPlaylists((playlistRes.data as Playlist[]) ?? []);
  };

  useEffect(() => { fetchData(); }, [profile?.organization_id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;
    const { error } = await supabase.from("screens").insert({
      name,
      location: location || null,
      organization_id: profile.organization_id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tela criada!" });
      setName(""); setLocation(""); setOpen(false);
      fetchData();
    }
  };

  const openEdit = (screen: Screen) => {
    setEditScreen(screen);
    setEditName(screen.name);
    setEditLocation(screen.location ?? "");
    setEditPlaylistId(screen.playlist_id ?? "none");
    setEditIsActive(screen.is_active);
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editScreen) return;
    const { error } = await supabase.from("screens").update({
      name: editName,
      location: editLocation || null,
      playlist_id: editPlaylistId === "none" ? null : editPlaylistId,
      is_active: editIsActive,
    }).eq("id", editScreen.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tela atualizada!" });
      setEditOpen(false);
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("screens").delete().eq("id", id);
    fetchData();
  };

  const getPlayerUrl = (code: string) => {
    const base = window.location.origin;
    return `${base}/player?screen=${code}`;
  };

  const copyUrl = (code: string) => {
    navigator.clipboard.writeText(getPlayerUrl(code));
    toast({ title: "URL do Player copiada!" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Telas</h1>
          <p className="text-muted-foreground">Gerencie seus dispositivos de exibição</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Tela</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar Tela</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vitrine Principal" required />
                </div>
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: Loja Centro" />
                </div>
                <Button type="submit" className="w-full">Criar Tela</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Tela</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Localização</Label>
              <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Playlist</Label>
              <Select value={editPlaylistId} onValueChange={setEditPlaylistId}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {playlists.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Ativa</Label>
              <input type="checkbox" checked={editIsActive} onChange={e => setEditIsActive(e.target.checked)} className="h-4 w-4" />
            </div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {screens.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Monitor className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhuma tela cadastrada</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {screens.map((screen) => (
            <Card key={screen.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div>
                  <CardTitle className="text-base">{screen.name}</CardTitle>
                  {screen.location && <p className="text-sm text-muted-foreground">{screen.location}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={screen.is_active ? "default" : "secondary"} className="text-xs">
                    {screen.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Badge variant={screen.is_online ? "default" : "secondary"} className="flex items-center gap-1">
                    {screen.is_online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {screen.is_online ? "Online" : "Offline"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Playlist</span>
                  <span className="text-xs">{playlists.find(p => p.id === screen.playlist_id)?.name ?? "Nenhuma"}</span>
                </div>
                {screen.activation_code && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">URL do Player:</p>
                    <div className="flex items-center gap-1 bg-muted rounded px-2 py-1.5">
                      <code className="text-xs font-mono truncate flex-1">/player?screen={screen.activation_code}</code>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyUrl(screen.activation_code!)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <a href={getPlayerUrl(screen.activation_code)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(screen)}>
                      <Pencil className="h-4 w-4 mr-2" />Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(screen.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}