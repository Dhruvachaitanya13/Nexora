/* ============================================
   FINTRACK AI - REGISTER PAGE
   Beautiful registration with multi-step flow
   ============================================ */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Lock, 
  User,
  ArrowRight,
  ArrowLeft,
  Eye, 
  EyeOff,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Building2,
  Briefcase,
  Github,
  Chrome,
  Check,
  X
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { cn } from '../lib/utils';
import Button from '../components/ui/Button';

// ============================================
// TYPES
// ============================================

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  businessType: string;
  acceptTerms: boolean;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

// ============================================
// CONSTANTS
// ============================================

const businessTypes = [
  { value: 'freelancer', label: 'Freelancer', icon: User, description: 'Independent professional' },
  { value: 'consultant', label: 'Consultant', icon: Briefcase, description: 'Business consulting' },
  { value: 'contractor', label: 'Contractor', icon: Building2, description: 'Independent contractor' },
  { value: 'creative', label: 'Creative', icon: Sparkles, description: 'Designer, writer, artist' },
];

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

// ============================================
// ANIMATIONS
// ============================================

const pageVariants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: { duration: 0.5, staggerChildren: 0.1 }
  },
  exit: { opacity: 0 }
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
  }
};

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0
  })
};

const floatVariants = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

const pulseVariants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// ============================================
// FLOATING SHAPES COMPONENT
// ============================================

function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        variants={pulseVariants}
        animate="animate"
        className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
      />
      <motion.div
        variants={pulseVariants}
        animate="animate"
        style={{ animationDelay: '1s' }}
        className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl"
      />
      <motion.div
        variants={pulseVariants}
        animate="animate"
        style={{ animationDelay: '2s' }}
        className="absolute top-1/3 right-1/4 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl"
      />

      {/* Floating Elements */}
      <motion.div
        variants={floatVariants}
        animate="animate"
        className="absolute top-32 right-[20%] w-12 h-12 bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-xl flex items-center justify-center"
      >
        <CheckCircle className="w-6 h-6 text-emerald-400" />
      </motion.div>

      <motion.div
        variants={floatVariants}
        animate="animate"
        style={{ animationDelay: '1s' }}
        className="absolute bottom-40 left-[15%] w-10 h-10 bg-primary-500/10 backdrop-blur-sm border border-primary-500/20 rounded-lg flex items-center justify-center"
      >
        <Sparkles className="w-5 h-5 text-primary-400" />
      </motion.div>

      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />
    </div>
  );
}

// ============================================
// STEP INDICATOR COMPONENT
// ============================================

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <React.Fragment key={index}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300",
              index < currentStep
                ? 'bg-emerald-500 text-white'
                : index === currentStep
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                : 'bg-dark-700 text-dark-400'
            )}
          >
            {index < currentStep ? (
              <Check className="w-5 h-5" />
            ) : (
              index + 1
            )}
          </motion.div>
          {index < totalSteps - 1 && (
            <div className={cn(
              "w-12 h-1 rounded-full transition-all duration-300",
              index < currentStep ? 'bg-emerald-500' : 'bg-dark-700'
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================
// PASSWORD STRENGTH COMPONENT
// ============================================

function PasswordStrength({ password }: { password: string }) {
  const metRequirements = passwordRequirements.filter(req => req.test(password)).length;
  const strength = (metRequirements / passwordRequirements.length) * 100;

  const getStrengthLabel = () => {
    if (strength < 40) return { label: 'Weak', color: 'text-red-400', bg: 'bg-red-500' };
    if (strength < 60) return { label: 'Fair', color: 'text-orange-400', bg: 'bg-orange-500' };
    if (strength < 80) return { label: 'Good', color: 'text-amber-400', bg: 'bg-amber-500' };
    return { label: 'Strong', color: 'text-emerald-400', bg: 'bg-emerald-500' };
  };

  const { label, color, bg } = getStrengthLabel();

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 space-y-3"
    >
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-400">Password strength</span>
          <span className={cn("text-xs font-medium", color)}>{label}</span>
        </div>
        <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${strength}%` }}
            transition={{ duration: 0.3 }}
            className={cn("h-full rounded-full", bg)}
          />
        </div>
      </div>

      {/* Requirements */}
      <div className="grid grid-cols-2 gap-2">
        {passwordRequirements.map((req, index) => {
          const isMet = req.test(password);
          return (
            <motion.div
              key={req.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-2"
            >
              {isMet ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <X className="w-3.5 h-3.5 text-dark-500" />
              )}
              <span className={cn(
                "text-xs",
                isMet ? 'text-emerald-400' : 'text-dark-500'
              )}>
                {req.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ============================================
// STEP 1: ACCOUNT INFO
// ============================================

function Step1AccountInfo({
  formData,
  setFormData,
  errors,
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  errors: Record<string, string>;
}) {
  const [focused, setFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="space-y-5">
      {/* Full Name */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-dark-300">Full Name</label>
        <div className="relative">
          <div className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200",
            focused === 'fullName' ? 'text-primary-400' : 'text-dark-500'
          )}>
            <User className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            onFocus={() => setFocused('fullName')}
            onBlur={() => setFocused(null)}
            placeholder="John Doe"
            className={cn(
              "w-full h-12 pl-12 pr-4 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/30",
              focused === 'fullName' 
                ? 'border-primary-500 bg-dark-800' 
                : 'border-dark-700 hover:border-dark-600',
              errors.fullName && 'border-red-500/50'
            )}
          />
        </div>
        {errors.fullName && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.fullName}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-dark-300">Email Address</label>
        <div className="relative">
          <div className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200",
            focused === 'email' ? 'text-primary-400' : 'text-dark-500'
          )}>
            <Mail className="w-5 h-5" />
          </div>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            placeholder="you@example.com"
            className={cn(
              "w-full h-12 pl-12 pr-4 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/30",
              focused === 'email' 
                ? 'border-primary-500 bg-dark-800' 
                : 'border-dark-700 hover:border-dark-600',
              errors.email && 'border-red-500/50'
            )}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.email}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-dark-300">Password</label>
        <div className="relative">
          <div className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200",
            focused === 'password' ? 'text-primary-400' : 'text-dark-500'
          )}>
            <Lock className="w-5 h-5" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            placeholder="Create a strong password"
            className={cn(
              "w-full h-12 pl-12 pr-12 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/30",
              focused === 'password' 
                ? 'border-primary-500 bg-dark-800' 
                : 'border-dark-700 hover:border-dark-600',
              errors.password && 'border-red-500/50'
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <AnimatePresence>
          {formData.password && <PasswordStrength password={formData.password} />}
        </AnimatePresence>
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-dark-300">Confirm Password</label>
        <div className="relative">
          <div className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200",
            focused === 'confirmPassword' ? 'text-primary-400' : 'text-dark-500'
          )}>
            <Lock className="w-5 h-5" />
          </div>
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            onFocus={() => setFocused('confirmPassword')}
            onBlur={() => setFocused(null)}
            placeholder="Confirm your password"
            className={cn(
              "w-full h-12 pl-12 pr-12 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/30",
              focused === 'confirmPassword' 
                ? 'border-primary-500 bg-dark-800' 
                : 'border-dark-700 hover:border-dark-600',
              errors.confirmPassword && 'border-red-500/50'
            )}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          {formData.confirmPassword && formData.password === formData.confirmPassword && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute right-12 top-1/2 -translate-y-1/2"
            >
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </motion.div>
          )}
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.confirmPassword}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================
// STEP 2: BUSINESS TYPE
// ============================================

function Step2BusinessType({
  formData,
  setFormData,
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-lg font-semibold text-white mb-2">What type of work do you do?</h3>
        <p className="text-sm text-dark-400">This helps us customize your experience</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {businessTypes.map((type, index) => (
          <motion.button
            key={type.value}
            type="button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => setFormData(prev => ({ ...prev, businessType: type.value }))}
            className={cn(
              "relative p-6 rounded-2xl border-2 text-left transition-all duration-300",
              "hover:border-primary-500/50 hover:bg-primary-500/5",
              formData.businessType === type.value
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-dark-700 bg-dark-800/30'
            )}
          >
            {formData.businessType === type.value && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-3 right-3"
              >
                <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </motion.div>
            )}
            
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
              formData.businessType === type.value
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-dark-700 text-dark-400'
            )}>
              <type.icon className="w-6 h-6" />
            </div>
            
            <h4 className="font-semibold text-white mb-1">{type.label}</h4>
            <p className="text-sm text-dark-400">{type.description}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// STEP 3: CONFIRMATION
// ============================================

function Step3Confirmation({
  formData,
  setFormData,
  errors,
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  errors: Record<string, string>;
}) {
  const selectedBusiness = businessTypes.find(t => t.value === formData.businessType);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30"
        >
          <Sparkles className="w-10 h-10 text-white" />
        </motion.div>
        <h3 className="text-lg font-semibold text-white mb-2">You're almost there!</h3>
        <p className="text-sm text-dark-400">Review your information and accept our terms</p>
      </div>

      {/* Summary Card */}
      <div className="p-6 bg-dark-800/50 border border-dark-700 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-dark-700">
          <span className="text-sm text-dark-400">Name</span>
          <span className="text-sm font-medium text-white">{formData.fullName}</span>
        </div>
        <div className="flex items-center justify-between pb-4 border-b border-dark-700">
          <span className="text-sm text-dark-400">Email</span>
          <span className="text-sm font-medium text-white">{formData.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">Business Type</span>
          <span className="text-sm font-medium text-white">{selectedBusiness?.label}</span>
        </div>
      </div>

      {/* Terms Checkbox */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer group">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, acceptTerms: !prev.acceptTerms }))}
            className={cn(
              "w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
              formData.acceptTerms 
                ? 'bg-primary-500 border-primary-500' 
                : 'border-dark-600 group-hover:border-dark-500'
            )}
          >
            {formData.acceptTerms && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <Check className="w-3 h-3 text-white" />
              </motion.div>
            )}
          </button>
          <span className="text-sm text-dark-300">
            I agree to Nexora's{' '}
            <Link to="/terms" className="text-primary-400 hover:text-primary-300 transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-primary-400 hover:text-primary-300 transition-colors">
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.acceptTerms}
          </p>
        )}
      </div>

      {/* Benefits */}
      <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-xl">
        <h4 className="font-medium text-primary-400 mb-3">What you'll get:</h4>
        <ul className="space-y-2">
          {[
            'AI-powered financial insights',
            'Automatic transaction categorization',
            'Tax optimization recommendations',
            'Cash flow forecasting',
          ].map((benefit, index) => (
            <motion.li
              key={benefit}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-2 text-sm text-primary-300"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              {benefit}
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ============================================
// MAIN REGISTER COMPONENT
// ============================================

export default function Register() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError, isAuthenticated } = useAuthStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    businessType: '',
    acceptTerms: false,
  });

  const totalSteps = 3;

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Clear auth error on mount
  useEffect(() => {
    clearError();
  }, []);

  // Validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.fullName.trim()) {
        newErrors.fullName = 'Full name is required';
      }
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email';
      }
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if (step === 2) {
      if (!formData.acceptTerms) {
        newErrors.acceptTerms = 'You must accept the terms and conditions';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps - 1) {
        setDirection(1);
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(currentStep)) return;

    try {
      await register(formData.email, formData.password, formData.fullName, formData.businessType);
      navigate('/', { replace: true });
    } catch {
      // Error is handled by the store
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <Step1AccountInfo formData={formData} setFormData={setFormData} errors={errors} />;
      case 1:
        return <Step2BusinessType formData={formData} setFormData={setFormData} />;
      case 2:
        return <Step3Confirmation formData={formData} setFormData={setFormData} errors={errors} />;
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.fullName && formData.email && formData.password && formData.confirmPassword;
      case 1:
        return formData.businessType;
      case 2:
        return formData.acceptTerms;
      default:
        return true;
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen flex items-center justify-center mesh-gradient p-4"
    >
      <FloatingShapes />

      <motion.div
        variants={itemVariants}
        className="w-full max-w-lg relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
            className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30"
          >
            <span className="text-white font-bold text-2xl">N</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-white">
            Create your <span className="gradient-text">Nexora</span> account
          </h1>
        </div>

        {/* Card */}
        <div className="bg-dark-900/80 backdrop-blur-xl border border-dark-700/50 rounded-3xl p-8 shadow-2xl">
          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Registration Failed</p>
                  <p className="text-sm text-red-400/80 mt-0.5">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-dark-700">
              {currentStep > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </Button>
              ) : (
                <div />
              )}

              {currentStep < totalSteps - 1 ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleNext}
                  disabled={!canProceed()}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  loading={isLoading}
                  disabled={!canProceed()}
                  rightIcon={!isLoading ? <Sparkles className="w-4 h-4" /> : undefined}
                >
                  Create Account
                </Button>
              )}
            </div>
          </form>

          {/* Social Login */}
          {currentStep === 0 && (
            <>
              <div className="relative flex items-center gap-4 py-6 mt-6">
                <div className="flex-1 h-px bg-dark-700" />
                <span className="text-sm text-dark-500">or sign up with</span>
                <div className="flex-1 h-px bg-dark-700" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Chrome className="w-5 h-5" />}
                >
                  Google
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Github className="w-5 h-5" />}
                >
                  GitHub
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Sign In Link */}
        <p className="text-center text-sm text-dark-400 mt-6">
          Already have an account?{' '}
          <Link 
            to="/login" 
            className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}