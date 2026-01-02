import { useState, useEffect } from 'react';
import { policiesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiFileText, FiX, FiCheck, FiEye, FiCheckCircle, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './PolicyPopup.css';

const PolicyPopup = ({ onClose }) => {
  const { user } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledgedPolicies, setAcknowledgedPolicies] = useState({});
  const [viewedPages, setViewedPages] = useState({}); // { policyId: Set of viewed page numbers }
  const [currentPolicyView, setCurrentPolicyView] = useState(null); // { policyId, currentPage }

  useEffect(() => {
    fetchUnreadPolicies();
  }, []);

  const fetchUnreadPolicies = async () => {
    try {
      setLoading(true);
      const response = await policiesAPI.getUnread();
      const unreadPolicies = response.data || [];
      
      // Preserve viewed pages for policies that still exist
      setViewedPages(prevViewed => {
        const newViewed = {};
        unreadPolicies.forEach(policy => {
          // Preserve viewed pages if policy was already in the list
          if (prevViewed[policy.id]) {
            newViewed[policy.id] = prevViewed[policy.id];
          } else {
            newViewed[policy.id] = new Set();
          }
        });
        return newViewed;
      });
      
      setPolicies(unreadPolicies);
    } catch (error) {
      console.error('Error fetching unread policies:', error);
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const handlePageView = (policyId, pageNumber) => {
    setViewedPages(prev => {
      const newViewed = { ...prev };
      if (!newViewed[policyId]) {
        newViewed[policyId] = new Set();
      }
      newViewed[policyId].add(pageNumber);
      return newViewed;
    });
  };

  const handleViewPolicy = (policy) => {
    const totalPages = policy.policy?.pages || 1;
    setCurrentPolicyView({
      policyId: policy.id,
      policy: policy,
      currentPage: 1,
      totalPages: totalPages
    });
    // Mark first page as viewed when opening
    handlePageView(policy.id, 1);
  };

  const handleNextPage = () => {
    if (currentPolicyView) {
      const nextPage = currentPolicyView.currentPage + 1;
      if (nextPage <= currentPolicyView.totalPages) {
        setCurrentPolicyView({
          ...currentPolicyView,
          currentPage: nextPage
        });
        handlePageView(currentPolicyView.policyId, nextPage);
      }
    }
  };

  const handlePrevPage = () => {
    if (currentPolicyView && currentPolicyView.currentPage > 1) {
      setCurrentPolicyView({
        ...currentPolicyView,
        currentPage: currentPolicyView.currentPage - 1
      });
    }
  };

  const canAcknowledgePolicy = (policyId) => {
    const policy = policies.find(p => p.id === policyId);
    if (!policy) return false;
    
    const totalPages = policy.policy?.pages || 1;
    const viewed = viewedPages[policyId] || new Set();
    
    // Check if all pages have been viewed
    for (let i = 1; i <= totalPages; i++) {
      if (!viewed.has(i)) {
        return false;
      }
    }
    return true;
  };

  const handleCheckboxChange = (policyId) => {
    if (!canAcknowledgePolicy(policyId)) {
      toast.error('Please read all pages before acknowledging');
      return;
    }
    
    setAcknowledgedPolicies(prev => ({
      ...prev,
      [policyId]: !prev[policyId]
    }));
  };

  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const handleSubmit = async () => {
    const checkedPolicies = Object.keys(acknowledgedPolicies).filter(
      id => acknowledgedPolicies[id]
    );

    if (checkedPolicies.length === 0) {
      toast.error('Please read and acknowledge at least one policy');
      return;
    }

    setSubmitting(true);
    try {
      const promises = checkedPolicies.map(policyId => 
        policiesAPI.acknowledge(parseInt(policyId))
      );
      await Promise.all(promises);
      
      // Show animated success popup
      setShowSuccessPopup(true);
      
      // Remove acknowledged policies from the list
      const remainingPolicies = policies.filter(p => !checkedPolicies.includes(p.id.toString()));
      setPolicies(remainingPolicies);
      setAcknowledgedPolicies({});
      setCurrentPolicyView(null);
      
      // Clear viewed pages for acknowledged policies
      const newViewedPages = { ...viewedPages };
      checkedPolicies.forEach(policyId => {
        delete newViewedPages[parseInt(policyId)];
      });
      setViewedPages(newViewedPages);
      
      // Close success popup after 3 seconds
      setTimeout(() => {
        setShowSuccessPopup(false);
        // If no more policies, close the main popup
        if (remainingPolicies.length === 0) {
          onClose();
        }
      }, 3000);
    } catch (error) {
      console.error('Error acknowledging policies:', error);
      toast.error('Failed to submit acknowledgments');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="policy-popup-overlay">
        <div className="policy-popup">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading policies...</p>
          </div>
        </div>
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="policy-popup-overlay">
        <div className="policy-popup">
          <div className="policy-popup-header">
            <h2>Policies</h2>
            <button className="close-btn" onClick={onClose}>
              <FiX />
            </button>
          </div>
          <div className="policy-popup-body">
            <div className="empty-state">
              <FiCheckCircle size={48} />
              <p>All policies have been acknowledged</p>
              <button className="btn-primary" onClick={onClose}>
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentPolicyView) {
    const { policy, currentPage, totalPages } = currentPolicyView;
    const viewed = viewedPages[policy.id] || new Set();
    const allPagesViewed = Array.from({ length: totalPages }, (_, i) => i + 1).every(
      page => viewed.has(page)
    );
    
    return (
      <div className="policy-popup-overlay">
        <div className="policy-popup policy-viewer">
          <div className="policy-popup-header">
            <h2>{policy.policy?.name || 'Policy Document'}</h2>
            <div className="viewer-controls">
              <button
                className="btn-secondary"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <FiChevronLeft /> Previous
              </button>
              <span className="page-indicator">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn-secondary"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next <FiChevronRight />
              </button>
              <button className="close-btn" onClick={() => setCurrentPolicyView(null)}>
                <FiX />
              </button>
            </div>
          </div>
          <div className="policy-popup-body">
            {policy.policy?.file_url && (
              <div className="pdf-viewer-container">
                <iframe
                  src={`${policy.policy.file_url}#page=${currentPage}`}
                  className="pdf-iframe"
                  title={`Page ${currentPage}`}
                  onLoad={() => handlePageView(policy.id, currentPage)}
                />
                <div className="page-view-indicator">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <span
                      key={pageNum}
                      className={`page-dot ${viewed.has(pageNum) ? 'viewed' : ''} ${currentPage === pageNum ? 'active' : ''}`}
                      title={`Page ${pageNum} ${viewed.has(pageNum) ? '(Viewed)' : '(Not viewed)'}`}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="viewer-footer">
              <div className="viewer-progress">
                <span>Progress: {viewed.size} / {totalPages} pages viewed</span>
                {allPagesViewed && (
                  <span className="all-viewed-badge">
                    <FiCheckCircle /> All pages viewed
                  </span>
                )}
              </div>
              <button className="btn-primary" onClick={() => setCurrentPolicyView(null)}>
                Back to Policies
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="policy-popup-overlay">
      {/** 
        <div className="policy-popup">
          <div className="policy-popup-header">
            <h2>Please Read and Acknowledge Policies</h2>
            <button className="close-btn" onClick={onClose}>
              <FiX />
            </button>
          </div>
          <div className="policy-popup-body">
            <div className="policies-list">
              {policies.map((policy) => {
                const totalPages = policy.policy?.pages || 1;
                const viewed = viewedPages[policy.id] || new Set();
                const viewedCount = viewed.size;
                const allPagesViewed = viewedCount === totalPages;
                const canAcknowledge = canAcknowledgePolicy(policy.id);
                
                return (
                  <div key={policy.id} className="policy-item">
                    <div className="policy-item-header">
                      <div className="policy-info">
                        <FiFileText className="policy-icon" />
                        <div>
                          <h3>{policy.policy?.name || 'Untitled Policy'}</h3>
                          <p className="policy-meta">
                            {totalPages} {totalPages === 1 ? 'page' : 'pages'} • 
                            {' '}{new Date(policy.created_at).toLocaleDateString()}
                          </p>
                          {viewedCount > 0 && (
                            <p className="policy-progress">
                              Progress: {viewedCount} / {totalPages} pages viewed
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn-secondary btn-view"
                        onClick={() => handleViewPolicy(policy)}
                      >
                        <FiEye /> {viewedCount > 0 ? 'Continue Reading' : 'View Policy'}
                      </button>
                    </div>
                    <div className="policy-pages-preview">
                      <div className="pages-indicator">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <span
                            key={pageNum}
                            className={`page-indicator-dot ${viewed.has(pageNum) ? 'viewed' : 'not-viewed'}`}
                            title={`Page ${pageNum} ${viewed.has(pageNum) ? '(Viewed)' : '(Not viewed)'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <label className={`acknowledge-checkbox ${canAcknowledge ? 'enabled' : 'disabled'}`}>
                      <input
                        type="checkbox"
                        checked={acknowledgedPolicies[policy.id] || false}
                        onChange={() => handleCheckboxChange(policy.id)}
                        disabled={!canAcknowledge}
                      />
                      <span>
                        {allPagesViewed 
                          ? '✓ I have read and understood this policy' 
                          : `Please read all ${totalPages} pages before acknowledging`}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="policy-popup-footer">
            <button
              className="btn-primary btn-submit"
              onClick={handleSubmit}
              disabled={submitting || Object.values(acknowledgedPolicies).every(v => !v)}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>

        */}
      </div>
      
      {/* Animated Success Popup */}
      {showSuccessPopup && (
        <div className="success-popup-overlay">
          <div className="success-popup">
            <FiCheckCircle className="success-icon" />
            <h3>Your record was submitted successfully</h3>
          </div>
        </div>
      )}
    </>
  );
};

export default PolicyPopup;

