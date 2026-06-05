"""Optional Sentry error tracking (enabled when SENTRY_DSN is set)."""

import logging

from app.config import Settings

logger = logging.getLogger(__name__)


def init_sentry(settings: Settings) -> None:
    dsn = settings.sentry_dsn.strip()
    if not dsn:
        logger.info("Sentry disabled (SENTRY_DSN not set)")
        return

    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=dsn,
        environment=settings.sentry_environment,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
    )
    logger.info("Sentry initialized (environment=%s)", settings.sentry_environment)
