from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Card(APIModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    details: str

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Card titles cannot be empty.")
        return title


class Column(APIModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    card_ids: list[str] = Field(alias="cardIds")

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Column titles cannot be empty.")
        return title


class BoardData(APIModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def validate_card_references(self) -> "BoardData":
        column_ids = [column.id for column in self.columns]
        if len(column_ids) != len(set(column_ids)):
            raise ValueError("Column IDs must be unique.")

        card_ids = [
            card_id for column in self.columns for card_id in column.card_ids
        ]
        if len(card_ids) != len(set(card_ids)):
            raise ValueError("A card can appear in only one column.")
        if set(card_ids) != set(self.cards):
            raise ValueError("Every card must be referenced by exactly one column.")
        if any(card_id != card.id for card_id, card in self.cards.items()):
            raise ValueError("Card IDs must match their object keys.")
        return self


class ChatMessage(APIModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        content = value.strip()
        if not content:
            raise ValueError("Chat messages cannot be empty.")
        return content


class ChatRequest(APIModel):
    message: str = Field(min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        message = value.strip()
        if not message:
            raise ValueError("Chat messages cannot be empty.")
        return message


class ChatModelResponse(APIModel):
    answer: str = Field(min_length=1)
    board_update: BoardData | None = Field(default=None, alias="boardUpdate")

    @field_validator("answer")
    @classmethod
    def strip_answer(cls, value: str) -> str:
        answer = value.strip()
        if not answer:
            raise ValueError("The assistant answer cannot be empty.")
        return answer


class ChatResponse(APIModel):
    answer: str
    board: BoardData
