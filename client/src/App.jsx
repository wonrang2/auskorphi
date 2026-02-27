import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Batches from './pages/Batches.jsx';
import Sales from './pages/Sales.jsx';
import Inventory from './pages/Inventory.jsx';
import Reports from './pages/Reports.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="batches" element={<Batches />} />
          <Route path="sales" element={<Sales />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
