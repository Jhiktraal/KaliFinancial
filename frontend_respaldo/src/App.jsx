import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';

import Dashboard from './components/Dashboard';
import RegistroForm from './components/RegistroForm';
import ResumenMensual from './components/ResumenMensual';

import './styles.css';

export default function App() {
  return (
    <Router>
      <nav className="navbar">
        <div className="logo-container">
          <Link to="/dashboard">
            <img src="/logo-kali.png" alt="Kali Financials" className="logo" />
          </Link>
        </div>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/registro" className="nav-link">Registro</Link>
          <Link to="/resumen" className="nav-link">Resumen Mensual</Link>
        </div>
      </nav>

      <div className="app-container">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/registro" element={<RegistroForm />} />
          <Route path="/resumen" element={<ResumenMensual />} />
        </Routes>
      </div>
    </Router>
  );
}