import asyncio
import json
import logging
import statistics
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.services.ai.engine import AIEngine, AIResponse
from app.services.ai.context import FinancialContext
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)


class AnomalyType(str, Enum):
    LARGE_TRANSACTION = "large_transaction"
    UNUSUAL_MERCHANT = "unusual_merchant"
    DUPLICATE_TRANSACTION = "duplicate_transaction"
    SPENDING_SPIKE = "spending_spike"
    UNUSUAL_TIME = "unusual_time"
    CATEGORY_OUTLIER = "category_outlier"
    FREQUENCY_ANOMALY = "frequency_anomaly"
    POTENTIAL_FRAUD = "potential_fraud"


class AnomalySeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Anomaly:
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    title: str
    description: str
    
    transaction_id: Optional[str] = None
    transaction_ids: List[str] = field(default_factory=list)
    
    amount: float = 0.0
    expected_amount: Optional[float] = None
    deviation: float = 0.0
    
    merchant: Optional[str] = None
    category: Optional[str] = None
    
    confidence: float = 0.7
    
    recommended_action: str = ""
    is_reviewed: bool = False
    is_false_positive: bool = False
    
    detected_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.anomaly_type.value,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "transaction_id": self.transaction_id,
            "amount": self.amount,
            "expected_amount": self.expected_amount,
            "deviation": self.deviation,
            "merchant": self.merchant,
            "confidence": self.confidence,
            "recommended_action": self.recommended_action,
            "detected_at": self.detected_at.isoformat(),
        }


class AnomalyDetector:
    def __init__(self, engine: AIEngine, db: Session):
        self.engine = engine
        self.db = db
    
    async def detect_anomalies(
        self,
        user_id: str,
        context: FinancialContext,
        days: int = 30,
    ) -> List[Anomaly]:
        anomalies = []
        
        cutoff = date.today() - timedelta(days=days)
        transactions = self.db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= cutoff,
        ).all()
        
        historical = self.db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= date.today() - timedelta(days=180),
            Transaction.transaction_date < cutoff,
        ).all()
        
        anomalies.extend(self._detect_large_transactions(transactions, context))
        anomalies.extend(self._detect_duplicates(transactions))
        anomalies.extend(self._detect_spending_spikes(transactions, historical, context))
        anomalies.extend(self._detect_unusual_merchants(transactions, historical))
        anomalies.extend(self._detect_category_outliers(transactions, historical))
        
        anomalies.sort(key=lambda a: (
            {"critical": 0, "high": 1, "medium": 2, "low": 3}[a.severity.value],
            -a.confidence,
        ))
        
        return anomalies
    
    def _detect_large_transactions(
        self,
        transactions: List[Transaction],
        context: FinancialContext,
    ) -> List[Anomaly]:
        anomalies = []
        threshold = context.income.average_monthly_income * 0.5 if context.income.average_monthly_income else 1000
        
        for txn in transactions:
            if abs(txn.amount) > threshold and not txn.is_income:
                severity = AnomalySeverity.HIGH if abs(txn.amount) > threshold * 2 else AnomalySeverity.MEDIUM
                
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.LARGE_TRANSACTION,
                    severity=severity,
                    title=f"Large Transaction: ${abs(txn.amount):,.2f}",
                    description=f"Transaction at {txn.merchant_name or 'Unknown'} for ${abs(txn.amount):,.2f} exceeds your typical spending",
                    transaction_id=str(txn.id),
                    amount=abs(txn.amount),
                    expected_amount=threshold,
                    deviation=abs(txn.amount) / threshold,
                    merchant=txn.merchant_name,
                    confidence=0.85,
                    recommended_action="Verify this transaction is legitimate and categorize appropriately",
                ))
        
        return anomalies
    
    def _detect_duplicates(self, transactions: List[Transaction]) -> List[Anomaly]:
        anomalies = []
        
        groups = defaultdict(list)
        for txn in transactions:
            key = (
                txn.merchant_name_normalized or txn.merchant_name,
                round(abs(txn.amount), 2),
            )
            groups[key].append(txn)
        
        for (merchant, amount), txns in groups.items():
            if len(txns) >= 2:
                dates = [t.transaction_date for t in txns]
                date_diffs = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
                
                close_together = any(diff <= 1 for diff in date_diffs)
                
                if close_together and merchant:
                    anomalies.append(Anomaly(
                        anomaly_type=AnomalyType.DUPLICATE_TRANSACTION,
                        severity=AnomalySeverity.MEDIUM,
                        title=f"Potential Duplicate: {merchant}",
                        description=f"Found {len(txns)} transactions of ${amount:,.2f} at {merchant} within close dates",
                        transaction_ids=[str(t.id) for t in txns],
                        amount=amount * len(txns),
                        merchant=merchant,
                        confidence=0.75,
                        recommended_action="Review these transactions to confirm they are not duplicates",
                    ))
        
        return anomalies
    
    def _detect_spending_spikes(
        self,
        recent: List[Transaction],
        historical: List[Transaction],
        context: FinancialContext,
    ) -> List[Anomaly]:
        anomalies = []
        
        hist_by_category = defaultdict(list)
        for txn in historical:
            if not txn.is_income:
                category = txn.category_display
                hist_by_category[category].append(abs(txn.amount))
        
        recent_by_category = defaultdict(float)
        for txn in recent:
            if not txn.is_income:
                category = txn.category_display
                recent_by_category[category] += abs(txn.amount)
        
        for category, recent_total in recent_by_category.items():
            hist_amounts = hist_by_category.get(category, [])
            
            if len(hist_amounts) >= 3:
                hist_mean = statistics.mean(hist_amounts)
                hist_std = statistics.stdev(hist_amounts) if len(hist_amounts) > 1 else hist_mean * 0.3
                
                monthly_average = sum(hist_amounts) / 6
                
                if recent_total > monthly_average * 2 and recent_total > 100:
                    anomalies.append(Anomaly(
                        anomaly_type=AnomalyType.SPENDING_SPIKE,
                        severity=AnomalySeverity.MEDIUM,
                        title=f"Spending Spike: {category}",
                        description=f"Spent ${recent_total:,.2f} on {category} this month, vs average of ${monthly_average:,.2f}",
                        amount=recent_total,
                        expected_amount=monthly_average,
                        deviation=recent_total / monthly_average if monthly_average > 0 else 0,
                        category=category,
                        confidence=0.80,
                        recommended_action=f"Review {category} spending to understand the increase",
                    ))
        
        return anomalies
    
    def _detect_unusual_merchants(
        self,
        recent: List[Transaction],
        historical: List[Transaction],
    ) -> List[Anomaly]:
        anomalies = []
        
        known_merchants = set()
        for txn in historical:
            if txn.merchant_name_normalized:
                known_merchants.add(txn.merchant_name_normalized)
        
        for txn in recent:
            merchant = txn.merchant_name_normalized or txn.merchant_name
            if merchant and merchant not in known_merchants and abs(txn.amount) > 50:
                if not txn.is_income:
                    anomalies.append(Anomaly(
                        anomaly_type=AnomalyType.UNUSUAL_MERCHANT,
                        severity=AnomalySeverity.LOW,
                        title=f"New Merchant: {txn.merchant_name}",
                        description=f"First transaction with {txn.merchant_name} for ${abs(txn.amount):,.2f}",
                        transaction_id=str(txn.id),
                        amount=abs(txn.amount),
                        merchant=txn.merchant_name,
                        confidence=0.60,
                        recommended_action="Verify this merchant and categorize the transaction",
                    ))
        
        return anomalies
    
    def _detect_category_outliers(
        self,
        recent: List[Transaction],
        historical: List[Transaction],
    ) -> List[Anomaly]:
        anomalies = []
        
        hist_by_category = defaultdict(list)
        for txn in historical:
            if not txn.is_income and txn.user_category:
                hist_by_category[txn.user_category].append(abs(txn.amount))
        
        for txn in recent:
            if not txn.is_income and txn.user_category:
                hist_amounts = hist_by_category.get(txn.user_category, [])
                
                if len(hist_amounts) >= 5:
                    mean = statistics.mean(hist_amounts)
                    std = statistics.stdev(hist_amounts)
                    
                    if std > 0 and abs(txn.amount) > mean + 2 * std:
                        anomalies.append(Anomaly(
                            anomaly_type=AnomalyType.CATEGORY_OUTLIER,
                            severity=AnomalySeverity.LOW,
                            title=f"Unusual {txn.user_category} Transaction",
                            description=f"${abs(txn.amount):,.2f} is unusually high for {txn.user_category} (avg: ${mean:,.2f})",
                            transaction_id=str(txn.id),
                            amount=abs(txn.amount),
                            expected_amount=mean,
                            deviation=(abs(txn.amount) - mean) / std if std > 0 else 0,
                            category=txn.user_category,
                            confidence=0.70,
                            recommended_action="Verify this transaction amount is correct",
                        ))
        
        return anomalies


class SpendingAnalyzer:
    def __init__(self, db: Session):
        self.db = db
    
    def analyze_spending_patterns(
        self,
        user_id: str,
        months: int = 6,
    ) -> Dict[str, Any]:
        cutoff = date.today() - timedelta(days=months * 30)
        
        transactions = self.db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.is_income == False,
            Transaction.is_transfer == False,
            Transaction.transaction_date >= cutoff,
        ).all()
        
        by_category = defaultdict(lambda: {"total": 0, "count": 0, "amounts": [], "merchants": set()})
        by_month = defaultdict(lambda: {"income": 0, "expenses": 0})
        by_day_of_week = defaultdict(float)
        
        for txn in transactions:
            category = txn.category_display
            amount = abs(txn.amount)
            
            by_category[category]["total"] += amount
            by_category[category]["count"] += 1
            by_category[category]["amounts"].append(amount)
            if txn.merchant_name:
                by_category[category]["merchants"].add(txn.merchant_name)
            
            month_key = txn.transaction_date.strftime("%Y-%m")
            by_month[month_key]["expenses"] += amount
            
            day = txn.transaction_date.weekday()
            by_day_of_week[day] += amount
        
        category_analysis = {}
        for cat, data in by_category.items():
            amounts = data["amounts"]
            category_analysis[cat] = {
                "total": data["total"],
                "count": data["count"],
                "average": statistics.mean(amounts) if amounts else 0,
                "median": statistics.median(amounts) if amounts else 0,
                "max": max(amounts) if amounts else 0,
                "top_merchants": list(data["merchants"])[:5],
            }
        
        monthly_trend = [
            {"month": k, "expenses": v["expenses"]}
            for k, v in sorted(by_month.items())
        ]
        
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        spending_by_day = {day_names[k]: v for k, v in by_day_of_week.items()}
        
        return {
            "period_months": months,
            "total_transactions": len(transactions),
            "total_spending": sum(d["total"] for d in by_category.values()),
            "by_category": dict(sorted(category_analysis.items(), key=lambda x: -x[1]["total"])),
            "monthly_trend": monthly_trend,
            "by_day_of_week": spending_by_day,
        }


class FraudDetector:
    FRAUD_INDICATORS = {
        "high_risk_categories": ["gambling", "crypto", "wire transfer", "money order"],
        "unusual_hours": [(0, 5)],
        "rapid_transactions": {"count": 5, "minutes": 10},
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def check_transaction(self, transaction: Transaction) -> Optional[Anomaly]:
        risk_score = 0
        reasons = []
        
        if transaction.merchant_name:
            merchant_lower = transaction.merchant_name.lower()
            for indicator in self.FRAUD_INDICATORS["high_risk_categories"]:
                if indicator in merchant_lower:
                    risk_score += 30
                    reasons.append(f"High-risk category: {indicator}")
        
        if abs(transaction.amount) > 5000:
            risk_score += 20
            reasons.append("Large transaction amount")
        
        if risk_score >= 50:
            return Anomaly(
                anomaly_type=AnomalyType.POTENTIAL_FRAUD,
                severity=AnomalySeverity.HIGH if risk_score >= 70 else AnomalySeverity.MEDIUM,
                title="Potential Suspicious Activity",
                description="; ".join(reasons),
                transaction_id=str(transaction.id),
                amount=abs(transaction.amount),
                merchant=transaction.merchant_name,
                confidence=min(risk_score / 100, 0.95),
                recommended_action="Review this transaction carefully and report if unauthorized",
            )
        
        return None
