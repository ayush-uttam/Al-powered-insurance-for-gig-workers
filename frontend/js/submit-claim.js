/* ============================================
   SUBMIT CLAIM FORM – script.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ─── FORM ELEMENTS ────────────────────────
  const claimForm = document.getElementById('claimForm');
  const fileInputs = document.querySelectorAll('.upload-input');

  // ─── FILE UPLOAD HANDLING ─────────────────
  fileInputs.forEach(input => {
    const statusElement = input.parentElement.querySelector('.upload-status');

    input.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files.length === 0) {
        statusElement.textContent = 'No file selected';
        statusElement.style.color = 'var(--text-muted)';
      } else if (files.length === 1) {
        statusElement.textContent = `${files[0].name} selected`;
        statusElement.style.color = 'var(--teal)';
      } else {
        statusElement.textContent = `${files.length} files selected`;
        statusElement.style.color = 'var(--teal)';
      }
    });
  });

  // ─── FORM VALIDATION ─────────────────────
  claimForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Basic validation
    const requiredFields = claimForm.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        isValid = false;
        showFieldError(field, 'This field is required');
      } else {
        clearFieldError(field);
      }
    });

    // Email validation
    const emailField = document.getElementById('email');
    if (emailField.value && !isValidEmail(emailField.value)) {
      isValid = false;
      showFieldError(emailField, 'Please enter a valid email address');
    }

    // Phone validation
    const phoneField = document.getElementById('phone');
    if (phoneField.value && !isValidPhone(phoneField.value)) {
      isValid = false;
      showFieldError(phoneField, 'Please enter a valid phone number');
    }

    // Date validation
    const incidentDate = document.getElementById('incidentDate');
    const treatmentDate = document.getElementById('treatmentDate');
    const today = new Date().toISOString().split('T')[0];

    if (incidentDate.value > today) {
      isValid = false;
      showFieldError(incidentDate, 'Incident date cannot be in the future');
    }

    if (treatmentDate.value && treatmentDate.value > today) {
      isValid = false;
      showFieldError(treatmentDate, 'Treatment date cannot be in the future');
    }

    if (treatmentDate.value && incidentDate.value && treatmentDate.value < incidentDate.value) {
      isValid = false;
      showFieldError(treatmentDate, 'Treatment date cannot be before incident date');
    }

    // Declaration checkbox
    const declarationCheckbox = document.getElementById('declaration');
    if (!declarationCheckbox.checked) {
      isValid = false;
      showFieldError(declarationCheckbox, 'You must agree to the declaration');
    }

    if (isValid) {
      submitClaim();
    } else {
      // Scroll to first error
      const firstError = claimForm.querySelector('.field-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  // ─── UTILITY FUNCTIONS ───────────────────
  function showFieldError(field, message) {
    clearFieldError(field);

    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;

    field.parentElement.appendChild(errorElement);
    field.style.borderColor = 'var(--rejected)';
  }

  function clearFieldError(field) {
    const existingError = field.parentElement.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }
    field.style.borderColor = 'var(--border)';
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  // ─── FORM SUBMISSION ─────────────────────
  function submitClaim() {
    // Show loading state
    const submitButton = claimForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Submitting...';
    submitButton.disabled = true;

    // Collect form data
    const formData = new FormData(claimForm);

    // Simulate API call (replace with actual API endpoint)
    setTimeout(() => {
      // Reset form state
      submitButton.textContent = originalText;
      submitButton.disabled = false;

      // Show success message
      showSuccessMessage();

      // Reset form
      claimForm.reset();
      fileInputs.forEach(input => {
        const statusElement = input.parentElement.querySelector('.upload-status');
        statusElement.textContent = 'No file selected';
        statusElement.style.color = 'var(--text-muted)';
      });

    }, 2000); // Simulate 2 second processing time
  }

  function showSuccessMessage() {
    // Create success message
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.innerHTML = `
      <div class="success-icon">✓</div>
      <h3>Claim Submitted Successfully!</h3>
      <p>Your claim has been submitted and is being processed. You will receive a confirmation email with your claim number shortly.</p>
      <button class="btn btn-primary" onclick="this.parentElement.remove()">Continue</button>
    `;

    // Add to page
    document.body.appendChild(successMessage);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (successMessage.parentElement) {
        successMessage.remove();
      }
    }, 10000);
  }

  // ─── REAL-TIME VALIDATION ────────────────
  const inputs = claimForm.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('blur', () => {
      if (input.hasAttribute('required') && !input.value.trim()) {
        showFieldError(input, 'This field is required');
      } else {
        clearFieldError(input);
      }
    });

    input.addEventListener('input', () => {
      if (input.classList.contains('field-error')) {
        clearFieldError(input);
      }
    });
  });
});