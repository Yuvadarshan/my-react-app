export const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

export const validateFile = (file, maxSizeMB = 5) => {
  if (!file) return { valid: false, error: "No file selected" };
  
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { 
      valid: false, 
      error: `File size should be less than ${maxSizeMB}MB` 
    };
  }
  
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: "Only JPEG, PNG, and PDF files are allowed" 
    };
  }
  
  return { valid: true, error: null };
};