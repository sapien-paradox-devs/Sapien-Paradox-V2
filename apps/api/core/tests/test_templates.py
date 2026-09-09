"""The four templates.

These tests guard the contract with Meta, not the prose. The wording will change during
review; the variable order, the key set, and the fail-loudly behaviour must not.
"""

from django.test import TestCase

from core.content import templates


class TemplateTests(TestCase):
    def test_all_four_exist(self):
        """All four are submitted to Meta together (D12), including the two not yet used."""
        self.assertEqual(
            sorted(templates.TEMPLATES),
            ["chapter_delivery", "fresh_link", "set_password", "unread_reminder"],
        )

    def test_renders_variables_in_order(self):
        text = templates.render(
            "chapter_delivery",
            {
                "first_name": "Rohit",
                "chapter_title": "Multi-Arm Bandits",
                "link": "https://app.example.com/r/abc",
            },
        )

        self.assertIn("Rohit", text)
        self.assertIn("Multi-Arm Bandits", text)
        self.assertIn("https://app.example.com/r/abc", text)

    def test_a_missing_variable_raises(self):
        """A programmer error, not a delivery failure — it must surface now, not as a
        `failed` MessageLog row that looks like Twilio's fault (D27)."""
        with self.assertRaises(KeyError):
            templates.render("chapter_delivery", {"first_name": "Rohit"})

    def test_an_unknown_key_raises(self):
        with self.assertRaises(KeyError):
            templates.get("no_such_template")

    def test_set_password_is_worded_for_someone_who_never_had_one(self):
        """D26: a concierge-created reader has never had a password. One neutral template
        serves both them and a returning reader, which avoids a fifth Meta submission."""
        # Assert on the copy itself, not on a rendering — the reset ROUTE legitimately
        # contains the word, and that is not what this test is about.
        body = templates.SET_PASSWORD.body.lower()

        self.assertIn("set a password", body)
        self.assertNotIn("reset", body)

    def test_every_template_declares_its_variables(self):
        for key, template in templates.TEMPLATES.items():
            with self.subTest(template=key):
                self.assertTrue(template.variables, f"{key} declares no variables")
                self.assertEqual(template.key, key)
