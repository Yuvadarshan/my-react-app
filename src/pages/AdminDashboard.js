import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import LoadingSpinner from '../components/LoadingSpinner';
import Notification from '../components/Notification';
import '../styles/AdminDashboard.css';

const AdminDashboard = ({ showNotification, onLogout }) => {
  const [activeTab, setActiveTab] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({});

  // Normalize column names to handle different formats
  const normalizeColumnName = (name) => {
    if (!name) return '';
    return name.toString().toLowerCase().trim().replace(/\s+/g, '_');
  };

  

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
            name: item.name,
            email: item.email.toLowerCase(),
            department: item.department,
            section: item.section,
            year: item.year,
            tempPassword: item.password,
            passwordSet: item.password_set === true || item.password_set === 'true' || item.password_set === 'TRUE',
            role: type === 'students' ? 'student' : 'teacher', // Make sure this is set
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
              <button className="action-btn">
                <span>View All Users</span>
              </button>
              <button className="action-btn">
                <span>Reset Passwords</span>
              </button>
              <button className="action-btn">
                <span>Export Data</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;