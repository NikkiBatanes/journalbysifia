import { useState, useCallback, useEffect } from 'react';
import { Logger } from '../utils/ProductionLogger';

export interface ReflectionFormValues {
  title: string;
  content: string;
  type: 'free' | 'guided';
  prompt?: string;
  tags: string[];
}

export interface ReflectionFormErrors {
  title?: string;
  content?: string;
  prompt?: string;
}

export interface ReflectionFormTouched {
  title?: boolean;
  content?: boolean;
  prompt?: boolean;
}

interface UseReflectionFormOptions {
  initialValues?: Partial<ReflectionFormValues>;
  onSubmit?: (values: ReflectionFormValues) => void | Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export function useReflectionForm({
  initialValues = {},
  onSubmit,
  validateOnChange = true,
  validateOnBlur = true,
}: UseReflectionFormOptions = {}) {
  const [values, setValues] = useState<ReflectionFormValues>({
    title: '',
    content: '',
    type: 'free',
    prompt: '',
    tags: [],
    ...initialValues,
  });

  const [errors, setErrors] = useState<ReflectionFormErrors>({});
  const [touched, setTouched] = useState<ReflectionFormTouched>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation rules
  const validateField = useCallback((field: keyof ReflectionFormValues, value: any): string | undefined => {
    switch (field) {
      case 'title':
        if (!value || !value.trim()) {
          return 'Title is required';
        }
        if (value.length > 100) {
          return 'Title must be 100 characters or less';
        }
        break;

      case 'content':
        if (!value || !value.trim()) {
          return 'Content is required';
        }
        if (value.length > 5000) {
          return 'Content must be 5000 characters or less';
        }
        break;

      case 'prompt':
        if (values.type === 'guided' && (!value || !value.trim())) {
          return 'Please select a prompt for guided reflection';
        }
        break;

      default:
        break;
    }
    return undefined;
  }, [values.type]);

  // Validate all fields
  const validateForm = useCallback((): ReflectionFormErrors => {
    const newErrors: ReflectionFormErrors = {};

    Object.keys(values).forEach((key) => {
      const field = key as keyof ReflectionFormValues;
      const error = validateField(field, values[field]);
      if (error) {
        newErrors[field as keyof ReflectionFormErrors] = error;
      }
    });

    return newErrors;
  }, [values, validateField]);

  // Check if form is valid
  const isValid = useCallback((): boolean => {
    const formErrors = validateForm();
    return Object.keys(formErrors).length === 0;
  }, [validateForm]);

  // Handle field changes
  const handleChange = useCallback((field: keyof ReflectionFormValues, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));

    // Validate on change if enabled
    if (validateOnChange && touched[field as keyof ReflectionFormTouched]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  }, [validateField, validateOnChange, touched]);

  // Handle field blur
  const handleBlur = useCallback((field: keyof ReflectionFormValues) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    // Validate on blur if enabled
    if (validateOnBlur) {
      const error = validateField(field, values[field]);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  }, [validateField, validateOnBlur, values]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!onSubmit) {return;}

    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => {
      acc[key as keyof ReflectionFormTouched] = true;
      return acc;
    }, {} as ReflectionFormTouched);
    setTouched(allTouched);

    // Validate form
    const formErrors = validateForm();
    setErrors(formErrors);

    // If form is valid, submit
    if (Object.keys(formErrors).length === 0) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        Logger.error('Form submission error', error as Error, { component: 'useReflectionForm' });
        // You could set a general form error here
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [onSubmit, values, validateForm]);

  // Reset form
  const resetForm = useCallback((newValues?: Partial<ReflectionFormValues>) => {
    setValues({
      title: '',
      content: '',
      type: 'free',
      prompt: '',
      tags: [],
      ...initialValues,
      ...newValues,
    });
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  // Update initial values when they change
  useEffect(() => {
    if (initialValues) {
      setValues(prev => ({ ...prev, ...initialValues }));
    }
  }, [initialValues]);

  // Get field props for easy integration
  const getFieldProps = useCallback((field: keyof ReflectionFormValues) => ({
    value: values[field],
    onChangeText: (value: string) => handleChange(field, value),
    onBlur: () => handleBlur(field),
    error: touched[field as keyof ReflectionFormTouched] ? errors[field as keyof ReflectionFormErrors] : undefined,
  }), [values, handleChange, handleBlur, touched, errors]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid: isValid(),
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    validateForm,
    getFieldProps,
  };
}
