import unittest

from app.services.pdf import extract_text_from_payload


class PdfParsingTests(unittest.TestCase):
    def test_malformed_pdf_returns_safe_validation_error(self) -> None:
        with self.assertRaisesRegex(ValueError, "valid, unencrypted PDF"):
            extract_text_from_payload("broken.pdf", b"this is not a PDF")


if __name__ == "__main__":
    unittest.main()
