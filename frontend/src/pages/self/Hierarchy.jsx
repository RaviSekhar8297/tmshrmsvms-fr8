import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiArrowDown, FiUsers, FiZoomIn, FiZoomOut, FiMaximize2, FiDownload } from 'react-icons/fi';
import './Hierarchy.css';

const Hierarchy = () => {
  const [users, setUsers] = useState([]);
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [downloading, setDownloading] = useState(false);
  const treeWrapperRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Use hierarchy endpoint which is accessible to all roles
      const response = await api.get('/users/hierarchy');
      const allUsers = response.data || [];
      setUsers(allUsers);
      buildHierarchy(allUsers);
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
      toast.error('Failed to load hierarchy data');
    } finally {
      setLoading(false);
    }
  };

  const buildHierarchy = (allUsers) => {
    // Create a map of users by empid for quick lookup
    const usersMap = {};
    allUsers.forEach(user => {
      usersMap[user.empid] = {
        ...user,
        children: []
      };
    });

    // Find root user (empid 101)
    const rootEmpid = '101';
    const root = usersMap[rootEmpid];

    if (!root) {
      toast.error('Root employee (ID: 101) not found');
      setHierarchy(null);
      return;
    }

    // Build the tree structure - only add users with valid parent relationships
    allUsers.forEach(user => {
      if (user.empid !== rootEmpid && user.report_to_id) {
        const parent = usersMap[user.report_to_id];
        if (parent) {
          parent.children.push(usersMap[user.empid]);
        }
      }
    });

    // Sort children by name for consistent display
    const sortChildren = (node) => {
      if (node.children && node.children.length > 0) {
        node.children.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        node.children.forEach(child => sortChildren(child));
      }
    };
    sortChildren(root);

    setHierarchy(root);
  };

  useEffect(() => {
    // Center the hierarchy view when it loads or zoom changes
    if (containerRef.current && hierarchy) {
      const container = containerRef.current;
      setTimeout(() => {
        if (container) {
          // Center horizontally - scroll to center of content
          const maxScrollLeft = container.scrollWidth - container.clientWidth;
          container.scrollLeft = maxScrollLeft > 0 ? maxScrollLeft / 2 : 0;
          
          // Center vertically - scroll to show the root node at center
          const maxScrollTop = container.scrollHeight - container.clientHeight;
          container.scrollTop = maxScrollTop > 0 ? maxScrollTop / 2 : 0;
        }
      }, 300);
    }
  }, [hierarchy, zoom]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const buildTreeStructure = (employee, level = 0, isLast = true, prefix = '') => {
    const connector = isLast ? '└── ' : '├── ';
    const name = `${employee.name}`;
    const id = `(ID: ${employee.empid})`;
    let result = prefix + connector + name + ' ' + id + '\n';
    
    if (employee.children && employee.children.length > 0) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      employee.children.forEach((child, index) => {
        const childIsLast = index === employee.children.length - 1;
        result += buildTreeStructure(child, level + 1, childIsLast, newPrefix);
      });
    }
    
    return result;
  };

  const handleDownloadWord = async () => {
    if (!hierarchy) {
      toast.error('No hierarchy data available');
      return;
    }

    setDownloading(true);
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = await import('docx');

      // Build visual tree structure
      const treeText = buildTreeStructure(hierarchy, 0, true, '');
      const treeLines = treeText.split('\n').filter(line => line.trim());

      // Create paragraphs for the document
      const children = [
        new Paragraph({
          children: [
            new TextRun({
              text: 'Organizational Hierarchy',
              bold: true,
              size: 32, // 16pt
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated on: ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}`,
              size: 20, // 10pt
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      ];

      // Add tree diagram with monospace font for proper alignment
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Hierarchy Tree Structure',
              bold: true,
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
        })
      );

      treeLines.forEach((line) => {
        if (line.trim()) {
          // Determine level and styling
          const level = (line.match(/^[│ ]*/)?.[0]?.length || 0) / 4;
          const isRoot = !line.startsWith(' ') && !line.startsWith('│');
          
          // Extract name and ID from line
          const match = line.match(/(├──|└──)\s*(.+?)\s*\(ID:\s*(\w+)\)/);
          if (match) {
            const [, connector, name, empid] = match;
            
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line,
                    size: isRoot ? 22 : level === 1 ? 20 : 18,
                    bold: isRoot || level === 1,
                    font: 'Courier New', // Monospace for tree alignment
                  }),
                ],
                spacing: { after: isRoot ? 200 : level === 1 ? 150 : 100 },
                indent: { left: 0 },
              })
            );
          } else {
            // Fallback for lines without proper format
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.trim(),
                    size: 18,
                    font: 'Courier New',
                  }),
                ],
                spacing: { after: 100 },
              })
            );
          }
        }
      });

      // Create document with landscape orientation for better fit
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                size: {
                  orientation: 'landscape',
                },
                margin: {
                  top: 720,    // 0.5 inch
                  right: 720,
                  bottom: 720,
                  left: 720,
                },
              },
            },
            children: children,
          },
        ],
      });

      // Generate and download
      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Organizational_Hierarchy_${new Date().toISOString().split('T')[0]}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Hierarchy downloaded successfully');
    } catch (error) {
      toast.error('Failed to download hierarchy');
    } finally {
      setDownloading(false);
    }
  };

  const EmployeeCard = ({ employee, level = 0, isLast = false }) => {
    const hasChildren = employee.children && employee.children.length > 0;
    const initials = employee.name ? employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '';

    return (
      <div className="hierarchy-node">
        <div className={`employee-card level-${level}`}>
          <div className="employee-image-wrapper">
            {employee.image_base64 ? (
              <img 
                src={employee.image_base64.startsWith('data:') 
                  ? employee.image_base64 
                  : `data:image/jpeg;base64,${employee.image_base64}`} 
                alt={employee.name}
                className="employee-image"
              />
            ) : (
              <div className="employee-image-placeholder">
                {initials || employee.empid}
              </div>
            )}
          </div>
          <div className="employee-name">{employee.name || 'N/A'}</div>
          <div className="employee-role" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>
            {employee.role || 'N/A'} - {employee.empid || 'N/A'}
          </div>
        </div>

        {hasChildren && (
          <>
            <div className="connector-line">
              <FiArrowDown className="arrow-icon" />
            </div>
            <div className={`children-container ${isLast ? 'is-last' : ''}`}>
              {employee.children.map((child, index) => (
                <EmployeeCard
                  key={child.empid}
                  employee={child}
                  level={level + 1}
                  isLast={index === employee.children.length - 1}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Organizational Hierarchy</h1>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading hierarchy...</p>
        </div>
      </div>
    );
  }

  if (!hierarchy) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Organizational Hierarchy</h1>
        </div>
        <div className="empty-state">
          <FiUsers size={48} className="empty-state-icon" />
          <h3>No hierarchy data available</h3>
          <p>Root employee (ID: 101) not found in the system</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiUsers size={24} />
          <h1>Organizational Hierarchy</h1>
        </div>
      </div>

      <div className="hierarchy-controls">
        <button 
          className="download-btn" 
          onClick={handleDownloadWord}
          disabled={downloading}
          title="Download as Word Document"
        >
          <FiDownload />
          {downloading ? 'Downloading...' : 'Download Word'}
        </button>
        <div className="zoom-controls">
          <button 
            className="zoom-btn" 
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            title="Zoom Out"
          >
            <FiZoomOut />
          </button>
          <span className="zoom-value">{zoom}%</span>
          <button 
            className="zoom-btn" 
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            title="Zoom In"
          >
            <FiZoomIn />
          </button>
          <button 
            className="zoom-btn reset-btn" 
            onClick={handleResetZoom}
            title="Reset Zoom"
          >
            <FiMaximize2 />
          </button>
        </div>
      </div>

      <div className="hierarchy-container" ref={containerRef}>
        <div className="hierarchy-tree-wrapper" ref={treeWrapperRef} style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
          <div className="hierarchy-tree">
            <EmployeeCard employee={hierarchy} level={0} isLast={true} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hierarchy;
