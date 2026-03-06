import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/AdminLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Screens from "@/pages/Screens";
import Media from "@/pages/Media";
import Content from "@/pages/Content";
import Playlists from "@/pages/Playlists";
import Schedules from "@/pages/Schedules";
import Player from "@/pages/Player";
import Queue from "@/pages/Queue";
import QueueDisplay from "@/pages/QueueDisplay";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/player" element={<Player />} />
            <Route path="/queue-display" element={<QueueDisplay />} />
            <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/screens" element={<Screens />} />
              <Route path="/media" element={<Media />} />
              <Route path="/content" element={<Content />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/queue" element={<Queue />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
