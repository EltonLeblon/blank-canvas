import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SlideData {
  id: string;
  type: string;
  duration: number;
  media_url?: string;
  text_content?: any;
  html_content?: string;
}

interface QueueTicket {
  ticket_number: number;
  person_name: string;
  status: string;
}

export default function Player() {
  const [searchParams] = useSearchParams();
  const screenId = searchParams.get("screen");
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<QueueTicket | null>(null);
  const [screenOrgId, setScreenOrgId] = useState<string | null>(null);

  const fetchPlaylist = useCallback(async () => {
    if (!screenId) return;

    // Try by activation_code first, then by UUID
    let screen: { playlist_id: string | null; organization_id: string } | null = null;
    const { data: byCode } = await supabase
      .from("screens")
      .select("playlist_id, organization_id")
      .eq("activation_code", screenId)
      .maybeSingle();

    if (byCode) {
      screen = byCode;
    } else {
      const { data: byId } = await supabase
        .from("screens")
        .select("playlist_id, organization_id")
        .eq("id", screenId)
        .maybeSingle();
      screen = byId;
    }

    if (screen) setScreenOrgId(screen.organization_id);

    if (!screen?.playlist_id) return;

    const { data: items } = await supabase
      .from("playlist_items")
      .select("*, content_items(*, media(file_url))")
      .eq("playlist_id", screen.playlist_id)
      .order("sort_order");

    if (!items) return;

    const mapped: SlideData[] = items.map((item: any) => ({
      id: item.id,
      type: item.content_items.type,
      duration: item.duration_override ?? item.content_items.duration,
      media_url: item.content_items.media?.file_url,
      text_content: item.content_items.text_content,
      html_content: item.content_items.html_content,
    }));
    setSlides(mapped);
  }, [screenId]);

  useEffect(() => { fetchPlaylist(); }, [fetchPlaylist]);

  // Refresh playlist every 60s
  useEffect(() => {
    const interval = setInterval(fetchPlaylist, 60000);
    return () => clearInterval(interval);
  }, [fetchPlaylist]);

  // Queue ticket realtime
  const fetchCurrentTicket = useCallback(async () => {
    if (!screenOrgId) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("queue_tickets")
      .select("ticket_number, person_name, status")
      .eq("organization_id", screenOrgId)
      .eq("status", "called")
      .gte("created_at", today)
      .order("called_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setCurrentTicket(data as QueueTicket | null);
  }, [screenOrgId]);

  useEffect(() => { fetchCurrentTicket(); }, [fetchCurrentTicket]);

  useEffect(() => {
    if (!screenOrgId) return;
    const channel = supabase
      .channel("player-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tickets" }, () => {
        fetchCurrentTicket();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [screenOrgId, fetchCurrentTicket]);

  // Auto-advance slides
  useEffect(() => {
    if (slides.length === 0) return;
    const slide = slides[currentIndex];
    const timer = setTimeout(() => {
      setTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
        setTransitioning(false);
      }, 500);
    }, (slide?.duration ?? 10) * 1000);
    return () => clearTimeout(timer);
  }, [currentIndex, slides]);

  if (!screenId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold mb-2">SignageHub Player</h1>
          <p className="text-white/60">Use ?screen=ID na URL para iniciar</p>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-white/60">Carregando conteúdo...</p>
      </div>
    );
  }

  const slide = slides[currentIndex];

  return (
    <div className="min-h-screen w-full bg-black overflow-hidden relative">
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${transitioning ? "opacity-0" : "opacity-100"}`}
      >
        {slide.type === "image" && slide.media_url && (
          <img src={slide.media_url} alt="" className="w-full h-full object-contain" />
        )}
        {slide.type === "video" && slide.media_url && (
          <video src={slide.media_url} autoPlay muted className="w-full h-full object-contain" onEnded={() => {
            setCurrentIndex((prev) => (prev + 1) % slides.length);
          }} />
        )}
        {slide.type === "text" && slide.text_content && (
          <div className="text-center text-white p-12">
            <h1 className="text-6xl font-display font-bold mb-6">{slide.text_content.titulo || slide.text_content.title || ""}</h1>
            {(slide.text_content.preco || slide.text_content.price) && (
              <p className="text-8xl font-bold text-accent">{slide.text_content.preco || slide.text_content.price}</p>
            )}
            {slide.text_content.descricao && (
              <p className="text-2xl mt-6 text-white/80">{slide.text_content.descricao}</p>
            )}
          </div>
        )}
        {slide.type === "html" && slide.html_content && (
          <iframe srcDoc={slide.html_content} className="w-full h-full border-0" sandbox="allow-scripts" />
        )}
      </div>

      {/* Queue ticket overlay */}
      {currentTicket && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 flex items-end justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-xl px-6 py-3 border border-white/20">
              <p className="text-white/60 text-xs uppercase tracking-wider">Senha</p>
              <p className="text-4xl font-bold font-mono text-white">
                {String(currentTicket.ticket_number).padStart(3, "0")}
              </p>
            </div>
            <p className="text-2xl text-white font-medium">{currentTicket.person_name}</p>
          </div>
        </div>
      )}
    </div>
  );
}
