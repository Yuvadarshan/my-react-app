import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc,
  deleteDoc,
  query,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase-config';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/AdminDashboard.css';

const AdminDashboard = ({ showNotification, onLogout }) => {
  const [activeTab, setActiveTab] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({});
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    department: '',
    section: '',
    year: '',
    role: ''
  });
  // Normalize column names to handle different formats
  const normalizeColumnName = (name) => {
    if (!name) return '';
    return name.toString().toLowerCase().trim().replace(/\s+/g, '_');
  };

  // Fetch users from Firestore
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const usersData = [];
      querySnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      showNotification('Failed to fetch users', 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load users when manage tab is active
  useEffect(() => {
    if (activeTab === 'manage') {
      fetchUsers();
    }
  }, [activeTab]);

  // Filter users based on role and search term
  const filteredUsers = users.filter(user => {
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesRole && matchesSearch;
  });

  // Process Excel file upload
  const processExcelFile = async (file, type) => {
    const workbook = new ExcelJS.Workbook();
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        try {
          const buffer = e.target.result;
          await workbook.xlsx.load(buffer);
          const worksheet = workbook.worksheets[0];
          
          const jsonData = [];
          let headers = [];
          
          // Get headers from first row
          worksheet.getRow(1).eachCell((cell, colNumber) => {
            headers[colNumber] = normalizeColumnName(cell.value);
          });
          
          // Process each row
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header row
            
            const rowData = {};
            row.eachCell((cell, colNumber) => {
              const header = headers[colNumber];
              if (header) {
                rowData[header] = cell.value;
              }
            });
            
            if (Object.keys(rowData).length > 0) {
              jsonData.push(rowData);
            }
          });
          
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    setUploadStatus({ [type]: { status: 'loading', message: 'Processing file...' } });
    
    try {
      // Validate file type
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        throw new Error('Please upload a valid Excel file (.xlsx or .xls)');
      }
      
      const jsonData = await processExcelFile(file, type);
      
      if (!jsonData || jsonData.length === 0) {
        throw new Error('No valid data found in the Excel file');
      }
      
      // Process data based on type
      let processedCount = 0;
      let errorCount = 0;
      const errorDetails = [];
      
      for (const [index, item] of jsonData.entries()) {
        try {
          // Map different possible column names to standard names
          const name = item.name || item.student_name || item.teacher_name || '';
          const email = item.email || item.mail || item.email_id || '';
          const department = item.department || item.dept || '';
          const section = item.section || item.sec || '';
          const year = item.year || item.yr || '';
          const password = item.password || item.pwd || item.pass || '';
          const passwordSet = item.password_set || item.password_sett || item.pwd_set || false;
          
          // Validate required fields
          if (!name || !email || !department || !section || !year || !password) {
            throw new Error(`Missing required fields in row ${index + 2}`);
          }
          
          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email.toString())) {
            throw new Error(`Invalid email format: ${email}`);
          }
          
          const userData = {
            name: name,
            email: email.toLowerCase(),
            department: department,
            section: section,
            year: year,
            tempPassword: password,
            passwordSet: passwordSet === true || passwordSet === 'true' || passwordSet === 'TRUE',
            role: type === 'students' ? 'student' : 'teacher',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Add to Firestore
          await setDoc(doc(db, 'users', userData.email), userData);
          processedCount++;
          
        } catch (error) {
          console.error(`Error processing row ${index + 2}:`, error);
          errorDetails.push(`Row ${index + 2}: ${error.message}`);
          errorCount++;
        }
      }
      
      const message = `Successfully processed ${processedCount} ${type}. ${errorCount > 0 ? `${errorCount} errors occurred.` : ''}`;
      
      setUploadStatus({ 
        [type]: { 
          status: processedCount > 0 ? 'success' : 'error', 
          message,
          details: errorDetails
        } 
      });
      
      if (processedCount > 0) {
        showNotification(message, 'success');
        // Refresh user list if we're on the manage tab
        if (activeTab === 'manage') {
          fetchUsers();
        }
      } else {
        showNotification(`Failed to process any ${type}. Check file format.`, 'error');
      }
      
    } catch (error) {
      console.error('Error uploading file:', error);
      
      setUploadStatus({ 
        [type]: { 
          status: 'error', 
          message: error.message || 'Error processing file' 
        } 
      });
      
      showNotification(error.message || 'Error processing file', 'error');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  const renderUploadStatus = (type) => {
    const status = uploadStatus[type];
    if (!status) return null;
    
    return (
      <div className={`upload-status ${status.status}`}>
        {status.status === 'loading' && <LoadingSpinner size="small" text={status.message} />}
        {status.status === 'success' && (
          <div>
            <span className="status-icon">✓</span>
            {status.message}
            {status.details && status.details.length > 0 && (
              <details className="error-details">
                <summary>View error details</summary>
                <ul>
                  {status.details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        {status.status === 'error' && (
          <div>
            <span className="status-icon">✕</span>
            {status.message}
          </div>
        )}
      </div>
    );
  };

  const downloadTemplate = (type) => {
    // Create sample data for template
    const sampleData = type === 'students' 
      ? [
          ['John Doe', 'john.doe@student.edu', 'CSE', 'A', '2', 'temp123', 'FALSE'],
          ['Jane Smith', 'jane.smith@student.edu', 'ECE', 'B', '3', 'temp456', 'FALSE']
        ]
      : [
          ['Dr. Robert Davis', 'robert.davis@faculty.edu', 'CSE', 'A', 'N/A', 'teach123', 'FALSE'],
          ['Prof. Sarah Miller', 'sarah.miller@faculty.edu', 'ECE', 'B', 'N/A', 'teach456', 'FALSE']
        ];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(type === 'students' ? 'Students' : 'Teachers');

    // Add headers
    worksheet.addRow(['Name', 'Email', 'Department', 'Section', 'Year', 'Password', 'Password_Set']);
    
    // Add sample data
    sampleData.forEach(row => worksheet.addRow(row));

    // Style headers
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });

    // Generate and download
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Reset password for a user
  const resetPassword = async (userId, email) => {
    if (!window.confirm(`Reset password for ${email}? A temporary password will be generated.`)) {
      return;
    }
    
    try {
      // Generate a random temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      
      // Update user in Firestore
      await updateDoc(doc(db, 'users', userId), {
        tempPassword: tempPassword,
        passwordSet: false,
        updatedAt: new Date()
      });
      
      showNotification(`Password reset for ${email}. Temporary password: ${tempPassword}`, 'success');
      fetchUsers(); // Refresh the user list
    } catch (error) {
      console.error('Error resetting password:', error);
      showNotification('Failed to reset password', 'error');
    }
  };

  // Delete a user
  const deleteUser = async (userId, email) => {
    if (!window.confirm(`Are you sure you want to delete ${email}?`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'users', userId));
      showNotification(`User ${email} deleted successfully`, 'success');
      fetchUsers(); // Refresh the user list
    } catch (error) {
      console.error('Error deleting user:', error);
      showNotification('Failed to delete user', 'error');
    }
  };

  // Start editing a user
  const startEditUser = (user) => {
    setEditingUser(user.id);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      department: user.department || '',
      section: user.section || '',
      year: user.year || '',
      role: user.role || ''
    });
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingUser(null);
    setEditForm({
      name: '',
      email: '',
      department: '',
      section: '',
      year: '',
      role: ''
    });
  };

  // Save edited user
  const saveEdit = async () => {
    if (!editingUser) return;
    
    try {
      await updateDoc(doc(db, 'users', editingUser), {
        name: editForm.name,
        department: editForm.department,
        section: editForm.section,
        year: editForm.year,
        role: editForm.role,
        updatedAt: new Date()
      });
      
      showNotification('User updated successfully', 'success');
      setEditingUser(null);
      fetchUsers(); // Refresh the user list
    } catch (error) {
      console.error('Error updating user:', error);
      showNotification('Failed to update user', 'error');
    }
  };

  // Export users to Excel
  const exportUsers = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Users');
      
      // Add headers
      worksheet.addRow(['Name', 'Email', 'Department', 'Section', 'Year', 'Role', 'Created At']);
      
      // Add data
      filteredUsers.forEach(user => {
        worksheet.addRow([
          user.name,
          user.email,
          user.department,
          user.section,
          user.year,
          user.role,
          user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A'
        ]);
      });
      
      // Style headers
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      });
      
      // Auto fit columns
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength;
      });
      
      // Generate and download
      workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      });
      
      showNotification('Users exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting users:', error);
      showNotification('Failed to export users', 'error');
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="header-content">
          <h1>Admin Dashboard</h1>
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>
      
      <div className="admin-tabs">
        <button 
          className={activeTab === 'upload' ? 'active' : ''}
          onClick={() => setActiveTab('upload')}
        >
          Upload Data
        </button>
        <button 
          className={activeTab === 'manage' ? 'active' : ''}
          onClick={() => setActiveTab('manage')}
        >
          Manage Users
        </button>
      </div>
      
      <div className="admin-content">
        {activeTab === 'upload' && (
          <div className="upload-section">
            <div className="upload-card">
              <div className="upload-card-header">
                <h2>Upload Student Data</h2>
                <button 
                  className="download-template-btn"
                  onClick={() => downloadTemplate('students')}
                  disabled={uploading}
                >
                  Download Template
                </button>
              </div>
              <p>Upload an Excel file with student details</p>
              
              <div className="file-input-container">
                <input 
                  type="file" 
                  id="student-file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileUpload(e, 'students')}
                  disabled={uploading}
                  className="file-input"
                />
                <label htmlFor="student-file" className="file-input-label">
                  {uploading ? 'Processing...' : 'Choose Excel File'}
                </label>
              </div>
              
              {renderUploadStatus('students')}
              
              <div className="upload-guide">
                <h4>Excel Format Requirements:</h4>
                <ul>
                  <li><strong>Columns must include:</strong> Name, Email, Department, Section, Year, Password</li>
                  <li><strong>Optional:</strong> Password_Set (TRUE/FALSE)</li>
                  <li>First row must contain headers</li>
                  <li>File format: .xlsx or .xls</li>
                  <li>Max file size: 10MB</li>
                </ul>
              </div>
            </div>
            
            <div className="upload-card">
              <div className="upload-card-header">
                <h2>Upload Teacher Data</h2>
                <button 
                  className="download-template-btn"
                  onClick={() => downloadTemplate('teachers')}
                  disabled={uploading}
                >
                  Download Template
                </button>
              </div>
              <p>Upload an Excel file with teacher details</p>
              
              <div className="file-input-container">
                <input 
                  type="file" 
                  id="teacher-file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileUpload(e, 'teachers')}
                  disabled={uploading}
                  className="file-input"
                />
                <label htmlFor="teacher-file" className="file-input-label">
                  {uploading ? 'Processing...' : 'Choose Excel File'}
                </label>
              </div>
              
              {renderUploadStatus('teachers')}
              
              <div className="upload-guide">
                <h4>Excel Format Requirements:</h4>
                <ul>
                  <li><strong>Columns must include:</strong> Name, Email, Department, Section, Year, Password</li>
                  <li><strong>Optional:</strong> Password_Set (TRUE/FALSE)</li>
                  <li>First row must contain headers</li>
                  <li>File format: .xlsx or .xls</li>
                  <li>Max file size: 10MB</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'manage' && (
          <div className="manage-section">
            <h2>User Management</h2>
            
            <div className="management-actions">
              <button className="action-btn" onClick={fetchUsers}>
                <span>Refresh Users</span>
              </button>
              <button className="action-btn" onClick={exportUsers}>
                <span>Export Data</span>
              </button>
            </div>
            
            <div className="filters-container">
              <div className="filter-group">
                <label htmlFor="role-filter">Filter by Role:</label>
                <select 
                  id="role-filter" 
                  value={filterRole} 
                  onChange={(e) => setFilterRole(e.target.value)}
                >
                  <option value="all">All Users</option>
                  <option value="student">Students</option>
                  <option value="teacher">Teachers</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label htmlFor="search-input">Search:</label>
                <input 
                  id="search-input"
                  type="text" 
                  placeholder="Search by name, email, or department" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {loadingUsers ? (
              <LoadingSpinner text="Loading users..." />
            ) : (
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Section</th>
                      <th>Year</th>
                      <th>Role</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="no-users">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(user => (
                        <tr key={user.id}>
                          {editingUser === user.id ? (
                            <>
                              <td>
                                <input 
                                  type="text" 
                                  value={editForm.name}
                                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                />
                              </td>
                              <td>{user.email}</td>
                              <td>
                                <input 
                                  type="text" 
                                  value={editForm.department}
                                  onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" 
                                  value={editForm.section}
                                  onChange={(e) => setEditForm({...editForm, section: e.target.value})}
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" 
                                  value={editForm.year}
                                  onChange={(e) => setEditForm({...editForm, year: e.target.value})}
                                />
                              </td>
                              <td>
                                <select 
                                  value={editForm.role}
                                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                                >
                                  <option value="student">Student</option>
                                  <option value="teacher">Teacher</option>
                                </select>
                              </td>
                              <td>
                                {user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A'}
                              </td>
                              <td>
                                <button className="action-btn save" onClick={saveEdit}>
                                  Save
                                </button>
                                <button className="action-btn cancel" onClick={cancelEdit}>
                                  Cancel
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{user.name}</td>
                              <td>{user.email}</td>
                              <td>{user.department}</td>
                              <td>{user.section}</td>
                              <td>{user.year}</td>
                              <td>
                                <span className={`role-badge ${user.role}`}>
                                  {user.role}
                                </span>
                              </td>
                              <td>
                                {user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A'}
                              </td>
                              <td>
                                <div className="action-buttons">
                                  <button 
                                    className="action-btn edit"
                                    onClick={() => startEditUser(user)}
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    className="action-btn reset"
                                    onClick={() => resetPassword(user.id, user.email)}
                                  >
                                    Reset Password
                                  </button>
                                  <button 
                                    className="action-btn delete"
                                    onClick={() => deleteUser(user.id, user.email)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;