import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Workers from "./pages/Workers";
import Customers from "./pages/Customers";
import Cases from "./pages/Cases";
import CaseDetail from "./pages/CaseDetail";
import WorkerDetail from "./pages/WorkerDetail";
import CustomerDetail from "./pages/CustomerDetail";
import Settings from "./pages/Settings";
import BrandPreview from "./pages/BrandPreview";
import { RequireStaff } from "./components/RequireStaff";
import PublicHome from "./pages/public/Home";
import Login from "./pages/public/Login";
import "./i18n";

/** 內部後台（既有頁面）。掛在 /admin 之下，路徑維持相對。 */
function AdminApp() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/workers" component={Workers} />
        <Route path="/customers" component={Customers} />
        <Route path="/cases" component={Cases} />
        <Route path="/cases/:id" component={CaseDetail} />
        <Route path="/workers/:id" component={WorkerDetail} />
        <Route path="/customers/:id" component={CustomerDetail} />
        <Route path="/settings" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* 品牌預覽頁：不需登入 */}
      <Route path="/brand-preview" component={BrandPreview} />
      {/* 內部後台：/admin（需 staff/admin）；nest 讓內部路由維持相對路徑，
          既有 navigate("/workers") 等自動變成 /admin/workers，無需逐一改寫 */}
      <Route path="/admin" nest>
        <RequireStaff>
          <AdminApp />
        </RequireStaff>
      </Route>
      {/* 公開站 */}
      <Route path="/login" component={Login} />
      <Route path="/" component={PublicHome} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
