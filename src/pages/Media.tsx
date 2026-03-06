import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, Image, Film, Trash2, Loader2 } from "lucide-react";

interface MediaItem {
  id: string;
  name: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export default function Media() {
  const { profile } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchMedia = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from("media")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });
    setItems((data as MediaItem[]) ?? []);
  };

  useEffect(() => { fetchMedia(); }, [profile?.organization_id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !profile?.organization_id) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const filePath = `${profile.organization_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("media").upload(filePath, file);
      if (uploadError) {
        toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
        continue;
      }
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(filePath);
      await supabase.from("media").insert({
        organization_id: profile.organization_id,
        name: file.name,
        file_path: filePath,
        file_url: urlData.publicUrl,
        mime_type: file.type,
        file_size: file.size,
        created_by: profile.id,
      });
    }
    setUploading(false);
    fetchMedia();
    toast({ title: "Upload concluído!" });
  };

  const handleDelete = async (item: MediaItem) => {
    await supabase.storage.from("media").remove([`${profile?.organization_id}/${item.name}`]);
    await supabase.from("media").delete().eq("id", item.id);
    fetchMedia();
  };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const isImage = (mime: string | null) => mime?.startsWith("image/");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Biblioteca de Mídia</h1>
          <p className="text-muted-foreground">Gerencie imagens e vídeos para suas telas</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleUpload} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Image className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhuma mídia encontrada</p>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => (
            <Card key={item.id} className="group overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                {isImage(item.mime_type) ? (
                  <img src={item.file_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <Film className="h-10 w-10 text-muted-foreground/50" />
                )}
              </div>
              <CardContent className="p-3">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(1)} MB` : "—"}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleDelete(item)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
