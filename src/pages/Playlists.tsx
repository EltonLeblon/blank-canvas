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
import { Plus, ListVideo, Trash2, GripVertical, Pencil } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  is_loop: boolean;
  created_at: string;
}

interface ContentItem {
  id: string;
  name: string;
  type: string;
  duration: number;
}

interface PlaylistItem {
  id: string;
  content_item_id: string;
  sort_order: number;
  duration_override: number | null;
  content_items: ContentItem;
}

export default function Playlists() {
  const { profile } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editPlaylist, setEditPlaylist] = useState<Playlist | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedContentId, setSelectedContentId] = useState("");
  const { toast } = useToast();

  const fetchPlaylists = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase.from("playlists").select("*").eq("organization_id", profile.organization_id).order("created_at", { ascending: false });
    setPlaylists((data as Playlist[]) ?? []);
  };

  const fetchContent = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase.from("content_items").select("id, name, type, duration").eq("organization_id", profile.organization_id);
    setContentItems((data as ContentItem[]) ?? []);
  };

  const fetchPlaylistItems = async (playlistId: string) => {
    const { data } = await supabase.from("playlist_items").select("*, content_items(id, name, type, duration)").eq("playlist_id", playlistId).order("sort_order");
    setPlaylistItems((data as any) ?? []);
  };

  useEffect(() => { fetchPlaylists(); fetchContent(); }, [profile?.organization_id]);
  useEffect(() => { if (selectedPlaylist) fetchPlaylistItems(selectedPlaylist); }, [selectedPlaylist]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;
    const { error } = await supabase.from("playlists").insert({ organization_id: profile.organization_id, name, description: description || null, created_by: profile.id });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Playlist criada!" });
    setOpen(false); setName(""); setDescription("");
    fetchPlaylists();
  };

  const openEdit = (pl: Playlist, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditPlaylist(pl);
    setName(pl.name);
    setDescription(pl.description ?? "");
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPlaylist) return;
    const { error } = await supabase.from("playlists").update({ name, description: description || null }).eq("id", editPlaylist.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Playlist atualizada!" });
    setEditOpen(false); setName(""); setDescription("");
    fetchPlaylists();
  };

  const handleAddItem = async () => {
    if (!selectedPlaylist || !selectedContentId) return;
    const maxOrder = playlistItems.length > 0 ? Math.max(...playlistItems.map(i => i.sort_order)) + 1 : 0;
    await supabase.from("playlist_items").insert({ playlist_id: selectedPlaylist, content_item_id: selectedContentId, sort_order: maxOrder });
    setAddItemOpen(false); setSelectedContentId("");
    fetchPlaylistItems(selectedPlaylist);
  };

  const handleRemoveItem = async (id: string) => {
    await supabase.from("playlist_items").delete().eq("id", id);
    if (selectedPlaylist) fetchPlaylistItems(selectedPlaylist);
  };

  const handleDeletePlaylist = async (id: string) => {
    await supabase.from("playlists").delete().eq("id", id);
    if (selectedPlaylist === id) { setSelectedPlaylist(null); setPlaylistItems([]); }
    fetchPlaylists();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Playlists</h1>
          <p className="text-muted-foreground">Organize conteúdos em sequências de exibição</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Playlist</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Playlist</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
              <Button type="submit" className="w-full">Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { setName(""); setDescription(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Playlist</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-3">
          {playlists.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12">
              <ListVideo className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma playlist</p>
            </Card>
          ) : playlists.map(pl => (
            <Card
              key={pl.id}
              className={`cursor-pointer shadow-sm hover:shadow-md transition-all ${selectedPlaylist === pl.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedPlaylist(pl.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">{pl.name}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(pl, e)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); handleDeletePlaylist(pl.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              {pl.description && <CardContent className="pt-0 pb-3"><p className="text-sm text-muted-foreground">{pl.description}</p></CardContent>}
            </Card>
          ))}
        </div>

        {selectedPlaylist && (
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Itens da Playlist</CardTitle>
              <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar Conteúdo</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Select value={selectedContentId} onValueChange={setSelectedContentId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um conteúdo" /></SelectTrigger>
                      <SelectContent>
                        {contentItems.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={handleAddItem} disabled={!selectedContentId}>Adicionar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {playlistItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum item adicionado</p>
              ) : (
                <div className="space-y-2">
                  {playlistItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group">
                      <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                      <span className="text-xs font-medium text-muted-foreground w-6">{idx + 1}</span>
                      <span className="flex-1 text-sm font-medium">{item.content_items?.name}</span>
                      <Badge variant="outline" className="text-xs">{item.content_items?.type}</Badge>
                      <span className="text-xs text-muted-foreground">{item.duration_override ?? item.content_items?.duration}s</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleRemoveItem(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}