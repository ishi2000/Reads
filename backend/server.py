"""Cosift backend — async social reading PWA."""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import secrets
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Cosift")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("cosift")


# ===================== Helpers =====================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


async def get_current_user(request: Request) -> Dict[str, Any]:
    """Resolve a user from session cookie/header. Supports both Google-auth and anonymous users."""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def optional_user(request: Request) -> Optional[Dict[str, Any]]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


# ===================== Models =====================
class SessionPayload(BaseModel):
    session_id: str


class AnonymousJoin(BaseModel):
    display_name: str
    invite_code: Optional[str] = None


class CircleCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class HighlightCreate(BaseModel):
    book_id: str
    page: int
    text: str
    thought: Optional[str] = ""


class ThoughtCreate(BaseModel):
    text: str


class ThreadReplyCreate(BaseModel):
    text: str


class VocabCreate(BaseModel):
    book_id: str
    word: str
    meaning: Optional[str] = ""
    page: Optional[int] = None


class ProgressUpdate(BaseModel):
    book_id: str
    current_page: int
    total_pages: Optional[int] = None


# ===================== Auth =====================
@api.post("/auth/session")
async def auth_session(payload: SessionPayload, response: Response):
    """Exchange Emergent OAuth session_id for our session_token."""
    r = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": payload.session_id},
        timeout=10,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()
    email = data["email"]
    name = data["name"]
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "anonymous": False}},
        )
    else:
        user_id = new_id("user")
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "anonymous": False,
            "created_at": now_iso(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": now_iso(),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {"user_id": user_id, "email": email, "name": name, "picture": picture, "session_token": session_token}


@api.post("/auth/anonymous")
async def auth_anonymous(body: AnonymousJoin, response: Response):
    """Create a lightweight anonymous user (used by invite-link joiners)."""
    user_id = new_id("anon")
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    await db.users.insert_one({
        "user_id": user_id,
        "email": None,
        "name": body.display_name.strip() or "Reader",
        "picture": "",
        "anonymous": True,
        "created_at": now_iso(),
    })
    await db.sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": now_iso(),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=30 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {"user_id": user_id, "name": body.display_name, "anonymous": True, "session_token": session_token}


@api.get("/auth/me")
async def auth_me(user: Dict = Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "_id"}


@api.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ===================== Circles =====================
@api.post("/circles")
async def create_circle(body: CircleCreate, user: Dict = Depends(get_current_user)):
    circle_id = new_id("cir")
    doc = {
        "circle_id": circle_id,
        "name": body.name,
        "description": body.description or "",
        "owner_id": user["user_id"],
        "created_at": now_iso(),
    }
    await db.circles.insert_one(doc)
    await db.circle_members.insert_one({
        "circle_id": circle_id,
        "user_id": user["user_id"],
        "role": "owner",
        "joined_at": now_iso(),
    })
    doc.pop("_id", None)
    return doc


@api.get("/circles")
async def list_circles(user: Dict = Depends(get_current_user)):
    memberships = await db.circle_members.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    circle_ids = [m["circle_id"] for m in memberships]
    circles = await db.circles.find({"circle_id": {"$in": circle_ids}}, {"_id": 0}).to_list(500)
    # attach books + member count + my progress
    out = []
    for c in circles:
        books = await db.books.find({"circle_id": c["circle_id"]}, {"_id": 0}).to_list(100)
        member_count = await db.circle_members.count_documents({"circle_id": c["circle_id"]})
        for b in books:
            prog = await db.progress.find_one(
                {"user_id": user["user_id"], "book_id": b["book_id"]}, {"_id": 0}
            )
            b["my_progress"] = prog or {"current_page": 0, "total_pages": b.get("total_pages", 0)}
        c["books"] = books
        c["member_count"] = member_count
        out.append(c)
    return out


@api.get("/circles/{circle_id}")
async def get_circle(circle_id: str, user: Dict = Depends(get_current_user)):
    c = await db.circles.find_one({"circle_id": circle_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Circle not found")
    members = await db.circle_members.find({"circle_id": circle_id}, {"_id": 0}).to_list(500)
    user_ids = [m["user_id"] for m in members]
    member_users = await db.users.find(
        {"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
    ).to_list(500)
    books = await db.books.find({"circle_id": circle_id}, {"_id": 0}).to_list(100)
    c["members"] = member_users
    c["books"] = books
    return c


# ===================== Books =====================
@api.post("/books")
async def upload_book(
    title: str = Form(...),
    circle_id: Optional[str] = Form(None),
    mode: str = Form("circle"),  # 'circle' or 'solo'
    file: UploadFile = File(...),
    user: Dict = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")
    book_id = new_id("bk")
    file_id = new_id("file")
    dest = UPLOAD_DIR / f"{file_id}.pdf"
    content = await file.read()
    dest.write_bytes(content)

    cover_palette = ["#1B3A6B", "#C86A58", "#2D5A3D", "#D4A547", "#7A2E3B"]
    cover_color = cover_palette[hash(book_id) % len(cover_palette)]

    doc = {
        "book_id": book_id,
        "title": title,
        "circle_id": circle_id if mode == "circle" else None,
        "mode": mode,
        "file_id": file_id,
        "owner_id": user["user_id"],
        "total_pages": 0,  # frontend will update after PDF parse
        "cover_color": cover_color,
        "created_at": now_iso(),
    }
    await db.books.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/books/solo")
async def list_solo_books(user: Dict = Depends(get_current_user)):
    books = await db.books.find(
        {"owner_id": user["user_id"], "mode": "solo"}, {"_id": 0}
    ).to_list(500)
    for b in books:
        prog = await db.progress.find_one(
            {"user_id": user["user_id"], "book_id": b["book_id"]}, {"_id": 0}
        )
        b["my_progress"] = prog or {"current_page": 0, "total_pages": b.get("total_pages", 0)}
    return books


@api.get("/books/{book_id}")
async def get_book(book_id: str, user: Dict = Depends(get_current_user)):
    book = await db.books.find_one({"book_id": book_id}, {"_id": 0})
    if not book:
        raise HTTPException(404, "Book not found")
    prog = await db.progress.find_one({"user_id": user["user_id"], "book_id": book_id}, {"_id": 0})
    book["my_progress"] = prog or {"current_page": 0, "total_pages": book.get("total_pages", 0)}
    return book


@api.put("/books/{book_id}/total-pages")
async def set_total_pages(book_id: str, total_pages: int, user: Dict = Depends(get_current_user)):
    await db.books.update_one({"book_id": book_id}, {"$set": {"total_pages": total_pages}})
    return {"ok": True}


@api.get("/files/{file_id}")
async def serve_file(file_id: str):
    safe = file_id.replace("/", "").replace("..", "")
    path = UPLOAD_DIR / f"{safe}.pdf"
    if not path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(path, media_type="application/pdf")


# ===================== Progress =====================
@api.put("/progress")
async def update_progress(body: ProgressUpdate, user: Dict = Depends(get_current_user)):
    existing = await db.progress.find_one(
        {"user_id": user["user_id"], "book_id": body.book_id}, {"_id": 0}
    )
    max_page = max(body.current_page, (existing or {}).get("max_page_reached", 0))
    update = {
        "user_id": user["user_id"],
        "book_id": body.book_id,
        "current_page": body.current_page,
        "max_page_reached": max_page,
        "total_pages": body.total_pages or (existing or {}).get("total_pages", 0),
        "updated_at": now_iso(),
    }
    await db.progress.update_one(
        {"user_id": user["user_id"], "book_id": body.book_id},
        {"$set": update},
        upsert=True,
    )
    if body.total_pages:
        await db.books.update_one(
            {"book_id": body.book_id, "total_pages": 0},
            {"$set": {"total_pages": body.total_pages}},
        )
    return update


# ===================== Highlights / Thoughts / Threads =====================
@api.post("/highlights")
async def create_highlight(body: HighlightCreate, user: Dict = Depends(get_current_user)):
    hl_id = new_id("hl")
    doc = {
        "highlight_id": hl_id,
        "book_id": body.book_id,
        "page": body.page,
        "text": body.text,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "created_at": now_iso(),
    }
    await db.highlights.insert_one(doc)

    if body.thought:
        await db.thoughts.insert_one({
            "thought_id": new_id("th"),
            "highlight_id": hl_id,
            "book_id": body.book_id,
            "page": body.page,
            "text": body.thought,
            "user_id": user["user_id"],
            "user_name": user["name"],
            "created_at": now_iso(),
        })

    await db.activity.insert_one({
        "activity_id": new_id("act"),
        "type": "highlight",
        "book_id": body.book_id,
        "page": body.page,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "preview": body.text[:120],
        "created_at": now_iso(),
    })
    doc.pop("_id", None)
    return doc


@api.get("/books/{book_id}/highlights")
async def list_highlights(book_id: str, user: Dict = Depends(get_current_user)):
    """Return only highlights for pages the user has already reached (unlocking mechanic)."""
    prog = await db.progress.find_one({"user_id": user["user_id"], "book_id": book_id}, {"_id": 0})
    max_page = (prog or {}).get("max_page_reached", 0) or (prog or {}).get("current_page", 0)
    highlights = await db.highlights.find(
        {"book_id": book_id, "page": {"$lte": max_page}}, {"_id": 0}
    ).sort("page", 1).to_list(2000)
    for h in highlights:
        thoughts = await db.thoughts.find(
            {"highlight_id": h["highlight_id"]}, {"_id": 0}
        ).to_list(50)
        h["thoughts"] = thoughts
        h["reply_count"] = await db.threads.count_documents({"highlight_id": h["highlight_id"]})
    return {"max_page_reached": max_page, "highlights": highlights}


@api.get("/books/{book_id}/locked-count")
async def locked_count(book_id: str, user: Dict = Depends(get_current_user)):
    prog = await db.progress.find_one({"user_id": user["user_id"], "book_id": book_id}, {"_id": 0})
    max_page = (prog or {}).get("max_page_reached", 0) or (prog or {}).get("current_page", 0)
    locked = await db.highlights.count_documents({"book_id": book_id, "page": {"$gt": max_page}})
    return {"locked": locked}


@api.post("/highlights/{highlight_id}/thoughts")
async def add_thought(highlight_id: str, body: ThoughtCreate, user: Dict = Depends(get_current_user)):
    """Attach a reflection (thought) to an EXISTING highlight.

    Distinct from POST /highlights (which creates a brand-new highlight,
    optionally with a thought baked in). This endpoint exists so the
    'Add Reflection' post-create action can attach to the highlight the
    user just made — without re-creating a duplicate row.
    """
    hl = await db.highlights.find_one({"highlight_id": highlight_id}, {"_id": 0})
    if not hl:
        raise HTTPException(404, "Highlight not found")
    doc = {
        "thought_id": new_id("th"),
        "highlight_id": highlight_id,
        "book_id": hl["book_id"],
        "page": hl["page"],
        "text": body.text,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "created_at": now_iso(),
    }
    await db.thoughts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/highlights/{highlight_id}/threads")
async def reply_thread(highlight_id: str, body: ThreadReplyCreate, user: Dict = Depends(get_current_user)):
    hl = await db.highlights.find_one({"highlight_id": highlight_id}, {"_id": 0})
    if not hl:
        raise HTTPException(404, "Highlight not found")
    doc = {
        "thread_id": new_id("tr"),
        "highlight_id": highlight_id,
        "book_id": hl["book_id"],
        "page": hl["page"],
        "text": body.text,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "created_at": now_iso(),
    }
    await db.threads.insert_one(doc)
    await db.activity.insert_one({
        "activity_id": new_id("act"),
        "type": "reply",
        "book_id": hl["book_id"],
        "page": hl["page"],
        "user_id": user["user_id"],
        "user_name": user["name"],
        "preview": body.text[:120],
        "created_at": now_iso(),
    })
    doc.pop("_id", None)
    return doc


@api.get("/highlights/{highlight_id}/threads")
async def list_threads(highlight_id: str, user: Dict = Depends(get_current_user)):
    rows = await db.threads.find({"highlight_id": highlight_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return rows


# ===================== Vocabulary =====================
@api.post("/vocabulary")
async def add_vocab(body: VocabCreate, user: Dict = Depends(get_current_user)):
    doc = {
        "vocab_id": new_id("vc"),
        "book_id": body.book_id,
        "word": body.word,
        "meaning": body.meaning or "",
        "page": body.page,
        "user_id": user["user_id"],
        "created_at": now_iso(),
    }
    await db.vocabulary.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/vocabulary")
async def list_vocab(user: Dict = Depends(get_current_user)):
    rows = await db.vocabulary.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return rows


# ===================== Personal: My Thoughts =====================
@api.get("/my-thoughts")
async def my_thoughts(user: Dict = Depends(get_current_user)):
    rows = await db.highlights.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    for r in rows:
        r["my_thoughts"] = await db.thoughts.find(
            {"highlight_id": r["highlight_id"], "user_id": user["user_id"]}, {"_id": 0}
        ).to_list(20)
    return rows


# ===================== Invites =====================
@api.post("/circles/{circle_id}/invite")
async def create_invite(circle_id: str, user: Dict = Depends(get_current_user)):
    circle = await db.circles.find_one({"circle_id": circle_id}, {"_id": 0})
    if not circle:
        raise HTTPException(404, "Circle not found")
    code = secrets.token_urlsafe(8)
    await db.invites.insert_one({
        "code": code,
        "circle_id": circle_id,
        "created_by": user["user_id"],
        "created_at": now_iso(),
    })
    return {"code": code, "circle_id": circle_id}


@api.get("/invites/{code}")
async def get_invite(code: str):
    inv = await db.invites.find_one({"code": code}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invite not found")
    circle = await db.circles.find_one({"circle_id": inv["circle_id"]}, {"_id": 0})
    books = await db.books.find({"circle_id": inv["circle_id"]}, {"_id": 0}).to_list(50)
    return {"circle": circle, "books": books, "code": code}


@api.post("/invites/{code}/join")
async def join_invite(code: str, user: Dict = Depends(get_current_user)):
    inv = await db.invites.find_one({"code": code}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invite not found")
    existing = await db.circle_members.find_one(
        {"circle_id": inv["circle_id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    if not existing:
        await db.circle_members.insert_one({
            "circle_id": inv["circle_id"],
            "user_id": user["user_id"],
            "role": "member",
            "joined_at": now_iso(),
        })
    return {"ok": True, "circle_id": inv["circle_id"]}


# ===================== Turns / Activity =====================
@api.get("/turns")
async def turns_feed(user: Dict = Depends(get_current_user)):
    """Async activity feed across user's circles. Filtered by unlocking rule."""
    memberships = await db.circle_members.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    circle_ids = [m["circle_id"] for m in memberships]
    circles = await db.circles.find({"circle_id": {"$in": circle_ids}}, {"_id": 0}).to_list(500)

    sections = []
    for c in circles:
        books = await db.books.find({"circle_id": c["circle_id"]}, {"_id": 0}).to_list(50)
        members = await db.circle_members.find({"circle_id": c["circle_id"]}, {"_id": 0}).to_list(500)
        member_ids = [m["user_id"] for m in members]
        member_progress = []
        for mid in member_ids:
            u = await db.users.find_one({"user_id": mid}, {"_id": 0})
            if not u:
                continue
            prog_total = 0
            for b in books:
                p = await db.progress.find_one({"user_id": mid, "book_id": b["book_id"]}, {"_id": 0})
                prog_total += (p or {}).get("current_page", 0)
            member_progress.append({
                "user_id": mid,
                "name": u["name"],
                "picture": u.get("picture", ""),
                "pages_read": prog_total,
            })

        activity_items = []
        for b in books:
            prog = await db.progress.find_one({"user_id": user["user_id"], "book_id": b["book_id"]}, {"_id": 0})
            max_page = (prog or {}).get("max_page_reached", 0) or (prog or {}).get("current_page", 0)
            acts = await db.activity.find(
                {"book_id": b["book_id"], "page": {"$lte": max_page}},
                {"_id": 0},
            ).sort("created_at", -1).to_list(50)
            for a in acts:
                a["book_title"] = b["title"]
                activity_items.append(a)
        activity_items.sort(key=lambda x: x["created_at"], reverse=True)
        sections.append({
            "circle": c,
            "books": books,
            "members": member_progress,
            "activity": activity_items[:30],
        })
    return sections


# ===================== Saved Insights =====================
@api.get("/saved-insights")
async def saved_insights(user: Dict = Depends(get_current_user)):
    """Group highlights from others (that user has unlocked) by book."""
    memberships = await db.circle_members.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    circle_ids = [m["circle_id"] for m in memberships]
    books = await db.books.find(
        {"$or": [{"circle_id": {"$in": circle_ids}}, {"owner_id": user["user_id"]}]},
        {"_id": 0},
    ).to_list(500)
    out = []
    for b in books:
        prog = await db.progress.find_one({"user_id": user["user_id"], "book_id": b["book_id"]}, {"_id": 0})
        max_page = (prog or {}).get("max_page_reached", 0) or (prog or {}).get("current_page", 0)
        hls = await db.highlights.find(
            {"book_id": b["book_id"], "page": {"$lte": max_page}, "user_id": {"$ne": user["user_id"]}},
            {"_id": 0},
        ).sort("page", 1).to_list(200)
        if hls:
            out.append({"book": b, "highlights": hls})
    return out


# Mount router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
