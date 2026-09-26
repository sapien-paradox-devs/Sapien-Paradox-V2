"""Unlock every chapter whose moment has come (D39, D50).

    manage.py cadence_tick
    manage.py cadence_tick --dry-run

What the Render Cron Job `sapien-cadence` runs every fifteen minutes. It is a
trigger and nothing more: `cadence.tick` finds the due grants and sends each one
`UNLOCK`, and the reading machine decides what that means. Nothing here talks to
Twilio, touches a grant, or decides who gets what.

Exits non-zero when any send failed, so the run shows red in the Render
dashboard. The failed grants stay `scheduled` and the next tick retries them
(D40); the red is for a human, not for recovery.
"""

from django.core.management.base import BaseCommand, CommandError

from core.services import cadence


class Command(BaseCommand):
    help = "Send UNLOCK to every scheduled grant whose unlock moment has passed."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true",
                            help="List the due grants, but send nothing.")

    def handle(self, *args, **options):
        if options["dry_run"]:
            self._list_due()
            return

        result = cadence.tick()
        line = (f"due={result.due} sent={result.sent} "
                f"failed={result.failed} refused={result.refused}")

        if result.failed:
            # Refused is not here on purpose: a deactivated reader or a row another
            # tick was holding is the system working, not failing (D80).
            raise CommandError(f"{line} — {result.failed} send(s) did not land; "
                               "they stay scheduled for the next tick")

        self.stdout.write(self.style.SUCCESS(line))

    def _list_due(self):
        # Never the token, and never the link built from it (D22). The pk is
        # enough to find the row in the admin.
        grants = list(cadence.due().select_related("user", "chapter__book"))

        self.stdout.write(f"due={len(grants)} (dry run, nothing sent)")
        for grant in grants:
            self.stdout.write(
                f"  grant {grant.pk} · {grant.user.email} · {grant.chapter.book.title} "
                f"· chapter {grant.chapter.order_index} · unlock_at {grant.unlock_at.isoformat()}"
            )
