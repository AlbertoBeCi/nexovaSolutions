"""
Envio de emails transaccionales via Resend.

Nombrado `mailer.py` (no `email.py`) a proposito: en el layout plano de
services/api, un modulo `email.py` en la raiz taparia el paquete `email` de
la stdlib para cualquier import posterior en el proceso (lo usan FastAPI,
email-validator, etc.).

Sin RESEND_API_KEY configurada, send_password_reset_email() es un no-op
(devuelve False): routes/auth.py cae entonces al log por consola, igual que
antes de integrar un proveedor de email real.
"""
from __future__ import annotations

import logging

import resend

from config import RESEND_API_KEY, RESEND_FROM_EMAIL

logger = logging.getLogger("mailer")

_RESET_EMAIL_SUBJECT = "Restablece tu contraseña de Nexova"


def _reset_email_html(reset_link: str) -> str:
    return (
        "<p>Recibimos una solicitud para restablecer tu contraseña de Nexova.</p>"
        f'<p><a href="{reset_link}">Restablecer contraseña</a></p>'
        "<p>Si tú no la pediste, puedes ignorar este email: tu contraseña no cambia.</p>"
    )


def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    """Intenta enviar el email de reset por Resend.

    Devuelve True si Resend acepto el envio, False si no hay API key
    configurada o si el envio fallo. Nunca lanza: un problema con Resend no
    debe romper POST /auth/forgot-password (que siempre responde 200)."""
    if not RESEND_API_KEY:
        return False

    resend.api_key = RESEND_API_KEY
    try:
        resend.Emails.send(
            {
                "from": RESEND_FROM_EMAIL,
                "to": to_email,
                "subject": _RESET_EMAIL_SUBJECT,
                "html": _reset_email_html(reset_link),
            }
        )
        return True
    except Exception:
        logger.exception("No se pudo enviar el email de reset de password a %s", to_email)
        return False
