"""AI Services module."""
from app.services.ai.engine import AIEngine
from app.services.ai.agent_orchestrator import AgentOrchestrator, BaseAgent
from app.services.ai.insights import InsightEngine, RealTimeInsightGenerator
from app.services.ai.categorization import SmartCategorizer, ReceiptOCR, MerchantClassifier
from app.services.ai.forecasting import CashFlowForecaster, IncomePredictor, ExpensePredictor
from app.services.ai.anomaly import AnomalyDetector, FraudDetector, SpendingAnalyzer
from app.services.ai.recommendations import RecommendationEngine, ActionGenerator
from app.services.ai.context import FinancialContextBuilder, ContextManager

__all__ = [
    "AIEngine",
    "AgentOrchestrator",
    "BaseAgent",
    "InsightEngine",
    "RealTimeInsightGenerator",
    "SmartCategorizer",
    "ReceiptOCR",
    "MerchantClassifier",
    "CashFlowForecaster",
    "IncomePredictor",
    "ExpensePredictor",
    "AnomalyDetector",
    "FraudDetector",
    "SpendingAnalyzer",
    "RecommendationEngine",
    "ActionGenerator",
    "FinancialContextBuilder",
    "ContextManager",
]