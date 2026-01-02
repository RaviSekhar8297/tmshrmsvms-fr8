import { useState, useEffect } from 'react';
import { 
  FiSearch, FiFileText, 
  FiTrash2, FiUpload, FiDownload, FiCheckCircle, FiEye
} from 'react-icons/fi';
import { policiesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import './Policies.css';

const Policies = () => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [readStatuses, setReadStatuses] = useState({});
  const { user } = useAuth();

  const isHRorAdmin = user?.role === 'HR' || user?.role === 'Admin';


  const [uploadData, setUploadData] = useState({
    file: null,
    name: ''
  });

  const [selectedPage, setSelectedPage] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await policiesAPI.getAll();
      setPolicies(res.data);
      
      // Fetch read status for each policy
      const statusPromises = res.data.map(policy => 
        policiesAPI.getReadStatus(policy.id).catch(() => null)
      );
      const statuses = await Promise.all(statusPromises);
      const statusMap = {};
      statuses.forEach((status, index) => {
        if (status) {
          statusMap[res.data[index].id] = status.data;
        }
      });
      setReadStatuses(statusMap);
    } catch (error) {
      console.error('Error fetching policies:', error);
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please select a PDF file');
        return;
      }
      setUploadData({
        ...uploadData,
        file: file,
        name: uploadData.name || file.name.replace(/\.[^/.]+$/, '') // Remove extension
      });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadData.file) {
      toast.error('Please select a file');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', uploadData.file);
      if (uploadData.name) {
        formData.append('name', uploadData.name);
      }

      await policiesAPI.upload(formData);
      toast.success('Policy uploaded successfully');
      setShowUploadModal(false);
      resetUploadForm();
      fetchPolicies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload policy');
    }
  };



  const handleDelete = async (policyId) => {
    const confirmed = await new Promise((resolve) => {
      toast(
        (t) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p>Are you sure you want to delete this policy?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(true);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(false);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#64748b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ),
        { duration: Infinity }
      );
    });

    if (!confirmed) return;

    try {
      await policiesAPI.delete(policyId);
      toast.success('Policy deleted successfully');
      fetchPolicies();
    } catch (error) {
      toast.error('Failed to delete policy');
    }
  };


  const handleDownload = (policy) => {
    if (policy.policy.file_url) {
      // file_url already includes /api, so use it directly
      window.open(policy.policy.file_url, '_blank');
    } else {
      toast.error('File not available');
    }
  };


  const resetUploadForm = () => {
    setUploadData({
      file: null,
      name: ''
    });
  };

  const handlePageClick = async (policy, pageNumber) => {
    setSelectedPolicy(policy);
    setSelectedPage(pageNumber);
    
    // Mark as read if not already read
    const status = readStatuses[policy.id];
    if (status && !status.user_read) {
      try {
        await policiesAPI.markAsRead(policy.id, {
          empid: user.empid,
          name: user.name
        });
        setReadStatuses(prev => ({
          ...prev,
          [policy.id]: {
            ...prev[policy.id],
            user_read: true
          }
        }));
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }
  };


  const filteredPolicies = policies.filter(policy =>
    policy.policy.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="policies-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="policies-container">
      <div className="policies-header">
        <div className="header-content">
          <h1>COMPANY - POLICIES</h1>
          <p>Manage company policies and documents</p>
        </div>
        {isHRorAdmin && (
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                resetUploadForm();
                setShowUploadModal(true);
              }}
            >
              <FiUpload /> Upload Policy
            </button>
          </div>
        )}
      </div>

      <div className="policies-filters">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search policies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredPolicies.length === 0 ? (
        <div className="empty-state">
          <FiFileText size={48} />
          <p>No policies found</p>
        </div>
      ) : (
        filteredPolicies.map((policy) => {
          const status = readStatuses[policy.id];
          const totalPages = policy.policy.pages || 1;
          
          // Get total viewed count from readby array
          const readbyList = policy.readby || [];
          const totalViewed = Array.isArray(readbyList) ? readbyList.length : 0;
          
          return (
            <div key={policy.id} className="policy-section">
              <div className="policy-section-header">
                <div className="policy-header-info">
                  <h2>{policy.policy.name}</h2>
                  <div className="policy-meta-info">
                    <span>{policy.policy.type}</span>
                    <span>•</span>
                    <span>{totalPages} {totalPages === 1 ? 'page' : 'pages'}</span>
                    <span>•</span>
                    <span>{new Date(policy.created_at).toLocaleDateString()}</span>
                    {totalViewed > 0 && (
                      <>
                        <span>•</span>
                        <span className="viewed-indicator">
                          <FiEye /> {totalViewed} {totalViewed === 1 ? 'view' : 'views'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {isHRorAdmin && (
                  <div className="policy-header-actions">
                    <button
                      className="btn btn-icon btn-danger"
                      onClick={() => handleDelete(policy.id)}
                      title="Remove Policy"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="pages-grid">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  return (
                    <div
                      key={pageNum}
                      className="page-thumbnail"
                      onClick={() => handlePageClick(policy, pageNum)}
                    >
                      <div className="page-card-content">
                        <FiFileText size={40} />
                        <div className="page-number">Page {pageNum}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}


      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          resetUploadForm();
        }}
        title="Upload Policy"
      >
        <form onSubmit={handleUpload} className="policy-form">
          <div className="form-group">
            <label>Select PDF File *</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              required
            />
            <small>Only PDF files are allowed. Page count will be extracted automatically.</small>
          </div>

          <div className="form-group">
            <label>Policy Name</label>
            <input
              type="text"
              value={uploadData.name}
              onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
              placeholder="Leave empty to use filename"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowUploadModal(false);
              resetUploadForm();
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Upload
            </button>
          </div>
        </form>
      </Modal>

      {/* View Page Modal */}
      <Modal
        isOpen={!!selectedPolicy && !!selectedPage}
        onClose={() => {
          setSelectedPolicy(null);
          setSelectedPage(null);
        }}
        title={selectedPolicy ? `${selectedPolicy.policy.name} - Page ${selectedPage}` : ''}
        size="full"
      >
        {selectedPolicy && selectedPage && selectedPolicy.policy.file_url && (
          <div className="page-view">
            <div className="page-viewer">
              <iframe
                src={`${selectedPolicy.policy.file_url}#page=${selectedPage}`}
                style={{
                  width: '100%',
                  height: '90vh',
                  border: 'none',
                  borderRadius: '8px'
                }}
                title={`Page ${selectedPage}`}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Policies;

