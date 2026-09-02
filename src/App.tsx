import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAppSettings } from "@/hooks/useAppSettings";
import MFAChallengeScreen from "@/components/auth/MFAChallengeScreen";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";
import { supabase } from "@/integrations/supabase/client";

import IrisButton from "@/components/iris/IrisButton";
import DbHealthOverlay from "@/components/system/DbHealthOverlay";
import ErrorBoundary from "@/components/system/ErrorBoundary";
import RouteFallback from "@/components/system/RouteFallback";

// Rute critice — încărcate imediat (primul ecran al utilizatorului)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Maintenance from "./pages/Maintenance";

// Restul rutelor — încărcate la cerere (code splitting)
const Settings = lazy(() => import("./pages/Settings"));
const MyProfile = lazy(() => import("./pages/MyProfile"));
const HRManagement = lazy(() => import("./pages/HRManagement"));
const Admin = lazy(() => import("./pages/Admin"));
const LeaveCalendar = lazy(() => import("./pages/LeaveCalendar"));
const LeaveRequest = lazy(() => import("./pages/LeaveRequest"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const FormTemplates = lazy(() => import("./pages/FormTemplates"));
const Library = lazy(() => import("./pages/Library"));
const PlatformGuide = lazy(() => import("./pages/PlatformGuide"));
const Salarizare = lazy(() => import("./pages/Salarizare"));
const Announcements = lazy(() => import("./pages/Announcements"));
const SystemStatus = lazy(() => import("./pages/SystemStatus"));
const MyTeam = lazy(() => import("./pages/MyTeam"));
const RoomBookings = lazy(() => import("./pages/RoomBookings"));
const RecreationalActivities = lazy(() => import("./pages/RecreationalActivities"));
const Chat = lazy(() => import("./pages/Chat"));
const MedicinaMuncii = lazy(() => import("./pages/MedicinaMuncii"));
const InstallApp = lazy(() => import("./pages/InstallApp"));
const Kiosk = lazy(() => import("./pages/Kiosk"));
const Archive = lazy(() => import("./pages/Archive"));
const MeetingsAgenda = lazy(() => import("./pages/MeetingsAgenda"));
const MeetingRemindersStatus = lazy(() => import("./pages/MeetingRemindersStatus"));
const SocialFeed = lazy(() => import("./pages/social/SocialFeed"));
const Communities = lazy(() => import("./pages/social/Communities"));
const CommunityDetail = lazy(() => import("./pages/social/CommunityDetail"));
const Birthdays = lazy(() => import("./pages/social/Birthdays"));
const Colleagues = lazy(() => import("./pages/social/Colleagues"));
const OrgChart = lazy(() => import("./pages/social/OrgChart"));
const SocialSettings = lazy(() => import("./pages/social/SocialSettings"));
const SavedPosts = lazy(() => import("./pages/social/SavedPosts"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const BusinessCards = lazy(() => import("./pages/BusinessCards"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Inventory = lazy(() => import("./pages/Inventory"));
const InventoryProfile = lazy(() => import("./pages/InventoryProfile"));
const InventoryPublicView = lazy(() => import("./pages/InventoryPublicView"));
const SecurityQuiz = lazy(() => import("./pages/SecurityQuiz"));
const Suggestions = lazy(() => import("./pages/Suggestions"));
const AccountSecurity = lazy(() => import("./pages/AccountSecurity"));
const ReportIncident = lazy(() => import("./pages/ReportIncident"));
const Privacy = lazy(() => import("./pages/Privacy"));
const PublicLegal = lazy(() => import("./pages/PublicLegal"));

const TRUSTED_TOKEN_KEY = 'icmpp_trusted_device_token';
const TRUSTED_SESSION_KEY = 'icmpp_trusted_session';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Datele rămân proaspete 2 minute → navigarea între pagini nu re-interoghează inutil
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});


function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { settings, loading: settingsLoading } = useAppSettings();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  // Always allow kiosk, public profile, and equipment routes
  if (location.pathname === '/kiosk' || location.pathname.startsWith('/profil/') || location.pathname.startsWith('/echipament/')) return <>{children}</>;

  // Always allow the maintenance page itself
  if (location.pathname === '/maintenance') return <>{children}</>;

  // Wait for settings to load before making any maintenance decision
  if (settingsLoading) return <>{children}</>;

  // If maintenance is off, redirect away from maintenance page and proceed normally
  if (!settings.maintenance_mode) {
    return <>{children}</>;
  }

  // Maintenance IS on from here

  // If user is NOT logged in → redirect to maintenance (including /auth)
  if (!authLoading && !user) {
    return <Navigate to="/maintenance" replace />;
  }

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
  const canBypassMaintenance = isSuperAdmin || role === 'hr' || role === 'sef_srus' || role === 'salarizare';
  
  if (canBypassMaintenance) {
    return <>{children}</>;
  }

  // Non-privileged user during maintenance → force maintenance page
  return <Navigate to="/maintenance" replace />;
}

function MFAGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [needsMFA, setNeedsMFA] = useState<boolean | null>(null);
  const [needsReenroll, setNeedsReenroll] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setNeedsMFA(false);
      setNeedsReenroll(false);
      return;
    }

    (async () => {
      // 1) force_mfa_reenroll flag (e.g. after recovery-code use)
      const { data: profile } = await supabase
        .from('profiles')
        .select('force_mfa_reenroll')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.force_mfa_reenroll) {
        setNeedsReenroll(true);
        setNeedsMFA(false);
        return;
      }

      // 2) Normal AAL check
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        // Trusted-device shortcut: validate the saved 30-day browser token before showing MFA.
        if (sessionStorage.getItem(TRUSTED_SESSION_KEY) === user.id) {
          setNeedsMFA(false);
          return;
        }

        const trustedToken = localStorage.getItem(TRUSTED_TOKEN_KEY);
        if (trustedToken) {
          try {
            const { data, error } = await supabase.functions.invoke('mfa-trusted-check', {
              body: { token: trustedToken },
            });
            if (cancelled) return;

            if (!error && data?.valid) {
              sessionStorage.setItem(TRUSTED_SESSION_KEY, user.id);
              setNeedsMFA(false);
              return;
            }

            if (data?.valid === false && ['not_found', 'mismatch', 'revoked', 'expired', 'force_reenroll'].includes(data.reason)) {
              localStorage.removeItem(TRUSTED_TOKEN_KEY);
            }
          } catch {
            // Network/function errors fall back to normal MFA challenge.
          }
        }

        setNeedsMFA(true);
      } else {
        setNeedsMFA(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Don't block public routes
  const publicPaths = ['/auth', '/auth/reset-password', '/kiosk', '/maintenance'];
  if (publicPaths.some(p => location.pathname.startsWith(p)) || location.pathname.startsWith('/profil/') || location.pathname.startsWith('/echipament/')) {
    return <>{children}</>;
  }

  if (loading || needsMFA === null) return null;

  if (needsReenroll && location.pathname !== '/settings') {
    return <Navigate to="/settings?reenroll=1" replace />;
  }

  if (needsMFA) {
    return <MFAChallengeScreen onVerified={() => setNeedsMFA(false)} />;
  }

  return <>{children}</>;
}


function GlobalChatNotifier() {
  useChatNotifications();
  return null;
}

/** Resetează bariera de eroare la fiecare schimbare de rută. */
function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>

    <ThemeProvider attribute="class" defaultTheme="light" storageKey="icmpp-theme">
      <AuthProvider>
        <ImpersonationProvider>
        <DemoModeProvider>
        <SidebarProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <GlobalChatNotifier />
          <ImpersonationBanner />
          <DbHealthOverlay />
          <BrowserRouter>
            <MFAGuard>
            <IrisButton />
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
                <Route path="/agenda-intalniri" element={<MeetingsAgenda />} />
                <Route path="/agenda-intalniri/reminder-status" element={<MeetingRemindersStatus />} />
                
                <Route path="/system-status" element={<SystemStatus />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/profil/:id" element={<PublicProfile />} />
                <Route path="/carti-vizita" element={<BusinessCards />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/inventory/:id" element={<InventoryProfile />} />
                <Route path="/echipament/:id" element={<InventoryPublicView />} />
                <Route path="/securitate-digitala" element={<SecurityQuiz />} />
                <Route path="/sugestii" element={<Suggestions />} />
                <Route path="/securitatea-mea" element={<AccountSecurity />} />
                <Route path="/raporteaza-incident" element={<ReportIncident />} />
                <Route path="/confidentialitate" element={<Privacy />} />
                <Route path="/legal/confidentialitate" element={<PublicLegal />} />
                <Route path="/legal/informare-autentificare" element={<PublicLegal />} />

                {/* INTRANET SOCIAL */}
                <Route path="/social" element={<SocialFeed />} />
                <Route path="/social/comunitati" element={<Communities />} />
                <Route path="/social/comunitati/:slug" element={<CommunityDetail />} />
                <Route path="/social/anunturi" element={<Announcements />} />
                <Route path="/social/aniversari" element={<Birthdays />} />
                <Route path="/social/colegi" element={<Colleagues />} />
                <Route path="/social/organigrama" element={<OrgChart />} />
                <Route path="/social/activitati" element={<RecreationalActivities />} />
                <Route path="/social/chat" element={<Chat />} />
                <Route path="/social/arhiva" element={<Archive />} />
                <Route path="/social/securitate" element={<SecurityQuiz />} />
                <Route path="/social/salvate" element={<SavedPosts />} />
                <Route path="/social/setari" element={<SocialSettings />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </MaintenanceGuard>
            </MFAGuard>
          </BrowserRouter>
        </TooltipProvider>
        </SidebarProvider>
        </DemoModeProvider>
        </ImpersonationProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
