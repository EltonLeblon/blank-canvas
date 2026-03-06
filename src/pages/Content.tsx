import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Film, Image, Type, Code, Trash2, Pencil } from "lucide-react";

interface ContentItem {
  id: string;
  name: string;
  type: string;
  duration: number;
  created_at: string;
  media_id: string | null;
  text_content: any;
  html_content: string | null;
}

interface MediaItem {
  id: string;
  name: string;
  file_url: string;
  mime_type: string | null;
}

const typeIcons: Record<string, any> = { image: Image, video: Film, text: Type, html: Code };
const typeLabels: Record<string, string> = { image: "Imagem", video: "Vídeo", text: "Texto", html: "HTML" };

export default function Content() {
  const { profile } = useAuth();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("image");
  const [mediaId, setMediaId] = useState("");
  const [textContent, setTextContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [duration, setDuration] = useState("10");
  const { toast } = useToast();

  const fetchItems = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase.from("content_items").select("*").eq("organization_id", profile.organization_id).order("created_at", { ascending: false });
    setItems((data as ContentItem[]) ?? []);
  };

  const fetchMedia = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase.from("media").select("id, name, file_url, mime_type").eq("organization_id", profile.organization_id);
    setMediaItems((data as MediaItem[]) ?? []);
  };

  useEffect(() => { fetchItems(); fetchMedia(); }, [profile?.organization_id]);

  const resetForm = () => {
    setName(""); setType("image"); setMediaId(""); setTextContent(""); setHtmlContent(""); setDuration("10");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;
    const { error } = await supabase.from("content_items").insert({
      organization_id: profile.organization_id,
      name,
      type,
      media_id: (type === "image" || type === "video") ? mediaId || null : null,
      text_content: type === "text" ? { text: textContent } : {},
      html_content: type === "html" ? htmlContent : null,
      duration: parseInt(duration),
      created_by: profile.id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conteúdo criado!" });
      setOpen(false);
      resetForm();
      fetchItems();
    }
  };

  const openEdit = (item: ContentItem) => {
    setEditItem(item);
    setName(item.name);
    setType(item.type);
    setMediaId(item.media_id ?? "");
    setTextContent(item.text_content?.text ?? (typeof item.text_content === "object" ? JSON.stringify(item.text_content) : ""));
    setHtmlContent(item.html_content ?? "");
    setDuration(String(item.duration));
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    const { error } = await supabase.from("content_items").update({
      name,
      type,
      media_id: (type === "image" || type === "video") ? mediaId || null : null,
      text_content: type === "text" ? { text: textContent } : {},
      html_content: type === "html" ? htmlContent : null,
      duration: parseInt(duration),
    }).eq("id", editItem.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conteúdo atualizado!" });
      setEditOpen(false);
      resetForm();
      fetchItems();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("content_items").delete().eq("id", id);
    fetchItems();
  };

  const ContentForm = ({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent) => void; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="video">Vídeo</SelectItem>
            <SelectItem value="text">Texto dinâmico</SelectItem>
            <SelectItem value="html">HTML / Web</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(type === "image" || type === "video") && (
        <div className="space-y-2">
          <Label>Mídia</Label>
          <Select value={mediaId} onValueChange={setMediaId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {mediaItems.filter(m => type === "image" ? m.mime_type?.startsWith("image/") : m.mime_type?.startsWith("video/")).map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {type === "text" && (
        <div className="space-y-2">
          <Label>Texto</Label>
          <Textarea value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="Texto para exibição" rows={4} />
        </div>
      )}
      {type === "html" && (
        <div className="space-y-2">
          <Label>HTML</Label>
          <Textarea value={htmlContent} onChange={e => setHtmlContent(e.target.value)} placeholder="<div>...</div>" rows={6} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Duração (segundos)</Label>
        <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="1" />
      </div>
      <Button type="submit" className="w-full">{submitLabel}</Button>
    </form>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Conteúdo</h1>
          <p className="text-muted-foreground">Crie e gerencie slides para suas playlists</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Conteúdo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Criar Conteúdo</DialogTitle></DialogHeader>
            <ContentForm onSubmit={handleCreate} submitLabel="Criar" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Conteúdo</DialogTitle></DialogHeader>
          <ContentForm onSubmit={handleEdit} submitLabel="Salvar" />
        </DialogContent>
      </Dialog>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Film className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhum conteúdo criado</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = typeIcons[item.type] || Film;
            return (
              <Card key={item.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base truncate">{item.name}</CardTitle>
                  <Badge variant="outline" className="shrink-0">
                    <Icon className="h-3 w-3 mr-1" />{typeLabels[item.type]}
                  </Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.duration}s</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}