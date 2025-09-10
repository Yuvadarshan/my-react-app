import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase-config';
import '../styles/TeacherDashboard.css';

// Separate EventCreationForm component to prevent unnecessary re-renders
const EventCreationForm = ({ showNotification, fetchEvents }) => {
  const [eventForm, setEventForm] = useState({
    name: '',
    description: '',
    fromDate: '',
    toDate: '',
    venue: '',
    organizer: ''
  });

  const [loading, setLoading] = useState(false);

  const handleInputChange = useCallback((field, value) => {
    setEventForm(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (!eventForm.name || !eventForm.fromDate || !eventForm.toDate) {
      showNotification('Please fill in all required fields', 'error');
      setLoading(false);
      return;
    }

    if (new Date(eventForm.fromDate) > new Date(eventForm.toDate)) {
      showNotification('End date cannot be before start date', 'error');
      setLoading(false);
      return;
    }

    try {
      const eventData = {
        name: eventForm.name,
        description: eventForm.description,
        venue: eventForm.venue,
        fromDate: new Date(eventForm.fromDate),
        toDate: new Date(eventForm.toDate),
        organizer: eventForm.organizer || auth.currentUser.email,
        createdAt: new Date(),
        createdBy: auth.currentUser.email
      };

      await addDoc(collection(db, 'events'), eventData);
      showNotification('Event created successfully!', 'success');
      
      // Reset form
      setEventForm({
        name: '',
        description: '',
        fromDate: '',
        toDate: '',
        venue: '',
        organizer: ''
      });
      
      fetchEvents(); // Refresh events list
    } catch (error) {
      showNotification('Error creating event: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="event-creation-section">
      <h2>Create New Event</h2>
      <form onSubmit={handleCreateEvent} className="event-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="eventName">Event Name *</label>
            <input
              type="text"
              id="eventName"
              value={eventForm.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              placeholder="Enter event name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="eventOrganizer">Organizer</label>
            <input
              type="text"
              id="eventOrganizer"
              value={eventForm.organizer}
              onChange={(e) => handleInputChange('organizer', e.target.value)}
              placeholder="Enter organizer name"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="eventDescription">Description</label>
          <textarea
            id="eventDescription"
            value={eventForm.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Enter event description"
            rows="3"
          />
        </div>

        <div className="form-group">
          <label htmlFor="eventVenue">Venue</label>
          <input
            type="text"
            id="eventVenue"
            value={eventForm.venue}
            onChange={(e) => handleInputChange('venue', e.target.value)}
            placeholder="Enter event venue"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="eventFromDate">From Date *</label>
            <input
              type="datetime-local"
              id="eventFromDate"
              value={eventForm.fromDate}
              onChange={(e) => handleInputChange('fromDate', e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="eventToDate">To Date *</label>
            <input
              type="datetime-local"
              id="eventToDate"
              value={eventForm.toDate}
              onChange={(e) => handleInputChange('toDate', e.target.value)}
              required
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="create-event-btn"
          disabled={loading}
        >
          {loading ? 'Creating Event...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
};

// Separate EventsList component
const EventsList = ({ events, showNotification, fetchEvents }) => {
  const handleDeleteEvent = async (eventId, eventName) => {
    if (window.confirm(`Are you sure you want to delete the event "${eventName}"? This action cannot be undone.`)) {
      try {
        // Delete the event from Firestore
        await deleteDoc(doc(db, 'events', eventId));
        showNotification('Event deleted successfully!', 'success');
        fetchEvents(); // Refresh the events list
      } catch (error) {
        console.error('Error deleting event:', error);
        if (error.code === 'permission-denied') {
          showNotification('You do not have permission to delete events. Please check your security rules.', 'error');
        } else {
          showNotification('Error deleting event: ' + error.message, 'error');
        }
      }
    }
  };

  return (
    <div className="events-list-section">
      <h2>Existing Events ({events.length})</h2>
      <div className="events-grid">
        {events.length === 0 ? (
          <p className="no-events">No events found. Create your first event!</p>
        ) : (
          events.map(event => (
            <div key={event.id} className="event-card">
              <h3>{event.name}</h3>
              {event.description && <p className="event-description">{event.description}</p>}
              {event.venue && <p className="event-venue"><strong>Venue:</strong> {event.venue}</p>}
              {event.organizer && <p className="event-organizer"><strong>Organizer:</strong> {event.organizer}</p>}
              <div className="event-dates">
                <div className="event-date">
                  <strong>From:</strong> {event.fromDate?.toLocaleString()}
                </div>
                <div className="event-date">
                  <strong>To:</strong> {event.toDate?.toLocaleString()}
                </div>
              </div>
              <div className="event-meta">
                <small>Created by: {event.createdBy || 'Unknown'}</small>
                <small>Created at: {event.createdAt?.toDate().toLocaleString()}</small>
              </div>
              <button 
                onClick={() => handleDeleteEvent(event.id, event.name)}
                className="delete-event-btn"
                title="Delete Event"
              >
                🗑️ Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Separate ViewAttachment component
const ViewAttachment = ({ request }) => {
  const [showModal, setShowModal] = useState(false);

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  const renderAttachment = () => {
    if (!request.documentBase64) return null;
    
    if (request.documentType?.includes('image')) {
      return <img src={request.documentBase64} alt="OD Attachment" className="attachment-image" />;
    } else if (request.documentType?.includes('pdf')) {
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

// Separate AttendanceView component
const AttendanceView = ({ attendance, filters, students, showNotification, updateStudentAttendance, markAllAttendance, setFilters }) => {
  const filteredAttendance = attendance.filter(record =>
    (!filters.department || record.studentDepartment === filters.department) &&
    (!filters.section || record.studentSection === filters.section)
  );

  return (
    <div className="attendance-view">
      <div className="attendance-header">
        <h3>Attendance for {new Date(filters.date).toLocaleDateString()}</h3>
        <div className="attendance-controls">
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters(prev => ({...prev, date: e.target.value}))}
            className="date-filter"
          />
          <div className="bulk-actions">
            <button onClick={() => markAllAttendance('present')} className="bulk-btn present">
              Mark All Present
            </button>
            <button onClick={() => markAllAttendance('absent')} className="bulk-btn absent">
              Mark All Absent
            </button>
          </div>
        </div>
      </div>

      <div className="attendance-list">
        {filteredAttendance.length === 0 ? (
          <p className="no-attendance">No attendance records found for selected date.</p>
        ) : (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Department</th>
                <th>Section</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.map((record) => (
                <tr key={record.id}>
                  <td>{record.studentName}</td>
                  <td>{record.studentDepartment}</td>
                  <td>{record.studentSection}</td>
                  <td>
                    <span className={`status-badge ${record.status}`}>
                      {record.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div className="attendance-actions">
                      <button
                        onClick={() => updateStudentAttendance(record.id, 'present')}
                        className={`action-btn ${record.status === 'present' ? 'active' : ''}`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => updateStudentAttendance(record.id, 'absent')}
                        className={`action-btn ${record.status === 'absent' ? 'active' : ''}`}
                      >
                        Absent
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="attendance-stats">
        <h4>Attendance Statistics</h4>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-number">{filteredAttendance.length}</span>
            <span className="stat-label">Total Students</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {filteredAttendance.filter(a => a.status === 'present').length}
            </span>
            <span className="stat-label">Present</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {filteredAttendance.filter(a => a.status === 'absent').length}
            </span>
            <span className="stat-label">Absent</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {filteredAttendance.length > 0 
                ? Math.round((filteredAttendance.filter(a => a.status === 'present').length / filteredAttendance.length) * 100)
                : 0
              }%
            </span>
            <span className="stat-label">Attendance %</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main TeacherDashboard component
const TeacherDashboard = ({ showNotification, onLogout }) => {
  const [activeTab, setActiveTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [odRequests, setOdRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [filters, setFilters] = useState({
    department: '',
    section: '',
    year: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Memoize fetch functions to prevent unnecessary re-renders
  const fetchEvents = useCallback(async () => {
    try {
      const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const eventsData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        fromDate: doc.data().fromDate?.toDate(),
        toDate: doc.data().toDate?.toDate()
      }));
      setEvents(eventsData);
    } catch (error) {
      showNotification('Error fetching events: ' + error.message, 'error');
    }
  }, [showNotification]);

  const fetchOdRequests = useCallback(async () => {
    try {
      const q = query(collection(db, 'odRequests'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const requestsData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        fromDate: doc.data().fromDate?.toDate(),
        toDate: doc.data().toDate?.toDate()
      }));
      setOdRequests(requestsData);
    } catch (error) {
      showNotification('Error fetching OD requests: ' + error.message, 'error');
    }
  }, [showNotification]);

  const fetchStudents = useCallback(async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const querySnapshot = await getDocs(q);
      const studentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsData);
    } catch (error) {
      showNotification('Error fetching students: ' + error.message, 'error');
    }
  }, [showNotification]);

  const fetchAttendance = useCallback(async () => {
    try {
      let q;
      if (filters.date) {
        q = query(
          collection(db, 'attendance'),
          where('date', '==', filters.date),
          orderBy('studentName')
        );
      } else {
        q = query(collection(db, 'attendance'), orderBy('date', 'desc'));
      }
      
      const querySnapshot = await getDocs(q);
      const attendanceData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttendance(attendanceData);
    } catch (error) {
      showNotification('Error fetching attendance: ' + error.message, 'error');
    }
  }, [filters.date, showNotification]);

  const updateStudentAttendance = useCallback(async (attendanceId, status) => {
    try {
      await updateDoc(doc(db, 'attendance', attendanceId), {
        status: status,
        updatedAt: new Date(),
        updatedBy: auth.currentUser.email
      });
      showNotification('Attendance updated successfully!', 'success');
      fetchAttendance(); // Refresh attendance data
    } catch (error) {
      showNotification('Error updating attendance: ' + error.message, 'error');
    }
  }, [showNotification, fetchAttendance]);

  const markAllAttendance = useCallback(async (status) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const studentsToMark = students.filter(student => 
        (!filters.department || student.department === filters.department) &&
        (!filters.section || student.section === filters.section) &&
        (!filters.year || student.year === filters.year)
      );

      for (const student of studentsToMark) {
        // Check if attendance already exists for today
        const existingAttendanceQuery = query(
          collection(db, 'attendance'),
          where('studentEmail', '==', student.email),
          where('date', '==', today)
        );
        const existingAttendance = await getDocs(existingAttendanceQuery);

        if (existingAttendance.empty) {
          // Create new attendance record
          await addDoc(collection(db, 'attendance'), {
            studentName: student.name,
            studentEmail: student.email,
            studentDepartment: student.department,
            studentSection: student.section,
            date: today,
            status: status,
            createdAt: new Date(),
            updatedAt: new Date(),
            markedBy: auth.currentUser.email
          });
        }
      }

      showNotification(`Marked all students as ${status} for today!`, 'success');
      fetchAttendance();
    } catch (error) {
      showNotification('Error marking attendance: ' + error.message, 'error');
    }
  }, [students, filters, showNotification, fetchAttendance]);

  const handleApproveRequest = useCallback(async (requestId) => {
    try {
      await updateDoc(doc(db, 'odRequests', requestId), {
        status: 'approved',
        approvedBy: auth.currentUser.email,
        approvedAt: new Date()
      });
      showNotification('OD request approved!', 'success');
      fetchOdRequests();
    } catch (error) {
      showNotification('Error approving request: ' + error.message, 'error');
    }
  }, [showNotification, fetchOdRequests]);

  const handleRejectRequest = useCallback(async (requestId) => {
    try {
      await updateDoc(doc(db, 'odRequests', requestId), {
        status: 'rejected',
        approvedBy: auth.currentUser.email,
        approvedAt: new Date()
      });
      showNotification('OD request rejected!', 'success');
      fetchOdRequests();
    } catch (error) {
      showNotification('Error rejecting request: ' + error.message, 'error');
    }
  }, [showNotification, fetchOdRequests]);

  useEffect(() => {
    fetchEvents();
    fetchOdRequests();
    fetchStudents();
    if (activeTab === 'attendance') {
      fetchAttendance();
    }
  }, [activeTab, filters.date, fetchEvents, fetchOdRequests, fetchStudents, fetchAttendance]);

  const filteredStudents = students.filter(student => {
    return (
      (filters.department ? student.department === filters.department : true) &&
      (filters.section ? student.section === filters.section : true) &&
      (filters.year ? student.year === filters.year : true)
    );
  });

  return (
    <div className="teacher-dashboard">
      <header className="teacher-header">
        <div className="header-content">
          <h1>Teacher Dashboard</h1>
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>
      
      <div className="teacher-tabs">
        <button 
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
        <button 
          className={activeTab === 'requests' ? 'active' : ''}
          onClick={() => setActiveTab('requests')}
        >
          OD Requests
        </button>
        <button 
          className={activeTab === 'students' ? 'active' : ''}
          onClick={() => setActiveTab('students')}
        >
          Students
        </button>
        <button 
          className={activeTab === 'attendance' ? 'active' : ''}
          onClick={() => setActiveTab('attendance')}
        >
          Attendance
        </button>
      </div>
      
      <div className="teacher-content">
        {activeTab === 'events' && (
          <div className="events-section">
            <EventCreationForm 
              showNotification={showNotification} 
              fetchEvents={fetchEvents} 
            />
            <EventsList 
              events={events} 
              showNotification={showNotification} 
            />
          </div>
        )}
        
        {activeTab === 'requests' && (
          <div className="requests-section">
            <h2>OD Requests</h2>
            <div className="requests-list">
              {odRequests.map(request => (
                <div key={request.id} className="request-card">
                  <h3>{request.studentName}</h3>
                  <p>Department: {request.studentDepartment}</p>
                  <p>Section: {request.studentSection}</p>
                  <p>From: {request.fromDate?.toLocaleDateString()}</p>
                  <p>To: {request.toDate?.toLocaleDateString()}</p>
                  <p>Status: <span className={`status ${request.status}`}>{request.status}</span></p>
                  
                  {request.documentBase64 && (
                    <ViewAttachment request={request} />
                  )}
                  
                  {request.status === 'pending' && (
                    <div className="action-buttons">
                      <button 
                        onClick={() => handleApproveRequest(request.id)}
                        className="approve-btn"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleRejectRequest(request.id)}
                        className="reject-btn"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'students' && (
          <div className="students-section">
            <h2>Student Management</h2>
            
            <div className="filters">
              <select 
                value={filters.department} 
                onChange={(e) => setFilters(prev => ({...prev, department: e.target.value}))}
              >
                <option value="">All Departments</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="MECH">MECH</option>
              </select>
              
              <select 
                value={filters.section} 
                onChange={(e) => setFilters(prev => ({...prev, section: e.target.value}))}
              >
                <option value="">All Sections</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
              
              <select 
                value={filters.year} 
                onChange={(e) => setFilters(prev => ({...prev, year: e.target.value}))}
              >
                <option value="">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
            
            <div className="students-list">
              {filteredStudents.map(student => (
                <div key={student.id} className="student-card">
                  <h3>{student.name}</h3>
                  <p>Email: {student.email}</p>
                  <p>Department: {student.department}</p>
                  <p>Section: {student.section}</p>
                  <p>Year: {student.year}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="attendance-section">
            <h2>Attendance Management</h2>
            <div className="attendance-filters">
              <select 
                value={filters.department} 
                onChange={(e) => setFilters(prev => ({...prev, department: e.target.value}))}
              >
                <option value="">All Departments</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="MECH">MECH</option>
              </select>
              
              <select 
                value={filters.section} 
                onChange={(e) => setFilters(prev => ({...prev, section: e.target.value}))}
              >
                <option value="">All Sections</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
            <AttendanceView 
              attendance={attendance}
              filters={filters}
              students={students}
              showNotification={showNotification}
              updateStudentAttendance={updateStudentAttendance}
              markAllAttendance={markAllAttendance}
              setFilters={setFilters}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;