import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, PhoneCall, SkipForward, RotateCcw, Trash2, Users } from "lucide-react";

interface Ticket {
  id: string;
  ticket_number: number;
  person_name: string;
  status: string;
  called_at: string | null;
  created_at: string;
}

export default function Queue() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [personName, setPersonName] = useState("");
  const [loading, setLoading] = useState(false);

  const orgId = profile?.organization_id;

  const fetchTickets = useCallback(async () => {
    if (!orgId) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("queue_tickets")
      .select("*")
      .eq("organization_id", orgId)
      .gte("created_at", today)
      .order("ticket_number", { ascending: true });
    if (data) setTickets(data as Ticket[]);
  }, [orgId]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Realtime subscription
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel("queue-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tickets" }, () => {
        fetchTickets();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, fetchTickets]);

  const addTicket = async () => {
    if (!personName.trim() || !orgId) return;
    setLoading(true);
    const nextNumber = tickets.length > 0
      ? Math.max(...tickets.map((t) => t.ticket_number)) + 1
      : 1;

    const { error } = await supabase.from("queue_tickets").insert({
      organization_id: orgId,
      ticket_number: nextNumber,
      person_name: personName.trim(),
      status: "waiting",
    });

    if (error) {
      toast.error("Erro ao adicionar na fila");
    } else {
      toast.success(`Senha ${String(nextNumber).padStart(3, "0")} gerada`);
      setPersonName("");
    }
    setLoading(false);
  };

  const callNext = async () => {
    const waiting = tickets.filter((t) => t.status === "waiting");
    if (waiting.length === 0) {
      toast.info("Nenhuma senha na fila");
      return;
    }
    const next = waiting[0];
    await supabase
      .from("queue_tickets")
      .update({ status: "called", called_at: new Date().toISOString() })
      .eq("id", next.id);
    toast.success(`Chamando senha ${String(next.ticket_number).padStart(3, "0")} - ${next.person_name}`);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("queue_tickets").update({ status }).eq("id", id);
  };

  const clearQueue = async () => {
    if (!orgId) return;
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("queue_tickets")
      .delete()
      .eq("organization_id", orgId)
      .gte("created_at", today);
    toast.success("Fila limpa");
  };

  const waiting = tickets.filter((t) => t.status === "waiting");
  const called = tickets.filter((t) => t.status === "called");
  const done = tickets.filter((t) => t.status === "done");

  const statusColor = (status: string) => {
    switch (status) {
      case "waiting": return "secondary";
      case "called": return "default";
      case "done": return "outline";
      default: return "destructive";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "waiting": return "Aguardando";
      case "called": return "Chamado";
      case "done": return "Atendido";
      case "skipped": return "Pulado";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Fila de Atendimento</h1>
          <p className="text-muted-foreground mt-1">Gerencie a fila de senhas</p>
        </div>
        <Button variant="destructive" size="sm" onClick={clearQueue}>
          <Trash2 className="h-4 w-4 mr-1" /> Limpar Fila
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-foreground">{waiting.length}</p>
            <p className="text-sm text-muted-foreground">Aguardando</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-primary">{called.length}</p>
            <p className="text-sm text-muted-foreground">Chamados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-accent">{done.length}</p>
            <p className="text-sm text-muted-foreground">Atendidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Add to queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" /> Adicionar à Fila
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Nome da pessoa"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTicket()}
              className="flex-1"
            />
            <Button onClick={addTicket} disabled={loading || !personName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Gerar Senha
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Call next */}
      <Button size="lg" className="w-full text-lg h-14" onClick={callNext} disabled={waiting.length === 0}>
        <PhoneCall className="h-5 w-5 mr-2" />
        Chamar Próximo {waiting.length > 0 && `(${String(waiting[0].ticket_number).padStart(3, "0")} - ${waiting[0].person_name})`}
      </Button>

      {/* Ticket list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Fila ({tickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma senha na fila hoje</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    ticket.status === "called" ? "bg-primary/5 border-primary/30" : "bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold font-mono text-foreground">
                      {String(ticket.ticket_number).padStart(3, "0")}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{ticket.person_name}</p>
                      <Badge variant={statusColor(ticket.status)} className="text-xs">
                        {statusLabel(ticket.status)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {ticket.status === "waiting" && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => updateStatus(ticket.id, "called")}
                          title="Chamar"
                        >
                          <PhoneCall className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(ticket.id, "skipped")}
                          title="Pular"
                        >
                          <SkipForward className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {ticket.status === "called" && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => updateStatus(ticket.id, "done")}
                          title="Marcar como atendido"
                          className="bg-accent hover:bg-accent/90"
                        >
                          Atendido
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(ticket.id, "waiting")}
                          title="Retornar à fila"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {(ticket.status === "done" || ticket.status === "skipped") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(ticket.id, "waiting")}
                        title="Retornar à fila"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
