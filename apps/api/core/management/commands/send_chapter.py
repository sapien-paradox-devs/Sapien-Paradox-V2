"""Send a chapter to a reader, from the command line.

    manage.py send_chapter --email reader@example.com --chapter 3
    manage.py send_chapter --email reader@example.com --chapter 3 --dry-run

The concierge's other hand. Everything the admin action does, without a browser
-- which matters when the person fixing a failed delivery is on a terminal, and
because "anything a human can do in Django admin, a service function does".

Goes through the seams: `access.can_read`, then `grants.mint_or_reuse`, then
`whatsapp.send_chapter`. Nothing here talks to Twilio or writes a MessageLog.
"""

from django.core.management.base import BaseCommand, CommandError

from core.models import Chapter, User
from core.services import access, grants, whatsapp


class Command(BaseCommand):
    help = "Send one chapter's link to one reader over WhatsApp."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="The reader.")
        parser.add_argument("--chapter", required=True, type=int,
                            help="1-based chapter number within the book.")
        parser.add_argument("--book", help="Book slug. Required only if the reader owns more than one.")
        parser.add_argument("--dry-run", action="store_true",
                            help="Resolve everything and print, but send nothing.")

    def handle(self, *args, **options):
        try:
            user = User.objects.get(email=options["email"])
        except User.DoesNotExist:
            raise CommandError(f"no reader with email {options['email']}") from None

        orders = user.orders.select_related("book")
        if options["book"]:
            orders = orders.filter(book__slug=options["book"])

        books = [order.book for order in orders]
        if not books:
            raise CommandError(f"{user.email} owns no books")
        if len(books) > 1:
            slugs = ", ".join(book.slug for book in books)
            raise CommandError(f"{user.email} owns several books; pass --book (one of: {slugs})")

        book = books[0]

        try:
            chapter = Chapter.objects.get(book=book, order_index=options["chapter"])
        except Chapter.DoesNotExist:
            raise CommandError(f"{book.slug} has no chapter {options['chapter']}") from None

        # The only access check, even here (D25). A CLI that skips it would be a
        # second answer to a question the seam exists to answer once.
        if not access.can_read(user, chapter):
            raise CommandError(f"{user.email} cannot read {book.slug} chapter {chapter.order_index}")

        if options["dry_run"]:
            self.stdout.write(f"would send {book.title} · {chapter.order_index}. {chapter.title}")
            self.stdout.write(f"                to {user.full_name} <{user.email}> {user.phone}")
            return

        grant = grants.mint_or_reuse(user, chapter)
        log = whatsapp.send_chapter(grant)

        if log.status == "sent":
            self.stdout.write(self.style.SUCCESS(
                f"sent {chapter.order_index}. {chapter.title} to {user.phone}"))
        else:
            # Not an exception: the send genuinely happened and genuinely failed,
            # and the MessageLog row is the record of it (D27).
            raise CommandError(f"delivery failed ({log.status}): {log.error or 'no detail'}")
