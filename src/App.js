import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import Login from './components/Login';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import SetPassword from './components/SetPassword';
import LoadingSpinner from './components/LoadingSpinner';
import Notification from './components/Notification';
import './styles/App.css';

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    const checkAdminSession = () => {
      const isAdminAuthenticated = localStorage.getItem('adminAuthenticated');
      const adminEmail = localStorage.getItem('userEmail');
      const adminRole = localStorage.getItem('userRole');
      
      if (isAdminAuthenticated === 'true' && adminEmail === 'admin@odzen.com') {
        setUser({ email: adminEmail });
        setUserRole(adminRole);
        setLoading(false);
        return true;
      }
      return false;
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser);
      
      if (firebaseUser) {
        // Regular Firebase user
        setUser(firebaseUser);
        
        // Get user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.email));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
        }
      } else {
        // No user authenticated, check for admin session
        if (!checkAdminSession()) {
          setUser(null);
          setUserRole(null);
        }
      }
      
      setLoading(false);
    });

    // Also check for admin session on initial load
    checkAdminSession();

    return () => unsubscribe();
  }, []);

  const showNotification = (message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('adminAuthenticated');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userRole');
      localStorage.removeItem('setPasswordEmail');
      setUser(null);
      setUserRole(null);
      showNotification('Logged out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      showNotification('Error logging out', 'error');
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading application..." />;
  }

  return (
    <div className="App">
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={
              !user ? (
                <Login showNotification={showNotification} />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            } 
          />
          <Route 
            path="/set-password" 
            element={
              <SetPassword showNotification={showNotification} />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              user ? (
                user.email === 'admin@odzen.com' || userRole === 'admin' ? (
                  <AdminDashboard 
                    showNotification={showNotification} 
                    onLogout={handleLogout}
                  />
                ) : userRole === 'teacher' ? (
                  <TeacherDashboard 
                    showNotification={showNotification} 
                    onLogout={handleLogout}
                  />
                ) : (
                  <StudentDashboard 
                    showNotification={showNotification} 
                    onLogout={handleLogout}
                  />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/" 
            element={
              <Navigate to={user ? "/dashboard" : "/login"} replace />
            } 
          />
          <Route 
            path="*" 
            element={
              <div className="not-found">
                <h2>404 - Page Not Found</h2>
                <p>The page you're looking for doesn't exist.</p>
                <Navigate to="/" replace />
              </div>
            } 
          />
        </Routes>
      </Router>
      
      {notification.show && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification({ show: false, message: '', type: '' })} 
        />
      )}
    </div>
  );
}

export default App;