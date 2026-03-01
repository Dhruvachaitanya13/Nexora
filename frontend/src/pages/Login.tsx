/* ============================================
   FINTRACK AI - LOGIN PAGE
   Stunning login page with animations
   ============================================ */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Eye, 
  EyeOff,
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
  CheckCircle,
  AlertCircle,
  Github,
  Chrome
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { cn } from '../lib/utils';

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

const glowVariants = {
  animate: {
    boxShadow: [
      '0 0 20px rgba(99, 102, 241, 0.3)',
      '0 0 60px rgba(99, 102, 241, 0.5)',
      '0 0 20px rgba(99, 102, 241, 0.3)'
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// ============================================
// FEATURE DATA
// ============================================

const features = [
  {
    icon: Sparkles,
    title: 'AI-Powered Insights',
    description: 'Get intelligent financial advice tailored for Chicago freelancers'
  },
  {
    icon: TrendingUp,
    title: 'Cash Flow Forecasting',
    description: 'Predict your financial future with 95% accuracy'
  },
  {
    icon: Shield,
    title: 'Tax Optimization',
    description: 'Maximize deductions and never miss quarterly payments'
  },
  {
    icon: Zap,
    title: 'Instant Categorization',
    description: 'Transactions auto-categorized with Schedule C mapping'
  }
];

// ============================================
// FLOATING SHAPES COMPONENT
// ============================================

function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient Orbs */}
      <motion.div
        variants={pulseVariants}
        animate="animate"
        className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl"
      />
      <motion.div
        variants={pulseVariants}
        animate="animate"
        style={{ animationDelay: '1s' }}
        className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
      />
      <motion.div
        variants={pulseVariants}
        animate="animate"
        style={{ animationDelay: '2s' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-3xl"
      />

      {/* Floating Icons */}
      <motion.div
        variants={floatVariants}
        animate="animate"
        className="absolute top-20 left-[15%] w-12 h-12 bg-primary-500/10 backdrop-blur-sm border border-primary-500/20 rounded-xl flex items-center justify-center"
      >
        <TrendingUp className="w-6 h-6 text-primary-400" />
      </motion.div>

      <motion.div
        variants={floatVariants}
        animate="animate"
        style={{ animationDelay: '0.5s' }}
        className="absolute top-40 right-[20%] w-10 h-10 bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-lg flex items-center justify-center"
      >
        <CheckCircle className="w-5 h-5 text-emerald-400" />
      </motion.div>

      <motion.div
        variants={floatVariants}
        animate="animate"
        style={{ animationDelay: '1s' }}
        className="absolute bottom-32 left-[25%] w-14 h-14 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 rounded-2xl flex items-center justify-center"
      >
        <Sparkles className="w-7 h-7 text-purple-400" />
      </motion.div>

      <motion.div
        variants={floatVariants}
        animate="animate"
        style={{ animationDelay: '1.5s' }}
        className="absolute bottom-20 right-[15%] w-11 h-11 bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 rounded-xl flex items-center justify-center"
      >
        <Zap className="w-5 h-5 text-amber-400" />
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
// LOGIN FORM COMPONENT
// ============================================

function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  // Get redirect path from location state
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // Clear error when inputs change
  useEffect(() => {
    if (error) clearError();
  }, [email, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login(email, password, rememberMe);
      navigate(from, { replace: true });
    } catch {
      // Error is handled by the store
    }
  };

  const isValidEmail = email.includes('@') && email.includes('.');
  const isValidPassword = password.length >= 8;
  const canSubmit = isValidEmail && isValidPassword && !isLoading;

  return (
    <motion.form
      variants={itemVariants}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Login Failed</p>
              <p className="text-sm text-red-400/80 mt-0.5">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-dark-300">
          Email Address
        </label>
        <div className="relative">
          <div className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200",
            focused === 'email' ? 'text-primary-400' : 'text-dark-500'
          )}>
            <Mail className="w-5 h-5" />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
              error && 'border-red-500/50'
            )}
            required
          />
          {email && isValidEmail && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Password Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-dark-300">
            Password
          </label>
          <Link 
            to="/forgot-password" 
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <div className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200",
            focused === 'password' ? 'text-primary-400' : 'text-dark-500'
          )}>
            <Lock className="w-5 h-5" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            placeholder="Enter your password"
            className={cn(
              "w-full h-12 pl-12 pr-12 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/30",
              focused === 'password' 
                ? 'border-primary-500 bg-dark-800' 
                : 'border-dark-700 hover:border-dark-600',
              error && 'border-red-500/50'
            )}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Remember Me */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRememberMe(!rememberMe)}
          className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200",
            rememberMe 
              ? 'bg-primary-500 border-primary-500' 
              : 'border-dark-600 hover:border-dark-500'
          )}
        >
          {rememberMe && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </motion.svg>
          )}
        </button>
        <span className="text-sm text-dark-400">Remember me for 30 days</span>
      </div>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={!canSubmit}
        whileHover={{ scale: canSubmit ? 1.02 : 1 }}
        whileTap={{ scale: canSubmit ? 0.98 : 1 }}
        className={cn(
          "relative w-full h-12 rounded-xl font-semibold text-white overflow-hidden",
          "transition-all duration-300",
          "focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-dark-900",
          canSubmit
            ? 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 shadow-lg shadow-primary-500/25'
            : 'bg-dark-700 cursor-not-allowed'
        )}
      >
        {/* Button Shine Effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          initial={{ x: '-100%' }}
          animate={canSubmit ? { x: '100%' } : { x: '-100%' }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
        />

        <span className="relative flex items-center justify-center gap-2">
          {isLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
              Signing in...
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </span>
      </motion.button>

      {/* Divider */}
      <div className="relative flex items-center gap-4 py-2">
        <div className="flex-1 h-px bg-dark-700" />
        <span className="text-sm text-dark-500">or continue with</span>
        <div className="flex-1 h-px bg-dark-700" />
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
          whileTap={{ scale: 0.98 }}
          className="h-12 px-4 bg-dark-800/50 border border-dark-700 rounded-xl flex items-center justify-center gap-3 text-dark-300 hover:text-white transition-colors"
        >
          <Chrome className="w-5 h-5" />
          <span className="text-sm font-medium">Google</span>
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
          whileTap={{ scale: 0.98 }}
          className="h-12 px-4 bg-dark-800/50 border border-dark-700 rounded-xl flex items-center justify-center gap-3 text-dark-300 hover:text-white transition-colors"
        >
          <Github className="w-5 h-5" />
          <span className="text-sm font-medium">GitHub</span>
        </motion.button>
      </div>

      {/* Sign Up Link */}
      <p className="text-center text-sm text-dark-400">
        Don't have an account?{' '}
        <Link 
          to="/register" 
          className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
        >
          Sign up for free
        </Link>
      </p>
    </motion.form>
  );
}

// ============================================
// FEATURES SECTION COMPONENT
// ============================================

function FeaturesSection() {
  return (
    <motion.div
      variants={itemVariants}
      className="space-y-8"
    >
      <div>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-500/10 border border-primary-500/30 rounded-full mb-6"
        >
          <Sparkles className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-primary-400">AI-Powered Finance</span>
        </motion.div>
        
        <h2 className="text-2xl font-bold text-white mb-3">
          Your Intelligent Financial Partner
        </h2>
        <p className="text-dark-400">
          Built specifically for Chicago freelancers and independent contractors.
        </p>
      </div>

      <div className="space-y-4">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-default"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
              <feature.icon className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
              <p className="text-sm text-dark-400">{feature.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="grid grid-cols-3 gap-4 pt-4"
      >
        {[
          { value: '50K+', label: 'Users' },
          { value: '$12M', label: 'Tax Saved' },
          { value: '4.9', label: 'Rating' },
        ].map((stat, index) => (
          <div key={stat.label} className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.1 + index * 0.1, type: 'spring' }}
              className="text-2xl font-bold gradient-text"
            >
              {stat.value}
            </motion.div>
            <div className="text-xs text-dark-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ============================================
// MAIN LOGIN PAGE COMPONENT
// ============================================

export default function Login() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen flex mesh-gradient"
    >
      {/* Floating Shapes Background */}
      <FloatingShapes />

      {/* Left Side - Features (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative p-12 items-center justify-center">
        <div className="max-w-lg relative z-10">
          {/* Logo */}
          <motion.div
            variants={glowVariants}
            animate="animate"
            className="w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg"
          >
            <span className="text-white font-bold text-2xl">F</span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl font-bold text-white mb-4"
          >
            Welcome to{' '}
            <span className="gradient-text">Nexora</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-xl text-dark-300 mb-12"
          >
            The most intelligent financial management platform for freelancers.
          </motion.p>

          <FeaturesSection />
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <motion.div
            variants={itemVariants}
            className="lg:hidden text-center mb-8"
          >
            <motion.div
              variants={glowVariants}
              animate="animate"
              className="w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg mx-auto"
            >
              <span className="text-white font-bold text-2xl">N</span>
            </motion.div>
            <h1 className="text-2xl font-bold text-white">
              Welcome to <span className="gradient-text">Nexora</span>
            </h1>
          </motion.div>

          {/* Card */}
          <motion.div
            variants={itemVariants}
            className="bg-dark-900/80 backdrop-blur-xl border border-dark-700/50 rounded-3xl p-8 shadow-2xl"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Sign In</h2>
              <p className="text-dark-400">Access your financial dashboard</p>
            </div>

            <LoginForm />
          </motion.div>

          {/* Footer */}
          <motion.div
            variants={itemVariants}
            className="mt-8 text-center"
          >
            <p className="text-xs text-dark-500">
              By signing in, you agree to our{' '}
              <Link to="/terms" className="text-dark-400 hover:text-white transition-colors">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-dark-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}