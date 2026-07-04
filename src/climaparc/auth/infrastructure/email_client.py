from __future__ import annotations

import smtplib
from email.message import EmailMessage


class SmtpEmailClient:
    def __init__(self, host: str, port: int, user: str, password: str, sender: str):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.sender = sender

    @property
    def configured(self) -> bool:
        return bool(self.host)

    def send_password_reset(self, email: str, reset_url: str) -> bool:
        if not self.configured:
            return False
        message = EmailMessage()
        message["Subject"] = "Reinitialisation de votre mot de passe ClimaParc"
        message["From"] = self.sender
        message["To"] = email
        message.set_content(
            "\n".join([
                "Bonjour,",
                "",
                "Vous avez demande la reinitialisation de votre mot de passe ClimaParc.",
                f"Utilisez ce lien dans la prochaine heure: {reset_url}",
                "",
                "Si vous n'avez pas demande cette operation, vous pouvez ignorer ce message.",
            ])
        )
        try:
            with smtplib.SMTP(self.host, self.port, timeout=15) as smtp:
                smtp.starttls()
                if self.user or self.password:
                    smtp.login(self.user, self.password)
                smtp.send_message(message)
            return True
        except Exception as error:
            print(f"Password reset email failed: {error}")
            return False
