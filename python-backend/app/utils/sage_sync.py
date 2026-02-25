"""Sage Business Cloud Accounting data sync service.

Pulls invoices, payments, and account balances from Sage,
stores them in Firestore, and creates financial snapshots.
"""

import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from app.models.client import COLLECTION_NAME as CLIENTS_COLLECTION
from app.models.financial import (
    COLLECTION_NAME as SNAPSHOTS_COLLECTION,
    INVOICES_COLLECTION,
    PAYMENTS_COLLECTION,
    FinancialSnapshot,
    InvoiceResponse,
    PaymentResponse,
)
from app.utils.firebase_client import get_firestore_client
from app.utils.sage_client import SageClient

logger = logging.getLogger(__name__)


class SageSyncService:
    """Orchestrates data synchronization from Sage into Firestore.

    Handles pulling invoices, payments, and ledger balances from the Sage API,
    mapping them to application models, and upserting them into Firestore.
    """

    def __init__(self, sage_client: SageClient) -> None:
        self.sage = sage_client

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _now_iso(self) -> str:
        """Return the current UTC time as an ISO 8601 string."""
        return datetime.now(timezone.utc).isoformat()

    async def _load_client_name_map(self) -> dict[str, str]:
        """Build a map of lowercased client name -> client doc ID from Firestore.

        Used for best-effort matching of Sage contact names to FableDash clients.
        """
        try:
            db = get_firestore_client()
            docs = db.collection(CLIENTS_COLLECTION).stream()
            name_map: dict[str, str] = {}
            for doc in docs:
                data = doc.to_dict()
                name = data.get("name", "")
                if name:
                    name_map[name.lower().strip()] = doc.id
            return name_map
        except Exception:
            logger.exception("Failed to load client name map")
            return {}

    def _match_client(self, contact_name: str | None, name_map: dict[str, str]) -> str | None:
        """Attempt to match a Sage contact name to a FableDash client ID.

        Uses exact case-insensitive matching. Returns None if no match is found.
        """
        if not contact_name:
            return None
        return name_map.get(contact_name.lower().strip())

    def _map_sage_invoice_status(self, sage_invoice: dict) -> str:
        """Map a Sage invoice to a FableDash status string.

        Sage statuses: DRAFT, SENT, PARTIALLY_PAID, PAID, VOID, DELETED.
        FableDash statuses: draft, sent, paid, overdue, void.
        """
        status = sage_invoice.get("status", {})
        if isinstance(status, dict):
            status = status.get("id", "")
        status = str(status).upper()

        if status == "PAID":
            return "paid"
        if status == "VOID" or status == "DELETED":
            return "void"
        if status == "DRAFT":
            return "draft"

        # Check if overdue (unpaid and past due date)
        due_date_str = sage_invoice.get("due_date")
        if due_date_str:
            try:
                due_date = date.fromisoformat(due_date_str[:10])
                if due_date < date.today():
                    return "overdue"
            except (ValueError, TypeError):
                pass

        return "sent"

    # ------------------------------------------------------------------
    # Invoice sync
    # ------------------------------------------------------------------

    async def sync_invoices(self, since: date | None = None) -> dict:
        """Pull sales invoices from Sage and upsert into Firestore.

        Args:
            since: If provided, only fetch invoices updated on or after this date.

        Returns:
            Dict with ``synced`` count and ``errors`` list.
        """
        if not await self.sage.is_connected():
            return {"synced": 0, "errors": ["Sage not connected"]}

        synced = 0
        errors: list[str] = []

        try:
            params: dict = {}
            if since:
                params["updated_or_created_since"] = since.isoformat()

            raw_invoices = await self.sage.get_paginated("/sales_invoices", params=params)
            logger.info("Fetched %d invoices from Sage", len(raw_invoices))

            client_map = await self._load_client_name_map()
            db = get_firestore_client()
            now = self._now_iso()

            for inv in raw_invoices:
                try:
                    sage_id = inv.get("id", "")
                    if not sage_id:
                        errors.append("Invoice missing Sage ID, skipped")
                        continue

                    # Extract contact name for client matching
                    contact = inv.get("contact", {}) or {}
                    contact_name = contact.get("displayed_as") or contact.get("name")
                    client_id = self._match_client(contact_name, client_map)

                    status = self._map_sage_invoice_status(inv)

                    total = float(inv.get("total_amount", 0) or 0)
                    currency = inv.get("currency", {})
                    if isinstance(currency, dict):
                        currency = currency.get("id", "ZAR")

                    invoice = InvoiceResponse(
                        id=sage_id,
                        sage_id=sage_id,
                        client_id=client_id,
                        invoice_number=inv.get("displayed_as", inv.get("invoice_number", sage_id)),
                        status=status,
                        amount=total,
                        currency=str(currency) if currency else "ZAR",
                        issued_date=inv.get("date", now[:10]),
                        due_date=inv.get("due_date", now[:10]),
                        paid_date=inv.get("fully_paid_on"),
                        description=inv.get("notes"),
                        created_at=inv.get("created_at", now),
                        updated_at=inv.get("updated_at", now),
                    )

                    db.collection(INVOICES_COLLECTION).document(sage_id).set(
                        invoice.model_dump(), merge=True
                    )
                    synced += 1

                except Exception as exc:
                    invoice_ref = inv.get("displayed_as", inv.get("id", "unknown"))
                    errors.append(f"Invoice {invoice_ref}: {exc}")
                    logger.exception("Failed to sync invoice %s", invoice_ref)

        except Exception as exc:
            errors.append(f"Sage API error: {exc}")
            logger.exception("Failed to fetch invoices from Sage")

        logger.info("Invoice sync complete: %d synced, %d errors", synced, len(errors))
        return {"synced": synced, "errors": errors}

    # ------------------------------------------------------------------
    # Payment sync
    # ------------------------------------------------------------------

    async def sync_payments(self, since: date | None = None) -> dict:
        """Pull contact payments from Sage and upsert into Firestore.

        Args:
            since: If provided, only fetch payments updated on or after this date.

        Returns:
            Dict with ``synced`` count and ``errors`` list.
        """
        if not await self.sage.is_connected():
            return {"synced": 0, "errors": ["Sage not connected"]}

        synced = 0
        errors: list[str] = []

        try:
            params: dict = {}
            if since:
                params["updated_or_created_since"] = since.isoformat()

            raw_payments = await self.sage.get_paginated("/contact_payments", params=params)
            logger.info("Fetched %d payments from Sage", len(raw_payments))

            db = get_firestore_client()
            now = self._now_iso()

            for pmt in raw_payments:
                try:
                    sage_id = pmt.get("id", "")
                    if not sage_id:
                        errors.append("Payment missing Sage ID, skipped")
                        continue

                    # Try to link to an invoice
                    invoice_id = None
                    allocated_artefacts = pmt.get("allocated_artefacts", []) or []
                    if allocated_artefacts:
                        first = allocated_artefacts[0]
                        artefact = first.get("artefact", {}) or {}
                        invoice_id = artefact.get("id")

                    # Extract contact for client linking
                    contact = pmt.get("contact", {}) or {}
                    contact_id = contact.get("id")

                    total = float(pmt.get("total_amount", 0) or 0)
                    currency = pmt.get("currency", {})
                    if isinstance(currency, dict):
                        currency = currency.get("id", "ZAR")

                    payment = PaymentResponse(
                        id=sage_id,
                        sage_id=sage_id,
                        invoice_id=invoice_id,
                        client_id=contact_id,
                        amount=total,
                        currency=str(currency) if currency else "ZAR",
                        payment_date=pmt.get("date", now[:10]),
                        payment_method=pmt.get("payment_method", {}).get("displayed_as")
                        if isinstance(pmt.get("payment_method"), dict)
                        else pmt.get("payment_method"),
                        reference=pmt.get("reference"),
                        created_at=pmt.get("created_at", now),
                        updated_at=pmt.get("updated_at", now),
                    )

                    db.collection(PAYMENTS_COLLECTION).document(sage_id).set(
                        payment.model_dump(), merge=True
                    )
                    synced += 1

                except Exception as exc:
                    pmt_ref = pmt.get("displayed_as", pmt.get("id", "unknown"))
                    errors.append(f"Payment {pmt_ref}: {exc}")
                    logger.exception("Failed to sync payment %s", pmt_ref)

        except Exception as exc:
            errors.append(f"Sage API error: {exc}")
            logger.exception("Failed to fetch payments from Sage")

        logger.info("Payment sync complete: %d synced, %d errors", synced, len(errors))
        return {"synced": synced, "errors": errors}

    # ------------------------------------------------------------------
    # Balance sync
    # ------------------------------------------------------------------

    async def sync_balances(self) -> dict:
        """Pull ledger account balances from Sage.

        Extracts cash-on-hand, accounts receivable, and accounts payable
        from the chart of accounts.

        Returns:
            Dict with balance figures, or error information.
        """
        if not await self.sage.is_connected():
            return {"error": "Sage not connected"}

        try:
            accounts = await self.sage.get_paginated("/ledger_accounts")
            logger.info("Fetched %d ledger accounts from Sage", len(accounts))

            cash_on_hand = 0.0
            accounts_receivable = 0.0
            accounts_payable = 0.0

            for acct in accounts:
                # Sage ledger_account_type has an id like CURRENT, CURRENT_LIABILITY, etc.
                acct_type = acct.get("ledger_account_type", {})
                if isinstance(acct_type, dict):
                    type_id = acct_type.get("id", "")
                else:
                    type_id = str(acct_type)

                balance = float(acct.get("balance", 0) or 0)
                display_name = (acct.get("displayed_as", "") or "").lower()

                # Categorize by account type
                if type_id in ("BANK", "CASH") or "bank" in display_name or "cash" in display_name:
                    cash_on_hand += balance
                elif type_id in ("ACCOUNTS_RECEIVABLE", "CURRENT") and (
                    "receivable" in display_name or "trade debtor" in display_name
                ):
                    accounts_receivable += balance
                elif type_id in ("ACCOUNTS_PAYABLE", "CURRENT_LIABILITY") and (
                    "payable" in display_name or "trade creditor" in display_name
                ):
                    accounts_payable += balance

            result = {
                "cash_on_hand": round(cash_on_hand, 2),
                "accounts_receivable": round(accounts_receivable, 2),
                "accounts_payable": round(accounts_payable, 2),
            }
            logger.info("Balance sync complete: %s", result)
            return result

        except Exception as exc:
            logger.exception("Failed to fetch ledger accounts from Sage")
            return {"error": f"Sage API error: {exc}"}

    # ------------------------------------------------------------------
    # Snapshot creation
    # ------------------------------------------------------------------

    async def create_snapshot(self, period_start: date, period_end: date) -> FinancialSnapshot:
        """Create a financial snapshot for the given period.

        Queries Firestore for invoices and payments within the period,
        calculates totals, fetches current balances, and writes a
        snapshot document.

        Args:
            period_start: Start of the reporting period (inclusive).
            period_end: End of the reporting period (inclusive).

        Returns:
            The created FinancialSnapshot.
        """
        db = get_firestore_client()
        now = self._now_iso()
        start_str = period_start.isoformat()
        end_str = period_end.isoformat()

        # Query invoices in period
        invoices_ref = (
            db.collection(INVOICES_COLLECTION)
            .where("issued_date", ">=", start_str)
            .where("issued_date", "<=", end_str)
        )
        invoice_docs = list(invoices_ref.stream())
        total_revenue = sum(float(d.to_dict().get("amount", 0)) for d in invoice_docs)
        invoice_count = len(invoice_docs)

        # Query payments in period
        payments_ref = (
            db.collection(PAYMENTS_COLLECTION)
            .where("payment_date", ">=", start_str)
            .where("payment_date", "<=", end_str)
        )
        payment_docs = list(payments_ref.stream())
        total_payments = sum(float(d.to_dict().get("amount", 0)) for d in payment_docs)
        payment_count = len(payment_docs)

        # Get current balances
        balances = await self.sync_balances()
        cash_on_hand = balances.get("cash_on_hand")
        accounts_receivable = balances.get("accounts_receivable")
        accounts_payable = balances.get("accounts_payable")

        # Simple net profit approximation (revenue - expenses proxy)
        # In a full implementation, expenses would come from purchase invoices
        total_expenses = total_payments  # payments made as expense proxy
        net_profit = total_revenue - total_expenses

        snapshot_id = str(uuid.uuid4())
        snapshot = FinancialSnapshot(
            id=snapshot_id,
            period_start=start_str,
            period_end=end_str,
            total_revenue=round(total_revenue, 2),
            total_expenses=round(total_expenses, 2),
            net_profit=round(net_profit, 2),
            cash_on_hand=cash_on_hand,
            accounts_receivable=accounts_receivable,
            accounts_payable=accounts_payable,
            invoice_count=invoice_count,
            payment_count=payment_count,
            created_at=now,
            source="sage_sync",
        )

        db.collection(SNAPSHOTS_COLLECTION).document(snapshot_id).set(snapshot.model_dump())
        logger.info(
            "Financial snapshot created for %s to %s: revenue=%.2f, expenses=%.2f, profit=%.2f",
            start_str,
            end_str,
            total_revenue,
            total_expenses,
            net_profit,
        )
        return snapshot

    # ------------------------------------------------------------------
    # Full sync orchestration
    # ------------------------------------------------------------------

    async def full_sync(self) -> dict:
        """Run a complete sync: invoices, payments, and a monthly snapshot.

        Returns:
            Combined results dict with invoice/payment sync stats and snapshot data.
        """
        if not await self.sage.is_connected():
            return {"error": "Sage not connected"}

        logger.info("Starting full Sage sync")

        invoice_result = await self.sync_invoices()
        payment_result = await self.sync_payments()

        # Create a snapshot for the current month
        today = date.today()
        period_start = today.replace(day=1)
        period_end = (period_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)

        snapshot = await self.create_snapshot(period_start, period_end)

        result = {
            "invoices": invoice_result,
            "payments": payment_result,
            "snapshot": snapshot.model_dump(),
        }
        logger.info("Full Sage sync complete")
        return result
