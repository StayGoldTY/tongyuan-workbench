import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from tongyuan_collector.settings import CollectorSettings
from tongyuan_collector.source_catalog import discover_sources


class SourceCatalogTestCase(unittest.TestCase):
    def test_discover_sources_marks_existing_roots_ready(self) -> None:
        with TemporaryDirectory() as temp_directory:
            root = Path(temp_directory)
            (root / "hainan").mkdir()
            (root / "wechat").mkdir()
            settings = CollectorSettings(
                repository_roots={
                    "hainan-server": root / "hainan",
                    "hainan-web": root / "missing-web",
                    "hunan-kellyt": root / "missing-kellyt",
                    "hunan-lekima": root / "missing-lekima",
                },
                chat_roots={
                    "wechat": root / "wechat",
                    "wxwork": root / "missing-wxwork",
                    "larkshell": root / "missing-larkshell",
                },
                output_directory=root / "out",
            )

            discovered = discover_sources(settings)
            ready_sources = {item.source_key for item in discovered if item.health == "ready"}

            self.assertIn("hainan-server", ready_sources)
            self.assertIn("wechat", ready_sources)


if __name__ == "__main__":
    unittest.main()
