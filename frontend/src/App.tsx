import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Layout
import Layout from './components/layout/Layout';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Tax = lazy(() => import('./pages/Tax'));
const Advisor = lazy(() => import('./pages/Advisor'));
const Settings = lazy(() => import('./pages/Settings'));
const Goals = lazy(() => import('./pages/Goals'));
const Budgets = lazy(() => import('./pages/Budgets'));
const Reports     = lazy(() => import('./pages/Reports'));
const ChicagoHub  = lazy(() => import('./pages/ChicagoHub'));

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-xl text-dark-400 mb-8">Page not found</p>
        <a href="/" className="px-6 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors inline-block">
          Go Home
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="tax" element={<Tax />} />
          <Route path="advisor" element={<Advisor />} />
          <Route path="settings" element={<Settings />} />
          <Route path="goals" element={<Goals />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="reports" element={<Reports />} />
          <Route path="chicago" element={<ChicagoHub />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
