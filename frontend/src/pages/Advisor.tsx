/* ============================================
   FINTRACK AI - AI ADVISOR PAGE
   Real-time AI financial advisor with OpenAI
   ============================================ */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { 
  Sparkles,
  Bot, 
  User, 
  RefreshCw,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  TrendingUp,
  Calculator,
  Receipt,
  PiggyBank,
  AlertTriangle,
  ChevronDown,
  Trash2,
  Plus,
  MessageSquare,
  Brain,
  Target,
  DollarSign,
  FileText,
  Shield,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  Download,
  Share2,
  BookmarkPlus,
  MoreHorizontal,
  ChevronRight,
  ArrowRight,
  Bookmark,
  History,
  Search,
  Filter,
  X,
  Info,
  HelpCircle,
  ExternalLink,
  Code,
  Table,
  BarChart3,
  PieChart,
  Activity,
  Wallet,
  CreditCard,
  Building2,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  MinusCircle,
  ChevronUp,
  Edit3,
  Save,
  RotateCcw,
  Maximize2,
  Minimize2,
  Image,
  Paperclip,
  Smile,
  ArrowUp
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { cn, formatCurrency, formatDate, formatPercentage, getInitials } from '../lib/utils';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { aiAPI } from '../services/api';

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agent?: AgentType;
  agentName?: string;
  isStreaming?: boolean;
  isError?: boolean;
  errorMessage?: string;
  actions?: MessageAction[];
  attachments?: Attachment[];
  charts?: ChartData[];
  tables?: TableData[];
  codeBlocks?: CodeBlock[];
  feedback?: 'positive' | 'negative' | null;
  metadata?: MessageMetadata;
  tokens?: number;
  processingTime?: number;
}

interface MessageAction {
  id: string;
  label: string;
  type: 'link' | 'action' | 'copy' | 'download';
  icon?: React.ElementType;
  href?: string;
  data?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
}

interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'spreadsheet';
  url: string;
  size: number;
}

interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  data: Record<string, unknown>[];
}

interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
}

interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
}

interface MessageMetadata {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  finishReason?: string;
  sources?: string[];
}

type AgentType = 
  | 'financial_advisor'
  | 'tax_specialist' 
  | 'cash_flow_analyst'
  | 'expense_optimizer'
  | 'investment_advisor'
  | 'budget_planner'
  | 'general';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
  agent?: AgentType;
  isPinned?: boolean;
  tags?: string[];
}

interface SuggestedPrompt {
  id: string;
  icon: React.ElementType;
  title: string;
  prompt: string;
  category: string;
  agent?: AgentType;
  popularity?: number;
}

interface QuickAction {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  action: () => void;
}

interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  systemPrompt: string;
  capabilities: string[];
  examplePrompts: string[];
}

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const AI_MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.7;

const agentConfigs: Record<AgentType, AgentConfig> = {
  financial_advisor: {
    type: 'financial_advisor',
    name: 'Financial Advisor',
    description: 'Your personal AI financial advisor for comprehensive financial guidance',
    icon: Brain,
    color: 'from-primary-500 to-purple-500',
    systemPrompt: `You are Nexora AI, an expert financial advisor specialized in helping Chicago-based freelancers and independent contractors manage their finances. You have deep knowledge of:

- Personal and business finance management
- Tax planning and optimization for self-employed individuals
- Cash flow management and forecasting
- Expense tracking and categorization
- Investment strategies for freelancers
- Illinois and Chicago-specific tax regulations
- Schedule C deductions and business expenses
- Quarterly estimated tax payments
- Retirement planning (SEP-IRA, Solo 401k)
- Health insurance options for self-employed

Always provide actionable, specific advice tailored to freelancers. Use numbers and calculations when relevant. Be conversational but professional. If you need more information to give accurate advice, ask clarifying questions.

When discussing money amounts, always format them as currency. When discussing percentages, be specific. Reference relevant tax forms and deadlines when applicable.

Current date context: ${new Date().toLocaleDateString()}
Tax year context: 2024`,
    capabilities: [
      'Comprehensive financial planning',
      'Tax optimization strategies',
      'Cash flow analysis',
      'Budget recommendations',
      'Investment guidance',
      'Retirement planning'
    ],
    examplePrompts: [
      'Review my overall financial health',
      'How can I improve my savings rate?',
      'What should my financial priorities be this quarter?'
    ]
  },
  tax_specialist: {
    type: 'tax_specialist',
    name: 'Tax Specialist',
    description: 'Expert in tax planning, deductions, and compliance for freelancers',
    icon: Calculator,
    color: 'from-emerald-500 to-teal-500',
    systemPrompt: `You are a specialized Tax Advisor AI for Nexora, focused on helping Chicago-based freelancers and independent contractors with tax planning and optimization. Your expertise includes:

- Schedule C (Form 1040) for sole proprietors
- Quarterly estimated tax payments (Form 1040-ES)
- Self-employment tax calculations
- Illinois state tax requirements
- Chicago-specific business taxes
- Home office deduction (simplified and regular method)
- Vehicle expenses (standard mileage vs actual expenses)
- Business meal deductions (50% rule)
- Health insurance deduction for self-employed
- Retirement contributions (SEP-IRA, Solo 401k)
- Section 199A QBI deduction
- Equipment depreciation (Section 179)

Always reference specific tax forms, lines, and current IRS guidelines. Provide calculations when possible. Remind users about important deadlines. Be thorough but accessible.

Key 2024 Tax Deadlines:
- Q1 Estimated Tax: April 15, 2024
- Q2 Estimated Tax: June 17, 2024
- Q3 Estimated Tax: September 16, 2024
- Q4 Estimated Tax: January 15, 2025
- Tax Filing Deadline: April 15, 2025`,
    capabilities: [
      'Quarterly tax estimation',
      'Deduction identification',
      'Schedule C optimization',
      'State tax guidance',
      'Tax deadline reminders',
      'Audit preparation'
    ],
    examplePrompts: [
      'Calculate my estimated quarterly taxes',
      'What deductions am I missing?',
      'How do I handle home office deduction?'
    ]
  },
  cash_flow_analyst: {
    type: 'cash_flow_analyst',
    name: 'Cash Flow Analyst',
    description: 'Specialist in managing irregular freelance income and cash flow',
    icon: Activity,
    color: 'from-blue-500 to-cyan-500',
    systemPrompt: `You are a Cash Flow Analysis AI for Nexora, specialized in helping freelancers manage irregular income and maintain healthy cash flow. Your expertise includes:

- Cash flow forecasting and projections
- Emergency fund planning
- Income smoothing strategies
- Expense timing optimization
- Invoice management and collection
- Payment term negotiations
- Seasonal income planning
- Buffer account strategies
- Bill payment prioritization
- Cash reserve calculations

Help users understand their money flow patterns, predict future cash positions, and make informed decisions about timing of expenses and investments. Use concrete numbers and timeframes.

Focus on practical strategies for handling the feast-or-famine nature of freelance income. Recommend specific buffer amounts and emergency fund targets based on their income patterns.`,
    capabilities: [
      'Cash flow forecasting',
      'Income smoothing',
      'Emergency fund planning',
      'Expense timing',
      'Invoice management',
      'Runway calculation'
    ],
    examplePrompts: [
      'How many months of runway do I have?',
      'When can I afford a major purchase?',
      'How should I handle slow months?'
    ]
  },
  expense_optimizer: {
    type: 'expense_optimizer',
    name: 'Expense Optimizer',
    description: 'Expert in categorizing expenses and finding savings opportunities',
    icon: Receipt,
    color: 'from-orange-500 to-amber-500',
    systemPrompt: `You are an Expense Optimization AI for Nexora, focused on helping freelancers categorize, track, and optimize their business and personal expenses. Your expertise includes:

- Expense categorization best practices
- Business vs personal expense separation
- Subscription audit and optimization
- Vendor negotiation strategies
- Cost-cutting recommendations
- Software and tool stack optimization
- Office supply and equipment purchasing
- Travel expense optimization
- Meal and entertainment expense tracking
- Receipt organization and documentation

Help users understand where their money goes, identify unnecessary expenses, and find opportunities to reduce costs without sacrificing productivity. Be specific with recommendations and potential savings amounts.

Focus on the unique expense patterns of freelancers: software subscriptions, home office costs, professional development, marketing, and client entertainment.`,
    capabilities: [
      'Expense categorization',
      'Subscription auditing',
      'Cost reduction analysis',
      'Vendor comparison',
      'Receipt management',
      'Budget optimization'
    ],
    examplePrompts: [
      'Analyze my subscription expenses',
      'Where can I cut costs this month?',
      'Is this expense tax deductible?'
    ]
  },
  investment_advisor: {
    type: 'investment_advisor',
    name: 'Investment Advisor',
    description: 'Guidance on retirement accounts and investment strategies',
    icon: TrendingUp,
    color: 'from-violet-500 to-purple-500',
    systemPrompt: `You are an Investment Advisory AI for Nexora, specialized in helping freelancers build wealth through smart investment strategies. Your expertise includes:

- SEP-IRA setup and contribution strategies
- Solo 401(k) plans and benefits
- Traditional vs Roth IRA decisions
- Taxable brokerage account strategies
- Asset allocation for self-employed
- Risk tolerance assessment
- Diversification strategies
- Low-cost index fund investing
- Tax-loss harvesting
- Retirement income planning

Help users understand their investment options, make informed decisions about retirement accounts, and build long-term wealth. Consider their unique situation as freelancers with variable income.

Current 2024 Contribution Limits:
- SEP-IRA: Up to 25% of net self-employment earnings, max $69,000
- Solo 401(k): $23,000 employee + 25% employer, max $69,000
- Traditional/Roth IRA: $7,000 ($8,000 if 50+)`,
    capabilities: [
      'Retirement account guidance',
      'Investment allocation',
      'Risk assessment',
      'Tax-advantaged strategies',
      'Contribution optimization',
      'Long-term planning'
    ],
    examplePrompts: [
      'Should I open a SEP-IRA or Solo 401k?',
      'How much should I contribute to retirement?',
      'What investment allocation do you recommend?'
    ]
  },
  budget_planner: {
    type: 'budget_planner',
    name: 'Budget Planner',
    description: 'Help creating and maintaining effective budgets',
    icon: Target,
    color: 'from-pink-500 to-rose-500',
    systemPrompt: `You are a Budget Planning AI for Nexora, specialized in helping freelancers create and maintain effective budgets despite irregular income. Your expertise includes:

- Variable income budgeting strategies
- Zero-based budgeting for freelancers
- 50/30/20 rule adaptation
- Profit First methodology
- Goal-based budgeting
- Annual vs monthly budget planning
- Budget category recommendations
- Spending limit calculations
- Budget review and adjustment
- Financial goal setting

Help users create realistic, flexible budgets that work with their freelance lifestyle. Consider income variability, seasonal patterns, and both business and personal expenses.

Recommend specific budget categories and percentages based on their income level and goals. Help them balance immediate needs with long-term financial objectives.`,
    capabilities: [
      'Custom budget creation',
      'Category allocation',
      'Goal tracking',
      'Spending analysis',
      'Budget adjustments',
      'Financial milestones'
    ],
    examplePrompts: [
      'Create a budget based on my income',
      'How should I allocate my earnings?',
      'Help me save for a specific goal'
    ]
  },
  general: {
    type: 'general',
    name: 'General Assistant',
    description: 'General financial questions and guidance',
    icon: Sparkles,
    color: 'from-primary-500 to-purple-500',
    systemPrompt: `You are Nexora AI, a helpful financial assistant for freelancers and independent contractors. You can help with general financial questions, provide guidance, and direct users to specialized agents when needed.

Be friendly, helpful, and conversational. If a question requires specialized expertise, mention which agent would be best suited to help.`,
    capabilities: [
      'General financial Q&A',
      'Agent recommendations',
      'Basic calculations',
      'Resource guidance'
    ],
    examplePrompts: [
      'What can you help me with?',
      'Explain a financial concept',
      'Where should I start?'
    ]
  }
};

const suggestedPrompts: SuggestedPrompt[] = [
  {
    id: '1',
    icon: Calculator,
    title: 'Estimate my quarterly taxes',
    prompt: 'Can you help me estimate my Q1 quarterly tax payment? My gross income this quarter is approximately $25,000 and I have about $5,000 in business expenses.',
    category: 'Tax',
    agent: 'tax_specialist',
    popularity: 95
  },
  {
    id: '2',
    icon: TrendingUp,
    title: 'Analyze my spending patterns',
    prompt: 'Can you analyze my spending patterns and identify areas where I might be overspending? I want to understand where my money is going.',
    category: 'Analysis',
    agent: 'expense_optimizer',
    popularity: 88
  },
  {
    id: '3',
    icon: PiggyBank,
    title: 'Create a savings plan',
    prompt: 'Help me create a realistic savings plan to build a 6-month emergency fund. My monthly income varies between $5,000 and $10,000.',
    category: 'Planning',
    agent: 'budget_planner',
    popularity: 82
  },
  {
    id: '4',
    icon: Receipt,
    title: 'Find missed deductions',
    prompt: 'What potential tax deductions might I be missing as a freelance software developer working from home in Chicago?',
    category: 'Tax',
    agent: 'tax_specialist',
    popularity: 91
  },
  {
    id: '5',
    icon: Activity,
    title: 'Optimize my cash flow',
    prompt: 'How can I better manage my cash flow with irregular freelance income? I sometimes have great months followed by slow ones.',
    category: 'Cash Flow',
    agent: 'cash_flow_analyst',
    popularity: 85
  },
  {
    id: '6',
    icon: Target,
    title: 'Set financial goals',
    prompt: 'Help me set SMART financial goals for this year. I want to focus on building wealth while maintaining a comfortable lifestyle.',
    category: 'Planning',
    agent: 'financial_advisor',
    popularity: 79
  },
  {
    id: '7',
    icon: Shield,
    title: 'Retirement planning',
    prompt: 'I\'m 35 and haven\'t started saving for retirement. What are my best options as a freelancer, and how much should I be contributing?',
    category: 'Investment',
    agent: 'investment_advisor',
    popularity: 76
  },
  {
    id: '8',
    icon: Building2,
    title: 'Home office deduction',
    prompt: 'How do I calculate and claim the home office deduction? I use a dedicated room in my apartment for work.',
    category: 'Tax',
    agent: 'tax_specialist',
    popularity: 87
  },
  {
    id: '9',
    icon: Wallet,
    title: 'Budget for variable income',
    prompt: 'How should I budget when my income varies significantly month to month? What percentage should go to different categories?',
    category: 'Budget',
    agent: 'budget_planner',
    popularity: 83
  },
  {
    id: '10',
    icon: CreditCard,
    title: 'Separate business expenses',
    prompt: 'What\'s the best way to separate business and personal expenses? Do I need a business bank account and credit card?',
    category: 'Organization',
    agent: 'expense_optimizer',
    popularity: 80
  },
  {
    id: '11',
    icon: Calendar,
    title: 'Tax deadline reminders',
    prompt: 'What are all the important tax deadlines I need to know about as a freelancer for this year?',
    category: 'Tax',
    agent: 'tax_specialist',
    popularity: 89
  },
  {
    id: '12',
    icon: DollarSign,
    title: 'Pricing my services',
    prompt: 'How should I think about pricing my freelance services? What factors should I consider when setting my rates?',
    category: 'Business',
    agent: 'financial_advisor',
    popularity: 74
  }
];

const quickActions: QuickAction[] = [
  {
    id: '1',
    icon: Calculator,
    label: 'Quick Tax Estimate',
    description: 'Get a rough quarterly tax estimate',
    action: () => {}
  },
  {
    id: '2',
    icon: PieChart,
    label: 'Expense Breakdown',
    description: 'See your spending by category',
    action: () => {}
  },
  {
    id: '3',
    icon: Activity,
    label: 'Cash Flow Check',
    description: 'Review your runway and cash position',
    action: () => {}
  },
  {
    id: '4',
    icon: FileText,
    label: 'Generate Report',
    description: 'Create a financial summary report',
    action: () => {}
  }
];

// ============================================
// ANIMATIONS
// ============================================

const messageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

const sidebarVariants = {
  initial: { x: -280, opacity: 0 },
  animate: { 
    x: 0, 
    opacity: 1,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }
  },
  exit: {
    x: -280,
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

const fadeInVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } }
};

const slideUpVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
  }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05
    }
  }
};

const pulseAnimation = {
  scale: [1, 1.05, 1],
  opacity: [0.7, 1, 0.7],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut"
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function detectAgent(message: string): AgentType {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('tax') || lowerMessage.includes('deduction') || lowerMessage.includes('irs') || lowerMessage.includes('schedule c') || lowerMessage.includes('1099') || lowerMessage.includes('quarterly')) {
    return 'tax_specialist';
  }
  if (lowerMessage.includes('cash flow') || lowerMessage.includes('runway') || lowerMessage.includes('invoice') || lowerMessage.includes('payment')) {
    return 'cash_flow_analyst';
  }
  if (lowerMessage.includes('expense') || lowerMessage.includes('spending') || lowerMessage.includes('subscription') || lowerMessage.includes('cost')) {
    return 'expense_optimizer';
  }
  if (lowerMessage.includes('invest') || lowerMessage.includes('retirement') || lowerMessage.includes('401k') || lowerMessage.includes('ira') || lowerMessage.includes('stock')) {
    return 'investment_advisor';
  }
  if (lowerMessage.includes('budget') || lowerMessage.includes('save') || lowerMessage.includes('goal') || lowerMessage.includes('plan')) {
    return 'budget_planner';
  }
  
  return 'financial_advisor';
}

function formatMessageContent(content: string): string {
  // Convert markdown-style formatting to display properly
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}

// ============================================
// OPENAI API SERVICE
// ============================================

class OpenAIService {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async *streamCompletion(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    onToken?: (token: string) => void
  ): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get AI response');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            
            if (token) {
              onToken?.(token);
              yield token;
            }
          } catch {
            // Ignore parsing errors for incomplete chunks
          }
        }
      }
    }
  }

  async getCompletion(
    messages: { role: string; content: string }[],
    systemPrompt: string
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get AI response');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}

const openaiService = new OpenAIService(OPENAI_API_KEY);

// ============================================
// TYPING INDICATOR COMPONENT
// ============================================

function TypingIndicator({ agentName }: { agentName?: string }) {
  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex flex-col gap-1">
        {agentName && (
          <span className="text-xs font-medium text-primary-400">{agentName}</span>
        )}
        <div className="px-4 py-3 bg-dark-800/80 backdrop-blur-sm border border-dark-700/50 rounded-2xl rounded-tl-md">
          <div className="flex items-center gap-1.5">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
              className="w-2 h-2 bg-primary-400 rounded-full"
            />
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
              className="w-2 h-2 bg-primary-400 rounded-full"
            />
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
              className="w-2 h-2 bg-primary-400 rounded-full"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// MESSAGE COMPONENT
// ============================================

function MessageBubble({ 
  message, 
  onCopy,
  onFeedback,
  onRetry,
  isLatest
}: { 
  message: Message;
  onCopy: (content: string) => void;
  onFeedback: (id: string, feedback: 'positive' | 'negative') => void;
  onRetry?: () => void;
  isLatest?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isUser = message.role === 'user';
  const agentConfig = message.agent ? agentConfigs[message.agent] : null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    if (message.isError) {
      return (
        <div className="flex items-start gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm text-red-400/80 mt-1">{message.errorMessage || 'An error occurred. Please try again.'}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-red-400 border-red-500/30 hover:bg-red-500/10"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={onRetry}
              >
                Retry
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div 
        className="whitespace-pre-wrap text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
        dangerouslySetInnerHTML={{ 
          __html: message.isStreaming 
            ? formatMessageContent(message.content) + '<span class="inline-block w-0.5 h-4 bg-primary-400 ml-0.5 animate-pulse"></span>'
            : formatMessageContent(message.content)
        }}
      />
    );
  };

  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        "flex items-start gap-3 group",
        isUser && "flex-row-reverse"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg",
        isUser 
          ? "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/20"
          : agentConfig
            ? `bg-gradient-to-br ${agentConfig.color} shadow-primary-500/20`
            : "bg-gradient-to-br from-primary-500 to-purple-500 shadow-primary-500/20"
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : agentConfig ? (
          <agentConfig.icon className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex flex-col gap-1.5 max-w-[85%] min-w-0",
        isUser && "items-end"
      )}>
        {/* Agent Name */}
        {!isUser && agentConfig && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-medium text-primary-400">{agentConfig.name}</span>
            {message.processingTime && (
              <span className="text-xs text-dark-500">• {(message.processingTime / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}

        {/* Message Bubble */}
        <div className={cn(
          "relative px-4 py-3 rounded-2xl",
          isUser
            ? "bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-tr-md shadow-lg shadow-primary-500/20"
            : "bg-dark-800/80 backdrop-blur-sm border border-dark-700/50 text-dark-100 rounded-tl-md"
        )}>
          {renderContent()}

          {/* Message Actions */}
          {message.actions && message.actions.length > 0 && !message.isStreaming && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-dark-700/50">
              {message.actions.map((action) => (
                <Button
                  key={action.id}
                  variant={action.variant === 'primary' ? 'primary' : 'outline'}
                  size="sm"
                  leftIcon={action.icon ? <action.icon className="w-3.5 h-3.5" /> : undefined}
                  onClick={action.onClick}
                  className="text-xs"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Actions Bar (for assistant messages) */}
        {!isUser && !message.isStreaming && !message.isError && (
          <AnimatePresence>
            {(showActions || isLatest) && (
              <motion.div
                variants={fadeInVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex items-center gap-1 px-1"
              >
                <button
                  onClick={handleCopy}
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    copied 
                      ? "text-emerald-400 bg-emerald-500/20" 
                      : "text-dark-500 hover:text-white hover:bg-white/10"
                  )}
                  title="Copy message"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => onFeedback(message.id, 'positive')}
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    message.feedback === 'positive'
                      ? "text-emerald-400 bg-emerald-500/20"
                      : "text-dark-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                  )}
                  title="Good response"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback(message.id, 'negative')}
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    message.feedback === 'negative'
                      ? "text-red-400 bg-red-500/20"
                      : "text-dark-500 hover:text-red-400 hover:bg-red-500/10"
                  )}
                  title="Bad response"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="p-1.5 rounded-lg text-dark-500 hover:text-white hover:bg-white/10 transition-all duration-200"
                    title="Regenerate response"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Timestamp */}
        <span className="text-xs text-dark-500 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================
// WELCOME SCREEN COMPONENT
// ============================================

function WelcomeScreen({ 
  onSelectPrompt,
  onSelectAgent 
}: { 
  onSelectPrompt: (prompt: string, agent?: AgentType) => void;
  onSelectAgent: (agent: AgentType) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const categories = ['all', 'Tax', 'Analysis', 'Planning', 'Cash Flow', 'Investment', 'Budget'];

  const filteredPrompts = activeCategory === 'all' 
    ? suggestedPrompts 
    : suggestedPrompts.filter(p => p.category === activeCategory);

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="max-w-4xl mx-auto px-4 py-8"
    >
      {/* Hero Section */}
      <motion.div variants={slideUpVariants} className="text-center mb-12">
        <motion.div
          animate={pulseAnimation}
          className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-primary-500/30"
        >
          <Sparkles className="w-12 h-12 text-white" />
        </motion.div>
        
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          How can I help you today?
        </h1>
        <p className="text-lg text-dark-400 max-w-2xl mx-auto">
          Your intelligent financial co-pilot — ask anything about budgeting, taxes,
          investments, or wealth-building and get expert-level answers instantly.
        </p>
      </motion.div>

      {/* Category Filter */}
      <motion.div variants={slideUpVariants} className="flex items-center justify-center gap-2 mb-6 flex-wrap">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
              activeCategory === category
                ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
                : "bg-dark-800/50 text-dark-400 hover:text-white hover:bg-dark-800"
            )}
          >
            {category === 'all' ? 'All Topics' : category}
          </button>
        ))}
      </motion.div>

      {/* Suggested Prompts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPrompts.map((prompt, index) => (
          <motion.button
            key={prompt.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            onClick={() => onSelectPrompt(prompt.prompt, prompt.agent)}
            className="group p-5 bg-dark-800/50 border border-dark-700/50 rounded-xl text-left hover:bg-dark-800 hover:border-primary-500/30 transition-all duration-300"
          >
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300",
                "bg-primary-500/20 text-primary-400",
                "group-hover:bg-primary-500/30 group-hover:scale-110"
              )}>
                <prompt.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white group-hover:text-primary-400 transition-colors mb-1">
                  {prompt.title}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-dark-700 text-dark-400">
                  {prompt.category}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-dark-600 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
            </div>
          </motion.button>
        ))}
      </div>

    </motion.div>
  );
}

// ============================================
// CONVERSATION SIDEBAR
// ============================================

function ConversationSidebar({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onPin,
  isOpen,
  onClose
}: {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedConversations = filteredConversations.filter(c => c.isPinned);
  const recentConversations = filteredConversations.filter(c => !c.isPinned);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            variants={fadeInVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Sidebar */}
          <motion.div
            variants={sidebarVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed lg:relative left-0 top-0 h-full w-80 bg-dark-900/95 backdrop-blur-xl border-r border-dark-800 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-dark-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Conversations</h2>
                <button
                  onClick={onClose}
                  className="lg:hidden p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <Button
                variant="primary"
                fullWidth
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={onNew}
                className="mb-4"
              >
                New Conversation
              </Button>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-dark-800/50 border border-dark-700 rounded-xl text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto p-2">
              {/* Pinned */}
              {pinnedConversations.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-medium text-dark-500 uppercase tracking-wider px-3 mb-2">
                    Pinned
                  </h3>
                  <div className="space-y-1">
                    {pinnedConversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={currentId === conv.id}
                        onSelect={() => onSelect(conv.id)}
                        onDelete={() => onDelete(conv.id)}
                        onPin={() => onPin(conv.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent */}
              {recentConversations.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-dark-500 uppercase tracking-wider px-3 mb-2">
                    Recent
                  </h3>
                  <div className="space-y-1">
                    {recentConversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={currentId === conv.id}
                        onSelect={() => onSelect(conv.id)}
                        onDelete={() => onDelete(conv.id)}
                        onPin={() => onPin(conv.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredConversations.length === 0 && (
                <div className="text-center py-8 text-dark-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onPin
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const agentConfig = conversation.agent ? agentConfigs[conversation.agent] : null;

  return (
    <div
      className={cn(
        "relative group rounded-xl transition-all duration-200",
        isActive
          ? "bg-primary-500/20 border border-primary-500/30"
          : "hover:bg-dark-800 border border-transparent"
      )}
    >
      <button
        onClick={onSelect}
        className="w-full p-3 text-left"
      >
        <div className="flex items-start gap-3">
          {agentConfig && (
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              `bg-gradient-to-br ${agentConfig.color}`
            )}>
              <agentConfig.icon className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={cn(
                "font-medium truncate text-sm",
                isActive ? "text-primary-400" : "text-white"
              )}>
                {conversation.title}
              </h4>
              {conversation.isPinned && (
                <Bookmark className="w-3 h-3 text-primary-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-dark-500 truncate mt-1">
              {conversation.lastMessage}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-dark-600">
              <span>{conversation.messageCount} messages</span>
              <span>•</span>
              <span>{formatDate(conversation.timestamp, 'relative')}</span>
            </div>
          </div>
        </div>
      </button>

      {/* Actions Menu */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 rounded-lg text-dark-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              variants={fadeInVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute right-0 top-full mt-1 w-40 bg-dark-800 border border-dark-700 rounded-xl shadow-xl py-1 z-10"
            >
              <button
                onClick={() => { onPin(); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
              >
                {conversation.isPinned ? (
                  <>
                    <MinusCircle className="w-4 h-4" />
                    Unpin
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-4 h-4" />
                    Pin
                  </>
                )}
              </button>
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================
// CHAT INPUT COMPONENT
// ============================================

function ChatInput({
  value,
  onChange,
  onSend,
  onCancel,
  isLoading,
  disabled,
  placeholder,
  selectedAgent
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  isLoading: boolean;
  disabled: boolean;
  placeholder?: string;
  selectedAgent?: AgentType;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading && !disabled) {
        onSend();
      }
    }
    if (e.key === 'Escape' && isLoading && onCancel) {
      onCancel();
    }
  };

  const agentConfig = selectedAgent ? agentConfigs[selectedAgent] : null;

  return (
    <div className="p-4 border-t border-dark-800/50 bg-dark-900/80 backdrop-blur-xl">
      <div className="max-w-4xl mx-auto">
        {/* Agent Indicator */}
        {agentConfig && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-3 px-2"
          >
            <div className={cn(
              "w-6 h-6 rounded-lg flex items-center justify-center",
              `bg-gradient-to-br ${agentConfig.color}`
            )}>
              <agentConfig.icon className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs text-dark-400">
              Talking to <span className="text-primary-400 font-medium">{agentConfig.name}</span>
            </span>
          </motion.div>
        )}

        {/* Input Container */}
        <div className={cn(
          "relative flex items-end gap-3 p-3 bg-dark-800/50 border rounded-2xl transition-all duration-200",
          isFocused ? "border-primary-500/50 shadow-lg shadow-primary-500/10" : "border-dark-700/50"
        )}>
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder || "Ask me anything about your finances..."}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-dark-500 resize-none focus:outline-none text-sm py-1.5 px-1 max-h-[200px] scrollbar-thin"
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Button
                variant="danger"
                size="icon"
                onClick={onCancel}
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="icon"
                onClick={onSend}
                disabled={!value.trim() || disabled}
                className={cn(
                  "transition-all duration-200",
                  value.trim() && "shadow-lg shadow-primary-500/30"
                )}
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Char Count */}
        {value.length > 0 && (
          <div className="flex justify-end mt-2 px-2">
            <p className="text-xs text-dark-600">{value.length} characters</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN ADVISOR COMPONENT
// ============================================

export default function Advisor() {
  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('financial_advisor');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom only when new messages arrive (not on page load)
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Close agent dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setAgentDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Copy message content
  const handleCopy = useCallback(async (content: string) => {
    await navigator.clipboard.writeText(content);
  }, []);

  // Handle feedback
  const handleFeedback = useCallback((id: string, feedback: 'positive' | 'negative') => {
    setMessages(prev => prev.map(msg => 
      msg.id === id 
        ? { ...msg, feedback: msg.feedback === feedback ? null : feedback } 
        : msg
    ));
  }, []);

  // Cancel streaming
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStreamingMessageId(null);
    
    // Mark the last assistant message as complete
    setMessages(prev => prev.map(msg => 
      msg.isStreaming ? { ...msg, isStreaming: false } : msg
    ));
  }, []);

  // Send message with real AI
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Detect appropriate agent based on message content
    const detectedAgent = detectAgent(userMessage.content);
    const agentToUse = selectedAgent || detectedAgent;
    const agentConfig = agentConfigs[agentToUse];

    // Create assistant message placeholder
    const assistantMessageId = generateMessageId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      agent: agentToUse,
      agentName: agentConfig.name,
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);
    setStreamingMessageId(assistantMessageId);

    const startTime = Date.now();

    try {
      // Prepare conversation history for context
      const conversationHistory = messages
        .filter(m => m.role !== 'system')
        .slice(-10) // Keep last 10 messages for context
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }));

      // Add the new user message
      conversationHistory.push({
        role: 'user',
        content: userMessage.content
      });

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Stream the response via backend (keeps API key server-side)
      let fullContent = '';

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const authToken = localStorage.getItem('access_token');
      const streamResponse = await fetch(`${apiUrl}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content: userMessage.content }),
        signal: abortControllerRef.current?.signal,
      });

      if (!streamResponse.ok) {
        const errData = await streamResponse.json().catch(() => ({ detail: `Server error ${streamResponse.status}` }));
        throw new Error(errData.detail || `Server error: ${streamResponse.status}`);
      }

      const reader = streamResponse.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body from server');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            let chunk = '';
            try {
              const parsed = JSON.parse(data);
              if (parsed && typeof parsed === 'object' && parsed.error) {
                throw new Error('I\'m having trouble connecting right now. Please try again in a moment.');
              }
              chunk = typeof parsed === 'string' ? parsed : '';
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) {
                chunk = data; // fallback for non-JSON chunks
              } else {
                throw parseErr; // re-throw intentional errors to outer catch
              }
            }
            if (chunk) {
              fullContent += chunk;
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: fullContent }
                  : msg
              ));
            }
          }
        }
      }

      const processingTime = Date.now() - startTime;

      // Finalize the message
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { 
              ...msg, 
              content: fullContent, 
              isStreaming: false,
              processingTime,
              actions: generateContextualActions(fullContent, agentToUse)
            }
          : msg
      ));

      // Update conversation title if this is a new conversation
      if (!currentConversationId) {
        const newConversation: Conversation = {
          id: generateMessageId(),
          title: userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : ''),
          lastMessage: fullContent.slice(0, 100) + '...',
          timestamp: new Date(),
          messageCount: 2,
          agent: agentToUse
        };
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversationId(newConversation.id);
      }

    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      const errorMessage = rawMessage.startsWith('I\'m having')
        ? rawMessage
        : 'I\'m having trouble connecting right now. Please try again in a moment.';

      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: '',
              isStreaming: false,
              isError: true,
              errorMessage
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  }, [inputValue, isLoading, messages, selectedAgent, currentConversationId]);

  // Generate contextual action buttons based on response
  const generateContextualActions = (content: string, agent: AgentType): MessageAction[] => {
    const actions: MessageAction[] = [];
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('tax') || lowerContent.includes('deduction')) {
      actions.push({
        id: '1',
        label: 'View Tax Summary',
        type: 'link',
        icon: Calculator,
        href: '/tax'
      });
    }

    if (lowerContent.includes('budget') || lowerContent.includes('spending')) {
      actions.push({
        id: '2',
        label: 'See Transactions',
        type: 'link',
        icon: Receipt,
        href: '/transactions'
      });
    }

    if (lowerContent.includes('account') || lowerContent.includes('balance')) {
      actions.push({
        id: '3',
        label: 'View Accounts',
        type: 'link',
        icon: Wallet,
        href: '/accounts'
      });
    }

    return actions.slice(0, 3); // Max 3 actions
  };

  // Handle prompt selection from welcome screen
  const handlePromptSelect = (prompt: string, agent?: AgentType) => {
    if (agent) {
      setSelectedAgent(agent);
    }
    setInputValue(prompt);
    // Auto-send after a brief delay
    setTimeout(() => {
      if (prompt.trim()) {
        setInputValue(prompt);
      }
    }, 100);
  };

  // Handle agent selection
  const handleAgentSelect = (agent: AgentType) => {
    setSelectedAgent(agent);

    // Only inject a system message when already in a conversation
    if (messages.length > 0) {
      const config = agentConfigs[agent];
      const systemMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: `Switched to **${config.name}**. ${config.description}\n\nHow can I help you today?`,
        timestamp: new Date(),
        agent: agent,
        agentName: config.name,
      };
      setMessages(prev => [...prev, systemMessage]);
    }
  };

  // New conversation
  const handleNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setSelectedAgent('financial_advisor');
    setSidebarOpen(false);
  };

  // Select conversation
  const handleSelectConversation = (id: string) => {
    const conversation = conversations.find(c => c.id === id);
    setCurrentConversationId(id);
    if (conversation?.agent) {
      setSelectedAgent(conversation.agent);
    }
    // In a real app, would load messages from backend
    setMessages([]);
    setSidebarOpen(false);
  };

  // Delete conversation
  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      handleNewConversation();
    }
  };

  // Pin conversation
  const handlePinConversation = (id: string) => {
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, isPinned: !c.isPinned } : c
    ));
  };

  // Retry last message
  const handleRetry = useCallback(() => {
    // Remove the last assistant message and resend
    setMessages(prev => {
      const withoutLastAssistant = [...prev];
      while (withoutLastAssistant.length && withoutLastAssistant[withoutLastAssistant.length - 1].role === 'assistant') {
        withoutLastAssistant.pop();
      }
      return withoutLastAssistant;
    });
    
    // Get the last user message and resend
    const lastUserMessage = messages.findLast(m => m.role === 'user');
    if (lastUserMessage) {
      setInputValue(lastUserMessage.content);
    }
  }, [messages]);

  const currentAgentConfig = agentConfigs[selectedAgent];

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 bg-dark-950">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        currentId={currentConversationId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        onPin={handlePinConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-purple-500/5" />
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }}
          />
        </div>

        {/* Header */}
        <div className="relative z-20 flex items-center justify-between p-4 border-b border-dark-800/50 bg-dark-900/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shadow-lg",
              `bg-gradient-to-br ${currentAgentConfig.color}`
            )}>
              <currentAgentConfig.icon className="w-5 h-5 text-white" />
            </div>
            
            <div>
              <h2 className="font-semibold text-white">{currentAgentConfig.name}</h2>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs text-dark-400">Online • Powered by GPT-4</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Agent Selector Dropdown */}
            <div className="relative" ref={agentDropdownRef}>
              <button
                onClick={() => setAgentDropdownOpen(prev => !prev)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-200 text-sm font-medium",
                  agentDropdownOpen
                    ? "bg-primary-500/15 border-primary-500/40 text-primary-300"
                    : "bg-dark-800/60 border-dark-700/60 text-dark-300 hover:bg-dark-800 hover:border-dark-600 hover:text-white"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0",
                  `bg-gradient-to-br ${currentAgentConfig.color}`
                )}>
                  <currentAgentConfig.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="hidden sm:block">{currentAgentConfig.name}</span>
                <motion.div
                  animate={{ rotate: agentDropdownOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </motion.div>
              </button>

              <AnimatePresence>
                {agentDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-72 bg-dark-800/95 backdrop-blur-xl border border-dark-700/80 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50"
                  >
                    <div className="px-3 py-2.5 border-b border-dark-700/60">
                      <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Switch Advisor</p>
                    </div>
                    <div className="p-2">
                      {Object.values(agentConfigs).filter(a => a.type !== 'general').map((agent, i) => {
                        const isSelected = selectedAgent === agent.type;
                        return (
                          <motion.button
                            key={agent.type}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.15 }}
                            onClick={() => { handleAgentSelect(agent.type); setAgentDropdownOpen(false); }}
                            className={cn(
                              "w-full px-3 py-2.5 rounded-xl text-left flex items-center gap-3 transition-all duration-150",
                              isSelected
                                ? "bg-primary-500/15 border border-primary-500/25"
                                : "hover:bg-white/5 border border-transparent"
                            )}
                          >
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg",
                              `bg-gradient-to-br ${agent.color}`
                            )}>
                              <agent.icon className="w-4.5 h-4.5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-semibold",
                                isSelected ? "text-primary-300" : "text-white"
                              )}>
                                {agent.name}
                              </p>
                              <p className="text-xs text-dark-500 truncate">{agent.description}</p>
                            </div>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0"
                              >
                                <Check className="w-3 h-3 text-primary-400" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={handleNewConversation}
            >
              New Chat
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="max-w-4xl mx-auto py-6 px-4">
            {messages.length === 0 ? (
              <WelcomeScreen 
                onSelectPrompt={handlePromptSelect}
                onSelectAgent={handleAgentSelect}
              />
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-6"
              >
                <AnimatePresence mode="popLayout">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onCopy={handleCopy}
                      onFeedback={handleFeedback}
                      onRetry={index === messages.length - 1 && message.role === 'assistant' ? handleRetry : undefined}
                      isLatest={index === messages.length - 1}
                    />
                  ))}
                </AnimatePresence>
                
                {isLoading && !streamingMessageId && (
                  <TypingIndicator agentName={currentAgentConfig.name} />
                )}
              </motion.div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onCancel={handleCancel}
          isLoading={isLoading}
          disabled={false}
          selectedAgent={selectedAgent}
          placeholder={`Ask ${currentAgentConfig.name} anything...`}
        />
      </div>
    </div>
  );
}