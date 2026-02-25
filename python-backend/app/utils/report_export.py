"""Report export utilities — plain text formatting and AI-generated executive summaries."""

import logging

from app.utils.openai_client import get_openai_client

logger = logging.getLogger(__name__)


class ReportExporter:
    """Export report data as structured text or AI-generated executive summary."""

    async def generate_text_report(self, report_data: dict) -> str:
        """Format report data as structured plain text suitable for copy/paste or email.

        Expects report_data to be the full health report dict with
        operational_efficiency, financial_performance, process_quality, and health_score keys.
        """
        lines: list[str] = []
        lines.append("=" * 60)
        lines.append("HEALTH & VITALITY REPORT")
        lines.append("=" * 60)
        lines.append("")

        # Health score
        health_score = report_data.get("health_score", {})
        overall = health_score.get("overall_score", "N/A")
        lines.append(f"Overall Health Score: {overall}")
        for component in health_score.get("components", []):
            name = component.get("name", "")
            score = component.get("score", "N/A")
            weight = component.get("weight", "")
            lines.append(f"  - {name}: {score} (weight: {weight})")
        lines.append("")

        # Operational efficiency
        ops = report_data.get("operational_efficiency", {})
        lines.append("-" * 40)
        lines.append("OPERATIONAL EFFICIENCY")
        lines.append("-" * 40)
        util_rate = ops.get("utilization_rate", "N/A")
        prod_score = ops.get("productivity_score", "N/A")
        lines.append(f"Utilization Rate: {util_rate}")
        lines.append(f"Productivity Score: {prod_score}")

        allocation = ops.get("time_allocation_by_group", {})
        if allocation:
            lines.append("Time Allocation by Group:")
            for group, hours in allocation.items():
                lines.append(f"  - {group}: {hours}h")

        top_clients = ops.get("saturation_top5_clients", [])
        if top_clients:
            lines.append("Top 5 Clients by Hours:")
            for entry in top_clients:
                name = entry.get("name", entry.get("client_id", "Unknown"))
                hours = entry.get("hours", 0)
                lines.append(f"  - {name}: {hours}h")

        lines.append("")

        # Financial performance
        fin = report_data.get("financial_performance", {})
        lines.append("-" * 40)
        lines.append("FINANCIAL PERFORMANCE")
        lines.append("-" * 40)
        revenue = fin.get("total_revenue", "N/A")
        expenses = fin.get("total_expenses", "N/A")
        profit = fin.get("net_profit", "N/A")
        lines.append(f"Total Revenue: R{revenue}")
        lines.append(f"Total Expenses: R{expenses}")
        lines.append(f"Net Profit: R{profit}")

        rankings = fin.get("cost_benefit_rankings", [])
        if rankings:
            lines.append("Cost-Benefit Rankings:")
            for rank in rankings[:5]:
                name = rank.get("name", rank.get("client_id", "Unknown"))
                rate = rank.get("effective_rate", 0)
                lines.append(f"  - {name}: R{rate}/h")

        lines.append("")

        # Process quality
        proc = report_data.get("process_quality", {})
        lines.append("-" * 40)
        lines.append("PROCESS QUALITY")
        lines.append("-" * 40)
        completion = proc.get("task_completion_rate", "N/A")
        overdue = proc.get("overdue_rate", "N/A")
        consistency = proc.get("time_entry_consistency", "N/A")
        lines.append(f"Task Completion Rate: {completion}")
        lines.append(f"Overdue Rate: {overdue}")
        lines.append(f"Time Entry Consistency: {consistency}")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)

    async def generate_ai_summary(self, report_data: dict) -> str:
        """Use OpenAI to generate an executive summary of the report (2-3 paragraphs)."""
        try:
            client = get_openai_client()

            # Build a condensed data snapshot for the prompt
            text_report = await self.generate_text_report(report_data)

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a business analyst summarising a health & vitality report for a CEO. "
                            "Write a concise executive summary in 2-3 paragraphs. Use professional language. "
                            "Highlight key strengths, areas of concern, and actionable recommendations. "
                            "Use specific numbers from the data. Currency is South African Rand (ZAR)."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Please summarise this report:\n\n{text_report}",
                    },
                ],
                temperature=0.4,
                max_tokens=500,
            )
            return response.choices[0].message.content or "Unable to generate summary."
        except Exception:
            logger.exception("Failed to generate AI summary")
            return "AI summary generation failed. Please try again later."
