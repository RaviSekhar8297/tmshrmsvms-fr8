import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FiGrid, FiFolder, FiCheckSquare, FiCalendar, 
  FiUsers, FiFileText, FiUser, FiAlertCircle, 
  FiStar, FiVideo, FiPower, FiChevronDown, FiChevronRight,
  FiClock, FiList, FiEdit, FiPlus, FiTruck, FiDollarSign,
  FiBriefcase, FiSend, FiShield, FiCalendar as FiCalendarIcon,
  FiTrendingUp, FiPhone, FiMail, FiGift, FiGitBranch, FiPercent, FiLogOut
} from 'react-icons/fi';
import './Sidebar.css';

const LOGO_URL_DARK = 'https://www.brihaspathi.com/highbtlogo%20white-%20tm.png';
const LOGO_URL_LIGHT = 'https://www.brihaspathi.com/highbtlogo%20tm%20(1).png';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, isEmployee } = useAuth();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    tms: false,
    employee: false,
    self: false,
    employees: false,
    payroll: false,
    attendance: false,
    vms: false
  });

  useEffect(() => {
    // Check theme on mount and when it changes
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme !== 'light');
    };
    
    checkTheme();
    
    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    return () => observer.disconnect();
  }, []);

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

  // Self Section (for Employee role) - using /self/ paths
  const employeeSelfItems = [
    { path: '/self/punch', icon: FiClock, label: 'Punch', roles: ['Employee'] },
    { path: '/self/hierarchy', icon: FiGitBranch, label: 'Hierarchy', roles: ['Employee'] },
    { path: '/self/apply-leave', icon: FiPlus, label: 'Apply Leave', roles: ['Employee'] },
    { path: '/self/leaves-list', icon: FiList, label: 'Leaves List', roles: ['Employee'] },
    { path: '/self/permission', icon: FiShield, label: 'Permission', roles: ['Employee'] },
    { path: '/self/requests', icon: FiSend, label: 'Requests', roles: ['Employee'] },
    { path: '/self/resignation', icon: FiLogOut, label: 'Resignation', roles: ['Employee'] },
    { path: '/employee/apply-loan', icon: FiDollarSign, label: 'Apply Loan', roles: ['Employee'] },
    { path: '/self/holidays', icon: FiGift, label: 'Holidays', roles: ['Employee'] },
    { path: '/self/work-report', icon: FiTrendingUp, label: 'Work Report', roles: ['Employee'] },
    { path: '/self/contact-details', icon: FiPhone, label: 'Contact Details', roles: ['Employee'] },
    { path: '/policies', icon: FiFileText, label: 'Policies', roles: ['Employee'] },
    { path: '/payroll/tax', icon: FiPercent, label: 'Tax', roles: ['Employee'] },
  ];

  // Self Section (for Manager, HR, Admin)
  const selfItems = [
    { path: '/self/punch', icon: FiClock, label: 'Punch', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/hierarchy', icon: FiGitBranch, label: 'Hierarchy', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/apply-leave', icon: FiPlus, label: 'Apply Leave', roles: ['Manager', 'HR'] },
    { path: '/self/leaves-list', icon: FiList, label: 'Leaves List', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/permission', icon: FiShield, label: 'Permission', roles: ['Manager', 'HR'] },
    { path: '/self/requests', icon: FiSend, label: 'Requests', roles: ['Manager', 'HR'] },
    { path: '/self/resignation', icon: FiLogOut, label: 'Resignation', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/employee/apply-loan', icon: FiDollarSign, label: 'Apply Loan', roles: ['Manager', 'HR'] },
    { path: '/self/week-offs', icon: FiCalendar, label: 'Week-Offs', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/holidays', icon: FiGift, label: 'Holidays', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/work-report', icon: FiTrendingUp, label: 'Work Report', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/self/contact-details', icon: FiPhone, label: 'Contact Details', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/policies', icon: FiFileText, label: 'Policies', roles: ['Admin', 'Manager', 'HR'] },
    { path: '/payroll/tax', icon: FiPercent, label: 'Tax', roles: ['Manager', 'HR'] },
  ];

  // Employees Section (for Manager - managing employees)
  const managerEmployeesItems = [
    { path: '/employees/data', icon: FiFileText, label: 'Data', roles: ['Manager'] },
    { path: '/employees/leaves-list', icon: FiList, label: 'Leaves List', roles: ['Manager'] },
    { path: '/employees/permission', icon: FiShield, label: 'Permission', roles: ['Manager'] },
    { path: '/employees/requests', icon: FiSend, label: 'Requests', roles: ['Manager'] },
    { path: '/employees/resigned-list', icon: FiLogOut, label: 'Resigned List', roles: ['Manager'] },
    { path: '/employees/work-report', icon: FiTrendingUp, label: 'Work Report', roles: ['Manager'] },
  ];

  // Employees Section (for HR, Admin - managing employees)
  const employeesItems = [
    { path: '/employees/apply-leave', icon: FiPlus, label: 'Apply Leave', roles: ['Admin'] },
    { path: '/employees/leaves-list', icon: FiList, label: 'Leaves List', roles: ['Admin', 'HR'] },
    { path: '/employees/balance-leaves', icon: FiList, label: 'Balance Leaves', roles: ['HR'] },
    { path: '/employees/data', icon: FiFileText, label: 'Data', roles: ['Admin', 'HR'] },
    { path: '/employees/letters', icon: FiMail, label: 'Letters', roles: ['HR'] },
    { path: '/employees/permission', icon: FiShield, label: 'Permission', roles: ['Admin', 'HR'] },
    { path: '/employees/requests', icon: FiSend, label: 'Requests', roles: ['Admin', 'HR'] },
    { path: '/employees/resigned-list', icon: FiLogOut, label: 'Resigned List', roles: ['Admin', 'HR'] },
    { path: '/employees/holidays', icon: FiGift, label: 'Holidays', roles: ['Admin'] },
    { path: '/employees/work-report', icon: FiTrendingUp, label: 'Work Report', roles: ['Admin', 'HR'] },
    { path: '/employees/contact-details', icon: FiPhone, label: 'Contact Details', roles: ['Admin'] },
  ];

  // Payroll Section (for Employee, Manager, HR, Admin)
  const payrollItems = [
    { path: '/payroll/structure', icon: FiBriefcase, label: 'Structure', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { path: '/payroll/generate', icon: FiPlus, label: 'Generate', roles: ['HR'] },
    { path: '/payroll/payslip', icon: FiFileText, label: 'Payslip', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { path: '/payroll/salary', icon: FiDollarSign, label: 'Salary', roles: ['Admin', 'HR'] },
    { path: '/payroll/tax', icon: FiPercent, label: 'Tax', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
  ];

  // Attendance Section (for Employee, Manager, HR, Admin)
  const attendanceItems = [
    { path: '/attendance/cycle', icon: FiCalendar, label: 'Cycle', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { path: '/attendance/count', icon: FiClock, label: 'Count', roles: ['Admin', 'HR'] },
    { path: '/attendance/history', icon: FiList, label: 'History', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { path: '/attendance/modify', icon: FiEdit, label: 'Modify', roles: ['HR'] },
  ];

  // VMS Module Items
  const vmsItems = [
    { path: '/vms/list', icon: FiList, label: 'Visitors', roles: ['Manager', 'Employee', 'HR', 'Front Desk'] },
    { path: '/vms/items', icon: FiTruck, label: 'Items', roles: ['Manager', 'Employee', 'HR', 'Front Desk'] },
  ];

  const filterItems = (items) => {
    // Front Desk role should only see VMS items
    if (user?.role === 'Front Desk') {
      return items.filter(item => item.path?.startsWith('/vms'));
    }
    return items.filter(item => item.roles.includes(user?.role));
  };

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
    '/employee/apply-loan': 'Apply Loan',
  };

  const getCurrentTitle = () => {
    const path = location.pathname;
    // exact match first
    if (routeTitleMap[path]) return routeTitleMap[path];
    // prefix match for nested paths
    const found = Object.keys(routeTitleMap).find((route) => path.startsWith(route));
    return routeTitleMap[found] || 'Dashboard';
  };

  const handleNavClick = () => {
    // Close sidebar on mobile when a menu item is clicked
    if (window.innerWidth <= 768 && isOpen) {
      onClose();
    }
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
                onClick={handleNavClick}
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
            <img 
              src={isDarkMode ? LOGO_URL_DARK : LOGO_URL_LIGHT} 
              alt="TMS Logo" 
              className="sidebar-logo-image" 
              style={isDarkMode ? {} : { filter: 'none' }}
            />
          </div>
          <span className="logo-text">TMS</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Front Desk role - only show VMS */}
        {user?.role === 'Front Desk' ? (
          renderSection('vms', 'VMS', vmsItems)
        ) : (
          <>
            {/* Direct items (not in collapsible sections) */}
            {filterItems(directItems).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={handleNavClick}
              >
                <item.icon className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
            
            {/* TMS Section - for all roles */}
            {renderSection('tms', 'TMS', tmsItems)}
            
            {/* Self Section - for Employee role */}
            {user?.role === 'Employee' && renderSection('self', 'Self', employeeSelfItems)}
            
            {/* Self Section - for Manager, HR, Admin */}
            {(user?.role === 'Manager' || user?.role === 'HR' || user?.role === 'Admin') && 
              renderSection('self', 'Self', selfItems)}
            
            {/* Employees Section - for Manager (limited items) */}
            {user?.role === 'Manager' && 
              renderSection('employees', 'Employees', managerEmployeesItems)}
            
            {/* Employees Section - for HR, Admin */}
            {(user?.role === 'HR' || user?.role === 'Admin') && 
              renderSection('employees', 'Employees', employeesItems)}
            
            {/* Payroll Section - for Employee, Manager, HR, Admin */}
            {renderSection('payroll', 'Payroll', payrollItems)}
            
            {/* Attendance Section - for Employee, Manager, HR, Admin */}
            {renderSection('attendance', 'Attendance', attendanceItems)}
            
            {/* VMS Section */}
            {renderSection('vms', 'VMS', vmsItems)}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="avatar">
            {user?.role === 'Front Desk' ? (
              user?.name?.charAt(0).toUpperCase()
            ) : user?.image_base64 ? (
              <img src={user.image_base64} alt={user.name} />
            ) : (
              user?.name?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="user-details">
            <p className="user-name">{user?.name.toUpperCase()}</p>
            <p className="user-role">{user?.role === 'Front Desk' ? 'FRONT DESK' : user?.role.toUpperCase()}</p>
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>
          <FiPower />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
