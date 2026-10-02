import os
import unittest
os.environ["AI_SERVICE_TOKEN"] = "test-only-token-not-valid-outside-tests-123456"
from fastapi.testclient import TestClient
import app


class PublicSearchTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app.app)
        app.requests_in_window = 0
        self.headers = {"Authorization": "Bearer " + app.TOKEN}

    def test_authentication_required_and_health_safe(self):
        self.assertEqual(self.client.post("/v1/search", json={"question": "تسجيل نادي"}).status_code, 401)
        self.assertEqual(self.client.post("/v1/search", json={"question": "تسجيل نادي"}, headers={"Authorization": "Bearer wrong"}).status_code, 401)
        self.assertEqual(self.client.get("/health").json(), {"status": "ok", "mode": "sources", "generated": False})

    def test_arabic_sources_with_no_generated_answer(self):
        response = self.client.post("/v1/search", json={"question": "كيف أقدم عضوية نادي؟"}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertFalse(result["generated"])
        self.assertEqual(result["sources"][0]["id"], "membership")
        self.assertLessEqual(len(result["sources"]), 3)
        self.assertTrue(all(source["url"].startswith("/help/") for source in result["sources"]))
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_no_match_does_not_invent_answer(self):
        result = self.client.post("/v1/search", json={"question": "zyxwvu"}, headers=self.headers).json()
        self.assertEqual(result["sources"], [])

    def test_private_identifiers_and_extra_fields_are_not_reflected(self):
        response = self.client.post("/v1/search", json={"question": "ساعاتي", "user_id": "private-id"}, headers=self.headers)
        self.assertEqual(response.status_code, 422)
        self.assertNotIn("private-id", response.text)
        result = self.client.post("/v1/search", json={"question": "كم رصيد ساعاتي؟"}, headers=self.headers).json()
        self.assertNotIn("total", result)
        self.assertFalse(result["generated"])

    def test_bounded_payload_and_question(self):
        for question in ["ا", "x" * 501, 10, "abc\u0000def"]:
            self.assertEqual(self.client.post("/v1/search", json={"question": question}, headers=self.headers).status_code, 422)
        self.assertEqual(self.client.post("/v1/search", content=b"x" * 4097, headers=self.headers).status_code, 413)

    def test_bounded_global_rate(self):
        app.requests_in_window = 30
        response = self.client.post("/v1/search", json={"question": "تسجيل نادي"}, headers=self.headers)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["retry-after"], "60")


if __name__ == "__main__":
    unittest.main()
