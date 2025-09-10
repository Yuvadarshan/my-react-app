import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword, updatePassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';
import LoadingSpinner from './LoadingSpinner';
import { validatePassword } from '../utils/validators';
import '../styles/SetPassword.css';

const SetPassword = ({ showNotification }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [passwordErrors, setPasswordErrors] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get user data from location state or try to recover from localStorage
    const getUserData = async () => {
      try {
        const { email, tempPassword } = location.state || {};
        
        if (email && tempPassword) {
          // Get user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', email));
          if (userDoc.exists()) {
            setUserData({ ...userDoc.data(), email, tempPassword });
          } else {
            showNotification('User data not found', 'error');
            navigate('/login');
          }
        } else {
          // Try to get from localStorage (for page refresh)
          const savedEmail = localStorage.getItem('setPasswordEmail');
          const savedTempPassword = localStorage.getItem('setPasswordTempPassword');
          
          if (savedEmail && savedTempPassword) {
            const userDoc = await getDoc(doc(db, 'users', savedEmail));
            if (userDoc.exists()) {
              setUserData({ ...userDoc.data(), email: savedEmail, tempPassword: savedTempPassword });
            } else {
              showNotification('Session expired. Please login again.', 'error');
              navigate('/login');
            }
          } else {
            showNotification('Invalid access. Please login again.', 'error');
            navigate('/login');
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        showNotification('Error loading user data', 'error');
        navigate('/login');
      }
    };

    getUserData();
  }, [location, navigate, showNotification]);

  const validateForm = () => {
    const errors = [];

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      errors.push('Passwords do not match');
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (passwordValidation !== true) {
      errors.push(passwordValidation);
    }

    setPasswordErrors(errors);
    return errors.length === 0;
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const { email, tempPassword } = userData;

      if (!email) {
        throw new Error('Email not found');
      }

      let user;
      
      // First try to create a new user (most common scenario for new users)
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, newPassword);
        user = userCredential.user;
        showNotification('Account created successfully!', 'success');
      } catch (createError) {
        // If user already exists, try to sign in with temp password and update
        if (createError.code === 'auth/email-already-in-use') {
          try {
            // Try to sign in with temporary password
            await signInWithEmailAndPassword(auth, email, tempPassword);
            user = auth.currentUser;
            
            // Update password
            await updatePassword(user, newPassword);
            showNotification('Password updated successfully!', 'success');
          } catch (signInError) {
            // If temp password doesn't work, user might need to reset password properly
            if (signInError.code === 'auth/invalid-login-credentials') {
              throw new Error('Temporary password is invalid. Please contact administrator.');
            } else {
              throw signInError;
            }
          }
        } else {
          throw createError;
        }
      }

      // Update user document in Firestore
      await setDoc(doc(db, 'users', email), {
        ...userData,
        passwordSet: true,
        tempPassword: null, // Remove temporary password
        updatedAt: new Date()
      }, { merge: true });

      // Clear any stored data
      localStorage.removeItem('setPasswordEmail');
      localStorage.removeItem('setPasswordTempPassword');
      
      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);

    } catch (error) {
      console.error('Error setting password:', error);
      
      let errorMessage = 'Failed to set password. ';
      switch (error.code) {
        case 'auth/weak-password':
          errorMessage += 'Password is too weak.';
          break;
        case 'auth/requires-recent-login':
          errorMessage += 'Session expired. Please login again.';
          navigate('/login');
          break;
        case 'auth/invalid-email':
          errorMessage += 'Invalid email address.';
          break;
        case 'auth/email-already-in-use':
          errorMessage += 'Email already in use.';
          break;
        case 'auth/invalid-login-credentials':
          errorMessage += 'Invalid temporary credentials. Please contact administrator.';
          break;
        default:
          errorMessage += error.message || 'Please try again.';
      }
      
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Clear stored data and redirect to login
    localStorage.removeItem('setPasswordEmail');
    localStorage.removeItem('setPasswordTempPassword');
    navigate('/login');
  };

  if (!userData) {
    return <LoadingSpinner text="Loading your information..." />;
  }

  return (
    <div className="set-password-container">
      <div className="set-password-card">
        <div className="set-password-header">
          <h1>Set Your Password</h1>
          <p>Welcome, {userData.name}! Please set your new password.</p>
        </div>

        <form onSubmit={handleSetPassword} className="set-password-form">
          <div className="user-info">
            <p><strong>Name:</strong> {userData.name}</p>
            <p><strong>Email:</strong> {userData.email}</p>
            <p><strong>Role:</strong> {userData.role}</p>
            {userData.department && <p><strong>Department:</strong> {userData.department}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength="8"
              placeholder="Enter your new password"
              className={passwordErrors.length > 0 ? 'error' : ''}
            />
            <div className="password-requirements">
              <p>Password must contain:</p>
              <ul>
                <li className={newPassword.length >= 8 ? 'met' : ''}>At least 8 characters</li>
                <li className={/[A-Z]/.test(newPassword) ? 'met' : ''}>One uppercase letter</li>
                <li className={/[a-z]/.test(newPassword) ? 'met' : ''}>One lowercase letter</li>
                <li className={/\d/.test(newPassword) ? 'met' : ''}>One number</li>
              </ul>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength="8"
              placeholder="Confirm your new password"
              className={passwordErrors.length > 0 ? 'error' : ''}
            />
          </div>

          {passwordErrors.length > 0 && (
            <div className="error-messages">
              {passwordErrors.map((error, index) => (
                <p key={index} className="error-message">• {error}</p>
              ))}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="cancel-btn"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="submit-btn"
            >
              {loading ? <LoadingSpinner size="small" text="Setting password..." /> : 'Set Password'}
            </button>
          </div>
        </form>

        <div className="security-note">
          <h4>Security Tips:</h4>
          <ul>
            <li>Use a unique password that you don't use elsewhere</li>
            <li>Avoid common words or personal information</li>
            <li>Consider using a passphrase for better security</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SetPassword;