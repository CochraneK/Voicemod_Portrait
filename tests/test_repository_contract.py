from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class RepositoryContractTests(unittest.TestCase):
    def test_local_audio_claim_matches_no_backend_runtime(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        js = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertNotIn("fetch(", js)
        self.assertNotIn("XMLHttpRequest", js)
        self.assertNotIn("WebSocket", js)
        self.assertIn("麦克风", html)

    def test_provenance_gate_exists(self):
        text = (ROOT / "DATA_PROVENANCE.md").read_text(encoding="utf-8")
        self.assertIn("Unresolved redistribution gate", text)
        self.assertIn("aiface", text)
        self.assertIn("voicemod", text)

    def test_face_dataset_section_is_not_called_open_downloads(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("Open Face Downloads", html)
        self.assertNotIn("开源人脸下载", html)

    def test_continuity_contract_exists(self):
        for path in ("AGENTS.md", "HANDOFF.md", "STATUS.md", "DECISIONS.md", "docs/architecture.md"):
            self.assertTrue((ROOT / path).is_file(), path)

    def test_canonical_identity(self):
        self.assertIn("CochraneK", (ROOT / "DECISIONS.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
