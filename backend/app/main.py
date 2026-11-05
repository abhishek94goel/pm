from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from starlette.middleware.sessions import SessionMiddleware

from app import database, openrouter
from app.schemas import BoardData, ChatModelResponse, ChatRequest, ChatResponse


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.initialize_database()
    yield


app = FastAPI(title="Project Management MVP", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get(
        "SESSION_SECRET", "local-development-only-session-secret"
    ),
    session_cookie="pm_session",
    same_site="lax",
    https_only=False,
)


class Credentials(BaseModel):
    username: str
    password: str


def require_user(request: Request) -> str:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(credentials: Credentials, request: Request) -> dict[str, str]:
    if credentials.username != "user" or credentials.password != "password":
        raise HTTPException(status_code=401, detail="Invalid username or password")
    request.session.clear()
    request.session["user_id"] = "user"
    return {"username": "user"}


@app.get("/api/auth/me")
def current_user(request: Request) -> dict[str, str]:
    return {"username": require_user(request)}


@app.post("/api/auth/logout")
def logout(request: Request) -> dict[str, str]:
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/board", response_model=BoardData)
def read_board(user_id: str = Depends(require_user)) -> BoardData:
    return database.get_or_create_board(user_id)


@app.put("/api/board", response_model=BoardData)
def update_board(
    board: BoardData,
    user_id: str = Depends(require_user),
) -> BoardData:
    try:
        return database.save_board(user_id, board)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/chat", response_model=ChatResponse)
def chat(
    chat_request: ChatRequest,
    user_id: str = Depends(require_user),
) -> ChatResponse:
    board = database.get_or_create_board(user_id)
    messages = [
        {
            "role": "system",
            "content": (
                "You are a project-management assistant. Reply with exactly one JSON "
                "object containing a concise string field 'answer' and a "
                "'boardUpdate' field that is either null or the complete updated "
                "board with 'columns' and 'cards'. Preserve the existing column IDs "
                "and order; columns may be renamed. Every card must appear in exactly "
                "one column and its ID must match its key in 'cards'. Use the current "
                "board and conversation to answer the user's latest request. Do not "
                "include markdown fences."
            ),
        },
        *[message.model_dump() for message in chat_request.history],
        {
            "role": "user",
            "content": (
                "Current board:\n"
                f"{board.model_dump_json(by_alias=True)}\n\n"
                f"Latest request:\n{chat_request.message}"
            ),
        },
    ]

    try:
        raw_response = openrouter.ask_openrouter_messages(messages)
    except openrouter.OpenRouterError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    try:
        model_response = ChatModelResponse.model_validate_json(raw_response)
    except ValidationError as error:
        raise HTTPException(
            status_code=502,
            detail="The assistant returned an invalid response.",
        ) from error

    if model_response.board_update is not None:
        try:
            board = database.save_board(user_id, model_response.board_update)
        except ValueError as error:
            raise HTTPException(
                status_code=502,
                detail="The assistant returned an invalid board update.",
            ) from error

    return ChatResponse(answer=model_response.answer, board=board)


static_dir = Path(
    os.environ.get(
        "STATIC_DIR",
        str(Path(__file__).resolve().parents[2] / "frontend" / "out"),
    )
)
app.mount(
    "/",
    StaticFiles(directory=static_dir, html=True, check_dir=False),
    name="frontend",
)
