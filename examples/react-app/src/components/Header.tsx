import React from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  onLogoClick: () => void;
}

export function Header({ onLogoClick }: HeaderProps): React.ReactElement {
  const { cart, ui, toggleSidebar } = useAppStore();
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-toggle" onClick={toggleSidebar}>
          ☰
        </button>
        <h1 className="logo" onClick={onLogoClick}>
          MyShop
        </h1>
      </div>

      <nav className="header-nav">
        <Link to="/products">Products</Link>
        {isAuthenticated && (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/profile">Profile</Link>
          </>
        )}
      </nav>

      <div className="header-right">
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {isAuthenticated ? (
          <>
            <Link to="/cart" className="cart-icon">
              🛒 {cart.itemCount > 0 && <span className="badge">{cart.itemCount}</span>}
            </Link>
            <div className="user-menu">
              <span>{user?.name}</span>
              <button onClick={logout}>Logout</button>
            </div>
          </>
        ) : (
          <Link to="/login" className="login-link">
            Login
          </Link>
        )}
      </div>
    </header>
  );
}