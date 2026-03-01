import asyncio
import json
import logging
import re
from datetime import datetime, date
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import hashlib

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.services.ai.engine import AIEngine, AIResponse, ResponseFormat
from app.services.ai.context import FinancialContext
from app.models.transaction import Transaction, ScheduleCCategory
from app.models.category import Category, CategoryRule

logger = logging.getLogger(__name__)


@dataclass
class CategorizationResult:
    category: str
    subcategory: Optional[str] = None
    schedule_c_category: Optional[str] = None
    is_business_expense: bool = False
    is_tax_deductible: bool = False
    business_percentage: float = 100.0
    confidence: float = 0.5
    reasoning: str = ""
    method: str = "ai"
    similar_patterns: List[str] = field(default_factory=list)
    documentation_recommended: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category,
            "subcategory": self.subcategory,
            "schedule_c_category": self.schedule_c_category,
            "is_business_expense": self.is_business_expense,
            "is_tax_deductible": self.is_tax_deductible,
            "business_percentage": self.business_percentage,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
            "method": self.method,
            "similar_patterns": self.similar_patterns,
            "documentation_recommended": self.documentation_recommended,
        }


class MerchantClassifier:
    KNOWN_MERCHANTS = {
        "software_subscriptions": {
            "merchants": ["adobe", "microsoft", "zoom", "slack", "dropbox", "google", "apple", "github", "notion", "figma", "canva", "mailchimp", "hubspot", "salesforce", "quickbooks", "freshbooks", "xero"],
            "category": "Software & Technology",
            "schedule_c": "office_expense",
            "is_business": True,
        },
        "office_supplies": {
            "merchants": ["staples", "office depot", "officemax", "amazon"],
            "keywords": ["office", "supplies", "paper", "printer", "desk"],
            "category": "Office Supplies",
            "schedule_c": "office_expense",
            "is_business": True,
        },
        "professional_services": {
            "merchants": ["legal", "attorney", "lawyer", "accountant", "cpa", "consultant"],
            "category": "Professional Services",
            "schedule_c": "legal_and_professional",
            "is_business": True,
        },
        "telecommunications": {
            "merchants": ["verizon", "at&t", "t-mobile", "sprint", "comcast", "xfinity", "spectrum", "cox"],
            "category": "Telecommunications",
            "schedule_c": "utilities",
            "is_business": "partial",
        },
        "travel": {
            "merchants": ["united", "delta", "american", "southwest", "jetblue", "alaska", "marriott", "hilton", "hyatt", "airbnb", "expedia", "booking.com"],
            "category": "Travel",
            "schedule_c": "travel",
            "is_business": True,
        },
        "transportation": {
            "merchants": ["uber", "lyft", "taxi", "parking", "enterprise", "hertz", "avis", "national"],
            "category": "Transportation",
            "schedule_c": "car_and_truck",
            "is_business": True,
        },
        "meals_entertainment": {
            "merchants": ["restaurant", "cafe", "coffee", "starbucks", "dunkin", "mcdonald", "chipotle", "panera"],
            "keywords": ["restaurant", "cafe", "grill", "kitchen", "bistro", "diner"],
            "category": "Meals & Entertainment",
            "schedule_c": "meals",
            "is_business": "partial",
            "deduction_rate": 0.5,
        },
        "advertising": {
            "merchants": ["facebook", "meta", "google ads", "linkedin", "twitter", "instagram", "tiktok", "yelp"],
            "keywords": ["ads", "advertising", "marketing", "promotion"],
            "category": "Advertising",
            "schedule_c": "advertising",
            "is_business": True,
        },
        "insurance": {
            "merchants": ["state farm", "geico", "progressive", "allstate", "liberty mutual", "nationwide"],
            "keywords": ["insurance", "premium"],
            "category": "Insurance",
            "schedule_c": "insurance",
            "is_business": "partial",
        },
        "banking_fees": {
            "merchants": ["bank", "chase", "wells fargo", "bank of america", "citibank"],
            "keywords": ["fee", "service charge", "monthly maintenance"],
            "category": "Bank Fees",
            "schedule_c": "commissions_and_fees",
            "is_business": True,
        },
        "education": {
            "merchants": ["udemy", "coursera", "linkedin learning", "skillshare", "masterclass"],
            "keywords": ["course", "training", "education", "workshop", "seminar", "conference"],
            "category": "Education & Training",
            "schedule_c": "other",
            "is_business": True,
        },
        "web_hosting": {
            "merchants": ["godaddy", "namecheap", "cloudflare", "aws", "digitalocean", "heroku", "netlify", "vercel", "squarespace", "wix", "shopify"],
            "keywords": ["hosting", "domain", "server", "cloud"],
            "category": "Web Hosting & Domains",
            "schedule_c": "office_expense",
            "is_business": True,
        },
        "coworking": {
            "merchants": ["wework", "regus", "industrious", "spaces"],
            "keywords": ["coworking", "workspace", "office space"],
            "category": "Rent - Workspace",
            "schedule_c": "rent_property",
            "is_business": True,
        },
        "contractor_platforms": {
            "merchants": ["upwork", "fiverr", "toptal", "99designs", "freelancer"],
            "category": "Contract Labor",
            "schedule_c": "contract_labor",
            "is_business": True,
        },
        "payment_processing": {
            "merchants": ["stripe", "paypal", "square", "venmo business", "wise", "transferwise"],
            "keywords": ["processing fee", "transaction fee"],
            "category": "Payment Processing Fees",
            "schedule_c": "commissions_and_fees",
            "is_business": True,
        },
    }
    
    INCOME_INDICATORS = {
        "platforms": ["paypal", "stripe", "square", "venmo", "zelle", "wise", "transferwise"],
        "keywords": ["payment", "deposit", "transfer from", "ach credit", "wire transfer"],
        "patterns": [r"payment\s+from", r"invoice\s+#?\d+", r"client\s+payment"],
    }
    
    PERSONAL_INDICATORS = {
        "merchants": ["netflix", "spotify", "hulu", "disney+", "hbo", "amazon prime video", "apple tv"],
        "keywords": ["grocery", "supermarket", "gas station", "pharmacy", "doctor", "hospital", "gym", "fitness"],
        "categories": ["entertainment", "grocery", "healthcare", "personal care"],
    }
    
    def __init__(self):
        self._merchant_cache: Dict[str, CategorizationResult] = {}
    
    def classify(self, transaction: Dict[str, Any]) -> Optional[CategorizationResult]:
        merchant = (transaction.get("merchant_name") or transaction.get("name") or "").lower()
        description = (transaction.get("description") or "").lower()
        amount = transaction.get("amount", 0)
        
        cache_key = self._get_cache_key(merchant, description)
        if cache_key in self._merchant_cache:
            cached = self._merchant_cache[cache_key]
            return CategorizationResult(
                category=cached.category,
                subcategory=cached.subcategory,
                schedule_c_category=cached.schedule_c_category,
                is_business_expense=cached.is_business_expense,
                is_tax_deductible=cached.is_tax_deductible,
                business_percentage=cached.business_percentage,
                confidence=min(cached.confidence + 0.1, 0.95),
                reasoning="Matched from cache",
                method="cache",
            )
        
        if amount < 0:
            income_result = self._check_income(merchant, description)
            if income_result:
                return income_result
        
        for category_key, config in self.KNOWN_MERCHANTS.items():
            merchants = config.get("merchants", [])
            keywords = config.get("keywords", [])
            
            merchant_match = any(m in merchant for m in merchants)
            keyword_match = any(k in merchant or k in description for k in keywords)
            
            if merchant_match or keyword_match:
                is_business = config.get("is_business", False)
                business_pct = 100.0
                
                if is_business == "partial":
                    is_business = True
                    business_pct = 50.0
                
                result = CategorizationResult(
                    category=config["category"],
                    schedule_c_category=config.get("schedule_c"),
                    is_business_expense=is_business,
                    is_tax_deductible=is_business,
                    business_percentage=business_pct,
                    confidence=0.85 if merchant_match else 0.70,
                    reasoning=f"Matched known {'merchant' if merchant_match else 'keyword'} pattern for {category_key}",
                    method="rule",
                    similar_patterns=[merchant.split()[0]] if merchant else [],
                    documentation_recommended=abs(amount) >= 75,
                )
                
                self._merchant_cache[cache_key] = result
                return result
        
        personal_result = self._check_personal(merchant, description)
        if personal_result:
            return personal_result
        
        return None
    
    def _check_income(self, merchant: str, description: str) -> Optional[CategorizationResult]:
        combined = f"{merchant} {description}"
        
        if any(platform in combined for platform in self.INCOME_INDICATORS["platforms"]):
            if any(kw in combined for kw in self.INCOME_INDICATORS["keywords"]):
                return CategorizationResult(
                    category="Income",
                    is_business_expense=False,
                    is_tax_deductible=False,
                    confidence=0.80,
                    reasoning="Matched income payment pattern",
                    method="rule",
                )
        
        for pattern in self.INCOME_INDICATORS["patterns"]:
            if re.search(pattern, combined, re.IGNORECASE):
                return CategorizationResult(
                    category="Income",
                    is_business_expense=False,
                    is_tax_deductible=False,
                    confidence=0.75,
                    reasoning=f"Matched income pattern: {pattern}",
                    method="rule",
                )
        
        return None
    
    def _check_personal(self, merchant: str, description: str) -> Optional[CategorizationResult]:
        combined = f"{merchant} {description}"
        
        if any(m in combined for m in self.PERSONAL_INDICATORS["merchants"]):
            return CategorizationResult(
                category="Personal - Entertainment",
                is_business_expense=False,
                is_tax_deductible=False,
                business_percentage=0,
                confidence=0.85,
                reasoning="Matched known personal/entertainment merchant",
                method="rule",
            )
        
        if any(kw in combined for kw in self.PERSONAL_INDICATORS["keywords"]):
            category = "Personal"
            if "grocery" in combined or "supermarket" in combined:
                category = "Personal - Groceries"
            elif "gas" in combined or "fuel" in combined:
                category = "Personal - Gas"
            elif "pharmacy" in combined or "doctor" in combined or "hospital" in combined:
                category = "Personal - Healthcare"
            
            return CategorizationResult(
                category=category,
                is_business_expense=False,
                is_tax_deductible=False,
                business_percentage=0,
                confidence=0.75,
                reasoning="Matched personal expense keyword",
                method="rule",
            )
        
        return None
    
    def _get_cache_key(self, merchant: str, description: str) -> str:
        normalized = re.sub(r'[^a-z0-9]', '', f"{merchant}{description}"[:100])
        return hashlib.md5(normalized.encode()).hexdigest()


class SmartCategorizer:
    def __init__(self, engine: AIEngine, db: Session):
        self.engine = engine
        self.db = db
        self.merchant_classifier = MerchantClassifier()
        self._user_rules_cache: Dict[str, List[CategoryRule]] = {}
    
    async def categorize(
        self,
        transaction: Dict[str, Any],
        context: FinancialContext = None,
        use_ai: bool = True,
    ) -> CategorizationResult:
        user_id = transaction.get("user_id")
        if user_id:
            user_result = await self._check_user_rules(transaction, user_id)
            if user_result and user_result.confidence >= 0.8:
                return user_result
        
        rule_result = self.merchant_classifier.classify(transaction)
        if rule_result and rule_result.confidence >= 0.8:
            return rule_result
        
        if use_ai:
            ai_result = await self._ai_categorize(transaction, context)
            
            if rule_result and ai_result:
                if rule_result.confidence > ai_result.confidence:
                    return rule_result
                return ai_result
            elif ai_result:
                return ai_result
        
        if rule_result:
            return rule_result
        
        return CategorizationResult(
            category="Uncategorized",
            confidence=0.1,
            reasoning="Unable to determine category",
            method="default",
        )
    
    async def categorize_batch(
        self,
        transactions: List[Dict[str, Any]],
        context: FinancialContext = None,
        parallel: bool = True,
    ) -> List[CategorizationResult]:
        if parallel:
            tasks = [self.categorize(t, context) for t in transactions]
            return await asyncio.gather(*tasks)
        else:
            results = []
            for t in transactions:
                result = await self.categorize(t, context)
                results.append(result)
            return results
    
    async def _check_user_rules(
        self,
        transaction: Dict[str, Any],
        user_id: str,
    ) -> Optional[CategorizationResult]:
        if user_id not in self._user_rules_cache:
            rules = self.db.query(CategoryRule).filter(
                CategoryRule.user_id == user_id,
                CategoryRule.is_enabled == True,
            ).order_by(CategoryRule.priority.desc()).all()
            self._user_rules_cache[user_id] = rules
        
        rules = self._user_rules_cache[user_id]
        merchant = (transaction.get("merchant_name") or "").lower()
        description = (transaction.get("description") or "").lower()
        amount = abs(transaction.get("amount", 0))
        
        for rule in rules:
            if self._rule_matches(rule, merchant, description, amount):
                category = self.db.query(Category).filter(
                    Category.id == rule.category_id
                ).first()
                
                if category:
                    return CategorizationResult(
                        category=category.name,
                        schedule_c_category=rule.schedule_c_category or category.schedule_c_category,
                        is_business_expense=rule.mark_as_business,
                        is_tax_deductible=rule.mark_as_tax_deductible,
                        business_percentage=rule.business_percentage,
                        confidence=0.95,
                        reasoning=f"Matched user rule: {rule.name or 'Custom rule'}",
                        method="user_rule",
                    )
        
        return None
    
    def _rule_matches(
        self,
        rule: CategoryRule,
        merchant: str,
        description: str,
        amount: float,
    ) -> bool:
        if rule.merchant_contains and rule.merchant_contains.lower() not in merchant:
            return False
        
        if rule.merchant_equals and rule.merchant_equals.lower() != merchant:
            return False
        
        if rule.merchant_starts_with and not merchant.startswith(rule.merchant_starts_with.lower()):
            return False
        
        if rule.description_contains and rule.description_contains.lower() not in description:
            return False
        
        if rule.amount_min is not None and amount < rule.amount_min:
            return False
        
        if rule.amount_max is not None and amount > rule.amount_max:
            return False
        
        if rule.amount_equals is not None and abs(amount - rule.amount_equals) > 0.01:
            return False
        
        return True
    
    async def _ai_categorize(
        self,
        transaction: Dict[str, Any],
        context: FinancialContext = None,
    ) -> Optional[CategorizationResult]:
        prompt = f"""Categorize this financial transaction for a freelancer/self-employed professional.

Transaction:
- Merchant/Name: {transaction.get('merchant_name') or transaction.get('name', 'Unknown')}
- Amount: ${abs(transaction.get('amount', 0)):,.2f}
- Date: {transaction.get('transaction_date', 'Unknown')}
- Description: {transaction.get('description', '')}
- Plaid Category: {transaction.get('plaid_category', 'N/A')}

Business Type: {context.business_type if context else 'freelancer'}

Respond in JSON:
{{
    "category": "Category name",
    "subcategory": "Subcategory or null",
    "schedule_c_category": "IRS Schedule C category or null (use: advertising, car_and_truck, commissions_and_fees, contract_labor, depreciation, insurance, interest_mortgage, interest_other, legal_and_professional, office_expense, rent_equipment, rent_property, repairs_and_maintenance, supplies, taxes_and_licenses, travel, meals, utilities, wages, home_office, other)",
    "is_business_expense": true/false,
    "is_tax_deductible": true/false,
    "business_percentage": 0-100,
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation",
    "similar_patterns": ["pattern1", "pattern2"],
    "documentation_recommended": true/false
}}"""

        response = await self.engine.chat(
            messages=[{"role": "user", "content": prompt}],
            response_format=ResponseFormat.JSON,
            temperature=0.2,
            max_tokens=500,
        )
        
        if response.success and response.content:
            try:
                data = json.loads(response.content)
                return CategorizationResult(
                    category=data.get("category", "Uncategorized"),
                    subcategory=data.get("subcategory"),
                    schedule_c_category=data.get("schedule_c_category"),
                    is_business_expense=data.get("is_business_expense", False),
                    is_tax_deductible=data.get("is_tax_deductible", False),
                    business_percentage=data.get("business_percentage", 100.0),
                    confidence=data.get("confidence", 0.7),
                    reasoning=data.get("reasoning", "AI categorization"),
                    method="ai",
                    similar_patterns=data.get("similar_patterns", []),
                    documentation_recommended=data.get("documentation_recommended", False),
                )
            except json.JSONDecodeError:
                logger.error(f"Failed to parse AI categorization response: {response.content}")
        
        return None
    
    async def learn_from_user_correction(
        self,
        transaction_id: str,
        user_id: str,
        correct_category: str,
        is_business: bool,
        schedule_c_category: str = None,
    ) -> bool:
        transaction = self.db.query(Transaction).filter(
            Transaction.id == transaction_id,
            Transaction.user_id == user_id,
        ).first()
        
        if not transaction:
            return False
        
        merchant = transaction.merchant_name_normalized or transaction.merchant_name or ""
        
        if merchant:
            existing_rule = self.db.query(CategoryRule).filter(
                CategoryRule.user_id == user_id,
                CategoryRule.merchant_contains == merchant,
            ).first()
            
            if not existing_rule:
                category = self.db.query(Category).filter(
                    Category.user_id == user_id,
                    Category.name == correct_category,
                ).first()
                
                if not category:
                    category = self.db.query(Category).filter(
                        Category.user_id == None,
                        Category.name == correct_category,
                    ).first()
                
                if category:
                    new_rule = CategoryRule(
                        user_id=user_id,
                        category_id=category.id,
                        name=f"Auto-learned: {merchant}",
                        merchant_contains=merchant,
                        mark_as_business=is_business,
                        mark_as_tax_deductible=is_business,
                        schedule_c_category=schedule_c_category,
                        priority=10,
                    )
                    self.db.add(new_rule)
                    self.db.commit()
                    
                    if user_id in self._user_rules_cache:
                        del self._user_rules_cache[user_id]
                    
                    logger.info(f"Created auto-learn rule for merchant: {merchant}")
                    return True
        
        return False
    
    def invalidate_cache(self, user_id: str = None):
        if user_id:
            if user_id in self._user_rules_cache:
                del self._user_rules_cache[user_id]
        else:
            self._user_rules_cache.clear()


class ReceiptOCR:
    def __init__(self, engine: AIEngine):
        self.engine = engine
    
    async def process_receipt(
        self,
        image_base64: str,
        context: FinancialContext = None,
    ) -> Dict[str, Any]:
        response = await self.engine.process_receipt(image_base64, context)
        
        if response.success and response.content:
            try:
                return json.loads(response.content)
            except json.JSONDecodeError:
                pass
        
        return {
            "error": "Failed to process receipt",
            "raw_response": response.content,
        }
    
    async def match_receipt_to_transaction(
        self,
        receipt_data: Dict[str, Any],
        transactions: List[Transaction],
        tolerance_days: int = 3,
        tolerance_amount: float = 0.10,
    ) -> Optional[Transaction]:
        receipt_amount = receipt_data.get("total_amount", 0)
        receipt_date = receipt_data.get("date")
        receipt_merchant = (receipt_data.get("merchant_name") or "").lower()
        
        if not receipt_amount:
            return None
        
        for txn in transactions:
            amount_diff = abs(abs(txn.amount) - receipt_amount) / receipt_amount if receipt_amount else 1
            if amount_diff > tolerance_amount:
                continue
            
            if receipt_date and txn.transaction_date:
                try:
                    r_date = datetime.strptime(receipt_date, "%Y-%m-%d").date() if isinstance(receipt_date, str) else receipt_date
                    date_diff = abs((txn.transaction_date - r_date).days)
                    if date_diff > tolerance_days:
                        continue
                except:
                    pass
            
            if receipt_merchant and txn.merchant_name:
                if receipt_merchant not in txn.merchant_name.lower() and txn.merchant_name.lower() not in receipt_merchant:
                    continue
            
            return txn
        
        return None
