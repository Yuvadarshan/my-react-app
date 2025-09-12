// TeacherDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  orderBy,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase-config';
import '../styles/TeacherDashboard.css';

// ---------------- EventCreationForm ----------------
const EventCreationForm = ({ showNotification, fetchEvents }) => {
  const [eventForm, setEventForm] = useState({
    name: '',
    description: '',
    fromDate: '',
    toDate: '',
    venue: '',
    organizer: '',
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field, value) => {
    setEventForm(prev => ({ ...prev, [field]: value }));
  };

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
        createdBy: auth.currentUser.email,
      };

      await addDoc(collection(db, 'events'), eventData);
      showNotification('Event created successfully!', 'success');

      setEventForm({
        name: '',
        description: '',
        fromDate: '',
        toDate: '',
        venue: '',
        organizer: '',
      });

      fetchEvents();
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

        <button type="submit" className="create-event-btn" disabled={loading}>
          {loading ? 'Creating Event...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
};

// ---------------- EventsList ----------------
const EventsList = ({ events, showNotification, fetchEvents }) => {
  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      // Deleting documents requires security rules in Firestore. If allowed:
      // await deleteDoc(doc(db, 'events', eventId));
      showNotification('Delete event is a protected operation. Implement server-side or set proper security rules.', 'info');
      // fetchEvents(); // refresh after deletion
    } catch (error) {
      showNotification('Error deleting event: ' + error.message, 'error');
    }
  };

  return (
    <div className="events-list-section">
      <h2>Existing Events</h2>
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
                  <strong>From:</strong> {event.fromDate ? (event.fromDate instanceof Date ? event.fromDate.toLocaleString() : new Date(event.fromDate.seconds * 1000).toLocaleString()) : '-'}
                </div>
                <div className="event-date">
                  <strong>To:</strong> {event.toDate ? (event.toDate instanceof Date ? event.toDate.toLocaleString() : new Date(event.toDate.seconds * 1000).toLocaleString()) : '-'}
                </div>
              </div>
              <button
                onClick={() => handleDeleteEvent(event.id)}
                className="delete-event-btn"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ---------------- ViewAttachment ----------------
const ViewAttachment = ({ request }) => {
  const [showModal, setShowModal] = useState(false);

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  const renderAttachment = () => {
    if (!request.documentBase64) return <p>No attachment</p>;

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
          <p>Document: {request.documentName || 'attachment'}</p>
          <a
            href={request.documentBase64}
            download={request.documentName || 'attachment'}
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
      <button onClick={openModal} className="view-attachment-btn">View Attachment</button>

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

// ---------------- AttendanceView ----------------
const AttendanceView = ({ attendance, filters, students, showNotification, updateStudentAttendance, markAllAttendance, setFilters, teacherDepartment, teacherSection, events, odRequests }) => {
  // Only show students matching teacher's department and section
  const filteredAttendance = attendance.filter(record =>
    (!filters.department || record.studentDepartment === filters.department) &&
    (!filters.section || record.studentSection === filters.section) &&
    (teacherDepartment ? record.studentDepartment === teacherDepartment : true) &&
    (teacherSection ? record.studentSection === teacherSection : true)
  );

  // Get event details for each attendance record
  const attendanceWithEventDetails = filteredAttendance.map(record => {
    // Try to find if this attendance is related to an OD request
    const relatedOD = odRequests.find(od => 
      od.studentEmail === record.studentEmail && 
      new Date(record.date).getTime() >= new Date(od.fromDate).getTime() &&
      new Date(record.date).getTime() <= new Date(od.toDate).getTime() &&
      od.status === 'approved'
    );
    
    let eventName = 'Regular Class';
    let eventVenue = 'Classroom';
    
    if (relatedOD) {
      // If we have an eventId in the OD request, use it to find the event
      if (relatedOD.eventId) {
        const event = events.find(e => e.id === relatedOD.eventId);
        if (event) {
          eventName = event.name;
          eventVenue = event.venue || 'Event Venue';
        } else if (relatedOD.eventName) {
          eventName = relatedOD.eventName;
          eventVenue = 'Event Venue';
        }
      } 
      // If no eventId but we have eventName in OD request
      else if (relatedOD.eventName) {
        eventName = relatedOD.eventName;
        
        // Try to find the event by name
        const event = events.find(e => e.name === relatedOD.eventName);
        if (event) {
          eventVenue = event.venue || 'Event Venue';
        } else {
          eventVenue = 'Event Venue';
        }
      }
    }
    
    return {
      ...record,
      eventName,
      eventVenue
    };
  });

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
        {attendanceWithEventDetails.length === 0 ? (
          <p className="no-attendance">No attendance records found for selected date.</p>
        ) : (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Department</th>
                <th>Section</th>
                <th>Year</th>
                <th>Event</th>
                <th>Venue</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendanceWithEventDetails.map((record) => (
                <tr key={record.id}>
                  <td>{record.studentName}</td>
                  <td>{record.studentDepartment}</td>
                  <td>{record.studentSection}</td>
                  <td>{record.studentYear || 'N/A'}</td>
                  <td>{record.eventName}</td>
                  <td>{record.eventVenue}</td>
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
            <span className="stat-number">{attendanceWithEventDetails.length}</span>
            <span className="stat-label">Total Students</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {attendanceWithEventDetails.filter(a => a.status === 'present').length}
            </span>
            <span className="stat-label">Present</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {attendanceWithEventDetails.filter(a => a.status === 'absent').length}
            </span>
            <span className="stat-label">Absent</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {attendanceWithEventDetails.length > 0 
                ? Math.round((attendanceWithEventDetails.filter(a => a.status === 'present').length / attendanceWithEventDetails.length) * 100)
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

// ---------------- TeacherDashboard (main) ----------------
const TeacherDashboard = ({ showNotification, onLogout }) => {
  const [activeTab, setActiveTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [odRequests, setOdRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [rawAttendance, setRawAttendance] = useState([]); // raw data from Firestore
  const [attendance, setAttendance] = useState([]); // enriched attendance
  const [filters, setFilters] = useState({
    department: '',
    section: '',
    year: '',
    date: new Date().toISOString().split('T')[0],
    eventName: '',
  });
  const [teacherDepartment, setTeacherDepartment] = useState('');
  const [teacherSection, setTeacherSection] = useState('');

  // Fetch teacher profile
  useEffect(() => {
    const fetchTeacherProfile = async () => {
      try {
        const email = auth.currentUser?.email;
        if (!email) return;
        const userDoc = await getDoc(doc(db, 'users', email));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setTeacherDepartment(data.department || '');
          setTeacherSection(data.section || '');
        }
      } catch (error) {
        showNotification('Error fetching teacher profile: ' + error.message, 'error');
      }
    };
    fetchTeacherProfile();
  }, [showNotification]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const eventsData = querySnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          fromDate: data.fromDate?.toDate ? data.fromDate.toDate() : data.fromDate,
          toDate: data.toDate?.toDate ? data.toDate.toDate() : data.toDate,
        };
      });
      setEvents(eventsData);
    } catch (error) {
      showNotification('Error fetching events: ' + error.message, 'error');
    }
  }, [showNotification]);

  // Fetch OD requests
  const fetchOdRequests = useCallback(async () => {
    try {
      const q = query(collection(db, 'odRequests'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const requestsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fromDate: data.fromDate?.toDate ? data.fromDate.toDate() : data.fromDate,
          toDate: data.toDate?.toDate ? data.toDate.toDate() : data.toDate,
        };
      });
      setOdRequests(requestsData);
    } catch (error) {
      showNotification('Error fetching OD requests: ' + error.message, 'error');
    }
  }, [showNotification]);

  // Fetch students
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

  // Fetch raw attendance (without enrichment)
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
      setRawAttendance(attendanceData);
    } catch (error) {
      showNotification('Error fetching attendance: ' + error.message, 'error');
    }
  }, [filters.date, showNotification]);

  // Enrich rawAttendance with student.year and event.venue/name
  useEffect(() => {
    const enriched = rawAttendance.map(record => {
      const student = students.find(s =>
        s.email === record.studentEmail || s.id === record.studentId
      );

      const event = events.find(e => e.id === record.eventId);

      return {
        ...record,
        studentYear: student?.year ?? '-',
        eventName: event?.name ?? record.eventName ?? '-',
        eventVenue: event?.venue ?? record.eventVenue ?? '-',
      };
    });
    setAttendance(enriched);
  }, [rawAttendance, students, events]);

  // updateStudentAttendance
  const updateStudentAttendance = useCallback(async (attendanceId, status) => {
    try {
      await updateDoc(doc(db, 'attendance', attendanceId), {
        status: status,
        updatedAt: new Date(),
        updatedBy: auth.currentUser.email,
      });
      showNotification('Attendance updated successfully!', 'success');
      fetchAttendance();
    } catch (error) {
      showNotification('Error updating attendance: ' + error.message, 'error');
    }
  }, [fetchAttendance, showNotification]);

  // markAllAttendance (bulk create)
  const markAllAttendance = useCallback(async (status) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const studentsToMark = students.filter(student =>
        (!filters.department || student.department === filters.department) &&
        (!filters.section || student.section === filters.section) &&
        (!filters.year || String(student.year) === String(filters.year))
      );

      const chosenEventName = filters.eventName || '';
      const matchedEvent = events.find(e => e.name === chosenEventName);

      for (const student of studentsToMark) {
        // check if exists
        const existingAttendanceQuery = query(
          collection(db, 'attendance'),
          where('studentEmail', '==', student.email),
          where('date', '==', today)
        );
        const existingAttendance = await getDocs(existingAttendanceQuery);

        if (existingAttendance.empty) {
          await addDoc(collection(db, 'attendance'), {
            studentName: student.name,
            studentEmail: student.email,
            studentDepartment: student.department,
            studentSection: student.section,
            studentId: student.id,
            date: today,
            status: status,
            eventId: matchedEvent?.id || null,   // ✅ Firestore doc ID
            eventName: matchedEvent?.name || '', // ✅ redundancy for faster display
            eventVenue: matchedEvent?.venue || '', // ✅ redundancy
            createdAt: new Date(),
            updatedAt: new Date(),
            markedBy: auth.currentUser.email,
          });
        }
      }

      showNotification(`Marked all students as ${status} for ${today}!`, 'success');
      fetchAttendance();
    } catch (error) {
      showNotification('Error marking attendance: ' + error.message, 'error');
    }
  }, [students, filters, events, fetchAttendance, showNotification]);

  // Approve / Reject OD requests
  const handleApproveRequest = useCallback(async (requestId) => {
    try {
      await updateDoc(doc(db, 'odRequests', requestId), {
        status: 'approved',
        approvedBy: auth.currentUser.email,
        approvedAt: new Date(),
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
        approvedAt: new Date(),
      });
      showNotification('OD request rejected!', 'success');
      fetchOdRequests();
    } catch (error) {
      showNotification('Error rejecting request: ' + error.message, 'error');
    }
  }, [showNotification, fetchOdRequests]);

  // Initial / dependent fetches
  useEffect(() => {
    fetchEvents();
    fetchOdRequests();
    fetchStudents();
  }, [fetchEvents, fetchOdRequests, fetchStudents]);

  // fetch attendance when tab active or date changed
  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendance();
    }
  }, [activeTab, filters.date, fetchAttendance]);

  // filtered students for Students tab (only those with active OD)
  const filteredStudents = students.filter(student => {
    const matchesDept = teacherDepartment ? student.department === teacherDepartment : true;
    const matchesSection = teacherSection ? student.section === teacherSection : true;
    const matchesFilterDept = filters.department ? student.department === filters.department : true;
    const matchesFilterSection = filters.section ? student.section === filters.section : true;
    const matchesYear = filters.year ? String(student.year) === String(filters.year) : true;

    const today = new Date();
    const hasCurrentOD = odRequests.some(request => {
      if (request.studentEmail !== student.email) return false;
      if (request.status === 'pending') return true;
      if (request.status === 'approved' && request.toDate) {
        const toDate = request.toDate instanceof Date ? request.toDate : new Date(request.toDate);
        return today <= toDate;
      }
      return false;
    });

    return matchesDept && matchesSection && matchesFilterDept && matchesFilterSection && matchesYear && hasCurrentOD;
  });

  return (
    <div className="teacher-dashboard">
      <header className="teacher-header">
        <div className="header-content">
          <h1>Teacher Dashboard</h1>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="teacher-tabs">
        <button className={activeTab === 'events' ? 'active' : ''} onClick={() => setActiveTab('events')}>Events</button>
        <button className={activeTab === 'requests' ? 'active' : ''} onClick={() => setActiveTab('requests')}>OD Requests</button>
        <button className={activeTab === 'students' ? 'active' : ''} onClick={() => setActiveTab('students')}>Students</button>
        <button className={activeTab === 'attendance' ? 'active' : ''} onClick={() => setActiveTab('attendance')}>Attendance</button>
      </div>

      <div className="teacher-content">
        {activeTab === 'events' && (
          <div className="events-section">
            <EventCreationForm showNotification={showNotification} fetchEvents={fetchEvents} />
            <EventsList events={events} showNotification={showNotification} fetchEvents={fetchEvents} />
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="requests-section">
            <h2>OD Requests</h2>
            <div className="filters">
              <label htmlFor="od-event-filter">Filter by Event:</label>
              <select
                id="od-event-filter"
                value={filters.eventName || ''}
                onChange={e => setFilters(prev => ({ ...prev, eventName: e.target.value }))}
              >
                <option value="">All Events</option>
                {[...new Set(odRequests.map(r => r.eventName).filter(Boolean))].map(eventName => (
                  <option key={eventName} value={eventName}>{eventName}</option>
                ))}
              </select>
            </div>

            <div className="requests-list">
              {odRequests
                .filter(request =>
                  request.studentDepartment === teacherDepartment &&
                  request.studentSection === teacherSection &&
                  request.status === 'pending' &&
                  (!filters.eventName || request.eventName === filters.eventName)
                )
                .map(request => (
                  <div key={request.id} className="request-card">
                    <h3>{request.studentName}</h3>
                    <p>Department: {request.studentDepartment}</p>
                    <p>Section: {request.studentSection}</p>
                    <p>Event: {request.eventName}</p>
                    <p>From: {request.fromDate ? (request.fromDate instanceof Date ? request.fromDate.toLocaleDateString() : new Date(request.fromDate).toLocaleDateString()) : '-'}</p>
                    <p>To: {request.toDate ? (request.toDate instanceof Date ? request.toDate.toLocaleDateString() : new Date(request.toDate).toLocaleDateString()) : '-'}</p>
                    <p>Status: <span className={`status ${request.status}`}>{request.status}</span></p>
                    {request.documentBase64 && <ViewAttachment request={request} />}
                    <div className="action-buttons">
                      <button onClick={() => handleApproveRequest(request.id)} className="approve-btn">Approve</button>
                      <button onClick={() => handleRejectRequest(request.id)} className="reject-btn">Reject</button>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="students-section">
            <h2>Student Management</h2>
            <div className="filters">
              <h3>{teacherDepartment} - {teacherSection}</h3>
              <label htmlFor="student-event-filter">Filter by Event:</label>
              <select
                id="student-event-filter"
                value={filters.eventName || ''}
                onChange={e => setFilters(prev => ({ ...prev, eventName: e.target.value }))}
              >
                <option value="">All Events</option>
                {[...new Set(odRequests.map(r => r.eventName).filter(Boolean))].map(eventName => (
                  <option key={eventName} value={eventName}>{eventName}</option>
                ))}
              </select>
            </div>

            <div className="students-list">
              {filteredStudents.map(student => {
                const currentOD = odRequests.find(request => {
                  if (request.studentEmail !== student.email) return false;
                  if (filters.eventName && request.eventName !== filters.eventName) return false;
                  if (request.status === 'pending') return true;
                  if (request.status === 'approved' && request.toDate) {
                    const today = new Date();
                    const toDate = request.toDate instanceof Date ? request.toDate : new Date(request.toDate);
                    return today <= toDate;
                  }
                  return false;
                });

                return (
                  <div key={student.id} className="student-card">
                    <h3>{student.name}</h3>
                    <p>Email: {student.email}</p>
                    <p>Department: {student.department}</p>
                    <p>Section: {student.section}</p>
                    <p>Year: {student.year}</p>
                    {currentOD && (
                      <>
                        <p>Event: {currentOD.eventName}</p>
                        <p>OD Start: {currentOD.fromDate ? (currentOD.fromDate instanceof Date ? currentOD.fromDate.toLocaleDateString() : new Date(currentOD.fromDate).toLocaleDateString()) : '-'}</p>
                        <p>OD End: {currentOD.toDate ? (currentOD.toDate instanceof Date ? currentOD.toDate.toLocaleDateString() : new Date(currentOD.toDate).toLocaleDateString()) : '-'}</p>
                        {currentOD.documentBase64 && <ViewAttachment request={currentOD} />}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="attendance-section">
            <h2>Attendance Management</h2>
            <div className="attendance-filters">
              <h3>{teacherDepartment} - {teacherSection}</h3>
            </div>
            <AttendanceView
              attendance={attendance}
              filters={filters}
              students={students}
              showNotification={showNotification}
              updateStudentAttendance={updateStudentAttendance}
              markAllAttendance={markAllAttendance}
              setFilters={setFilters}
              teacherDepartment={teacherDepartment}
              teacherSection={teacherSection}
              events={events}
              odRequests={odRequests}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
