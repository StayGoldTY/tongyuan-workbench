import sqlite3
import tempfile
import unittest
from pathlib import Path

from tongyuan_collector.adapters.sqlite_chat_archive import SqliteChatArchiveAdapter
from tongyuan_collector.source_catalog import SourceDescriptor


class SqliteChatArchiveAdapterTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.adapter = SqliteChatArchiveAdapter()

    def test_wechat_ext_log_is_not_treated_as_chat(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "ext_20240926.log"
            log_path.write_text(
                "\n".join(
                    [
                        "(2024-9-26:16:36:15:865 19620)-d/WeChatExt:start",
                        "(2024-9-26:16:36:15:869 19620)-d/WeChatExtMgr:cmdstr:1",
                        "(2024-9-26:16:36:15:871 19620)-i/WeChatExtMgr:cmdLine:1&&D:\\Program Files\\Tencent\\WeChat\\WeChat.exe",
                    ]
                ),
                encoding="utf-8",
            )
            source = SourceDescriptor(
                source_key="wechat",
                source_family="chat",
                source_app="wechat",
                workspace="WeChat",
                root_path=Path(temp_dir),
                adapter_key="sqlite_chat_archive",
                health="ready",
                notes="",
            )

            units = self.adapter._log_segments_to_units(
                source=source,
                path=log_path,
                content=log_path.read_text(encoding="utf-8"),
                remaining_capacity=10,
            )

        self.assertEqual(units, [])

    def test_larkshell_kv_store_skips_meta_and_keeps_workplace_rows(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "persistent_storage.db"
            connection = sqlite3.connect(db_path)
            try:
                connection.execute(
                    "create table kv_123 (storage_id integer, key text, value text, partition text, update_time text)"
                )
                connection.execute(
                    "create table kv_meta (user_id text, partition text, create_time text, update_time text)"
                )
                connection.execute(
                    """
                    insert into kv_123 (storage_id, key, value, partition, update_time)
                    values (
                        1,
                        'Workplace_Cache_Template_List_7450875085159841820',
                        '{"orgVal":{"locale":"zh_CN","data":[{"name":"工作台","updateInfo":{"updateRemark":"添加举报平台二维码"},"templateFileUrl":"https://example.com/template?id=123"}]}}',
                        'Lark_Openplatform_Template_V1',
                        '1774945575910'
                    )
                    """
                )
                connection.commit()
            finally:
                connection.close()

            source = SourceDescriptor(
                source_key="larkshell",
                source_family="chat",
                source_app="larkshell",
                workspace="建研智通",
                root_path=Path(temp_dir),
                adapter_key="sqlite_chat_archive",
                health="ready",
                notes="",
            )

            units = self.adapter._collect_from_larkshell_kv_store(
                db_path=db_path,
                source=source,
                row_limit=10,
                remaining_capacity=10,
            )

        self.assertEqual(len(units), 1)
        self.assertEqual(units[0].source_uri, "sqlite://persistent_storage.db/kv_123")
        self.assertIn("[REDACTED_ID]", units[0].title)
        self.assertIn("工作台", units[0].content_redacted)
        self.assertIn("https://example.com/template?id=123", units[0].content_redacted)


if __name__ == "__main__":
    unittest.main()
