import unittest

from tongyuan_collector.redaction import redact_text


class RedactionTestCase(unittest.TestCase):
    def test_redact_phone_and_secret(self) -> None:
        content = "手机号 13812345678, apiKey=abc123, Bearer token-value"
        redacted = redact_text(content)

        self.assertIn("[REDACTED_PHONE]", redacted)
        self.assertIn("apiKey=[REDACTED]", redacted)
        self.assertIn("Bearer [REDACTED_TOKEN]", redacted)


if __name__ == "__main__":
    unittest.main()
