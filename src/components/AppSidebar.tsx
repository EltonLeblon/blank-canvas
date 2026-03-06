import {
  LayoutDashboard,
  Monitor,
  Image,
  Film,
  ListVideo,
  Calendar,
  LogOut,
  Tv,
  Ticket,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Telas", url: "/screens", icon: Monitor },
  { title: "Mídia", url: "/media", icon: Image },
  { title: "Conteúdo", url: "/content", icon: Film },
  { title: "Playlists", url: "/playlists", icon: ListVideo },
  { title: "Agendamento", url: "/schedules", icon: Calendar },
  { title: "Fila", url: "/queue", icon: Ticket },
];

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-6">
            <div className="flex items-center gap-2">
              <Tv className="h-6 w-6 text-sidebar-primary shrink-0" />
              {!collapsed && (
                <span className="text-lg font-display font-bold text-sidebar-foreground tracking-tight">
                  SignageHub
                </span>
              )}
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent/50 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Separator className="mb-3 bg-sidebar-border" />
        {!collapsed && (
          <div className="px-2 mb-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name ?? "Usuário"}
            </p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">{role ?? "..."}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="h-4 w-4 mr-2 shrink-0" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
