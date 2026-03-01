"""Plaid API client."""
import plaid
from plaid.api import plaid_api
from app.core.config import settings


class PlaidClient:
    """Plaid API client."""
    
    def __init__(self):
        self.client_id = settings.plaid.PLAID_CLIENT_ID
        self.secret = settings.plaid.PLAID_SECRET
        self.env = settings.plaid.PLAID_ENV
        
        if not self.client_id or not self.secret:
            self.client = None
            return
        
        # Environment mapping - use correct attribute names
        if self.env == "production":
            host = plaid.Environment.Production
        elif self.env == "development":
            host = plaid.Environment.Sandbox  # Development uses Sandbox in newer versions
        else:
            host = plaid.Environment.Sandbox
        
        configuration = plaid.Configuration(
            host=host,
            api_key={
                'clientId': self.client_id,
                'secret': self.secret,
            }
        )
        
        api_client = plaid.ApiClient(configuration)
        self.client = plaid_api.PlaidApi(api_client)
    
    @property
    def is_configured(self) -> bool:
        return self.client is not None
    
    @property
    def is_sandbox(self) -> bool:
        return self.env == "sandbox"


# Global instance
plaid_client = PlaidClient()
