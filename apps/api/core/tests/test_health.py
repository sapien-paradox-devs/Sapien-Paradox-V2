from django.test import TestCase


class HealthTests(TestCase):
    def test_health_reports_ok(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "database": "ok"})

    def test_health_needs_no_authentication(self):
        """The host polls this without credentials."""
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
