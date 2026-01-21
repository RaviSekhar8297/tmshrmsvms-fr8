import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import { FiPackage, FiUsers, FiCalendar, FiPlus, FiEdit, FiTrash2, FiSave, FiX, FiSearch, FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import './VMS.css';

const Item = () => {
  const { user } = useAuth();
  // Manager and Employee roles should default to 'issues' tab
  const defaultTab = (user?.role === 'Manager' || user?.role === 'Employee') ? 'issues' : 'dashboard';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);
  
  // Dashboard data
  const [dashboardData, setDashboardData] = useState(null);
  
  // Stationery data
  const [items, setItems] = useState([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    item_name: '',
    available_quantity: 0,
    description: ''
  });
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockForm, setStockForm] = useState({
    item_id: null,
    quantity: 0,
    remarks: ''
  });
  
  // Issues data
  const [issuesMatrix, setIssuesMatrix] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({
    item_id: '',
    quantity: 1,
    issued_to_empid: ''
  });
  const [issueEmployeeSearch, setIssueEmployeeSearch] = useState('');
  
  // Events data
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    event_name: '',
    event_date: '',
    total_quantity: 0
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventEmployees, setEventEmployees] = useState([]);
  const [eventClients, setEventClients] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [clientName, setClientName] = useState('');
  const [clientQuantity, setClientQuantity] = useState(1);
  const [showEventItemModal, setShowEventItemModal] = useState(false);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  const [eventDetails, setEventDetails] = useState(null);
  // Removed quantity from form - it will be calculated from employees and clients
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');

  useEffect(() => {
    // For Manager/Employee, always fetch issues data
    if (user?.role === 'Manager' || user?.role === 'Employee') {
      if (activeTab === 'issues') {
        fetchIssuesMatrix();
        fetchEmployees();
        fetchItems();
      }
    } else {
      // For HR/Admin and special employees, fetch based on active tab
      if (activeTab === 'dashboard') {
        fetchDashboard();
      } else if (activeTab === 'stationery') {
        fetchItems();
      } else if (activeTab === 'issues') {
        fetchIssuesMatrix();
        fetchEmployees();
        fetchItems();
      } else if (activeTab === 'events') {
        fetchEvents();
        fetchEmployees();
      }
    }
  }, [activeTab, user?.role]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await api.get('/stationery/dashboard');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await api.get('/stationery/items');
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const fetchIssuesMatrix = async () => {
    setLoading(true);
    try {
      const response = await api.get('/stationery/issues/matrix');
      setIssuesMatrix(response.data);
    } catch (error) {
      console.error('Error fetching issues matrix:', error);
      toast.error('Failed to load issues data');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/stationery/events');
      setEvents(response.data);
      // Update selectedEvent if it exists
      if (selectedEvent) {
        const updatedEvent = response.data.find(e => e.event_id === selectedEvent.event_id);
        if (updatedEvent) {
          setSelectedEvent(updatedEvent);
        }
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const fetchEventDetails = async (eventId) => {
    setLoading(true);
    try {
      const response = await api.get(`/stationery/events/${eventId}`);
      setEventDetails(response.data);
      setShowEventDetailsModal(true);
      // Update selectedEvent with latest data including remaining quantity
      const event = events.find(e => e.event_id === eventId);
      if (event) {
        setSelectedEvent({ 
          ...event, 
          remaining_quantity: response.data.remaining_quantity, 
          total_assigned: response.data.total_assigned 
        });
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/stationery/employees');
      setAllEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingItem) {
        await api.put(`/stationery/items/${editingItem.item_id}`, itemForm);
        toast.success('Item updated successfully');
      } else {
        await api.post('/stationery/items', itemForm);
        toast.success('Item created successfully');
      }
      setShowItemModal(false);
      setEditingItem(null);
      setItemForm({ item_name: '', available_quantity: 0, description: '' });
      fetchItems();
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      item_name: item.item_name,
      available_quantity: item.available_quantity,
      description: item.description || ''
    });
    setShowItemModal(true);
  };

  const handleDeleteItem = async (itemId) => {
    const toastId = toast.loading('Deleting stationery item...');
    setLoading(true);
    try {
      await api.delete(`/stationery/items/${itemId}`);
      toast.success('Stationery item deleted successfully', { id: toastId });
      fetchItems();
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete item', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId, eventName) => {
    const toastId = toast.loading(`Deleting event "${eventName}"...`);
    setLoading(true);
    try {
      await api.delete(`/stationery/events/${eventId}`);
      toast.success('Event deleted successfully', { id: toastId });
      fetchEvents();
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete event', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteItem = (itemId, itemName) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '300px' }}>
        <div style={{ fontWeight: '600', fontSize: '1rem' }}>
          Delete Stationery Item?
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Are you sure you want to delete "{itemName}"? This action cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              toast.dismiss(t.id);
            }}
            style={{
              padding: '6px 16px',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              handleDeleteItem(itemId);
            }}
            style={{
              padding: '6px 16px',
              background: 'var(--danger)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,
      style: {
        minWidth: '350px'
      }
    });
  };

  const confirmDeleteEvent = (eventId, eventName) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '300px' }}>
        <div style={{ fontWeight: '600', fontSize: '1rem' }}>
          Delete Event?
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Are you sure you want to delete "{eventName}"? This action cannot be undone and will delete all associated event items.
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              toast.dismiss(t.id);
            }}
            style={{
              padding: '6px 16px',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              handleDeleteEvent(eventId, eventName);
            }}
            style={{
              padding: '6px 16px',
              background: 'var(--danger)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,
      style: {
        minWidth: '350px'
      }
    });
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/stationery/stock/add', {
        ...stockForm,
        item_id: parseInt(stockForm.item_id)
      });
      toast.success('Stock added successfully');
      setShowStockModal(false);
      setStockForm({ item_id: '', quantity: 0, remarks: '' });
      fetchItems();
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/stationery/events', {
        ...eventForm,
        event_date: eventForm.event_date
      });
      toast.success('Event created successfully');
      setShowEventModal(false);
      setEventForm({ event_name: '', event_date: '', total_quantity: 0 });
      fetchEvents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEventItem = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setLoading(true);
    try {
      // Calculate assigned quantity from employees and clients
      const totalEmployeeQuantity = eventEmployees.reduce((sum, emp) => sum + (emp.quantity || 1), 0);
      const totalClientQuantity = eventClients.reduce((sum, client) => sum + (client.quantity || 1), 0);
      const assignedQuantity = totalEmployeeQuantity + totalClientQuantity;
      
      if (assignedQuantity <= 0) {
        toast.error('Please select at least one employee or add at least one client');
        setLoading(false);
        return;
      }
      
      await api.post(`/stationery/events/${selectedEvent.event_id}/items`, {
        event_id: selectedEvent.event_id,
        employees: eventEmployees.map(emp => ({ ...emp, quantity: emp.quantity || 1 })),
        clients: eventClients.map(client => ({ ...client, quantity: client.quantity || 1 }))
      });
      toast.success('Event item added successfully');
      setShowEventItemModal(false);
      setEventEmployees([]);
      setEventClients([]);
      setSelectedEvent(null);
      setEmployeeSearchTerm('');
      setClientName('');
      setClientQuantity(1);
      fetchEvents();
      // Refresh event details if modal is open
      if (showEventDetailsModal && eventDetails) {
        fetchEventDetails(selectedEvent.event_id);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add event item');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = () => {
    if (clientName.trim()) {
      setEventClients([...eventClients, { name: clientName, quantity: clientQuantity }]);
      setClientName('');
      setClientQuantity(1);
    }
  };

  const handleRemoveClient = (index) => {
    setEventClients(eventClients.filter((_, i) => i !== index));
  };

  const handleToggleEmployee = (employee) => {
    const exists = eventEmployees.find(emp => emp.empid === employee.empid);
    if (exists) {
      setEventEmployees(eventEmployees.filter(emp => emp.empid !== employee.empid));
    } else {
      // Auto-set quantity to 1 when employee is selected
      setEventEmployees([...eventEmployees, { ...employee, quantity: 1 }]);
    }
  };

  const handleEmployeeQuantityChange = (empid, quantity) => {
    setEventEmployees(eventEmployees.map(emp => 
      emp.empid === empid ? { ...emp, quantity: parseInt(quantity) || 1 } : emp
    ));
  };

  const exportToExcel = () => {
    if (!issuesMatrix) return;
    
    const data = [];
    
    // Header row
    const headerRow = ['Employee', ...issuesMatrix.items.map(item => item.item_name)];
    data.push(headerRow);
    
    // Data rows
    issuesMatrix.employees.forEach(employee => {
      const row = [employee.name];
      issuesMatrix.items.forEach(item => {
        const count = issuesMatrix.matrix[employee.empid]?.items[item.item_id] || 0;
        row.push(count);
      });
      data.push(row);
    });
    
    // Create workbook and worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Issues Matrix');
    
    // Download
    XLSX.writeFile(wb, `issues_matrix_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel file downloaded successfully');
  };

  const filteredEmployees = (user?.role === 'HR' || user?.role === 'Admin' || user?.empid === '99' || user?.empid === '123123') 
    ? (issuesMatrix?.employees?.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.empid.toLowerCase().includes(searchTerm.toLowerCase())
      ) || [])
    : (issuesMatrix?.employees || []); // Manager/Employee see only their own data (no search needed)

  const filteredAllEmployees = allEmployees.filter(emp =>
    emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.empid.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    (emp.phone && emp.phone.toLowerCase().includes(employeeSearchTerm.toLowerCase()))
  );

  const filteredIssueEmployees = allEmployees.filter(emp =>
    emp.name.toLowerCase().includes(issueEmployeeSearch.toLowerCase()) ||
    emp.empid.toLowerCase().includes(issueEmployeeSearch.toLowerCase()) ||
    (emp.phone && emp.phone.toLowerCase().includes(issueEmployeeSearch.toLowerCase()))
  );

  const handleIssueItem = async (e) => {
    e.preventDefault();
    if (!issueForm.item_id || !issueForm.issued_to_empid || !issueForm.quantity) {
      toast.error('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      await api.post('/stationery/issues', {
        item_id: parseInt(issueForm.item_id),
        quantity: parseInt(issueForm.quantity),
        issued_to_empid: issueForm.issued_to_empid
      });
      toast.success('Item assigned successfully');
      setShowIssueModal(false);
      setIssueForm({ item_id: '', quantity: 1, issued_to_empid: '' });
      setIssueEmployeeSearch('');
      fetchIssuesMatrix();
      fetchItems();
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Stationery Items Management</h1>
      </div>

      {/* Tabs */}
      <div className="filter-tabs" style={{ marginBottom: '24px' }}>
        {(user?.role === 'HR' || user?.role === 'Admin' || (user?.empid === '99' || user?.empid === '123123')) && (
          <button
            type="button"
            className={`filter-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
        )}
        {(user?.role === 'HR' || user?.role === 'Admin' || (user?.empid === '99' || user?.empid === '123123')) && (
          <button
            type="button"
            className={`filter-tab ${activeTab === 'stationery' ? 'active' : ''}`}
            onClick={() => setActiveTab('stationery')}
          >
            Stationery
          </button>
        )}
        <button
          type="button"
          className={`filter-tab ${activeTab === 'issues' ? 'active' : ''}`}
          onClick={() => setActiveTab('issues')}
        >
          Issues Items
        </button>
        {(user?.role === 'HR' || user?.role === 'Admin' || (user?.empid === '99' || user?.empid === '123123')) && (
          <button
            type="button"
            className={`filter-tab ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Events
          </button>
        )}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (user?.role === 'HR' || user?.role === 'Admin' || (user?.empid === '99' || user?.empid === '123123')) && (
        <div>
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading...</p>
            </div>
          ) : dashboardData ? (
            <>
              {/* Items Section */}
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ marginBottom: '20px', fontSize: '1.5rem' }}>Items Summary</h2>
                {dashboardData.items?.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <FiPackage size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
                    <h3 style={{ color: 'var(--text-secondary)' }}>No items found</h3>
                  </div>
                ) : (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                    gap: '20px' 
                  }}>
                    {dashboardData.items?.map((item) => (
                      <div key={item.item_id} className="card" style={{ 
                        padding: '20px',
                        transition: 'all 0.3s',
                        border: '1px solid var(--border-color)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <FiPackage size={24} style={{ color: 'var(--primary)' }} />
                          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                            {item.item_name}
                          </h3>
                        </div>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr 1fr', 
                          gap: '12px' 
                        }}>
                          <div style={{ 
                            padding: '12px', 
                            background: 'var(--bg-hover)', 
                            borderRadius: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--success)', marginBottom: '4px' }}>
                              {item.balance}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Balance</div>
                          </div>
                          <div style={{ 
                            padding: '12px', 
                            background: 'var(--bg-hover)', 
                            borderRadius: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                              {item.used}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Used</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Events Section */}
              <div>
                <h2 style={{ marginBottom: '20px', fontSize: '1.5rem' }}>Events Summary</h2>
                {dashboardData.events?.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <FiCalendar size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
                    <h3 style={{ color: 'var(--text-secondary)' }}>No events found</h3>
                  </div>
                ) : (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                    gap: '20px' 
                  }}>
                    {dashboardData.events?.map((event) => (
                      <div key={event.event_id} className="card" style={{ 
                        padding: '20px',
                        transition: 'all 0.3s',
                        border: '1px solid var(--border-color)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <FiCalendar size={24} style={{ color: 'var(--primary)' }} />
                          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                            {event.event_name}
                          </h3>
                        </div>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(3, 1fr)', 
                          gap: '8px' 
                        }}>
                          <div style={{ 
                            padding: '10px', 
                            background: 'var(--bg-hover)', 
                            borderRadius: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                              {event.total_items}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Items</div>
                          </div>
                          <div style={{ 
                            padding: '10px', 
                            background: 'var(--bg-hover)', 
                            borderRadius: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                              {event.total_employees}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Employees</div>
                          </div>
                          <div style={{ 
                            padding: '10px', 
                            background: 'var(--bg-hover)', 
                            borderRadius: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                              {event.total_clients}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Clients</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Stationery Tab */}
      {activeTab === 'stationery' && (user?.role === 'HR' || user?.role === 'Admin' || (user?.empid === '99' || user?.empid === '123123')) && (
        <div>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Stationery Items</h2>
            {(user?.role === 'HR' || user?.role === 'Admin') && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditingItem(null);
                  setItemForm({ item_name: '', available_quantity: 0, description: '' });
                  setShowItemModal(true);
                }}
              >
                <FiPlus /> Add Item
              </button>
            )}
          </div>

          <div className="card">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Available Quantity</th>
                    <th>Description</th>
                    {(user?.role === 'HR' || user?.role === 'Admin') && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={(user?.role === 'HR' || user?.role === 'Admin') ? 4 : 3} className="text-center">No items found</td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.item_id}>
                        <td>{item.item_name}</td>
                        <td>{item.available_quantity}</td>
                        <td>{item.description || '-'}</td>
                        <td>
                          {(user?.role === 'HR' || user?.role === 'Admin') && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="btn-sm btn-primary"
                                onClick={() => handleEditItem(item)}
                              >
                                <FiEdit /> Edit
                              </button>
                              <button
                                className="btn-sm btn-secondary"
                                onClick={() => {
                                  setStockForm({ item_id: item.item_id.toString(), quantity: 0, remarks: '' });
                                  setShowStockModal(true);
                                }}
                              >
                                <FiPlus /> Add Stock
                              </button>
                              <button
                                className="btn-sm btn-danger"
                                onClick={() => confirmDeleteItem(item.item_id, item.item_name)}
                              >
                                <FiTrash2 /> Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Issues Items Tab */}
      {activeTab === 'issues' && (
        <div>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h2>Issues Items</h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {(user?.role === 'HR' || user?.role === 'Admin' || user?.empid === '99' || user?.empid === '123123') && (
                <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
                  <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by employee name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '40px' }}
                  />
                </div>
              )}
              {(user?.role === 'HR' || user?.role === 'Admin' || user?.empid === '99' || user?.empid === '123123') && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setIssueForm({ item_id: '', quantity: 1, issued_to_empid: '' });
                    setIssueEmployeeSearch('');
                    setShowIssueModal(true);
                  }}
                >
                  <FiPlus /> Assign Item
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={exportToExcel}
                disabled={!issuesMatrix}
              >
                <FiDownload /> Export Excel
              </button>
            </div>
          </div>
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading...</p>
            </div>
          ) : issuesMatrix ? (
            <div className="card">
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 10 }}>Employee</th>
                      {issuesMatrix.items?.map((item) => (
                        <th key={item.item_id}>{item.item_name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {((user?.role === 'HR' || user?.role === 'Admin' || user?.empid === '99' || user?.empid === '123123') ? filteredEmployees : issuesMatrix.employees).length === 0 ? (
                      <tr>
                        <td colSpan={(issuesMatrix.items?.length || 0) + 1} className="text-center">
                          {(user?.role === 'HR' || user?.role === 'Admin' || user?.empid === '99' || user?.empid === '123123') ? 'No employees found' : 'No items assigned'}
                        </td>
                      </tr>
                    ) : (
                      ((user?.role === 'HR' || user?.role === 'Admin' || user?.empid === '99' || user?.empid === '123123') ? filteredEmployees : issuesMatrix.employees).map((employee) => (
                        <tr key={employee.empid}>
                          <td style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', fontWeight: '600' }}>
                            {employee.name}
                          </td>
                          {issuesMatrix.items?.map((item) => (
                            <td key={item.item_id}>
                              {issuesMatrix.matrix[employee.empid]?.items[item.item_id] || 0}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (user?.role === 'HR' || user?.role === 'Admin' || (user?.empid === '99' || user?.empid === '123123')) && (
        <div>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Events</h2>
            {(user?.role === 'HR' || user?.role === 'Admin') && user?.empid !== '99' && user?.empid !== '123123' && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEventForm({ event_name: '', event_date: '', total_quantity: 0 });
                  setShowEventModal(true);
                }}
              >
                <FiPlus /> Create Event
              </button>
            )}
          </div>

          {events.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <FiCalendar size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
              <h3 style={{ color: 'var(--text-secondary)' }}>No events found</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Create your first event to get started</p>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
              gap: '24px' 
            }}>
              {events.map((event) => (
                <div key={event.event_id} className="card" style={{ 
                  padding: '24px',
                  transition: 'all 0.3s',
                  position: 'relative'
                }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => fetchEventDetails(event.event_id)}>
                      <h3 style={{ margin: 0, marginBottom: '8px', fontSize: '1.25rem', fontWeight: '700' }}>
                        {event.event_name}
                      </h3>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {event.event_date ? new Date(event.event_date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        }) : '-'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <FiCalendar size={24} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      {(user?.role === 'HR' || user?.role === 'Admin') && user?.empid !== '99' && user?.empid !== '123123' && (
                        <button
                          className="btn-sm btn-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteEvent(event.event_id, event.event_name);
                          }}
                          style={{ padding: '6px 12px' }}
                          title="Delete Event"
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '12px', 
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'var(--bg-hover)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                        {event.total_items}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Items</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                        {event.total_employees}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Employees</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                        {event.total_clients}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Clients</div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(event);
                      setEventEmployees([]);
                      setEventClients([]);
                      setEmployeeSearchTerm('');
                      setClientName('');
                      setClientQuantity(1);
                      setShowEventItemModal(true);
                    }}
                  >
                    <FiPlus /> Add Item
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Item Modal */}
      <Modal
        isOpen={showItemModal}
        onClose={() => {
          setShowItemModal(false);
          setEditingItem(null);
          setItemForm({ item_name: '', available_quantity: 0, description: '' });
        }}
        title={editingItem ? 'Edit Item' : 'Add New Item'}
        size="medium"
      >
        <form onSubmit={handleItemSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Item Name *</label>
            <input
              type="text"
              className="form-input"
              value={itemForm.item_name}
              onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Available Quantity *</label>
            <input
              type="number"
              className="form-input"
              value={itemForm.available_quantity}
              onChange={(e) => setItemForm({ ...itemForm, available_quantity: parseInt(e.target.value) || 0 })}
              min="0"
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              value={itemForm.description}
              onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
              rows="3"
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowItemModal(false);
              setEditingItem(null);
              setItemForm({ item_name: '', available_quantity: 0, description: '' });
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <FiSave /> {editingItem ? 'Update' : 'Create'} Item
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Modal */}
      <Modal
        isOpen={showStockModal}
        onClose={() => {
          setShowStockModal(false);
          setStockForm({ item_id: '', quantity: 0, remarks: '' });
        }}
        title="Add Stock"
        size="medium"
      >
        <form onSubmit={handleAddStock}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Item *</label>
            <select
              className="form-input"
              value={stockForm.item_id || ''}
              onChange={(e) => setStockForm({ ...stockForm, item_id: e.target.value ? parseInt(e.target.value) : '' })}
              required
            >
              <option value="">Select Item</option>
              {items.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Quantity *</label>
            <input
              type="number"
              className="form-input"
              value={stockForm.quantity}
              onChange={(e) => setStockForm({ ...stockForm, quantity: parseInt(e.target.value) || 0 })}
              min="1"
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Remarks</label>
            <textarea
              className="form-input"
              value={stockForm.remarks}
              onChange={(e) => setStockForm({ ...stockForm, remarks: e.target.value })}
              rows="2"
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowStockModal(false);
              setStockForm({ item_id: '', quantity: 0, remarks: '' });
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <FiSave /> Add Stock
            </button>
          </div>
        </form>
      </Modal>

      {/* Event Modal */}
      <Modal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setEventForm({ event_name: '', event_date: '', total_quantity: 0 });
        }}
        title="Create Event"
        size="medium"
      >
        <form onSubmit={handleEventSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Event Name *</label>
            <input
              type="text"
              className="form-input"
              value={eventForm.event_name}
              onChange={(e) => setEventForm({ ...eventForm, event_name: e.target.value })}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Event Date *</label>
            <input
              type="date"
              className="form-input"
              value={eventForm.event_date}
              onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Total Quantity</label>
            <input
              type="number"
              className="form-input"
              value={eventForm.total_quantity}
              onChange={(e) => setEventForm({ ...eventForm, total_quantity: parseInt(e.target.value) || 0 })}
              min="0"
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowEventModal(false);
              setEventForm({ event_name: '', event_date: '', total_quantity: 0 });
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <FiSave /> Create Event
            </button>
          </div>
        </form>
      </Modal>

      {/* Event Item Modal */}
      <Modal
        isOpen={showEventItemModal}
        onClose={() => {
          setShowEventItemModal(false);
          setSelectedEvent(null);
          setEventEmployees([]);
          setEventClients([]);
          setEmployeeSearchTerm('');
          setClientName('');
          setClientQuantity(1);
        }}
        title={selectedEvent ? `Add Item to Event: ${selectedEvent.event_name}` : 'Add Item to Event'}
        size="large"
      >
        <form onSubmit={handleAddEventItem}>
          {selectedEvent && (() => {
            const eventTotal = selectedEvent.total_quantity || 0;
            const alreadyAssigned = selectedEvent.total_assigned || 0;
            const thisAssignment = eventEmployees.reduce((sum, emp) => sum + (emp.quantity || 1), 0) + eventClients.reduce((sum, client) => sum + (client.quantity || 1), 0);
            const remainingAfterThis = eventTotal - alreadyAssigned - thisAssignment;
            return (
              <div className="form-group" style={{ marginBottom: '20px', padding: '12px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Event Total</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)' }}>{eventTotal}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}> Assigned</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-secondary)' }}>{alreadyAssigned}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>This Assignment</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--success)' }}>{thisAssignment}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Remaining</div>
                    <div style={{ 
                      fontSize: '1.1rem', 
                      fontWeight: '700', 
                      color: remainingAfterThis >= 0 ? 'var(--text-primary)' : 'var(--danger)' 
                    }}>
                      {remainingAfterThis >= 0 ? remainingAfterThis : 0}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                  Employees: {eventEmployees.reduce((sum, emp) => sum + (emp.quantity || 1), 0)} | Clients: {eventClients.reduce((sum, client) => sum + (client.quantity || 1), 0)}
                </div>
                {remainingAfterThis < 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '8px', fontWeight: '600' }}>
                    ⚠️ This assignment ({thisAssignment}) exceeds remaining quantity ({eventTotal - alreadyAssigned})
                  </div>
                )}
              </div>
            );
          })()}

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Employees  - Quantity auto-set to 1</label>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 1 }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search employees..."
                  value={employeeSearchTerm}
                  onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                />
              </div>
            </div>
            <div style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              padding: '12px', 
              maxHeight: '300px', 
              overflowY: 'auto',
              background: 'var(--bg-hover)'
            }}>
              {filteredAllEmployees.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
                  No employees found
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {filteredAllEmployees.map((emp) => {
                    const isSelected = eventEmployees.find(e => e.empid === emp.empid);
                    return (
                      <div key={emp.empid} style={{ 
                        padding: '12px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'var(--bg-hover)';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'var(--bg-card)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                        }
                      }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: isSelected ? '10px' : '0' }}>
                          <label style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            cursor: 'pointer',
                            flex: 1,
                            minWidth: 0
                          }}>
                            <div className="checkbox-wrapper-31" style={{ flexShrink: 0, marginRight: '12px' }}>
                              <input
                                type="checkbox"
                                checked={!!isSelected}
                                onChange={() => handleToggleEmployee(emp)}
                              />
                              <svg viewBox="0 0 35.6 35.6">
                                <circle className="background" cx="17.8" cy="17.8" r="17.8"></circle>
                                <circle className="stroke" cx="17.8" cy="17.8" r="14.37"></circle>
                                <polyline className="check" points="11.78 18.12 15.55 22.23 25.17 12.87"></polyline>
                              </svg>
                            </div>
                            <div style={{ 
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: isSelected ? 'var(--primary)' : 'var(--bg-hover)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? 'white' : 'var(--text-primary)',
                              fontWeight: '600',
                              fontSize: '0.9rem',
                              flexShrink: 0,
                              transition: 'all 0.2s'
                            }}>
                              {emp.name?.charAt(0).toUpperCase() || 'E'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, marginLeft: '8px' }}>
                              <div style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {emp.name}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {emp.empid} {emp.phone ? `• ${emp.phone}` : ''}
                              </div>
                            </div>
                          </label>
                        </div>
                        {isSelected && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                              Quantity:
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              value={isSelected.quantity || 1}
                              onChange={(e) => handleEmployeeQuantityChange(emp.empid, e.target.value)}
                              min="1"
                              style={{ width: '100%', padding: '8px' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {eventEmployees.length > 0 && (
              <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>
                  Selected Employees ({eventEmployees.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {eventEmployees.map((emp) => (
                    <div key={emp.empid} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'var(--bg-card)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <span style={{ fontWeight: '500' }}>{emp.name} ({emp.empid})</span>
                      <span style={{ 
                        padding: '4px 10px',
                        background: 'var(--primary)',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        Qty: {emp.quantity || 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Clients (Manually add - Enter quantity)</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Client name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddClient();
                  }
                }}
                style={{ flex: 2 }}
              />
              <input
                type="number"
                className="form-input"
                placeholder="Qty"
                value={clientQuantity}
                onChange={(e) => setClientQuantity(parseInt(e.target.value) || 1)}
                min="1"
                style={{ flex: 1, minWidth: '80px' }}
              />
              <button type="button" className="btn btn-primary" onClick={handleAddClient}>
                <FiPlus /> Add
              </button>
            </div>
            <div style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              padding: '12px',
              background: 'var(--bg-hover)',
              minHeight: '60px'
            }}>
              {eventClients.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
                  No clients added
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {eventClients.map((client, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '10px 12px',
                      background: 'var(--bg-card)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <span style={{ fontWeight: '500', flex: 1 }}>{client.name}</span>
                      <span style={{ 
                        padding: '4px 10px',
                        background: 'var(--primary)',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        marginRight: '8px'
                      }}>
                        Qty: {client.quantity || 1}
                      </span>
                      <button
                        type="button"
                        className="btn-sm btn-danger"
                        onClick={() => handleRemoveClient(index)}
                        style={{ padding: '4px 8px', minWidth: 'auto' }}
                      >
                        <FiX />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowEventItemModal(false);
              setSelectedEvent(null);
              setEventEmployees([]);
              setEventClients([]);
              setEmployeeSearchTerm('');
              setClientName('');
              setClientQuantity(1);
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <FiSave /> Add Item to Event
            </button>
          </div>
        </form>
      </Modal>

      {/* Issue Item Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => {
          setShowIssueModal(false);
          setIssueForm({ item_id: '', quantity: 1, issued_to_empid: '' });
          setIssueEmployeeSearch('');
        }}
        title="Assign Item to Employee"
        size="medium"
      >
        <form onSubmit={handleIssueItem}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Item *</label>
            <select
              className="form-input"
              value={issueForm.item_id}
              onChange={(e) => setIssueForm({ ...issueForm, item_id: e.target.value })}
              required
            >
              <option value="">Select Item</option>
              {items.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_name} (Available: {item.available_quantity})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Quantity *</label>
            <input
              type="number"
              className="form-input"
              value={issueForm.quantity}
              onChange={(e) => setIssueForm({ ...issueForm, quantity: parseInt(e.target.value) || 1 })}
              min="1"
              required
            />
            {issueForm.item_id && (() => {
              const selectedItem = items.find(item => item.item_id === parseInt(issueForm.item_id));
              return selectedItem && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Available: {selectedItem.available_quantity} | 
                  {parseInt(issueForm.quantity) > selectedItem.available_quantity && (
                    <span style={{ color: 'var(--danger)', fontWeight: '600' }}>
                      {' '}⚠️ Insufficient stock
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Employee *</label>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 1 }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search employees..."
                  value={issueEmployeeSearch}
                  onChange={(e) => setIssueEmployeeSearch(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                />
              </div>
            </div>
            <div style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              padding: '12px', 
              maxHeight: '250px', 
              overflowY: 'auto',
              background: 'var(--bg-hover)'
            }}>
              {filteredIssueEmployees.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
                  No employees found
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredIssueEmployees.map((emp) => (
                    <label key={emp.empid} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      padding: '10px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      background: issueForm.issued_to_empid === emp.empid ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                      border: issueForm.issued_to_empid === emp.empid ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (issueForm.issued_to_empid !== emp.empid) {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (issueForm.issued_to_empid !== emp.empid) {
                        e.currentTarget.style.background = 'var(--bg-card)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }
                    }}
                    >
                      <input
                        type="radio"
                        name="employee"
                        checked={issueForm.issued_to_empid === emp.empid}
                        onChange={() => setIssueForm({ ...issueForm, issued_to_empid: emp.empid })}
                        style={{ 
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: 'var(--primary)',
                          margin: 0,
                          flexShrink: 0
                        }}
                      />
                      <div style={{ 
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: issueForm.issued_to_empid === emp.empid ? 'var(--primary)' : 'var(--bg-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: issueForm.issued_to_empid === emp.empid ? 'white' : 'var(--text-primary)',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        flexShrink: 0,
                        transition: 'all 0.2s'
                      }}>
                        {emp.name?.charAt(0).toUpperCase() || 'E'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.empid} {emp.phone ? `• ${emp.phone}` : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowIssueModal(false);
              setIssueForm({ item_id: '', quantity: 1, issued_to_empid: '' });
              setIssueEmployeeSearch('');
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <FiSave /> Assign Item
            </button>
          </div>
        </form>
      </Modal>

      {/* Event Details Modal */}
      <Modal
        isOpen={showEventDetailsModal}
        onClose={() => {
          setShowEventDetailsModal(false);
          setEventDetails(null);
        }}
        title={eventDetails ? `Event Details: ${eventDetails.event_name}` : 'Event Details'}
        size="large"
      >
        {eventDetails && (
          <div>
            <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Event Date</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600' }}>
                    {eventDetails.event_date ? new Date(eventDetails.event_date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Quantity</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600' }}>{eventDetails.total_quantity}</div>
                </div>
              </div>
            </div>

            {eventDetails.items && eventDetails.items.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Event Items</h3>
                {eventDetails.items.map((item, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: '20px', 
                    padding: '16px', 
                    background: 'var(--bg-hover)', 
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ marginBottom: '12px', fontWeight: '600', color: 'var(--primary)' }}>
                      Quantity: {item.quantity}
                    </div>
                    
                    {item.employees && item.employees.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
                          Employees ({item.employees.length})
                        </div>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                          gap: '10px' 
                        }}>
                          {item.employees.map((emp, empIdx) => (
                            <div key={empIdx} style={{
                              padding: '10px 12px',
                              background: 'var(--bg-card)',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                flexShrink: 0
                              }}>
                                {emp.name?.charAt(0).toUpperCase() || 'E'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {emp.name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {emp.empid} {emp.phone ? `• ${emp.phone}` : ''}
                                </div>
                              </div>
                              {emp.quantity && (
                                <div style={{ 
                                  padding: '4px 10px',
                                  background: 'var(--primary)',
                                  color: 'white',
                                  borderRadius: '12px',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  flexShrink: 0
                                }}>
                                  Qty: {emp.quantity}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.clients && item.clients.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
                          Clients ({item.clients.length})
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '8px' 
                        }}>
                          {item.clients.map((client, clientIdx) => (
                            <div key={clientIdx} style={{
                              padding: '8px 12px',
                              background: 'var(--bg-card)',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              fontSize: '0.9rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span>{client.name}</span>
                              {client.quantity && (
                                <span style={{ 
                                  padding: '2px 8px',
                                  background: 'var(--primary)',
                                  color: 'white',
                                  borderRadius: '10px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600'
                                }}>
                                  Qty: {client.quantity}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(!eventDetails.items || eventDetails.items.length === 0) && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <FiPackage size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <p>No items added to this event yet</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Item;
