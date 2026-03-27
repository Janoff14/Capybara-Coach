import os

from dotenv import load_dotenv
from openai import AzureOpenAI


def main() -> None:
    load_dotenv()

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    deployment = os.getenv("AZURE_OPENAI_TEXT_DEPLOYMENT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")

    if not endpoint or not api_key or not deployment:
        raise RuntimeError(
            "Missing Azure text config. Set AZURE_OPENAI_ENDPOINT, "
            "AZURE_OPENAI_API_KEY, and AZURE_OPENAI_TEXT_DEPLOYMENT."
        )

    client = AzureOpenAI(
        api_key=api_key,
        api_version=api_version,
        azure_endpoint=endpoint,
    )

    response = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": "You are a strict evaluator."},
            {"role": "user", "content": "Explain Newton's first law."},
        ],
    )

    print("\nRESPONSE:\n")
    print(response.choices[0].message.content)


if __name__ == "__main__":
    main()
