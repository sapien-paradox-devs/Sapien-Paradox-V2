"""Extraction, and the seed that makes everything else runnable."""

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase

from core.management.commands.seed_dev import a_pdf
from core.models import Book, Chapter, Order, TemporalGrant, User
from core.services import extraction


class ExtractionTests(TestCase):
    def setUp(self):
        self.book = Book.objects.create(title="B", slug="b", price_cents=100)

    def a_chapter(self, file=None):
        chapter = Chapter.objects.create(book=self.book, order_index=1, title="One")
        chapter.file.save("1.pdf", file or a_pdf("One", 1), save=True)
        return chapter

    def test_it_finds_the_text_and_counts_the_pages(self):
        result = extraction.extract(self.a_chapter())

        self.assertTrue(result.ok)
        self.assertEqual(result.page_count, 2)
        self.assertIn("Chapter 1", result.text)

    def test_extract_and_save_persists_onto_the_chapter(self):
        chapter = self.a_chapter()

        extraction.extract_and_save(chapter)

        chapter.refresh_from_db()
        self.assertEqual(chapter.page_count, 2)
        self.assertTrue(chapter.text_content)

    def test_an_unreadable_file_does_not_take_the_caller_down(self):
        """A chapter with no extracted text still streams to the reader."""
        chapter = self.a_chapter(file=ContentFile(b"not a pdf", name="1.pdf"))

        result = extraction.extract(chapter)

        self.assertFalse(result.ok)
        self.assertEqual(result.text, "")
        self.assertEqual(result.page_count, 0)


class SeedTests(TestCase):
    def test_it_produces_a_walkable_dataset(self):
        call_command("seed_dev", verbosity=0)

        self.assertEqual(Book.objects.count(), 1)
        self.assertEqual(Chapter.objects.count(), 5)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(TemporalGrant.objects.count(), 1)

    def test_running_it_twice_changes_nothing(self):
        call_command("seed_dev", verbosity=0)
        call_command("seed_dev", verbosity=0)

        self.assertEqual(Book.objects.count(), 1)
        self.assertEqual(Chapter.objects.count(), 5)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Order.objects.count(), 1)

    def test_the_seeded_chapters_carry_extracted_text(self):
        call_command("seed_dev", verbosity=0)

        for chapter in Chapter.objects.all():
            self.assertEqual(chapter.page_count, 2)
            self.assertTrue(chapter.text_content, f"chapter {chapter.order_index} has no text")

    def test_the_reader_arrives_through_create_reader_not_direct_writes(self):
        """A grant for chapter 1 and an unusable password are its fingerprints."""
        call_command("seed_dev", verbosity=0)

        reader = User.objects.get()
        self.assertFalse(reader.has_usable_password())
        self.assertEqual(TemporalGrant.objects.get().chapter.order_index, 1)
        self.assertTrue(reader.reset_tokens.exists())
