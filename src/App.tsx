import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { TariffsPage } from './pages/TariffsPage';
import { CostsPage } from './pages/CostsPage';

type Theme = 'modern' | 'classic';
type Mode = 'light' | 'dark';

export default function App() {
  const [collapsed, setCollapsed] = useState(true);
  const [theme] = useState<Theme>('modern');
  const [mode] = useState<Mode>('light');

  const toggleMenu = () => setCollapsed((prev) => !prev);
  const shellClass = `app-shell ${collapsed ? 'nav-collapsed' : 'nav-expanded'}`;
  const layoutClass = `layout-shell ${theme === 'classic' ? 'theme-classic' : 'theme-modern'}`;

  return (
    <BrowserRouter>
      <div className={layoutClass}>
        <aside className={`side-panel ${collapsed ? 'is-collapsed' : ''}`}>
          <button className="panel-toggle" onClick={toggleMenu} aria-label="Alternar menú">
            <span />
            <span />
            <span />
          </button>
          <div className="side-panel__header">
            <div className="avatar">JD</div>
            {!collapsed && (
              <div className="profile-text">
                <strong>John Doe</strong>
                <span>Ing. de Software</span>
              </div>
            )}
          </div>
          <div className="side-panel__content">
            <div className="side-panel__section">Finanzas</div>
            <nav className="side-panel__nav">
              <NavLink to="/admin/sueldos">
                <span className="icon">🗂️</span>
                <span className="label">Sueldos</span>
              </NavLink>
              <NavLink to="/admin/costos">
                <span className="icon">📊</span>
                <span className="label">Costos</span>
              </NavLink>
            </nav>
            <div className="side-panel__section">Panel</div>
            <div className="side-panel__nav side-panel__nav--muted">
              <div className="nav-placeholder">
                <span className="icon">📁</span>
                <span className="label">Proyectos</span>
              </div>
              <div className="nav-placeholder">
                <span className="icon">📈</span>
                <span className="label">Reportes</span>
              </div>
              <div className="nav-placeholder">
                <span className="icon">⚙️</span>
                <span className="label">Configuración</span>
              </div>
            </div>
          </div>
          <div className="side-panel__support">
            <button type="button">Ayuda</button>
            <button type="button">Soporte</button>
            <button type="button" className="logout-button">
              Cerrar sesión
            </button>
          </div>
          <div className="side-panel__footer" />
        </aside>
        <div className={shellClass}>
          <Routes>
            <Route path="/" element={<Navigate to="/admin/sueldos" replace />} />
            <Route path="/admin/sueldos" element={<TariffsPage />} />
            <Route path="/admin/costos" element={<CostsPage />} />
            <Route path="*" element={<Navigate to="/admin/sueldos" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
