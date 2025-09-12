import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase-config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import LoadingSpinner from './LoadingSpinner';
import '../styles/Login.css';
import logo from '../assets/logo.png'; // Import the logo image

const Login = ({ showNotification }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Create a proper admin user in Firebase Auth
  const createAdminSession = async () => {
    try {
      // First, try to sign in with admin credentials to Firebase Auth
      // If admin doesn't exist, we'll create a session manually
      const adminEmail = 'admin@odzen.com';
      const adminPassword = 'admin123';
      
      try {
        // Try to sign in (will work if admin exists in Firebase Auth)
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // Admin doesn't exist in Firebase Auth, so we need to create a session
          // For demo purposes, we'll create a custom token or use a different approach
          // Since we can't create users programmatically without proper backend,
          // we'll use a workaround by storing admin data in Firestore
          // Store admin data in Firestore
          await setDoc(doc(db, 'users', adminEmail), {
            name: 'System Administrator',
            email: adminEmail,
            role: 'admin',
            passwordSet: true,
            createdAt: new Date()
          });
          
          // For immediate redirect, we'll use a different approach
          // Since we can't create auth session without proper backend,
          // we'll use localStorage to track admin login temporarily
          localStorage.setItem('adminAuthenticated', 'true');
          localStorage.setItem('userEmail', adminEmail);
          localStorage.setItem('userRole', 'admin');
          
          // Force reload to trigger auth state change
          window.location.reload();
          return;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error creating admin session:', error);
      throw error;
    }
  };

  const handleLogin = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    if (isAdminLogin) {
      // Admin login logic
      if (email === 'admin@odzen.com' && password === 'admin123') {
       
        
        // Try to login with Firebase Auth
        try {
          await signInWithEmailAndPassword(auth, email, password);
          showNotification('Admin login successful!', 'success');
          navigate('/dashboard', { replace: true });
        } catch (authError) {
          showNotification(authError.message, 'error');
        }
      } else {
        showNotification('Invalid admin credentials', 'error');
      }
    } else {
      // Regular user login
      const userDoc = await getDoc(doc(db, 'users', email));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (userData.passwordSet) {
          // User has already set password, login normally
          try {
            await signInWithEmailAndPassword(auth, email, password);
            showNotification('Login successful!', 'success');
            navigate('/dashboard', { replace: true });
          } catch (authError) {
            if (authError.code === 'auth/invalid-login-credentials') {
              showNotification('Invalid password. Please try again or reset your password.', 'error');
            } else {
              showNotification(authError.message, 'error');
            }
          }
        } else {
          // New user needs to set password
          if (userData.tempPassword === password) {
            // Store email and temp password for SetPassword component
            localStorage.setItem('setPasswordEmail', email);
            localStorage.setItem('setPasswordTempPassword', password);
            
            showNotification('Please set your new password', 'info');
            navigate('/set-password', { 
              state: { email, tempPassword: password } 
            });
          } else {
            showNotification('Invalid temporary password. Please contact administrator.', 'error');
          }
        }
      } else {
        showNotification('User not found. Please contact administrator.', 'error');
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification(error.message, 'error');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
        <img src={logo} alt="Logo" className="logo" />
          <h1>CSE OD Tracking System</h1>
          <p>On Duty Tracking System</p>
        </div>
        
        <div className="login-tabs">
          <button 
            className={!isAdminLogin ? 'active' : ''} 
            onClick={() => setIsAdminLogin(false)}
          >
            Student/Teacher Login
          </button>
          <button 
            className={isAdminLogin ? 'active' : ''} 
            onClick={() => setIsAdminLogin(true)}
          >
            Admin Login
          </button>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={isAdminLogin ? "admin@odzen.com" : "Enter your email"}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={isAdminLogin ? "admin123" : "Enter your password"}
            />
          </div>
          
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? <LoadingSpinner size="small" text="Logging in..." /> : 'Login'}
          </button>
        </form>

        {isAdminLogin && (
          <div className="admin-credentials">
            <p>Demo Admin Credentials:</p>
            <p>Email: admin@odzen.com</p>
            <p>Password: admin123</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;