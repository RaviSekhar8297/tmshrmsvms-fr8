import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import './Layout.css';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarOpen && !e.target.closest('.sidebar') && !e.target.closest('.menu-toggle')) {
        setSidebarOpen(false);
        document.body.classList.remove('sidebar-open');
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [sidebarOpen]);

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => {
        setSidebarOpen(false);
        document.body.classList.remove('sidebar-open');
      }} />
      <div className="main-content">
        <Header onMenuClick={() => {
          setSidebarOpen(!sidebarOpen);
          document.body.classList.toggle('sidebar-open', !sidebarOpen);
        }} />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;






