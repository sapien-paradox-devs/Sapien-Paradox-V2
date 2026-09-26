"""Temporary command to create an admin and a test reader for cadence testing.

    manage.py create_test_reader --email=rohit.kalavapudi@gmail.com --pace=fast

DELETE THIS FILE after testing is done.
"""

from django.core.management.base import BaseCommand, CommandError

from core.models import Book, Order, User
from core.services.onboarding import create_reader


class Command(BaseCommand):
    help = "Create an admin and a test reader with a book on a given pace."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="rohit.kalavapudi@gmail.com")
        parser.add_argument("--phone", default="+919876543210")
        parser.add_argument("--name", default="Rohit Test")
        parser.add_argument("--pace", default="fast")

    def handle(self, *args, **options):
        admin, created = User.objects.get_or_create(
            email="admin@sapienparadox.com",
            defaults={"full_name": "Admin", "is_staff": True, "is_superuser": True},
        )
        if created:
            admin.set_password("testadmin123")
            admin.save()
            self.stdout.write(self.style.SUCCESS("Created admin: admin@sapienparadox.com"))
        else:
            self.stdout.write("Admin already exists")

        book = Book.objects.filter(is_published=True).first()
        if not book:
            raise CommandError("No published book found")

        self.stdout.write(f"Book: {book.title} ({book.chapters.count()} chapters)")

        existing = Order.objects.filter(
            user__email=options["email"], book=book
        ).first()
        if existing:
            self.stdout.write(self.style.WARNING(
                f"{options['email']} already owns {book.title}"
            ))
            return

        result = create_reader(
            full_name=options["name"],
            email=options["email"],
            phone=options["phone"],
            book=book,
            pace=options["pace"],
        )
        self.stdout.write(self.style.SUCCESS(
            f"Created reader {result.user.email} with {book.title} on {options['pace']} pace"
        ))
        self.stdout.write(f"  Order: {result.order.pk}")
        self.stdout.write(f"  Grant (ch1): {result.grant.pk}")
        self.stdout.write(f"  Chapter sent: {result.chapter_message is not None}")
