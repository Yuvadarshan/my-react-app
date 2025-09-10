export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateName = (name) => {
  // Only letters, spaces, and hyphens, 2-50 characters
  const nameRegex = /^[a-zA-Z\s\-']{2,50}$/;
  return nameRegex.test(name);
};

export const validateRequired = (value) => {
  return value !== null && value !== undefined && value.toString().trim() !== '';
};

export const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start <= end;
};

export const validateFile = (file, options = {}) => {
  const {
    maxSizeMB = 5,
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
  } = options;

  if (!file) return { isValid: false, error: 'No file selected' };

  if (file.size > maxSizeMB * 1024 * 1024) {
    return { 
      isValid: false, 
      error: `File size must be less than ${maxSizeMB}MB` 
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return { 
      isValid: false, 
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` 
    };
  }

  return { isValid: true, error: null };
};

export const getValidationErrors = (validations) => {
  const errors = {};
  
  Object.keys(validations).forEach(field => {
    const { value, validators } = validations[field];
    const fieldErrors = [];
    
    validators.forEach(validator => {
      const result = validator(value);
      if (result !== true) {
        fieldErrors.push(result);
      }
    });
    
    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  });
  
  return Object.keys(errors).length > 0 ? errors : null;
};

// Helper function to create validation rules
export const createValidator = (validateFn, errorMessage) => {
  return (value) => {
    return validateFn(value) ? true : errorMessage;
  };
};

// Add these functions to your existing validators.js

export const validateExcelFile = (file) => {
  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  // Check file extension
  const validExtensions = ['.xlsx', '.xls'];
  const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!validExtensions.includes(fileExtension)) {
    return { 
      isValid: false, 
      error: 'Invalid file type. Please upload .xlsx or .xls files' 
    };
  }

  // Check file size (max 10MB)
  const maxSizeMB = 10;
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { 
      isValid: false, 
      error: `File size must be less than ${maxSizeMB}MB` 
    };
  }

  return { isValid: true, error: null };
};

export const validateExcelHeaders = (headers, requiredHeaders) => {
  const missingHeaders = requiredHeaders.filter(header => 
    !headers.includes(header) && !headers.includes(header.toLowerCase())
  );

  if (missingHeaders.length > 0) {
    return {
      isValid: false,
      error: `Missing required columns: ${missingHeaders.join(', ')}`
    };
  }

  return { isValid: true, error: null };
};

export const validateExcelData = (data, requiredFields) => {
  const errors = [];
  
  data.forEach((row, index) => {
    const rowErrors = [];
    const rowNumber = index + 2; // +2 because header is row 1 and index starts at 0
    
    requiredFields.forEach(field => {
      if (!row[field] && row[field] !== 0) {
        rowErrors.push(`Missing ${field} in row ${rowNumber}`);
      }
    });
    
    // Validate email format if present
    if (row.email && !validateEmail(row.email)) {
      rowErrors.push(`Invalid email format in row ${rowNumber}`);
    }
    
    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        errors: rowErrors
      });
    }
  });
  
  return errors;
};

export const validatePassword = (password) => {
  if (!password) {
    return 'Password is required';
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }

  if (!/\d/.test(password)) {
    return 'Password must contain at least one number';
  }

  return true;
};