"""Render every machine as a Mermaid state diagram."""

from pathlib import Path

from django.core.management.base import BaseCommand

from core.machines.diagram import to_mermaid
from core.machines.registry import MACHINES

OUT = Path("machine-diagrams")


class Command(BaseCommand):
    help = "Render every state machine as Mermaid, from its transition table."

    def add_arguments(self, parser):
        # Not "--stdout": Django's BaseCommand already owns self.stdout, and
        # argparse would overwrite it with a bool.
        parser.add_argument(
            "--show",
            action="store_true",
            help="Print the diagrams instead of writing files.",
        )

    def handle(self, *args, **options):
        if options["show"]:
            for spec in MACHINES:
                self.stdout.write(f"\n```mermaid\n{to_mermaid(spec)}\n```")
            return

        OUT.mkdir(exist_ok=True)
        for spec in MACHINES:
            path = OUT / f"{spec.name}.mmd"
            path.write_text(to_mermaid(spec) + "\n")
            self.stdout.write(f"{path}")

        self.stdout.write(
            self.style.SUCCESS(f"\n{len(MACHINES)} diagrams in {OUT}/ (gitignored)")
        )
