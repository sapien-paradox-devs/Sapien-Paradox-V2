"""A demoable dataset, from nothing, in one command.

**Idempotent.** Run it twice and the second run changes nothing — which matters
because it is the fastest way to get back to a working state, and nobody should
have to think about whether it is safe.

It goes through `onboarding.create_reader`, the same path the admin uses (D10),
rather than writing rows directly. A seed that takes a shortcut stops proving
the thing you want it to prove.
"""

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from core.models import Book, Chapter, User
from core.services import extraction
from core.services.onboarding import OnboardingRefused, create_reader

BOOK = {"title": "The Sapien Paradox", "slug": "sapien-paradox", "price_cents": 190000}

CHAPTERS = [
    "The Long Descent",
    "What the Hands Knew",
    "The Quiet Century",
    "Instruments of Attention",
    "A Slower Return",
]

READER = {
    "full_name": "Ada Demo",
    "email": "reader@example.com",
    "phone": "+919876543210",
}


def a_pdf(title: str, index: int) -> ContentFile:
    """A real, parseable PDF carrying real text.

    Hand-built rather than generated, because the alternative was a reportlab
    dependency for the sake of a fixture. Blank pages would parse fine and
    extract to nothing, which would leave the companion with no content to read
    and hide an extraction bug behind a passing seed.

    Two pages, because one would let a paging bug through.
    """
    pages = [
        f"Chapter {index}", title,
        "The instrument was never the difficulty. Attention was.",
        "", "",
        "What follows is the second page, so that page counts and page",
        "navigation have something honest to act on.",
    ]

    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        "/Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        "/Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
        _text_stream(pages[:4]),
        _text_stream(pages[4:]),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    return ContentFile(_assemble(objects), name=f"{index}.pdf")


def _text_stream(lines) -> str:
    """A PDF content stream drawing one line per row."""
    body = ["BT", "/F1 13 Tf", "72 780 Td", "18 TL"]
    for line in lines:
        body.append(f"({_escape(line)}) Tj T*")
    body.append("ET")

    drawn = "\n".join(body)
    return f"<< /Length {len(drawn)} >>\nstream\n{drawn}\nendstream"


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _assemble(objects) -> bytes:
    """Serialise numbered objects with a correct xref table.

    The offsets have to be exact or every reader rejects the file, so they are
    computed here rather than guessed.
    """
    out = bytearray(b"%PDF-1.4\n")
    offsets = []

    for number, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n{obj}\nendobj\n".encode("latin-1")

    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode("latin-1")
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode("latin-1")

    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_at}\n%%EOF\n"
    ).encode("latin-1")

    return bytes(out)


class Command(BaseCommand):
    help = "Idempotently seed a demoable book, chapters and reader."

    def handle(self, *args, **options):
        self.quiet = options.get("verbosity", 1) == 0

        book, created = Book.objects.get_or_create(
            slug=BOOK["slug"],
            defaults={"title": BOOK["title"], "price_cents": BOOK["price_cents"],
                      "is_published": True},
        )
        self.say("book", book.title, created)

        for index, title in enumerate(CHAPTERS, start=1):
            chapter, created = Chapter.objects.get_or_create(
                book=book,
                order_index=index,
                defaults={"title": title},
            )
            if created:
                chapter.file.save(f"{index}.pdf", a_pdf(title, index), save=True)
                # Explicit, never a signal (D19).
                extraction.extract_and_save(chapter)
            self.say(f"chapter {index}", title, created)

        if User.objects.filter(email=READER["email"]).exists():
            self.say("reader", READER["email"], False)
            self.report("\nseed_dev: already seeded, nothing changed", self.style.SUCCESS)
            return

        try:
            result = create_reader(book=book, pace="medium", **READER)
        except OnboardingRefused as refused:
            self.stderr.write(f"onboarding refused: {refused.reason} ({refused.field})")
            return

        self.say("reader", result.user.email, True)
        self.report("")
        self.report("seed_dev: ready", self.style.SUCCESS)
        # The token is a credential — printed for local use only, never logged (D22).
        self.report(f"  read chapter 1:  /r/{result.grant.token}")
        if result.reset_token is not None:
            self.report(f"  set a password:  /reset/{result.reset_token.token}")

    def say(self, kind, name, created):
        if self.quiet:
            return
        mark = self.style.SUCCESS("created") if created else "exists "
        self.stdout.write(f"  {mark}  {kind}: {name}")

    def report(self, line, style=None):
        if self.quiet:
            return
        self.stdout.write(style(line) if style else line)
