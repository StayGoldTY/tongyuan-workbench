import subprocess
import tempfile
import unittest
from pathlib import Path

from tongyuan_collector.adapters.code_repository import CodeRepositoryAdapter
from tongyuan_collector.settings import CollectorSettings
from tongyuan_collector.source_catalog import SourceDescriptor


class CodeRepositoryAdapterTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.adapter = CodeRepositoryAdapter()

    def test_collect_adds_business_profile_units_and_reads_mdc_documents(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "public").mkdir(parents=True)
            (root / "src" / "views" / "dashboard").mkdir(parents=True)
            (root / "src" / "views" / "monitor").mkdir(parents=True)
            (root / "src" / "views" / "union").mkdir(parents=True)
            (root / "src" / "router").mkdir(parents=True)
            (root / ".cursor" / "rules").mkdir(parents=True)

            (root / "public" / "index.html").write_text(
                "<html><head><title>湖南省装配式产业大数据分析及公共服务平台</title></head></html>",
                encoding="utf-8",
            )
            (root / "src" / "router" / "index.js").write_text(
                "export default [{ meta: { title: '视频监控' } }, { meta: { title: '绿色建筑' } }]",
                encoding="utf-8",
            )
            (root / ".cursor" / "rules" / "business-modules.mdc").write_text(
                "# 业务模块\n- union: 联合监管\n- monitor: 视频监控\n- green: 绿色建筑",
                encoding="utf-8",
            )

            subprocess.run(["git", "-C", str(root), "init"], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.com"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Test User"], check=True)
            subprocess.run(["git", "-C", str(root), "add", "."], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-m", "新增视频监控大屏入口"], check=True, capture_output=True)
            (root / "src" / "views" / "monitor" / "index.vue").write_text("<template>monitor</template>", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "."], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-m", "优化工厂项目联动查询"], check=True, capture_output=True)

            source = SourceDescriptor(
                source_key="hunan-lekima",
                source_family="code",
                source_app="git",
                workspace="Lekima-App",
                root_path=root,
                adapter_key="code_repository",
                health="ready",
                notes="",
            )
            settings = CollectorSettings(max_repo_files_per_source=20, max_commit_entries=10)

            units = self.adapter.collect(source, settings)

        titles = {item.title for item in units}
        self.assertIn("Lekima-App 业务概况", titles)
        self.assertIn("Lekima-App 模块地图", titles)
        self.assertIn("Lekima-App 最近改动的业务影响", titles)
        self.assertIn(".cursor/rules/business-modules.mdc", titles)

        overview = next(item for item in units if item.title == "Lekima-App 业务概况")
        module_map = next(item for item in units if item.title == "Lekima-App 模块地图")
        recent_change = next(item for item in units if item.title == "Lekima-App 最近改动的业务影响")

        self.assertIn("湖南省装配式产业大数据分析及公共服务平台", overview.content_redacted)
        self.assertIn("monitor：视频监控", module_map.content_redacted)
        self.assertIn("新增视频监控大屏入口", recent_change.content_redacted)


if __name__ == "__main__":
    unittest.main()
