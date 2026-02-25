"""Financial data models for Sage integration, invoices, payments, and reporting."""

from pydantic import BaseModel

# --- Firestore collection names ---

COLLECTION_NAME = "financial_snapshots"
SAGE_CREDENTIALS_COLLECTION = "sage_credentials"
INVOICES_COLLECTION = "invoices"
PAYMENTS_COLLECTION = "payments"
PNL_COLLECTION = "pnl_uploads"
FORECAST_COLLECTION = "revenue_forecasts"


# --- Sage OAuth2 credentials ---


class SageCredentials(BaseModel):
    """OAuth2 credentials for Sage Business Cloud Accounting API."""

    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_at: str  # ISO 8601 datetime
    scope: str | None = None
    updated_at: str


# --- Invoice models ---


class InvoiceResponse(BaseModel):
    """Invoice document returned from the API."""

    id: str
    sage_id: str | None = None
    client_id: str | None = None
    invoice_number: str
    status: str  # draft / sent / paid / overdue / void
    amount: float
    currency: str = "ZAR"
    issued_date: str
    due_date: str
    paid_date: str | None = None
    description: str | None = None
    created_at: str
    updated_at: str


# --- Payment models ---


class PaymentResponse(BaseModel):
    """Payment document returned from the API."""

    id: str
    sage_id: str | None = None
    invoice_id: str | None = None
    client_id: str | None = None
    amount: float
    currency: str = "ZAR"
    payment_date: str
    payment_method: str | None = None
    reference: str | None = None
    created_at: str
    updated_at: str


# --- Financial snapshot ---


class FinancialSnapshot(BaseModel):
    """Aggregated financial snapshot for a given period."""

    id: str
    period_start: str
    period_end: str
    total_revenue: float
    total_expenses: float
    net_profit: float
    cash_on_hand: float | None = None
    accounts_receivable: float | None = None
    accounts_payable: float | None = None
    invoice_count: int
    payment_count: int
    created_at: str
    source: str  # "sage_sync" or "manual_upload"


# --- P&L upload models ---


class PnlRow(BaseModel):
    """Single row in a profit-and-loss upload."""

    category: str
    subcategory: str | None = None
    actual: float
    forecast: float | None = None
    variance: float | None = None
    period: str


class PnlUpload(BaseModel):
    """Uploaded profit-and-loss spreadsheet with parsed rows."""

    id: str
    filename: str
    period: str
    rows: list[PnlRow]
    uploaded_at: str
    uploaded_by: str


# --- Revenue forecast ---


class RevenueForecast(BaseModel):
    """Uploaded revenue forecast with entries."""

    id: str
    filename: str
    forecast_date: str
    entries: list[dict]
    uploaded_at: str
    uploaded_by: str
