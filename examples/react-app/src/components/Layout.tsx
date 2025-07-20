import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NotificationContainer } from './NotificationContainer';
import { LoadingOverlay } from './LoadingOverlay';

export function Layout(): React.ReactElement {
  const { ui, auth } = useAppStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    // Apply theme on mount
    document.documentElement.setAttribute('data-theme', ui.theme);
  }, [ui.theme]);

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <div className="layout">
      <Header onLogoClick={handleLogoClick} />
      
      <div className="layout-body">
        {auth.isAuthenticated && ui.sidebarOpen && (
          <Sidebar />
        )}
        
        <main className={`layout-main ${ui.sidebarOpen ? 'with-sidebar' : ''}`}>
          <Outlet />
        </main>
      </div>
      
      <NotificationContainer />
      {ui.loading.global && <LoadingOverlay />}
    </div>
  );
}

export default Layout;