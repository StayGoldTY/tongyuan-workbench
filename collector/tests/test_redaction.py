import unittest

from tongyuan_collector.redaction import redact_text


class RedactionTestCase(unittest.TestCase):
    def test_redact_phone_secret_and_url_query(self) -> None:
        content = (
            "phone 13812345678, apiKey=abc123, Bearer token-value, "
            "https://example.com/download?id=123&token=secret"
        )
        redacted = redact_text(content)

        self.assertIn("[REDACTED_PHONE]", redacted)
        self.assertIn("apiKey=[REDACTED]", redacted)
        self.assertIn("Bearer [REDACTED_TOKEN]", redacted)
        self.assertIn("https://example.com/download", redacted)
        self.assertNotIn("token=secret", redacted)
        self.assertNotIn("?id=123", redacted)


if __name__ == "__main__":
    unittest.main()
