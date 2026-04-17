import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tongyuan_collector.settings import CollectorSettings


class CollectorSettingsTestCase(unittest.TestCase):
    def test_openai_compatible_env_fallbacks_are_supported(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            env_path = Path(temp_dir) / ".env"
            env_path.write_text("", encoding="utf-8")

            with patch.dict(
                os.environ,
                {
                    "OPENAI_BASE_URL": "https://example.com/v1",
                    "OPENAI_API_KEY": "test-key",
                    "OPENAI_MODEL": "gpt-5.4",
                    "OPENAI_EMBEDDING_MODEL": "text-embedding-3-small",
                },
                clear=True,
            ):
                settings = CollectorSettings.from_env(env_path)

        self.assertEqual(settings.openai_base_url, "https://example.com/v1")
        self.assertEqual(settings.openai_api_key, "test-key")
        self.assertEqual(settings.chat_model, "gpt-5.4")
        self.assertEqual(settings.embedding_model, "text-embedding-3-small")

    def test_wechat_defaults_point_to_real_windows_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            env_path = Path(temp_dir) / ".env"
            env_path.write_text("", encoding="utf-8")

            with patch.dict(os.environ, {}, clear=True):
                settings = CollectorSettings.from_env(env_path)

        self.assertEqual(settings.chat_roots["wechat"], Path("D:/WeChat Files"))
        self.assertEqual(settings.wechat_account, "shangerty")
        self.assertEqual(settings.wxdump_path, "wxdump.exe")


if __name__ == "__main__":
    unittest.main()
