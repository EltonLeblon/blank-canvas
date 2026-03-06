
-- Queue tickets table
CREATE TABLE public.queue_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  screen_id uuid REFERENCES public.screens(id) ON DELETE SET NULL,
  ticket_number integer NOT NULL,
  person_name text NOT NULL,
  status text NOT NULL DEFAULT 'waiting', -- waiting, called, done, skipped
  called_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.queue_tickets ENABLE ROW LEVEL SECURITY;

-- Anon can view tickets (for public display)
CREATE POLICY "Anon view queue tickets"
  ON public.queue_tickets FOR SELECT
  USING (true);

-- Org members can manage their queue
CREATE POLICY "Insert org queue tickets"
  ON public.queue_tickets FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Update org queue tickets"
  ON public.queue_tickets FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Delete org queue tickets"
  ON public.queue_tickets FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "View org queue tickets"
  ON public.queue_tickets FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

-- Enable realtime for queue updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_tickets;
