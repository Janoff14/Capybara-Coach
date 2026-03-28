import json
import unittest
from unittest.mock import patch

from app.core.config import Settings
from app.services.ai import ASSESSMENT_PROTOCOL_VERSION, assess_transcript


class AssessmentProtocolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = Settings()

    def test_assessment_score_is_deterministic_for_same_payload(self) -> None:
        model_payload = json.dumps(
            {
                "verdict": "Solid grasp with a few missing specifics.",
                "feedback": "The student has the core idea but leaves out some detail.",
                "covered_well": ["Names the main mechanism correctly", "Keeps the explanation mostly coherent"],
                "missing": ["Does not mention the role of net force"],
                "weak_areas": ["Depth stays a bit surface-level"],
                "inaccuracies": [],
                "next_steps": ["Add one concrete example"],
                "rubric": {
                    "coverage": "solid",
                    "accuracy": "solid",
                    "clarity": "solid",
                    "structure": "partial",
                    "depth": "partial",
                },
            }
        )

        with patch("app.services.ai._chat_json", return_value=model_payload):
            first = assess_transcript(
                transcript="Objects keep moving unless something changes them.",
                source_text="Newton's first law says an object stays at rest or uniform motion unless acted on by a net force.",
                strictness=78,
                settings=self.settings,
            )
            second = assess_transcript(
                transcript="Objects keep moving unless something changes them.",
                source_text="Newton's first law says an object stays at rest or uniform motion unless acted on by a net force.",
                strictness=78,
                settings=self.settings,
            )

        self.assertEqual(first["score"], second["score"])
        self.assertEqual(first["criteria"], second["criteria"])
        self.assertEqual(first["score_protocol"], second["score_protocol"])
        self.assertEqual(first["protocol_version"], ASSESSMENT_PROTOCOL_VERSION)

    def test_strictness_changes_penalty_not_rubric(self) -> None:
        model_payload = json.dumps(
            {
                "verdict": "Mostly right, but not fully developed.",
                "feedback": "Needs stronger detail and one missing concept.",
                "covered_well": ["Gets the central idea right"],
                "missing": ["Leaves out inertia"],
                "weak_areas": ["Explanation stays too general"],
                "inaccuracies": ["Suggests force is always required to keep motion going"],
                "next_steps": ["State inertia explicitly"],
                "rubric": {
                    "coverage": "partial",
                    "accuracy": "partial",
                    "clarity": "solid",
                    "structure": "partial",
                    "depth": "weak",
                },
            }
        )

        with patch("app.services.ai._chat_json", return_value=model_payload):
            forgiving = assess_transcript(
                transcript="Motion keeps going, but I am fuzzy on the reason.",
                source_text="Newton's first law says an object stays at rest or uniform motion unless acted on by a net force.",
                strictness=0,
                settings=self.settings,
            )
            demanding = assess_transcript(
                transcript="Motion keeps going, but I am fuzzy on the reason.",
                source_text="Newton's first law says an object stays at rest or uniform motion unless acted on by a net force.",
                strictness=80,
                settings=self.settings,
            )

        self.assertEqual(forgiving["criteria"], demanding["criteria"])
        self.assertGreater(forgiving["score"], demanding["score"])
        self.assertEqual(forgiving["score_protocol"]["penalty_points"], 0)
        self.assertGreater(demanding["score_protocol"]["penalty_points"], 0)

    def test_rubric_aliases_normalize_to_expected_scores(self) -> None:
        model_payload = json.dumps(
            {
                "verdict": "Alias normalization check.",
                "feedback": "Alias normalization check.",
                "covered_well": ["Some strong recall"],
                "missing": ["One important omission"],
                "weak_areas": ["Depth could improve"],
                "inaccuracies": [],
                "next_steps": ["Tighten the explanation"],
                "rubric": {
                    "coverage": "good",
                    "accuracy": "excellent",
                    "clarity": "adequate",
                    "structure": "poor",
                    "depth": "none",
                },
            }
        )

        with patch("app.services.ai._chat_json", return_value=model_payload):
            assessment = assess_transcript(
                transcript="Test transcript",
                source_text="Test source",
                strictness=50,
                settings=self.settings,
            )

        self.assertEqual(assessment["criteria"]["coverage"], 80)
        self.assertEqual(assessment["criteria"]["accuracy"], 95)
        self.assertEqual(assessment["criteria"]["clarity"], 60)
        self.assertEqual(assessment["criteria"]["structure"], 40)
        self.assertEqual(assessment["criteria"]["depth"], 20)


if __name__ == "__main__":
    unittest.main()
