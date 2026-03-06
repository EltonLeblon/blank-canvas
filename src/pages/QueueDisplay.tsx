import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Ticket {
  id: string;
  ticket_number: number;
  person_name: string;
  status: string;
  called_at: string | null;
}

export default function QueueDisplay() {
  const [searchParams] = useSearchParams();
  const screenCode = searchParams.get("screen");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Find org from screen code
  useEffect(() => {
    if (!screenCode) return;
    const fetchOrg = async () => {
      const { data } = await supabase
        .from("screens")
        .select("organization_id")
        .eq("activation_code", screenCode)
        .maybeSingle();
      if (data) setOrgId(data.organization_id);
    };
    fetchOrg();
  }, [screenCode]);

  const fetchTickets = useCallback(async () => {
    if (!orgId) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("queue_tickets")
      .select("*")
      .eq("organization_id", orgId)
      .gte("created_at", today)
      .in("status", ["waiting", "called"])
      .order("ticket_number", { ascending: true });
    if (data) setTickets(data as Ticket[]);
  }, [orgId]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("queue-display")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tickets" }, () => {
        fetchTickets();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTickets]);

  const called = tickets.filter((t) => t.status === "called");
  const waiting = tickets.filter((t) => t.status === "waiting");
  const currentTicket = called.length > 0 ? called[called.length - 1] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(220,25%,10%)] to-[hsl(250,30%,15%)] text-white flex flex-col">
      {/* Header */}
      <div className="text-center py-6 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-wide opacity-60">PAINEL DE SENHAS</h1>
      </div>

      <div className="flex-1 flex">
        {/* Current ticket - left side */}
        <div className="flex-1 flex items-center justify-center">
          {currentTicket ? (
            <div className="text-center animate-pulse">
              <p className="text-2xl opacity-60 mb-2">SENHA ATUAL</p>
              <p className="text-[12rem] font-bold font-mono leading-none text-[hsl(250,75%,65%)]">
                {String(currentTicket.ticket_number).padStart(3, "0")}
              </p>
              <p className="text-4xl font-medium mt-4">{currentTicket.person_name}</p>
            </div>
          ) : (
            <div className="text-center opacity-40">
              <p className="text-4xl">Nenhuma senha chamada</p>
            </div>
          )}
        </div>

        {/* Waiting list - right side */}
        <div className="w-80 border-l border-white/10 p-6 overflow-y-auto">
          <h2 className="text-lg font-bold mb-4 opacity-60">PRÓXIMOS ({waiting.length})</h2>
          <div className="space-y-3">
            {waiting.slice(0, 15).map((ticket, i) => (
              <div
                key={ticket.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  i === 0 ? "bg-white/10" : "bg-white/5"
                }`}
              >
                <span className="text-2xl font-bold font-mono">
                  {String(ticket.ticket_number).padStart(3, "0")}
                </span>
                <span className="text-sm opacity-80 truncate">{ticket.person_name}</span>
              </div>
            ))}
            {waiting.length === 0 && (
              <p className="text-sm opacity-40 text-center">Nenhuma senha aguardando</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
