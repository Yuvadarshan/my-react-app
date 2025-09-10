import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/StudentDashboard.css';

const StudentDashboard = ({ showNotification, onLogout }) => {
  const [activeTab, setActiveTab] = useState('odRequest');
  const [events, setEvents] = useState([]);
  const [odRequests, setOdRequests] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [documentFile, setDocumentFile] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
    fetchOdRequests();
    if (activeTab === 'attendance') {
      fetchAttendance();
    }
  }, [activeTab]);

  const fetchEvents = async () => {
    try {
      const q = query(collection(db, 'events'));
      const querySnapshot = await getDocs(q);
      const eventsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsData);
    } catch (error) {
      showNotification('Error fetching events: ' + error.message, 'error');
    }
  };

  const fetchOdRequests = async () => {
    try {
      const user = auth.currentUser;
      const q = query(collection(db, 'odRequests'), where('studentEmail', '==', user.email));
      const querySnapshot = await getDocs(q);
      const requestsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOdRequests(requestsData);
    } catch (error) {
      showNotification('Error fetching OD requests: ' + error.message, 'error');
    }
  };

  const fetchAttendance = async () => {
    try {
      const user = auth.currentUser;
      const q = query(collection(db, 'attendance'), where('studentEmail', '==', user.email));
      const querySnapshot = await getDocs(q);
      const attendanceData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttendance(attendanceData);
    } catch (error) {
      showNotification('Error fetching attendance: ' + error.message, 'error');
    }
  };

  const markAttendance = async (date, status) => {
    try {
      const user = auth.currentUser;
      const userDoc = await getDoc(doc(db, 'users', user.email));
      const userData = userDoc.data();

      // Check if attendance already exists for this date
      const existingAttendanceQuery = query(
        collection(db, 'attendance'),
        where('studentEmail', '==', user.email),
        where('date', '==', date)
      );
      const existingAttendance = await getDocs(existingAttendanceQuery);

      if (!existingAttendance.empty) {
        // Update existing attendance
        const attendanceDoc = existingAttendance.docs[0];
        await updateDoc(doc(db, 'attendance', attendanceDoc.id), {
          status: status,
          updatedAt: new Date()
        });
        showNotification('Attendance updated successfully!', 'success');
      } else {
        // Create new attendance record
        await addDoc(collection(db, 'attendance'), {
          studentName: userData.name,
          studentEmail: user.email,
          studentDepartment: userData.department,
          studentSection: userData.section,
          date: date,
          status: status,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        showNotification('Attendance marked successfully!', 'success');
      }

      fetchAttendance(); // Refresh attendance list
    } catch (error) {
      showNotification('Error marking attendance: ' + error.message, 'error');
    }
  };

  const getCurrentWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1)); // Adjust to Monday
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      weekDates.push(date.toISOString().split('T')[0]);
    }
    return weekDates;
  };

  const getStatusForDate = (date) => {
    const attendanceForDate = attendance.find(a => a.date === date);
    return attendanceForDate ? attendanceForDate.status : null;
  };

  const isFutureDate = (date) => {
    const today = new Date().toISOString().split('T')[0];
    return date > today;
  };

  const AttendanceCalendar = () => {
    const weekDates = getCurrentWeekDates();
    
    return (
      <div className="attendance-calendar">
        <h3>This Week's Attendance</h3>
        <div className="calendar-grid">
          {weekDates.map((date, index) => {
            const status = getStatusForDate(date);
            const isFuture = isFutureDate(date);
            
            return (
              <div key={index} className={`calendar-day ${status} ${isFuture ? 'future' : ''}`}>
                <div className="date">{new Date(date).getDate()}</div>
                <div className="day">{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                {!isFuture && (
                  <div className="attendance-actions">
                    {status ? (
                      <span className={`status-badge ${status}`}>
                        {status.toUpperCase()}
                      </span>
                    ) : (
                      <>
                        <button 
                          onClick={() => markAttendance(date, 'present')}
                          className="attendance-btn present"
                        >
                          Present
                        </button>
                        <button 
                          onClick={() => markAttendance(date, 'absent')}
                          className="attendance-btn absent"
                        >
                          Absent
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const AttendanceHistory = () => {
    return (
      <div className="attendance-history">
        <h3>Attendance History</h3>
        <div className="attendance-list">
          {attendance.length === 0 ? (
            <p className="no-attendance">No attendance records found.</p>
          ) : (
            attendance.map((record) => (
              <div key={record.id} className="attendance-record">
                <div className="attendance-date">
                  {new Date(record.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                <div className={`attendance-status ${record.status}`}>
                  {record.status.toUpperCase()}
                </div>
                <div className="attendance-time">
                  Marked at: {new Date(record.updatedAt?.toDate()).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };


  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('File size should be less than 5MB', 'error');
      return;
    }
    
    setDocumentFile(file);
    
    try {
      const base64 = await convertToBase64(file);
      setDocumentPreview(base64);
    } catch (error) {
      showNotification('Error processing file: ' + error.message, 'error');
    }
  };

  const handleOdSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let documentBase64 = '';
      if (documentFile) {
        documentBase64 = await convertToBase64(documentFile);
      }
      
      // Create OD request
      const user = auth.currentUser;
      const userDoc = await getDoc(doc(db, 'users', user.email));
      const userData = userDoc.data();
      
      await addDoc(collection(db, 'odRequests'), {
        studentName: userData.name,
        studentEmail: user.email,
        studentDepartment: userData.department,
        studentSection: userData.section,
        eventId: selectedEvent,
        eventName: events.find(e => e.id === selectedEvent)?.name || 'Unknown Event',
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        documentBase64,
        documentName: documentFile ? documentFile.name : '',
        documentType: documentFile ? documentFile.type : '',
        status: 'pending',
        createdAt: new Date()
      });
      
      showNotification('OD request submitted successfully!', 'success');
      setFromDate('');
      setToDate('');
      setDocumentFile(null);
      setDocumentPreview(null);
      setSelectedEvent(null);
      fetchOdRequests();
    } catch (error) {
      showNotification('Error submitting OD request: ' + error.message, 'error');
    }
  };

  const ViewAttachment = ({ request }) => {
    const [showModal, setShowModal] = useState(false);

    const openModal = () => setShowModal(true);
    const closeModal = () => setShowModal(false);

    const renderAttachment = () => {
      if (!request.documentBase64) return null;
      
      if (request.documentType.includes('image')) {
        return <img src={request.documentBase64} alt="OD Attachment" className="attachment-image" />;
      } else if (request.documentType.includes('pdf')) {
        return (
          <embed 
            src={request.documentBase64} 
            type="application/pdf" 
            width="100%" 
            height="600px" 
          />
        );
      } else {
        return (
          <div className="generic-attachment">
            <p>Document: {request.documentName}</p>
            <a 
              href={request.documentBase64} 
              download={request.documentName}
              className="download-btn"
            >
              Download Attachment
            </a>
          </div>
        );
      }
    };

    return (
      <>
        <button onClick={openModal} className="view-attachment-btn">
          View Attachment
        </button>
        
        {showModal && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>OD Attachment</h3>
                <button className="close-btn" onClick={closeModal}>×</button>
              </div>
              <div className="modal-body">
                {renderAttachment()}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="student-dashboard">
      <header className="student-header">
        <div className="header-content">
          <h1>Student Dashboard</h1>
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>
      
      <div className="student-tabs">
        <button 
          className={activeTab === 'odRequest' ? 'active' : ''}
          onClick={() => setActiveTab('odRequest')}
        >
          OD Request
        </button>
        <button 
          className={activeTab === 'attendance' ? 'active' : ''}
          onClick={() => setActiveTab('attendance')}
        >
          Attendance
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          My Requests
        </button>
      </div>
      
      <div className="student-content">
        {activeTab === 'odRequest' && (
          <div className="od-request-section">
            <h2>Create OD Request</h2>
            <form onSubmit={handleOdSubmit} className="od-form">
              <div className="form-group">
                <label>Select Event</label>
                <select
                  value={selectedEvent || ''}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  required
                >
                  <option value="">Select an event</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {event.organizer}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>To Date</label>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Upload Supporting Document (PDF or Image, max 5MB)</label>
                <input 
                  type="file" 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
                {documentPreview && (
                  <div className="file-preview">
                    <p>File selected: {documentFile.name}</p>
                    {documentFile.type.includes('image') && (
                      <img src={documentPreview} alt="Preview" className="thumbnail" />
                    )}
                  </div>
                )}
              </div>
              
              <button type="submit" className="submit-btn">Submit Request</button>
            </form>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="attendance-section">
            <h2>Attendance Management</h2>
            <AttendanceCalendar />
            <AttendanceHistory />
          </div>
        )}
        
        {activeTab === 'history' && (
          <div className="history-section">
            <h2>My OD Requests</h2>
            <div className="requests-list">
              {odRequests.map(request => (
                <div key={request.id} className="request-card">
                  <h3>{request.eventName}</h3>
                  <p>From: {request.fromDate?.toDate().toLocaleDateString()}</p>
                  <p>To: {request.toDate?.toDate().toLocaleDateString()}</p>
                  <p>Status: <span className={`status ${request.status}`}>{request.status}</span></p>
                  
                  {request.documentBase64 && (
                    <ViewAttachment request={request} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;