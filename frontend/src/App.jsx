import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Tasks from './pages/Tasks';
import TaskDetails from './pages/TaskDetails';
import Meetings from './pages/Meetings';
import Calendar from './pages/Calendar';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Issues from './pages/Issues';
import Ratings from './pages/Ratings';
import Policies from './pages/Policies';
import GoogleCallback from './pages/GoogleCallback';
// Employee Module
import ApplyLeave from './pages/employee/ApplyLeave';
import LeavesList from './pages/employee/LeavesList';
import Permission from './pages/employee/Permission';
import Requests from './pages/employee/Requests';
import Holidays from './pages/employee/Holidays';
import WorkReport from './pages/employee/WorkReport';
import ContactDetails from './pages/employee/ContactDetails';
import ApplyLoan from './pages/employee/ApplyLoan';
// Self Module
import Punch from './pages/self/Punch';
import Hierarchy from './pages/self/Hierarchy';
import Resignation from './pages/self/Resignation';
// Employees Module
import WeekOffs from './pages/employees/WeekOffs';
import ResignedList from './pages/employees/ResignedList';
// VMS Module
import AddItem from './pages/vms/AddItem';
import ItemList from './pages/vms/ItemList';
import Items from './pages/vms/Items';
import Item from './pages/vms/Item';
// Payroll Module
import PayrollStructure from './pages/payroll/PayrollStructure';
import Generate from './pages/payroll/Generate';
import Payslip from './pages/payroll/Payslip';
import Salary from './pages/payroll/Salary';
import Tax from './pages/payroll/Tax';
// Attendance Module
import AttendanceCycle from './pages/attendance/Cycle';
import AttendanceCount from './pages/attendance/Count';
import AttendanceHistory from './pages/attendance/History';
import ModifyAttendance from './pages/attendance/Modify';
// Company Module
import Company from './pages/company/Company';
// HR Module
import BalanceLeaves from './pages/hr/BalanceLeaves';
import EmpLeaves from './pages/hr/EmpLeaves';
import Data from './pages/employee/Data';
import Letters from './pages/employees/Letters';

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container" style={{ height: '100vh' }}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

const DefaultRedirect = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container" style={{ height: '100vh' }}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  // Front Desk users go directly to Add Visitor page
  if (user?.role === 'Front Desk') {
    return <Navigate to="/vms/add" replace />;
  }
  
  if (user?.role === 'Manager') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Navigate to="/dashboard" replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/google/callback" element={<GoogleCallback />} />
      
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<DefaultRedirect />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        <Route path="projects" element={
          <PrivateRoute allowedRoles={['Admin', 'Manager', 'HR']}>
            <Projects />
          </PrivateRoute>
        } />
        <Route path="projects/:id" element={
          <PrivateRoute allowedRoles={['Admin', 'Manager', 'HR']}>
            <ProjectDetails />
          </PrivateRoute>
        } />
        
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:id" element={<TaskDetails />} />
        
        <Route path="meetings" element={<Meetings />} />
        <Route path="calendar" element={<Calendar />} />
        
        <Route path="reports" element={
          <PrivateRoute allowedRoles={['Admin', 'Manager', 'HR']}>
            <Reports />
          </PrivateRoute>
        } />
        
        <Route path="users" element={
          <PrivateRoute allowedRoles={['Admin', 'Manager', 'HR']}>
            <Users />
          </PrivateRoute>
        } />
        
        <Route path="profile" element={<Profile />} />
        
        <Route path="company" element={
          <PrivateRoute allowedRoles={['Admin', 'HR']}>
            <Company />
          </PrivateRoute>
        } />
        <Route path="issues" element={<Issues />} />
        <Route path="ratings" element={<Ratings />} />
        <Route path="policies" element={<Policies />} />
        
        {/* Employee Module Routes */}
        <Route path="employee/apply-leave" element={<ApplyLeave />} />
        <Route path="employee/leaves-list" element={<LeavesList />} />
        <Route path="employee/permission" element={<Permission />} />
        <Route path="employee/requests" element={<Requests />} />
        <Route path="employee/holidays" element={<Holidays />} />
        <Route path="employee/work-report" element={<WorkReport />} />
        <Route path="employee/contact-details" element={<ContactDetails />} />
        <Route path="employee/apply-loan" element={<ApplyLoan />} />
        
        {/* Self Module Routes (Manager/HR/Admin) */}
        <Route path="self/punch" element={<Punch />} />
        <Route path="self/hierarchy" element={<Hierarchy />} />
        <Route path="self/apply-leave" element={<ApplyLeave />} />
        <Route path="self/leaves-list" element={<LeavesList />} />
        <Route path="self/permission" element={<Permission />} />
        <Route path="self/requests" element={<Requests />} />
        <Route path="self/week-offs" element={<WeekOffs />} />
        <Route path="self/holidays" element={<Holidays />} />
        <Route path="self/work-report" element={<WorkReport />} />
        <Route path="self/contact-details" element={<ContactDetails />} />
        <Route path="self/resignation" element={<Resignation />} />
        
        {/* Employees Module Routes (Manager/HR/Admin - managing employees) */}
        <Route path="employees/apply-leave" element={<ApplyLeave />} />
        <Route path="employees/leaves-list" element={
          <PrivateRoute allowedRoles={['Manager', 'HR', 'Admin']}>
            <EmpLeaves />
          </PrivateRoute>
        } />
        <Route path="employees/permission" element={<Permission />} />
        <Route path="employees/requests" element={<Requests />} />
        <Route path="employees/week-offs" element={<WeekOffs />} />
        <Route path="employees/holidays" element={<Holidays />} />
        <Route path="employees/work-report" element={<WorkReport />} />
        <Route path="employees/contact-details" element={<ContactDetails />} />
        <Route path="employees/balance-leaves" element={
          <PrivateRoute allowedRoles={['Admin', 'HR']}>
            <BalanceLeaves />
          </PrivateRoute>
        } />
        <Route path="employees/data" element={
          <PrivateRoute allowedRoles={['Admin', 'HR', 'Manager']}>
            <Data />
          </PrivateRoute>
        } />
        <Route path="employees/letters" element={
          <PrivateRoute allowedRoles={['HR']}>
            <Letters />
          </PrivateRoute>
        } />
        <Route path="employees/resigned-list" element={
          <PrivateRoute allowedRoles={['Manager', 'HR', 'Admin']}>
            <ResignedList />
          </PrivateRoute>
        } />
        
        {/* VMS Module Routes */}
        <Route path="vms/add" element={<AddItem />} />
        <Route path="vms/list" element={<AddItem />} />
        <Route path="vms/items" element={<Items />} />
        <Route path="vms/item" element={<Item />} />
        
        {/* Payroll Module Routes */}
        <Route path="payroll/structure" element={<PayrollStructure />} />
        <Route path="payroll/generate" element={<Generate />} />
        <Route path="payroll/payslip" element={<Payslip />} />
        <Route path="payroll/salary" element={<Salary />} />
        <Route path="payroll/tax" element={<Tax />} />
        
        {/* Attendance Module Routes */}
        <Route path="attendance/cycle" element={<AttendanceCycle />} />
        <Route path="attendance/count" element={<AttendanceCount />} />
        <Route path="attendance/history" element={<AttendanceHistory />} />
        <Route path="attendance/modify" element={<ModifyAttendance />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#f8fafc',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#f8fafc',
              },
            },
          }}
        />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;






