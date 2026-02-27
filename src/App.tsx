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
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CalendarPage from "./pages/CalendarPage";
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

const queryClient = new QueryClient();

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { settings, loading: settingsLoading } = useAppSettings();
  const { user } = useAuth();
  const { isSuperAdmin, role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  // Allow auth routes always
  if (location.pathname.startsWith('/auth')) return <>{children}</>;

  // Wait for data
  if (settingsLoading || (user && roleLoading)) return <>{children}</>;

  // Redirect non-admins to maintenance page (allow super_admin and admin)
  const isAdmin = isSuperAdmin || role === 'admin';
  if (settings.maintenance_mode && !isAdmin && location.pathname !== '/maintenance') {
    return <Navigate to="/maintenance" replace />;
  }

  // If maintenance is off, redirect away from maintenance page
  if (!settings.maintenance_mode && location.pathname === '/maintenance') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="icmpp-theme">
      <AuthProvider>
        <SidebarProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <MaintenanceGuard>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/leave-calendar" element={<LeaveCalendar />} />
                <Route path="/my-profile" element={<MyProfile />} />
                <Route path="/hr-management" element={<HRManagement />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/leave-request" element={<LeaveRequest />} />
                <Route path="/formulare" element={<FormTemplates />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/library" element={<Library />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MaintenanceGuard>
          </BrowserRouter>
        </TooltipProvider>
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
