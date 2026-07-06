import unittest

from app.core.config import Settings
from app.services.ai import assess_flashcard_practice


class PracticeAssessmentTests(unittest.TestCase):
    def test_fallback_scores_complete_concise_answers_and_uses_time(self) -> None:
        cards = [
            {
                "id": "card-1",
                "question": "What changes motion?",
                "answer": "A net force changes an object's state of motion.",
            },
            {
                "id": "card-2",
                "question": "What is inertia?",
                "answer": "Inertia is an object's resistance to a change in motion.",
            },
        ]
        answers = [
            {
                "flashcard_id": "card-1",
                "user_answer": "A net force changes an object's state of motion.",
            },
            {
                "flashcard_id": "card-2",
                "user_answer": "Inertia is resistance to a change in an object's motion.",
            },
        ]
        settings = Settings(
            azure_openai_endpoint=None,
            azure_openai_api_key=None,
            storage_backend="filesystem",
        )

        assessment = assess_flashcard_practice(
            cards=cards,
            answers=answers,
            active_seconds=48,
            paused_seconds=12,
            settings=settings,
        )

        self.assertGreaterEqual(assessment["score"], 85)
        self.assertEqual(assessment["rating"], "easy")
        self.assertEqual(len(assessment["per_card"]), 2)
        self.assertEqual(assessment["protocol_version"], 1)

    def test_fallback_does_not_reward_fast_but_incorrect_answers(self) -> None:
        cards = [{"id": "card-1", "question": "What is inertia?", "answer": "Resistance to a change in motion."}]
        answers = [{"flashcard_id": "card-1", "user_answer": "It makes objects accelerate faster."}]
        settings = Settings(
            azure_openai_endpoint=None,
            azure_openai_api_key=None,
            storage_backend="filesystem",
        )

        assessment = assess_flashcard_practice(
            cards=cards,
            answers=answers,
            active_seconds=4,
            paused_seconds=0,
            settings=settings,
        )

        self.assertLess(assessment["score"], 55)
        self.assertEqual(assessment["rating"], "hard")


if __name__ == "__main__":
    unittest.main()
