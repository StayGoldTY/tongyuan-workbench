import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from tongyuan_collector.settings import CollectorSettings
from tongyuan_collector.source_catalog import discover_sources


class SourceCatalogTestCase(unittest.TestCase):
    def test_discover_sources_marks_existing_repo_and_readable_wechat_ready(self) -> None:
        with TemporaryDirectory() as temp_directory:
            root = Path(temp_directory)
            (root / "hainan").mkdir()
            msg_root = root / "wechat" / "shangerty" / "Msg"
            msg_root.mkdir(parents=True)

            connection = sqlite3.connect(msg_root / "MicroMsg.db")
            try:
                connection.execute("create table message (content text)")
                connection.commit()
            finally:
                connection.close()

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
                wechat_account="shangerty",
                output_directory=root / "out",
            )

            discovered = discover_sources(settings)
            ready_sources = {item.source_key for item in discovered if item.health == "ready"}

            self.assertIn("hainan-server", ready_sources)
            self.assertIn("wechat", ready_sources)


if __name__ == "__main__":
    unittest.main()
