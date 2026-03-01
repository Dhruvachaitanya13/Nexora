from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    accounts,
    transactions,
    plaid,
    invoices,
    categories,
    goals,
    income_sources,
    clients,
    tax,
    cashflow,
    ai,
    insights,
    automations,
    reports,
    dashboard,
    webhooks,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
api_router.include_router(plaid.router, prefix="/plaid", tags=["Plaid Integration"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(goals.router, prefix="/goals", tags=["Goals"])
api_router.include_router(income_sources.router, prefix="/income-sources", tags=["Income Sources"])
api_router.include_router(clients.router, prefix="/clients", tags=["Clients"])
api_router.include_router(tax.router, prefix="/tax", tags=["Tax"])
api_router.include_router(cashflow.router, prefix="/cashflow", tags=["Cash Flow"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Assistant"])
api_router.include_router(insights.router, prefix="/insights", tags=["Insights"])
api_router.include_router(automations.router, prefix="/automations", tags=["Automations"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
