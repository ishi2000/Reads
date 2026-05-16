"""Backend API tests for Cosift — covers auth, circles, books, progress, highlights,
threads, vocabulary, invites, turns, my-thoughts and saved-insights."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://circle-reads.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Tiny valid PDF
PDF_BYTES = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n"
    b"0000000098 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n147\n%%EOF"
)


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session_a():
    s = requests.Session()
    r = s.post(f"{API}/auth/anonymous", json={"display_name": "TEST_Alice"})
    assert r.status_code == 200, r.text
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['session_token']}"})
    s.user = data
    return s


@pytest.fixture(scope="module")
def session_b():
    s = requests.Session()
    r = s.post(f"{API}/auth/anonymous", json={"display_name": "TEST_Bob"})
    assert r.status_code == 200, r.text
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['session_token']}"})
    s.user = data
    return s


@pytest.fixture(scope="module")
def circle(session_a):
    r = session_a.post(f"{API}/circles", json={"name": "TEST_Circle", "description": "for tests"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def book(session_a, circle):
    files = {"file": ("sample.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    data = {"title": "TEST_Book", "mode": "circle", "circle_id": circle["circle_id"]}
    r = session_a.post(f"{API}/books", files=files, data=data)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Auth ----------
class TestAuth:
    def test_anonymous_creates_user(self):
        r = requests.post(f"{API}/auth/anonymous", json={"display_name": "TEST_Tmp"})
        assert r.status_code == 200
        d = r.json()
        assert d["anonymous"] is True
        assert d["name"] == "TEST_Tmp"
        assert isinstance(d["session_token"], str) and len(d["session_token"]) > 10
        assert "session_token" in r.cookies or r.cookies.get("session_token")

    def test_me_with_bearer(self, session_a):
        r = session_a.get(f"{API}/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_Alice"
        assert d["anonymous"] is True

    def test_me_unauthorized(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout_clears_session(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/anonymous", json={"display_name": "TEST_Logout"})
        token = r.json()["session_token"]
        s.headers["Authorization"] = f"Bearer {token}"
        assert s.get(f"{API}/auth/me").status_code == 200
        r2 = s.post(f"{API}/auth/logout")
        assert r2.status_code == 200
        # token now invalid
        assert s.get(f"{API}/auth/me").status_code == 401


# ---------- Circles ----------
class TestCircles:
    def test_create_circle_adds_owner(self, session_a, circle):
        assert circle["name"] == "TEST_Circle"
        assert "circle_id" in circle

    def test_list_circles_returns_member_count_and_books(self, session_a, circle):
        r = session_a.get(f"{API}/circles")
        assert r.status_code == 200
        circles = r.json()
        found = next((c for c in circles if c["circle_id"] == circle["circle_id"]), None)
        assert found is not None
        assert found["member_count"] >= 1
        assert isinstance(found["books"], list)


# ---------- Books ----------
class TestBooks:
    def test_upload_rejects_non_pdf(self, session_a):
        files = {"file": ("foo.txt", io.BytesIO(b"hello"), "text/plain")}
        data = {"title": "TEST_Bad", "mode": "solo"}
        r = session_a.post(f"{API}/books", files=files, data=data)
        assert r.status_code == 400

    def test_upload_pdf_creates_book(self, book):
        assert book["title"] == "TEST_Book"
        assert book["file_id"].startswith("file_")
        assert book["book_id"].startswith("bk_")

    def test_serve_file(self, book):
        r = requests.get(f"{API}/files/{book['file_id']}")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")

    def test_get_book_with_progress(self, session_a, book):
        r = session_a.get(f"{API}/books/{book['book_id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["book_id"] == book["book_id"]
        assert "my_progress" in d


# ---------- Progress ----------
class TestProgress:
    def test_update_progress_persists_and_max_never_decreases(self, session_a, book):
        r = session_a.put(f"{API}/progress", json={
            "book_id": book["book_id"], "current_page": 5, "total_pages": 10,
        })
        assert r.status_code == 200
        assert r.json()["max_page_reached"] == 5

        # Now go back to page 2 — max_page_reached should stay at 5
        r2 = session_a.put(f"{API}/progress", json={
            "book_id": book["book_id"], "current_page": 2,
        })
        assert r2.status_code == 200
        d = r2.json()
        assert d["current_page"] == 2
        assert d["max_page_reached"] == 5

        # Verify via GET book
        rg = session_a.get(f"{API}/books/{book['book_id']}")
        assert rg.json()["my_progress"]["max_page_reached"] == 5


# ---------- Highlights / Unlocking ----------
class TestHighlights:
    def test_create_highlight_with_thought(self, session_a, book):
        r = session_a.post(f"{API}/highlights", json={
            "book_id": book["book_id"], "page": 3, "text": "Important line", "thought": "Wow",
        })
        assert r.status_code == 200
        assert r.json()["highlight_id"].startswith("hl_")

    def test_unlocking_filters_by_max_page(self, session_a, session_b, book, circle):
        # Bob joins via invite
        inv = session_a.post(f"{API}/circles/{circle['circle_id']}/invite").json()
        session_b.post(f"{API}/invites/{inv['code']}/join")

        # Bob's progress = 0, so no highlights visible even though Alice has one on page 3
        r = session_b.get(f"{API}/books/{book['book_id']}/highlights")
        assert r.status_code == 200
        assert r.json()["highlights"] == []

        # Bob creates a future highlight at page 8
        session_b.put(f"{API}/progress", json={
            "book_id": book["book_id"], "current_page": 8, "total_pages": 10,
        })
        rb = session_b.post(f"{API}/highlights", json={
            "book_id": book["book_id"], "page": 8, "text": "Bob's far highlight",
        })
        assert rb.status_code == 200

        # Alice currently has max_page 5, so she should see her hl@3 but NOT Bob's hl@8
        ra = session_a.get(f"{API}/books/{book['book_id']}/highlights")
        pages = [h["page"] for h in ra.json()["highlights"]]
        assert 3 in pages
        assert 8 not in pages
        assert ra.json()["max_page_reached"] == 5

    def test_locked_count(self, session_a, book):
        r = session_a.get(f"{API}/books/{book['book_id']}/locked-count")
        assert r.status_code == 200
        assert r.json()["locked"] >= 1  # Bob's hl@8 locked from Alice


# ---------- Threads ----------
class TestThreads:
    def test_create_and_list_thread(self, session_a, book):
        hl = session_a.post(f"{API}/highlights", json={
            "book_id": book["book_id"], "page": 1, "text": "anchor",
        }).json()
        r = session_a.post(f"{API}/highlights/{hl['highlight_id']}/threads", json={"text": "Reply 1"})
        assert r.status_code == 200
        rl = session_a.get(f"{API}/highlights/{hl['highlight_id']}/threads")
        assert rl.status_code == 200
        replies = rl.json()
        assert len(replies) == 1
        assert replies[0]["text"] == "Reply 1"


# ---------- Vocabulary ----------
class TestVocab:
    def test_add_and_list(self, session_a, book):
        r = session_a.post(f"{API}/vocabulary", json={
            "book_id": book["book_id"], "word": "TEST_serendipity", "meaning": "happy chance", "page": 1,
        })
        assert r.status_code == 200
        rl = session_a.get(f"{API}/vocabulary")
        assert rl.status_code == 200
        words = [v["word"] for v in rl.json()]
        assert "TEST_serendipity" in words


# ---------- Invites ----------
class TestInvites:
    def test_invite_flow(self, session_a, session_b, circle):
        r = session_a.post(f"{API}/circles/{circle['circle_id']}/invite")
        assert r.status_code == 200
        code = r.json()["code"]

        # public GET (no auth needed)
        rg = requests.get(f"{API}/invites/{code}")
        assert rg.status_code == 200
        assert rg.json()["circle"]["circle_id"] == circle["circle_id"]

        # join twice idempotent
        rj = session_b.post(f"{API}/invites/{code}/join")
        assert rj.status_code == 200
        assert rj.json()["circle_id"] == circle["circle_id"]
        rj2 = session_b.post(f"{API}/invites/{code}/join")
        assert rj2.status_code == 200


# ---------- Turns / Personal / Saved ----------
class TestFeeds:
    def test_turns_returns_sections_with_unlocked_activity(self, session_a, circle, book):
        r = session_a.get(f"{API}/turns")
        assert r.status_code == 200
        data = r.json()
        section = next((s for s in data if s["circle"]["circle_id"] == circle["circle_id"]), None)
        assert section is not None
        assert "members" in section and "activity" in section and "books" in section
        # Activity should be filtered by max_page (Alice=5). No page 8 entries.
        pages = [a["page"] for a in section["activity"]]
        assert all(p <= 5 for p in pages)

    def test_my_thoughts(self, session_a):
        r = session_a.get(f"{API}/my-thoughts")
        assert r.status_code == 200
        rows = r.json()
        # Alice created highlights at pages 3 and 1
        assert len(rows) >= 2

    def test_saved_insights_excludes_self(self, session_a, book):
        # Push Alice further so Bob's hl@8 becomes unlocked
        session_a.put(f"{API}/progress", json={
            "book_id": book["book_id"], "current_page": 9, "total_pages": 10,
        })
        r = session_a.get(f"{API}/saved-insights")
        assert r.status_code == 200
        groups = r.json()
        matching = next((g for g in groups if g["book"]["book_id"] == book["book_id"]), None)
        assert matching is not None
        # Should contain Bob's hl@8 but not Alice's own
        user_ids = {h["user_id"] for h in matching["highlights"]}
        assert session_a.user["user_id"] not in user_ids
