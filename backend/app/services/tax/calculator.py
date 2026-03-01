"""Tax calculator for Illinois freelancers."""
from decimal import Decimal
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import date


@dataclass
class TaxBracket:
    min_income: Decimal
    max_income: Optional[Decimal]
    rate: Decimal
    base_tax: Decimal


@dataclass
class QuarterlyDeadline:
    quarter: int
    period_start: date
    period_end: date
    federal_due: date
    state_due: date


class TaxCalculator:
    """Tax calculator for IL freelancers."""
    
    FEDERAL_BRACKETS_SINGLE = [
        TaxBracket(Decimal("0"), Decimal("11600"), Decimal("0.10"), Decimal("0")),
        TaxBracket(Decimal("11600"), Decimal("47150"), Decimal("0.12"), Decimal("1160")),
        TaxBracket(Decimal("47150"), Decimal("100525"), Decimal("0.22"), Decimal("5426")),
        TaxBracket(Decimal("100525"), Decimal("191950"), Decimal("0.24"), Decimal("17168.50")),
        TaxBracket(Decimal("191950"), Decimal("243725"), Decimal("0.32"), Decimal("39110.50")),
        TaxBracket(Decimal("243725"), Decimal("609350"), Decimal("0.35"), Decimal("55678.50")),
        TaxBracket(Decimal("609350"), None, Decimal("0.37"), Decimal("183647.25")),
    ]
    
    IL_TAX_RATE = Decimal("0.0495")
    SE_TAX_RATE = Decimal("0.153")
    SS_WAGE_BASE = Decimal("168600")
    STANDARD_DEDUCTION = Decimal("14600")
    
    def __init__(self, filing_status: str = "single", state: str = "IL", tax_year: int = 2024):
        self.filing_status = filing_status
        self.state = state
        self.tax_year = tax_year
    
    def calculate_self_employment_tax(self, net_profit: Decimal) -> Dict[str, Decimal]:
        if net_profit <= 0:
            return {"total_se_tax": Decimal("0"), "se_tax_deduction": Decimal("0")}
        
        net_se = net_profit * Decimal("0.9235")
        ss_taxable = min(net_se, self.SS_WAGE_BASE)
        ss_tax = ss_taxable * Decimal("0.124")
        medicare = net_se * Decimal("0.029")
        total = ss_tax + medicare
        
        return {
            "social_security_tax": ss_tax.quantize(Decimal("0.01")),
            "medicare_tax": medicare.quantize(Decimal("0.01")),
            "total_se_tax": total.quantize(Decimal("0.01")),
            "se_tax_deduction": (total * Decimal("0.5")).quantize(Decimal("0.01")),
        }
    
    def calculate_federal_tax(self, taxable_income: Decimal) -> Dict[str, Any]:
        if taxable_income <= 0:
            return {"federal_tax": Decimal("0"), "bracket": "0%", "effective_rate": Decimal("0")}
        
        tax = Decimal("0")
        bracket = "10%"
        
        for b in self.FEDERAL_BRACKETS_SINGLE:
            if taxable_income >= b.min_income:
                if b.max_income is None or taxable_income <= b.max_income:
                    tax = b.base_tax + (taxable_income - b.min_income) * b.rate
                    bracket = f"{int(b.rate * 100)}%"
                    break
        
        eff_rate = (tax / taxable_income) if taxable_income > 0 else Decimal("0")
        
        return {
            "federal_tax": tax.quantize(Decimal("0.01")),
            "bracket": bracket,
            "effective_rate": eff_rate.quantize(Decimal("0.0001")),
        }
    
    def calculate_full_tax_liability(
        self,
        gross_income: Decimal,
        business_expenses: Decimal,
        other_deductions: Decimal = Decimal("0"),
        use_itemized: bool = False,
        itemized_deductions: Decimal = Decimal("0"),
    ) -> Dict[str, Any]:
        net_profit = max(gross_income - business_expenses, Decimal("0"))
        se_result = self.calculate_self_employment_tax(net_profit)
        
        agi = net_profit - se_result["se_tax_deduction"] - other_deductions
        deduction = self.STANDARD_DEDUCTION
        taxable = max(agi - deduction, Decimal("0"))
        
        federal = self.calculate_federal_tax(taxable)
        state_tax = (agi * self.IL_TAX_RATE).quantize(Decimal("0.01"))
        
        total = federal["federal_tax"] + state_tax + se_result["total_se_tax"]
        eff_rate = (total / gross_income) if gross_income > 0 else Decimal("0")
        
        return {
            "summary": {
                "gross_income": float(gross_income),
                "business_expenses": float(business_expenses),
                "net_profit": float(net_profit),
                "agi": float(agi),
                "taxable_income": float(taxable),
            },
            "federal": {
                "tax": float(federal["federal_tax"]),
                "bracket": federal["bracket"],
            },
            "state": {
                "tax": float(state_tax),
                "rate": float(self.IL_TAX_RATE),
            },
            "self_employment": {
                "tax": float(se_result["total_se_tax"]),
                "deduction": float(se_result["se_tax_deduction"]),
            },
            "total": {
                "tax_liability": float(total),
                "effective_rate": float(eff_rate),
            },
        }
    
    def calculate_tax_reserve(self, income_amount: Decimal, ytd_income: Decimal = Decimal("0")) -> Dict[str, Any]:
        federal_rate = Decimal("0.22")
        se_rate = Decimal("0.153") * Decimal("0.9235")
        
        federal = income_amount * federal_rate
        state = income_amount * self.IL_TAX_RATE
        se = income_amount * se_rate
        total = federal + state + se
        pct = (total / income_amount * 100) if income_amount > 0 else Decimal("0")
        
        return {
            "income_amount": float(income_amount),
            "federal_reserve": float(federal.quantize(Decimal("0.01"))),
            "state_reserve": float(state.quantize(Decimal("0.01"))),
            "se_reserve": float(se.quantize(Decimal("0.01"))),
            "total_reserve": float(total.quantize(Decimal("0.01"))),
            "reserve_percentage": float(pct.quantize(Decimal("0.01"))),
        }
    
    def get_quarterly_deadlines(self, year: int = None) -> List[QuarterlyDeadline]:
        y = year or self.tax_year
        return [
            QuarterlyDeadline(1, date(y, 1, 1), date(y, 3, 31), date(y, 4, 15), date(y, 4, 15)),
            QuarterlyDeadline(2, date(y, 4, 1), date(y, 5, 31), date(y, 6, 17), date(y, 6, 17)),
            QuarterlyDeadline(3, date(y, 6, 1), date(y, 8, 31), date(y, 9, 16), date(y, 9, 16)),
            QuarterlyDeadline(4, date(y, 9, 1), date(y, 12, 31), date(y+1, 1, 15), date(y+1, 1, 15)),
        ]
    
    def get_current_quarter(self) -> int:
        month = date.today().month
        if month <= 3: return 1
        if month <= 5: return 2
        if month <= 8: return 3
        return 4
