import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAppSettings } from "@/hooks/useAppSettings";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import Index from "./pages/Index";
import Auth from "./pages/Auth";

import Settings from "./pages/Settings";
import MyProfile from "./pages/MyProfile";
import HRManagement from "./pages/HRManagement";
import Admin from "./pages/Admin";
import LeaveCalendar from "./pages/LeaveCalendar";
import LeaveRequest from "./pages/LeaveRequest";
import ResetPassword from "./pages/ResetPassword";
import FormTemplates from "./pages/FormTemplates";
import NotFound from "./pages/NotFound";
import Library from "./pages/Library";
import Maintenance from "./pages/Maintenance";
import PlatformGuide from "./pages/PlatformGuide";
import Salarizare from "./pages/Salarizare";
import Announcements from "./pages/Announcements";
import SystemStatus from "./pages/SystemStatus";
import MyTeam from "./pages/MyTeam";
import RoomBookings from "./pages/RoomBookings";
import RecreationalActivities from "./pages/RecreationalActivities";
import Chat from "./pages/Chat";
import MedicinaMuncii from "./pages/MedicinaMuncii";
import InstallApp from "./pages/InstallApp";
import Kiosk from "./pages/Kiosk";
import Archive from "./pages/Archive";
import PublicProfile from "./pages/PublicProfile";
import BusinessCards from "./pages/BusinessCards";
import Changelog from "./pages/Changelog";

const queryClient = new QueryClient();

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { settings, loading: settingsLoading } = useAppSettings();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  // Allow auth and kiosk routes always
  if (location.pathname.startsWith('/auth') || location.pathname === '/kiosk' || location.pathname.startsWith('/profil/')) return <>{children}</>;

  // Wait for settings to load before making any maintenance decision
  if (settingsLoading) return <>{children}</>;

  // If maintenance is off, redirect away from maintenance page and proceed normally
  if (!settings.maintenance_mode) {
    if (location.pathname === '/maintenance') {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  // Maintenance IS on from here
  // Wait for auth AND role to fully load before deciding — prevents
  // incorrectly redirecting super_admin to /maintenance
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Se verifică accesul...</p>
        </div>
      </div>
    );
  }

  // Auth + role loaded — check bypass
  const canBypassMaintenance = isSuperAdmin || role === 'admin' || role === 'hr' || role === 'sef_srus' || role === 'salarizare';
  
  if (canBypassMaintenance) {
    return <>{children}</>;
  }

  // Non-privileged user during maintenance → force maintenance page
  if (location.pathname !== '/maintenance') {
    return <Navigate to="/maintenance" replace />;
  }

  return <>{children}</>;
}

function GlobalChatNotifier() {
  useChatNotifications();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="icmpp-theme">
      <AuthProvider>
        <DemoModeProvider>
        <SidebarProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <GlobalChatNotifier />
          <BrowserRouter>
            <MaintenanceGuard>
              <Routes>
                <Route path="/kiosk" element={<Kiosk />} />
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
                
                <Route path="/leave-calendar" element={<LeaveCalendar />} />
                <Route path="/my-profile" element={<MyProfile />} />
                <Route path="/hr-management" element={<HRManagement />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/leave-request" element={<LeaveRequest />} />
                <Route path="/formulare" element={<FormTemplates />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/library" element={<Library />} />
                <Route path="/ghid" element={<PlatformGuide />} />
                <Route path="/salarizare" element={<Salarizare />} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/my-team" element={<MyTeam />} />
                <Route path="/room-bookings" element={<RoomBookings />} />
                <Route path="/activitati" element={<RecreationalActivities />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/medicina-muncii" element={<MedicinaMuncii />} />
                <Route path="/install" element={<InstallApp />} />
                <Route path="/arhiva" element={<Archive />} />
                <Route path="/system-status" element={<SystemStatus />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/profil/:id" element={<PublicProfile />} />
                <Route path="/carti-vizita" element={<BusinessCards />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MaintenanceGuard>
          </BrowserRouter>
        </TooltipProvider>
        </SidebarProvider>
        </DemoModeProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
