"""Render the pages of chapters that have none — or all of them with --force (D73).

Chapters uploaded before D73 have no page images, and the chamber cannot open
them until they do. Run once after deploying D73, and again with --force after
changing how pages are rendered.
"""

from django.core.management.base import BaseCommand

from core.models import Chapter
from core.services import extraction, pages


class Command(BaseCommand):
    help = "Render chapter pages to images (D73). Skips chapters already rendered."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Re-render every chapter.")

    def handle(self, *args, force=False, **options):
        chapters = Chapter.objects.select_related("book").order_by("book__title", "order_index")
        rendered = skipped = failed = 0

        for chapter in chapters:
            if chapter.page_layout and not force:
                skipped += 1
                continue
            if not chapter.text_content:
                extraction.extract_and_save(chapter)
            if pages.render_and_save(chapter):
                rendered += 1
                self.stdout.write(f"  rendered  {chapter}")
            else:
                failed += 1
                self.stdout.write(self.style.WARNING(f"  FAILED    {chapter}"))

        summary = f"render_chapters: {rendered} rendered, {skipped} already done, {failed} failed"
        self.stdout.write(self.style.ERROR(summary) if failed else self.style.SUCCESS(summary))
