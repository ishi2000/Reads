# Auth Testing Playbook (Cosift)

Cosift uses Emergent OAuth (Google) for full users, plus anonymous sessions for invite-link joiners.

## Step 1 — Create Test User & Session

```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: '',
  anonymous: false,
  created_at: new Date().toISOString()
});
db.sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2 — Test Backend API

```bash
API="https://circle-reads.preview.emergentagent.com"

# Test /auth/me via Bearer
curl -X GET "$API/api/auth/me" -H "Authorization: Bearer <token>"

# Or via cookie jar after anonymous join
curl -s -c /tmp/c.txt -X POST "$API/api/auth/anonymous" \
  -H "Content-Type: application/json" -d '{"display_name":"Tester"}'
curl -s -b /tmp/c.txt "$API/api/auth/me"

# Create a circle
curl -s -b /tmp/c.txt -X POST "$API/api/circles" \
  -H "Content-Type: application/json" -d '{"name":"Test Circle"}'
```

## Step 3 — Browser Testing

```python
await page.context.add_cookies([{
    "name": "session_token",
    "value": "<TOKEN>",
    "domain": "circle-reads.preview.emergentagent.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}])
# Or set localStorage fallback:
await page.goto("https://circle-reads.preview.emergentagent.com/")
await page.evaluate("localStorage.setItem('cosift_token', '<TOKEN>')")
await page.reload()
```

## Checklist
- User document has `user_id` (UUID-string).
- Session document `user_id` matches user's `user_id` exactly.
- All MongoDB queries use `{"_id": 0}` projection.
- `/api/auth/me` returns user data when token valid.

## Success Indicators
- /api/auth/me returns user JSON (not 401).
- Visiting /app/reads loads the Reads tab (not redirect to /).
- CRUD endpoints accept the token.
