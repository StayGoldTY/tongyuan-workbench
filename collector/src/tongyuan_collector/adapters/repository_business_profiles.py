from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from ..contracts import KnowledgeUnitRecord
from ..settings import CollectorSettings
from ..source_catalog import SourceDescriptor


HTML_TITLE_PATTERN = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
ROUTE_TITLE_PATTERN = re.compile(r"title\s*:\s*['\"]([^'\"]{2,40})['\"]")
CHINESE_PATTERN = re.compile(r"[\u4e00-\u9fff]")
COMMIT_LINE_PATTERN = re.compile(r"^(?P<date>[^|]+)\| (?P<subject>.+)$")

GENERIC_ROUTE_TITLES = {
    "首页",
    "个人中心",
    "个人信息",
    "文档",
    "引导页",
    "系统设置",
    "数据库管理",
    "Dashboard",
    "Profile",
}
SKIPPED_LOCAL_FILE_NAMES = {
    "AGENTS.md",
    "CLAUDE.md",
    "agent-router.mdc",
    "local-agent-roles.mdc",
}

WORKSPACE_STORIES = {
    "HAINAN.Server": {
        "label": "海南审查业务后端",
        "story": "从仓库结构、业务规则和近期提交看，这一侧更像是承接项目申报、审查办理、专家协同、统计分析和对外数据推送的后端能力中心。",
        "roles": [
            "建设单位、勘察设计单位、审查机构等业务角色",
            "专家、管理员、流程办理人员",
            "需要查看统计、推送状态和流程执行情况的管理侧人员",
        ],
    },
    "HAINAN.Web": {
        "label": "海南审查业务前端",
        "story": "从页面目录、路由标题和前后端约定看，这一侧更像是面向业务人员的审查办理门户，重点覆盖项目、企业、专家、流程和统计展示。",
        "roles": [
            "建设单位、勘察设计单位、审查机构",
            "专家个人和专家单位",
            "管理员和需要处理待办已办的业务同事",
        ],
    },
    "KellyT.Solutions.Prod": {
        "label": "湖南装配式产业平台后端",
        "story": "从服务拆分、发布说明和项目命名看，这一侧更像是湖南装配式产业大数据分析及公共服务平台的后端服务底座，负责核心业务、文件、网关和统计能力。",
        "roles": [
            "政府监管和平台运营侧",
            "企业、工厂、项目等业务协同角色",
            "需要联调接口、文件和网关链路的实施同事",
        ],
    },
    "Lekima-App": {
        "label": "湖南装配式产业平台前端",
        "story": "从站点标题、页面目录和监控/BIM/绿色建筑等页面划分看，这一侧更像是湖南省装配式产业大数据分析及公共服务平台的可视化门户。",
        "roles": [
            "政府监管人员",
            "企业、工厂、项目相关协同人员",
            "需要查看产业总览、视频监控、质量和绿色建筑数据的业务同事",
        ],
    },
}

VIEW_MODULE_HINTS = {
    "HAINAN.Web": {
        "dashboard": "首页与业务总览，适合看整体态势和常用入口。",
        "large-screen": "大屏展示，适合汇报和集中展示关键指标。",
        "project": "项目申报、变更、审查、抽查和资料流转。",
        "task": "待办、已办和办理中的任务处理。",
        "bussiness": "业务表单、申报表单和流程性资料填写。",
        "account-manage": "企业、个人、专家及单位账号管理。",
        "company-info": "企业基础资料和资质信息维护。",
        "personal-information": "个人资料、专业信息和执业信息维护。",
        "statistical-analysis": "项目、企业、个人、质量和消防等统计分析。",
        "admin": "系统配置、字典、菜单、流程定义和后台管理。",
        "workFlow": "流程展示、流程节点和流程配置相关页面。",
        "push-data": "对外数据推送、同步和联调相关能力。",
        "platform": "平台基础信息、日志和对接侧页面。",
    },
    "Lekima-App": {
        "dashboard": "产业总览大屏，适合看资讯、排名、产能和装配式占比。",
        "union": "项目、工厂、企业三个维度的联合监管总览。",
        "unionnew": "联合监管的新版本或地方端入口。",
        "monitor": "视频监控，适合查看工厂或项目现场摄像头。",
        "green": "绿色建筑分析和示范展示。",
        "quality": "质量监管相关页面。",
        "part": "构件相关页面，适合看构件维度的信息。",
        "knowledge": "知识、资讯和详情浏览。",
        "policy": "政策法规和制度资料。",
        "bim": "BIM 模型或模型展示能力。",
        "service": "公共服务入口。",
        "dataReport": "数据上报或报送相关页面。",
        "login": "登录和身份进入流程。",
    },
}

SERVICE_MODULE_HINTS = {
    "HAINAN.Server": {
        "IModules": "业务接口、实体和跨模块约定。",
        "Modules": "核心业务实现层。",
        "Services": "对外 API 服务入口。",
        "Dto": "前后端和服务间交换数据对象。",
        "PKPM.SGD.Workflow": "工作流引擎和流程模型。",
        "SyncData": "同步、推送和外部平台联动。",
        "Tests": "单元测试和业务验证。",
    },
    "KellyT.Solutions.Prod": {
        "Kelly.App.Core": "核心业务服务实现。",
        "KellyT.App.Organization": "组织、企业、账号等组织侧能力。",
        "KellyT.App.DataCollect": "数据采集和报送。",
        "KellyT.App.Files": "文件能力和文件服务协同。",
        "KellyT.App.BI": "统计分析和 BI 相关能力。",
        "KellyT.Services.Server": "核心服务宿主。",
        "KellyT.Services.FileServer": "文件服务宿主。",
        "KellyT.Web": "Web 管理端宿主。",
        "Surging": "网关、服务治理和基础框架。",
    },
}

COMMIT_THEME_RULES = {
    "数据安全与账号保护": ("敏感", "加密", "解密", "密码", "token", "登录", "滑块"),
    "流程稳定性与待办办理": ("工作流", "流程", "待办", "任务", "回退", "步骤"),
    "项目申报与资料维护": ("项目", "申请", "变更", "资料", "表单", "单体"),
    "专家与人员管理": ("专家", "评价", "冻结", "缺席", "抽取", "轮换"),
    "统计分析与查询": ("统计", "分析", "报表", "查询"),
    "对外推送与平台对接": ("推送", "同步", "接口", "网关", "csb", "apione", "machine", "工改", "四库"),
    "消防相关业务": ("消防", "验收"),
    "装配式监管与可视化": ("装配式", "工厂", "企业", "项目监控", "大屏", "地图", "bim", "绿色"),
    "文件与资料流转": ("文件", "上传", "下载", "附件"),
}


@dataclass(slots=True)
class PriorityDocument:
    relative_path: str
    title: str
    content: str
    modified_at: float


@dataclass(slots=True)
class CommitEntry:
    date_text: str
    subject: str


class RepositoryBusinessProfileBuilder:
    def __init__(
        self,
        source: SourceDescriptor,
        settings: CollectorSettings,
        read_text: Callable[[Path, int], str],
        to_iso: Callable[[float], str],
    ) -> None:
        self._source = source
        self._settings = settings
        self._read_text = read_text
        self._to_iso = to_iso

    def build(self) -> list[KnowledgeUnitRecord]:
        priority_documents = self._collect_priority_documents()
        commit_entries = self._collect_commit_entries()
        view_directories = self._collect_view_directories()
        route_titles = self._collect_route_titles(priority_documents)
        units: list[KnowledgeUnitRecord] = []

        for factory in (
            self._build_business_overview_unit,
            self._build_module_map_unit,
            self._build_recent_change_unit,
            self._build_release_playbook_unit,
        ):
            unit = factory(priority_documents, commit_entries, view_directories, route_titles)
            if unit:
                units.append(unit)

        return units

    def _build_business_overview_unit(
        self,
        priority_documents: list[PriorityDocument],
        commit_entries: list[CommitEntry],
        view_directories: list[str],
        route_titles: list[str],
    ) -> KnowledgeUnitRecord | None:
        story = WORKSPACE_STORIES.get(self._source.workspace)
        document_titles = [item.title for item in priority_documents[:4]]
        if not story and not document_titles and not view_directories and not commit_entries:
            return None

        lines = [
            f"工作空间：{self._source.workspace}",
            f"仓库定位：{story['label'] if story else self._source.workspace}",
        ]

        if story:
            lines.extend(
                [
                    "业务判断：",
                    f"- {story['story']}",
                    "主要服务对象：",
                    *[f"- {role}" for role in story["roles"]],
                ]
            )

        focus_terms = self._collect_focus_terms(priority_documents, commit_entries, view_directories, route_titles)
        if focus_terms:
            lines.extend(
                [
                    "当前高频业务词：",
                    f"- {', '.join(focus_terms)}",
                ]
            )

        if route_titles:
            lines.extend(
                [
                    "页面或菜单线索：",
                    *[f"- {title}" for title in route_titles[:8]],
                ]
            )

        if document_titles:
            lines.extend(
                [
                    "高优先级资料来源：",
                    *[f"- {title}" for title in document_titles],
                ]
            )

        if commit_entries:
            lines.extend(
                [
                    "近期关注方向：",
                    *[f"- {entry.subject}" for entry in commit_entries[:4]],
                ]
            )

        content = "\n".join(lines)
        return self._build_unit(
            external_suffix="business-overview",
            title=f"{self._source.workspace} 业务概况",
            content=content,
            summary=f"{self._source.workspace} 的高优先级业务摘要，覆盖平台定位、主要对象和常见业务线索。",
            tags=["business-summary", "business-overview", "priority-context"],
            event_time=self._resolve_latest_time(priority_documents),
        )

    def _build_module_map_unit(
        self,
        priority_documents: list[PriorityDocument],
        commit_entries: list[CommitEntry],
        view_directories: list[str],
        route_titles: list[str],
    ) -> KnowledgeUnitRecord | None:
        module_lines = self._build_module_lines(view_directories)
        if not module_lines:
            return None

        lines = [
            f"工作空间：{self._source.workspace}",
            "模块地图：",
            *[f"- {line}" for line in module_lines],
        ]

        if route_titles:
            lines.extend(
                [
                    "补充菜单词：",
                    *[f"- {title}" for title in route_titles[:10]],
                ]
            )

        lines.extend(
            [
                "适合回答的问题：",
                "- 这个平台主要分成哪几块业务？",
                "- 某个页面大概属于哪个业务环节？",
                "- 这个模块是给谁用的、主要看什么？",
            ]
        )

        return self._build_unit(
            external_suffix="business-module-map",
            title=f"{self._source.workspace} 模块地图",
            content="\n".join(lines),
            summary=f"{self._source.workspace} 的业务模块地图，适合把页面、服务和目录翻译成业务语言。",
            tags=["business-summary", "business-module-map", "priority-context"],
            event_time=self._resolve_latest_time(priority_documents),
        )

    def _build_recent_change_unit(
        self,
        priority_documents: list[PriorityDocument],
        commit_entries: list[CommitEntry],
        view_directories: list[str],
        route_titles: list[str],
    ) -> KnowledgeUnitRecord | None:
        if not commit_entries:
            return None

        themed_commits = self._group_commit_themes(commit_entries)
        lines = [
            f"工作空间：{self._source.workspace}",
            "近期业务变化重点：",
        ]

        if themed_commits:
            for theme, items in themed_commits[:5]:
                sample_text = "；".join(item.subject for item in items[:2])
                lines.append(f"- {theme}：最近多次出现相关提交，典型内容包括：{sample_text}")
        else:
            lines.extend(f"- {entry.subject}" for entry in commit_entries[:6])

        lines.extend(
            [
                "适合回答的问题：",
                "- 最近这一块为什么改得比较多？",
                "- 当前优先关注的是哪类业务变化？",
                "- 这个改动更像是安全、流程、统计还是对接问题？",
            ]
        )

        latest_commit_date = commit_entries[0].date_text.strip()
        latest_event_time = self._normalize_commit_date(latest_commit_date)

        return self._build_unit(
            external_suffix="recent-business-focus",
            title=f"{self._source.workspace} 最近改动的业务影响",
            content="\n".join(lines),
            summary=f"{self._source.workspace} 近期改动的业务焦点摘要，适合回答“最近在忙什么、为什么改这块”。",
            tags=["business-summary", "recent-business-impact", "priority-context"],
            event_time=latest_event_time,
        )

    def _build_release_playbook_unit(
        self,
        priority_documents: list[PriorityDocument],
        commit_entries: list[CommitEntry],
        view_directories: list[str],
        route_titles: list[str],
    ) -> KnowledgeUnitRecord | None:
        if self._source.workspace not in {"KellyT.Solutions.Prod", "Lekima-App"}:
            return None

        release_doc = self._find_shared_release_doc()
        if not release_doc:
            return None

        lines = [
            f"工作空间：{self._source.workspace}",
            "湖南发布与联调要点：",
        ]

        if self._source.workspace == "Lekima-App":
            lines.extend(
                [
                    "- 前端静态资源目标目录固定是 D:\\HUNAN\\nginx\\html\\App。",
                    "- 对外入口固定是 https://103.76.61.132:1103。",
                    "- 只改页面、样式、前端交互时，默认只发 Lekima-App，不需要动 nginx 和 consul。",
                    "- 如果这次改动依赖新接口、返回字段、权限或上传下载契约，就不能只发前端。",
                ]
            )
        else:
            lines.extend(
                [
                    "- 后端服务按职责分成 HNServer、HNWeb、HNGateway、HNFileServer。",
                    "- 改共享层时，默认按 HNServer + HNWeb 联发处理。",
                    "- 只要包含接口更新，发布后都要处理 consul，经过网关暴露的还要重启 HNGateway。",
                    "- 发布顺序更偏向先后端、再网关、最后前端，避免页面先发但接口未就绪。",
                ]
            )

        lines.extend(
            [
                "适合回答的问题：",
                "- 这次改动只发前端够不够？",
                "- 湖南这边应该发哪个服务？",
                "- 发布后为什么还要动 consul 或网关？",
                f"- 参考资料：{release_doc.relative_path}",
            ]
        )

        return self._build_unit(
            external_suffix="release-playbook",
            title=f"{self._source.workspace} 发布与联调说明",
            content="\n".join(lines),
            summary=f"{self._source.workspace} 的发布判断与联调说明，适合回答“该发哪里、先后顺序是什么”。",
            tags=["business-summary", "delivery-playbook", "priority-context"],
            event_time=self._to_iso(release_doc.modified_at),
        )

    def _collect_priority_documents(self) -> list[PriorityDocument]:
        candidates: list[Path] = []
        candidates.extend(path for path in self._source.root_path.glob("README.*") if path.is_file())
        candidates.extend(path for path in self._source.root_path.glob("public/index.html") if path.is_file())
        candidates.extend(path for path in self._source.root_path.glob("src/router/*.js") if path.is_file())
        candidates.extend(path for path in self._source.root_path.glob("src/router/*.ts") if path.is_file())
        candidates.extend(path for path in self._source.root_path.glob("src/lang/zh.js") if path.is_file())
        candidates.extend(
            path
            for path in (self._source.root_path / ".cursor" / "rules").rglob("*.mdc")
            if path.is_file()
        )
        candidates.extend(
            path
            for path in (self._source.root_path / "docs").rglob("*")
            if path.is_file() and path.suffix.lower() in {".md", ".mdc", ".txt", ".docx"}
        )

        shared_release_doc = self._find_shared_release_doc_path()
        if shared_release_doc:
            candidates.append(shared_release_doc)

        scored = []
        for path in candidates:
            if path.name in SKIPPED_LOCAL_FILE_NAMES:
                continue
            try:
                stat = path.stat()
            except OSError:
                continue
            scored.append((self._priority_score(path), stat.st_mtime, path))

        documents: list[PriorityDocument] = []
        seen: set[str] = set()
        for _, _, path in sorted(scored, key=lambda item: (item[0], item[1]), reverse=True):
            normalized = path.as_posix().lower()
            if normalized in seen:
                continue
            content = self._read_text(path, self._settings.max_file_bytes)
            if not content or self._is_placeholder_readme(path, content):
                continue
            title = self._infer_document_title(path, content)
            relative_path = self._display_path(path)
            documents.append(
                PriorityDocument(
                    relative_path=relative_path,
                    title=title,
                    content=self._compact_text(content)[:4000],
                    modified_at=path.stat().st_mtime,
                )
            )
            seen.add(normalized)
            if len(documents) >= 10:
                break

        return documents

    def _collect_commit_entries(self) -> list[CommitEntry]:
        try:
            completed = subprocess.run(
                [
                    "git",
                    "-C",
                    str(self._source.root_path),
                    "log",
                    "-n20",
                    "--pretty=format:%ad | %s",
                    "--date=iso-strict",
                ],
                capture_output=True,
                check=True,
                encoding="utf-8",
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            return []

        entries: list[CommitEntry] = []
        for line in completed.stdout.splitlines():
            match = COMMIT_LINE_PATTERN.match(line.strip())
            if not match:
                continue
            subject = match.group("subject").strip()
            if not subject or subject.lower().startswith("merge branch"):
                continue
            entries.append(
                CommitEntry(
                    date_text=match.group("date").strip(),
                    subject=subject,
                )
            )
        return entries

    def _collect_view_directories(self) -> list[str]:
        views_root = self._source.root_path / "src" / "views"
        if not views_root.exists():
            return []
        return sorted(
            item.name
            for item in views_root.iterdir()
            if item.is_dir() and item.name not in {".", ".."}
        )

    def _collect_route_titles(self, documents: list[PriorityDocument]) -> list[str]:
        titles: list[str] = []
        for document in documents:
            for match in ROUTE_TITLE_PATTERN.findall(document.content):
                candidate = match.strip()
                if candidate in GENERIC_ROUTE_TITLES:
                    continue
                if not CHINESE_PATTERN.search(candidate):
                    continue
                titles.append(candidate)

        unique_titles: list[str] = []
        seen: set[str] = set()
        for title in titles:
            if title in seen:
                continue
            seen.add(title)
            unique_titles.append(title)
        return unique_titles

    def _collect_focus_terms(
        self,
        documents: list[PriorityDocument],
        commit_entries: list[CommitEntry],
        view_directories: list[str],
        route_titles: list[str],
    ) -> list[str]:
        combined = "\n".join(
            [
                *(document.content for document in documents),
                *(entry.subject for entry in commit_entries),
                *view_directories,
                *route_titles,
            ]
        ).lower()
        terms = [
            ("项目申报", ("项目", "申报", "declare")),
            ("审查办理", ("审查", "review")),
            ("专家管理", ("专家", "expert")),
            ("企业资料", ("企业", "company")),
            ("工作流", ("工作流", "workflow")),
            ("统计分析", ("统计", "analysis")),
            ("数据推送", ("推送", "sync")),
            ("装配式监管", ("装配式", "union", "factory")),
            ("视频监控", ("监控", "camera", "video")),
            ("绿色建筑", ("绿色", "green")),
            ("BIM", ("bim",)),
            ("政策知识", ("政策", "knowledge")),
        ]
        matched = [label for label, tokens in terms if any(token in combined for token in tokens)]
        return matched[:8]

    def _build_module_lines(self, view_directories: list[str]) -> list[str]:
        lines: list[str] = []
        seen_labels: set[str] = set()

        view_hints = VIEW_MODULE_HINTS.get(self._source.workspace, {})
        for view_name in view_directories:
            description = view_hints.get(view_name)
            if not description:
                continue
            label = f"{view_name}：{description}"
            if label not in seen_labels:
                lines.append(label)
                seen_labels.add(label)

        service_hints = SERVICE_MODULE_HINTS.get(self._source.workspace, {})
        for directory_name, description in service_hints.items():
            if not (self._source.root_path / directory_name).exists():
                continue
            label = f"{directory_name}：{description}"
            if label not in seen_labels:
                lines.append(label)
                seen_labels.add(label)

        return lines[:12]

    def _group_commit_themes(self, commit_entries: list[CommitEntry]) -> list[tuple[str, list[CommitEntry]]]:
        groups: dict[str, list[CommitEntry]] = {}
        for entry in commit_entries:
            lowered = entry.subject.lower()
            for theme, keywords in COMMIT_THEME_RULES.items():
                if any(keyword.lower() in lowered for keyword in keywords):
                    groups.setdefault(theme, []).append(entry)

        ranked = sorted(groups.items(), key=lambda item: len(item[1]), reverse=True)
        return ranked

    def _build_unit(
        self,
        external_suffix: str,
        title: str,
        content: str,
        summary: str,
        tags: list[str],
        event_time: str | None,
    ) -> KnowledgeUnitRecord:
        return KnowledgeUnitRecord(
            external_id=f"{self._source.source_key}:{external_suffix}",
            bot=self._settings.bot,
            source_family="document",
            source_app=self._source.source_app,
            workspace=self._source.workspace,
            title=title,
            content_redacted=content,
            summary=summary,
            tags=sorted({*tags, "git", self._source.workspace.lower()}),
            permissions=self._settings.permission_scopes.copy(),
            allowed_emails=self._settings.allowed_emails.copy(),
            event_time=event_time,
            source_uri=f"git://{self._source.workspace}/{external_suffix}",
        )

    def _resolve_latest_time(self, documents: list[PriorityDocument]) -> str | None:
        if not documents:
            return None
        latest_modified = max(document.modified_at for document in documents)
        return self._to_iso(latest_modified)

    def _normalize_commit_date(self, date_text: str) -> str | None:
        if "T" not in date_text:
            return None
        return date_text

    def _priority_score(self, path: Path) -> int:
        normalized = path.as_posix().lower()
        score = 0
        if path.name.lower().startswith("readme"):
            score += 120
        if ".cursor/rules/" in normalized:
            score += 110
        if normalized.endswith("frontend-backend-integration.mdc"):
            score += 130
        if normalized.endswith("business-modules.mdc"):
            score += 130
        if normalized.endswith("backend-structure.mdc"):
            score += 120
        if "/docs/" in normalized:
            score += 90
        if normalized.endswith("public/index.html"):
            score += 80
        if "/src/router/" in normalized:
            score += 70
        if normalized.endswith("zh.js"):
            score += 60
        return score

    def _infer_document_title(self, path: Path, content: str) -> str:
        match = HTML_TITLE_PATTERN.search(content)
        if match:
            html_title = self._compact_text(match.group(1))
            if html_title:
                return html_title
        return path.name

    def _is_placeholder_readme(self, path: Path, content: str) -> bool:
        if path.name.lower() != "readme.md":
            return False
        placeholder_tokens = ("todo:", "简要介绍你的项目", "指导用户获取你的代码")
        lowered = content.lower()
        if all(token.lower() in lowered for token in placeholder_tokens):
            return True
        if "vue-element-admin" in lowered and "introduction" in lowered and "getting started" in lowered:
            return True
        return False

    def _display_path(self, path: Path) -> str:
        try:
            return path.relative_to(self._source.root_path).as_posix()
        except ValueError:
            return path.as_posix()

    def _compact_text(self, content: str) -> str:
        lines = [line.strip() for line in content.replace("\r\n", "\n").splitlines() if line.strip()]
        return "\n".join(lines)

    def _find_shared_release_doc(self) -> PriorityDocument | None:
        path = self._find_shared_release_doc_path()
        if not path:
            return None
        content = self._read_text(path, self._settings.max_file_bytes)
        if not content:
            return None
        return PriorityDocument(
            relative_path=self._display_path(path),
            title=path.name,
            content=self._compact_text(content)[:4000],
            modified_at=path.stat().st_mtime,
        )

    def _find_shared_release_doc_path(self) -> Path | None:
        shared_path = self._source.root_path.parent / "docs" / "湖南项目更新与发布说明.md"
        return shared_path if shared_path.exists() else None
