import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Announcements from "./pages/Announcements";
import Employees from "./pages/Employees";
import Documents from "./pages/Documents";
import CalendarPage from "./pages/CalendarPage";
import Settings from "./pages/Settings";

import MyProfile from "./pages/MyProfile";
import HRManagement from "./pages/HRManagement";
import Admin from "./pages/Admin";
import IntranetUpdates from "./pages/IntranetUpdates";
import Suggestions from "./pages/Suggestions";

import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/calendar" element={<CalendarPage />} />
            
            <Route path="/my-profile" element={<MyProfile />} />
            <Route path="/hr-management" element={<HRManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/intranet-updates" element={<IntranetUpdates />} />
            <Route path="/suggestions" element={<Suggestions />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
