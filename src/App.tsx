import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Reservations from './pages/Reservations';
import CalendarPage from './pages/Calendar';
import Guests from './pages/Guests';
import FrontDesk from './pages/FrontDesk';
import Housekeeping from './pages/Housekeeping';
import Payments from './pages/Payments';
import StaffPage from './pages/Staff';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Accounting from './pages/Accounting';
import Invoices from './pages/Invoices';
import ActivityLogPage from './pages/ActivityLog';
import Maintenance from './pages/Maintenance';
import MenuManagement from './pages/MenuManagement';
import CafeOrders from './pages/CafeOrders';
import PublicOrder from './pages/PublicOrder';

function ProtectedApp() {
  const { isAuthenticated, ready } = useStore();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071614] text-teal-100">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-pulse rounded-2xl bg-teal-600/40" />
          <p className="text-sm">UYU ROOM yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Misafirin giris yapmadan acabilecegi siparis sayfasi — auth korumasi disinda */}
      <Route path="order/:reservationId" element={<PublicOrder />} />

      {!isAuthenticated ? (
        <Route path="*" element={<Login />} />
      ) : (
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="guests" element={<Guests />} />
          <Route path="front-desk" element={<FrontDesk />} />
          <Route path="housekeeping" element={<Housekeeping />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="payments" element={<Payments />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="accounting" element={<Accounting />} />
          <Route path="menu" element={<MenuManagement />} />
          <Route path="orders" element={<CafeOrders />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="activity" element={<ActivityLogPage />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="online" element={<Navigate to="/settings" replace />} />
          <Route path="sheets" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <ProtectedApp />
      </BrowserRouter>
    </StoreProvider>
  );
}
