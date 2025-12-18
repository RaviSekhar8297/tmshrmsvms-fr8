import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FiGrid, FiFolder, FiCheckSquare, FiCalendar, 
  FiUsers, FiFileText, FiUser, FiAlertCircle, 
  FiStar, FiVideo, FiLogOut, FiChevronDown, FiChevronRight,
  FiClock, FiList, FiEdit, FiPlus, FiTruck, FiDollarSign,
  FiBriefcase, FiSend, FiShield, FiCalendar as FiCalendarIcon,
  FiTrendingUp, FiPhone, FiMail, FiGift
} from 'react-icons/fi';
import './Sidebar.css';

const LOGO_URL = 'https://www.brihaspathi.com/highbtlogo%20white-%20tm.png';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, isEmployee } = useAuth();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({
    tms: true,
    employee: false,
    self: false,
    employees: false,
    payroll: false,
    attendance: false,
    vms: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => {
      // Close all sections first, then open the clicked one if it wasn't open
      const newState = {
        tms: false,
        employee: false,
        self: false,
        employees: false,
        payroll: false,
        attendance: false,
        vms: false
      };
      // If the clicked section was closed, open it
      if (!prev[section]) {
        newState[section] = true;
      }
      return newState;
    });
  };

  // Direct Menu Items (not in collapsible sections)
  const directItems = [
    { path: '/dashboard', icon: FiGrid, label: 'Dashboard', roles: ['Admin', 'Manager', 'Employee', 'HR'] },
    { path: '/users', icon: FiUsers, label: 'Users', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/profile', icon: FiUser, label: 'Profile', roles: ['Admin', 'Manager', 'Employee', 'HR'] },
    { path: '/company', icon: FiBriefcase, label: 'Company', roles: ['Admin', 'HR'] },
  ];

  // TMS Module Items
  const tmsItems = [
    { path: '/projects', icon: FiFolder, label: 'Projects', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/tasks', icon: FiCheckSquare, label: 'Tasks', roles: ['Admin', 'Manager', 'Employee', 'HR'] },
    { path: '/meetings', icon: FiVideo, label: 'Meetings', roles: ['Admin', 'Manager', 'Employee', 'HR'] },
    { path: '/calendar', icon: FiCalendar, label: 'Calendar', roles: ['Admin', 'Manager', 'Employee', 'HR'] },
    { path: '/reports', icon: FiFileText, label: 'Reports', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/issues', icon: FiAlertCircle, label: 'Issues', roles: ['Admin', 'Manager', 'Employee', 'HR'] },
    { path: '/ratings', icon: FiStar, label: 'Ratings', roles: ['Admin', 'Manager', 'Employee', 'HR'] },
  ];

  // Employee Section (for Employee role)
  const employeeItems = [
    { path: '/employee/apply-leave', icon: FiPlus, label: 'Apply Leave', roles: ['Employee'] },
    { path: '/employee/leaves-list', icon: FiList, label: 'Leaves List', roles: ['Employee'] },
    { path: '/employee/permission', icon: FiShield, label: 'Permission', roles: ['Employee'] },
    { path: '/employee/requests', icon: FiSend, label: 'Requests', roles: ['Employee'] },
    { path: '/employee/holidays', icon: FiGift, label: 'Holidays', roles: ['Employee'] },
    { path: '/employee/work-report', icon: FiTrendingUp, label: 'Work Report', roles: ['Employee'] },
    { path: '/employee/contact-details', icon: FiPhone, label: 'Contact Details', roles: ['Employee'] },
  ];

  // Self Section (for Manager, HR, Admin)
  const selfItems = [
    { path: '/self/punch', icon: FiClock, label: 'Punch', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/apply-leave', icon: FiPlus, label: 'Apply Leave', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/leaves-list', icon: FiList, label: 'Leaves List', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/permission', icon: FiShield, label: 'Permission', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/requests', icon: FiSend, label: 'Requests', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/holidays', icon: FiGift, label: 'Holidays', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/work-report', icon: FiTrendingUp, label: 'Work Report', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/contact-details', icon: FiPhone, label: 'Contact Details', roles: ['Admin', 'Manager', 'HR'] },
  ];

  // Employees Section (for Manager, HR, Admin - managing employees)
  const employeesItems = [
    { path: '/employees/apply-leave', icon: FiPlus, label: 'Apply Leave', roles: ['Admin', 'Manager'] },
    { path: '/employees/leaves-list', icon: FiList, label: 'Leaves List', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/employees/permission', icon: FiShield, label: 'Permission', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/employees/requests', icon: FiSend, label: 'Requests', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/employees/week-offs', icon: FiCalendar, label: 'Week-Offs', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/employees/holidays', icon: FiGift, label: 'Holidays', roles: ['Admin', 'Manager'] },
    { path: '/employees/work-report', icon: FiTrendingUp, label: 'Work Report', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/employees/contact-details', icon: FiPhone, label: 'Contact Details', roles: ['Admin', 'Manager'] },
  ];

  // Payroll Section (for HR, Admin)
  const payrollItems = [
    { path: '/payroll/structure', icon: FiBriefcase, label: 'Structure', roles: ['Admin', 'HR'] },
    { path: '/payroll/generate', icon: FiPlus, label: 'Generate', roles: ['Admin', 'HR'] },
    { path: '/payroll/payslip', icon: FiFileText, label: 'Payslip', roles: ['Admin', 'HR'] },
    { path: '/payroll/salary', icon: FiDollarSign, label: 'Salary', roles: ['Admin', 'HR'] },
  ];

  // Attendance Section (for HR, Admin)
  const attendanceItems = [
    { path: '/attendance/count', icon: FiClock, label: 'Count', roles: ['Admin', 'HR'] },
    { path: '/attendance/history', icon: FiList, label: 'History', roles: ['Admin', 'HR'] },
    { path: '/attendance/modify', icon: FiEdit, label: 'Modify', roles: ['Admin', 'HR'] },
  ];

  // VMS Module Items
  const vmsItems = [
    { path: '/vms/add', icon: FiPlus, label: 'Add', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/vms/list', icon: FiList, label: 'List', roles: ['Admin', 'Manager', 'Employee', 'HR'] },
    { path: '/vms/items', icon: FiTruck, label: 'Items', roles: ['Admin', 'Manager', 'Employee', 'HR'] },
  ];

  const filterItems = (items) => items.filter(item => item.roles.includes(user?.role));

  const routeTitleMap = {
    '/dashboard': 'Dashboard',
    '/profile': 'Profile',
    '/projects': 'Projects',
    '/tasks': 'Tasks',
    '/meetings': 'Meetings',
    '/calendar': 'Calendar',
    '/reports': 'Reports',
    '/issues': 'Issues',
    '/ratings': 'Ratings',
    '/employee/apply-leave': 'Apply Leave',
    '/employee/leaves-list': 'My Leaves',
    '/employee/permission': 'Permission',
    '/employee/requests': 'Requests',
    '/employee/holidays': 'Holidays',
    '/employee/work-report': 'Work Report',
    '/employee/contact-details': 'Contact Details',
    '/self/punch': 'Punch',
    '/self/leaves-list': 'Leaves List',
    '/self/permission': 'Permission',
    '/self/holidays': 'Holidays',
    '/self/work-report': 'Work Report',
    '/self/contact-details': 'Contact Details',
  };

  const getCurrentTitle = () => {
    const path = location.pathname;
    // exact match first
    if (routeTitleMap[path]) return routeTitleMap[path];
    // prefix match for nested paths
    const found = Object.keys(routeTitleMap).find((route) => path.startsWith(route));
    return routeTitleMap[found] || 'Dashboard';
  };

  const renderSection = (sectionKey, title, items) => {
    const filteredItems = filterItems(items);
    if (filteredItems.length === 0) return null;

    const isExpanded = expandedSections[sectionKey];
    const hasActiveItem = filteredItems.some(item => location.pathname.startsWith(item.path.split('/')[1] === sectionKey ? `/${sectionKey}` : item.path));

    return (
      <div className="nav-section">
        <button
          className={`nav-section-header ${hasActiveItem ? 'active-section' : ''}`}
          onClick={() => toggleSection(sectionKey)}
        >
          {isExpanded ? <FiChevronDown className="section-icon" /> : <FiChevronRight className="section-icon" />}
          <span className="section-title">{title}</span>
        </button>
        {isExpanded && (
          <div className="nav-section-items">
            {filteredItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <img src={LOGO_URL} alt="TMS Logo" className="sidebar-logo-image" />
          </div>
          <span className="logo-text">TMS</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Direct items (not in collapsible sections) */}
        {filterItems(directItems).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon className="nav-icon" />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
        
        {/* TMS Section - for all roles */}
        {renderSection('tms', 'TMS', tmsItems)}
        
        {/* Employee Section - only for Employee role */}
        {user?.role === 'Employee' && renderSection('employee', 'Employee', employeeItems)}
        
        {/* Self Section - for Manager, HR, Admin */}
        {(user?.role === 'Manager' || user?.role === 'HR' || user?.role === 'Admin') && 
          renderSection('self', 'Self', selfItems)}
        
        {/* Employees Section - for Manager, HR, Admin */}
        {(user?.role === 'Manager' || user?.role === 'HR' || user?.role === 'Admin') && 
          renderSection('employees', 'Employees', employeesItems)}
        
        {/* Payroll Section - for HR, Admin */}
        {(user?.role === 'HR' || user?.role === 'Admin') && 
          renderSection('payroll', 'Payroll', payrollItems)}
        
        {/* Attendance Section - for HR, Admin */}
        {(user?.role === 'HR' || user?.role === 'Admin') && 
          renderSection('attendance', 'Attendance', attendanceItems)}
        
        {/* VMS Section */}
        {renderSection('vms', 'VMS', vmsItems)}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="avatar">
            {user?.image_base64 ? (
              <img src={user.image_base64} alt={user.name} />
            ) : (
              user?.name?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="user-details">
            <p className="user-name">{user?.name.toUpperCase()}</p>
            <p className="user-role">{user?.role.toUpperCase()}</p>
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>
          <FiLogOut />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
